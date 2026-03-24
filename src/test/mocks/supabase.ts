import { vi } from "vitest";

function createQueryBuilder() {
  const builder: any = {
    _data: null as any,
    _error: null as any,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn(function (this: any, resolve: any) {
      return resolve({ data: this._data, error: this._error });
    }),
  };
  builder.then = vi.fn((resolve: any) =>
    resolve({ data: builder._data, error: builder._error })
  );
  Object.defineProperty(builder, Symbol.toStringTag, { value: "Promise" });
  return builder;
}

export function createMockSupabaseClient() {
  const queryBuilder = createQueryBuilder();

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(() => queryBuilder),
    _queryBuilder: queryBuilder,
  };
}

export const mockSupabase = createMockSupabaseClient();
