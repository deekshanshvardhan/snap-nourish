import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncQueueDB extends DBSchema {
  operations: {
    key: string;
    value: SyncOperation;
    indexes: { 'by-created': string };
  };
  checkpoints: {
    key: string;
    value: { table: string; lastSyncedAt: string };
  };
}

interface SyncOperation {
  id: string;
  table: 'meals' | 'meal_templates' | 'user_profiles' | 'user_preferences';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

interface DbMeal {
  id: string;
  client_id: string | null;
  type: string;
  timestamp: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photo_url: string | null;
  meal_label: string | null;
  deleted_at: string | null;
  updated_at: string;
}

interface DbTemplate {
  id: string;
  client_id: string | null;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
  last_logged: string | null;
  meal_timing: string;
  deleted_at: string | null;
  updated_at: string;
}

function dbMealToFrontend(row: DbMeal) {
  return {
    id: row.client_id || row.id,
    type: row.type,
    timestamp: row.timestamp,
    description: row.description,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    photoUrl: row.photo_url ?? undefined,
    mealLabel: row.meal_label ?? undefined,
  };
}

function dbTemplateToFrontend(row: DbTemplate) {
  return {
    id: row.client_id || row.id,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    count: row.count,
    lastLogged: row.last_logged || new Date().toISOString(),
    mealTiming: row.meal_timing as 'breakfast' | 'lunch' | 'dinner' | 'snack',
  };
}

class SyncEngine {
  private db: IDBPDatabase<SyncQueueDB> | null = null;
  private isSyncing = false;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    this.db = await openDB<SyncQueueDB>('snap-nourish-sync', 1, {
      upgrade(db) {
        const store = db.createObjectStore('operations', { keyPath: 'id' });
        store.createIndex('by-created', 'createdAt');
        db.createObjectStore('checkpoints', { keyPath: 'table' });
      },
    });

    window.addEventListener('online', () => this.flush());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.flush();
      }
    });

    setInterval(() => {
      if (navigator.onLine) this.flush();
    }, 5 * 60 * 1000);

    this.initialized = true;

    if (navigator.onLine) this.flush();
  }

  async enqueue(op: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount'>) {
    if (!this.db) await this.init();

    const operation: SyncOperation = {
      ...op,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await this.db!.put('operations', operation);

    if (navigator.onLine) {
      this.flush();
    }
  }

  async flush() {
    if (this.isSyncing || !this.db) return;
    this.isSyncing = true;

    try {
      const ops = await this.db.getAllFromIndex('operations', 'by-created');
      for (const op of ops) {
        try {
          await this.executeRemote(op);
          await this.db.delete('operations', op.id);
        } catch (err: any) {
          const status = err?.status || 500;
          if (status === 409) {
            await this.db.delete('operations', op.id);
          } else if (status >= 400 && status < 500 && status !== 429) {
            await this.db.delete('operations', op.id);
          } else {
            op.retryCount++;
            if (op.retryCount > 10) {
              await this.db.delete('operations', op.id);
            } else {
              await this.db.put('operations', op);
            }
          }
        }
      }

      await this.pullChanges();
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeRemote(op: SyncOperation) {
    const { supabase } = await import(/* @vite-ignore */ './supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    switch (op.action) {
      case 'INSERT': {
        const { error: insertErr } = await supabase.from(op.table).insert(op.payload);
        if (insertErr) {
          throw { status: insertErr.code === '23505' ? 409 : 500 };
        }
        break;
      }
      case 'UPDATE': {
        const { id, ...updatePayload } = op.payload as Record<string, unknown>;
        const { error: updateErr } = await supabase
          .from(op.table)
          .update(updatePayload)
          .eq('client_id', id as string);
        if (updateErr) throw { status: 500 };
        break;
      }
      case 'DELETE': {
        const { error: deleteErr } = await supabase
          .from(op.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('client_id', (op.payload as Record<string, unknown>).id as string);
        if (deleteErr) throw { status: 500 };
        break;
      }
    }
  }

  private async pullChanges() {
    const { supabase } = await import(/* @vite-ignore */ './supabaseClient');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    for (const table of ['meals', 'meal_templates'] as const) {
      const checkpoint = await this.db!.get('checkpoints', table);
      const since = checkpoint?.lastSyncedAt || '1970-01-01T00:00:00Z';

      const { data: rows } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true });

      if (rows && rows.length > 0) {
        this.applyServerChanges(table, rows);
        const lastUpdated = rows[rows.length - 1].updated_at;
        await this.db!.put('checkpoints', { table, lastSyncedAt: lastUpdated });
      }
    }

    window.dispatchEvent(new CustomEvent('snap-nourish:sync-complete'));
  }

  private async applyServerChanges(table: string, serverRows: any[]) {
    const storage = await import(/* @vite-ignore */ './storage');

    if (table === 'meals') {
      const localMeals = storage.getMeals();
      const localMap = new Map(localMeals.map((m: any) => [m.id, m]));

      for (const row of serverRows) {
        const clientId = row.client_id || row.id;
        if (row.deleted_at) {
          localMap.delete(clientId);
        } else {
          localMap.set(clientId, dbMealToFrontend(row as DbMeal));
        }
      }

      storage.saveMealsLocal(Array.from(localMap.values()));
    } else if (table === 'meal_templates') {
      const localTemplates = storage.getStoredTemplates();
      const localMap = new Map(localTemplates.map((t: any) => [t.id, t]));

      for (const row of serverRows) {
        const clientId = row.client_id || row.id;
        if (row.deleted_at) {
          localMap.delete(clientId);
        } else {
          localMap.set(clientId, dbTemplateToFrontend(row as DbTemplate));
        }
      }

      storage.saveStoredTemplatesLocal(Array.from(localMap.values()));
    }
  }
}

export const syncEngine = new SyncEngine();
