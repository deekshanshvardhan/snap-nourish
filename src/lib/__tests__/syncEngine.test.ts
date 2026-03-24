import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openDB } from "idb";

const {
  mockGetSession,
  mockFrom,
  mockInsert,
  mockUpdate,
  mockEq,
  mockGt,
  mockOrder,
  mockSelect,
  mockGetMeals,
  mockSaveMealsLocal,
  mockGetStoredTemplates,
  mockSaveStoredTemplatesLocal,
} = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockGt = vi.fn();
  const mockOrder = vi.fn();

  return {
    mockGetSession: vi.fn(),
    mockFrom: vi.fn(),
    mockInsert,
    mockUpdate,
    mockSelect,
    mockEq,
    mockGt,
    mockOrder,
    mockGetMeals: vi.fn(() => []),
    mockSaveMealsLocal: vi.fn(),
    mockGetStoredTemplates: vi.fn(() => []),
    mockSaveStoredTemplatesLocal: vi.fn(),
  };
});

function setupChainDefaults() {
  mockInsert.mockResolvedValue({ data: [], error: null });
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEq.mockResolvedValue({ data: [], error: null });

  mockFrom.mockImplementation(() => ({
    insert: mockInsert,
    update: (...args: any[]) => {
      mockUpdate(...args);
      return {
        eq: (...eqArgs: any[]) => {
          mockEq(...eqArgs);
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
    select: (...sArgs: any[]) => {
      mockSelect(...sArgs);
      return {
        gt: (...gtArgs: any[]) => {
          mockGt(...gtArgs);
          return {
            order: (...oArgs: any[]) => mockOrder(...oArgs),
          };
        },
      };
    },
  }));
}

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: (...a: any[]) => mockGetSession(...a) },
    from: (...a: any[]) => mockFrom(...a),
  },
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: { getSession: (...a: any[]) => mockGetSession(...a) },
    from: (...a: any[]) => mockFrom(...a),
  },
}));

vi.mock("@/lib/storage", () => ({
  getMeals: (...a: any[]) => mockGetMeals(...a),
  saveMealsLocal: (...a: any[]) => mockSaveMealsLocal(...a),
  getStoredTemplates: (...a: any[]) => mockGetStoredTemplates(...a),
  saveStoredTemplatesLocal: (...a: any[]) => mockSaveStoredTemplatesLocal(...a),
}));

vi.mock("../storage", () => ({
  getMeals: (...a: any[]) => mockGetMeals(...a),
  saveMealsLocal: (...a: any[]) => mockSaveMealsLocal(...a),
  getStoredTemplates: (...a: any[]) => mockGetStoredTemplates(...a),
  saveStoredTemplatesLocal: (...a: any[]) => mockSaveStoredTemplatesLocal(...a),
}));

import { syncEngine } from "@/lib/syncEngine";

const mockSession = {
  access_token: "test-token",
  user: { id: "user-123" },
};

describe("syncEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    setupChainDefaults();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setupChainDefaults();
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
  });

  describe("enqueue", () => {
    it("stores an operation in IndexedDB", async () => {
      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-enq-1" },
      });

      const db = await openDB("snap-nourish-sync", 1);
      const ops = await db.getAll("operations");
      const found = ops.find((op) => op.payload.client_id === "m-enq-1");
      expect(found).toBeDefined();
      expect(found!.action).toBe("INSERT");
      expect(found!.retryCount).toBe(0);
      db.close();
    });
  });

  describe("flush", () => {
    it("sends operations and removes them on success", async () => {
      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-flush-ok" },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockFrom).toHaveBeenCalledWith("meals");
      expect(mockInsert).toHaveBeenCalled();

      const db = await openDB("snap-nourish-sync", 1);
      const ops = await db.getAll("operations");
      const found = ops.find((op) => op.payload.client_id === "m-flush-ok");
      expect(found).toBeUndefined();
      db.close();
    });

    it("skips flush if no session", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-no-session-2" },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("removes operation on 409 conflict (dedup)", async () => {
      mockInsert.mockResolvedValue({
        data: null,
        error: { code: "23505" },
      });

      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-dedup-409" },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      const db = await openDB("snap-nourish-sync", 1);
      const ops = await db.getAll("operations");
      const found = ops.find((op) => op.payload.client_id === "m-dedup-409");
      expect(found).toBeUndefined();
      db.close();
    });
  });

  describe("flush — UPDATE and DELETE actions", () => {
    it("sends UPDATE with correct payload and eq filter", async () => {
      await syncEngine.enqueue({
        table: "meals",
        action: "UPDATE",
        payload: { id: "m-upd-1", description: "Updated meal", calories: 600 },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Updated meal", calories: 600 })
      );
      expect(mockEq).toHaveBeenCalledWith("client_id", "m-upd-1");
    });

    it("sends DELETE as soft-delete update with deleted_at", async () => {
      await syncEngine.enqueue({
        table: "meals",
        action: "DELETE",
        payload: { id: "m-del-1" },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(mockEq).toHaveBeenCalledWith("client_id", "m-del-1");
    });
  });

  describe("flush — error handling and retries", () => {
    it("removes operation on 4xx client error (not 409/429)", async () => {
      mockInsert.mockRejectedValue({ status: 400 });

      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-400" },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      const db = await openDB("snap-nourish-sync", 1);
      const ops = await db.getAll("operations");
      const found = ops.find((op) => op.payload.client_id === "m-400");
      expect(found).toBeUndefined();
      db.close();
    });

    it("retries on 500 server error and increments retryCount", async () => {
      mockInsert.mockRejectedValue({ status: 500 });

      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-500-retry" },
      });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      const db = await openDB("snap-nourish-sync", 1);
      const ops = await db.getAll("operations");
      const found = ops.find((op) => op.payload.client_id === "m-500-retry");
      expect(found).toBeDefined();
      expect(found!.retryCount).toBe(1);
      db.close();
    });

    it("removes operation after 10+ retries", async () => {
      mockInsert.mockRejectedValue({ status: 500 });

      await syncEngine.enqueue({
        table: "meals",
        action: "INSERT",
        payload: { client_id: "m-max-retry" },
      });

      // Manually set the retryCount to 10 in IDB
      const db = await openDB("snap-nourish-sync", 1);
      const ops = await db.getAll("operations");
      const op = ops.find((o) => o.payload.client_id === "m-max-retry");
      if (op) {
        op.retryCount = 10;
        await db.put("operations", op);
      }
      db.close();

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      const db2 = await openDB("snap-nourish-sync", 1);
      const ops2 = await db2.getAll("operations");
      const found = ops2.find((o) => o.payload.client_id === "m-max-retry");
      expect(found).toBeUndefined();
      db2.close();
    });
  });

  describe("pullChanges / applyServerChanges", () => {
    it("merges new server meals into localStorage", async () => {
      mockGetMeals.mockReturnValue([]);

      const serverRow = {
        id: "server-1",
        client_id: "c1",
        type: "photo",
        timestamp: "2024-01-01T12:00:00Z",
        description: "Server meal",
        calories: 500,
        protein: 30,
        carbs: 40,
        fat: 20,
        photo_url: null,
        meal_label: null,
        deleted_at: null,
        updated_at: "2024-06-01T00:00:00Z",
      };

      mockOrder
        .mockResolvedValueOnce({ data: [serverRow], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockFrom).toHaveBeenCalledWith("meals");
      expect(mockFrom).toHaveBeenCalledWith("meal_templates");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockSaveMealsLocal).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "c1", description: "Server meal" }),
        ])
      );
    });

    it("removes meals with deleted_at set", async () => {
      mockGetMeals.mockReturnValue([
        {
          id: "c2",
          type: "text",
          timestamp: "2024-01-01T08:00:00Z",
          description: "Local meal",
          calories: 200,
          protein: 10,
          carbs: 20,
          fat: 5,
        },
      ]);

      const deletedRow = {
        id: "server-2",
        client_id: "c2",
        type: "text",
        timestamp: "2024-01-01T08:00:00Z",
        description: "Local meal",
        calories: 200,
        protein: 10,
        carbs: 20,
        fat: 5,
        photo_url: null,
        meal_label: null,
        deleted_at: "2024-06-01T00:00:00Z",
        updated_at: "2024-06-01T00:00:00Z",
      };

      mockOrder
        .mockResolvedValueOnce({ data: [deletedRow], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockSaveMealsLocal).toHaveBeenCalledWith([]);
    });

    it("merges server templates into localStorage", async () => {
      mockGetStoredTemplates.mockReturnValue([]);

      const serverTemplate = {
        id: "tpl-server-1",
        client_id: "tpl-c1",
        name: "Morning Oats",
        calories: 300,
        protein: 10,
        carbs: 50,
        fat: 8,
        count: 5,
        last_logged: "2024-06-01T00:00:00Z",
        meal_timing: "breakfast",
        deleted_at: null,
        updated_at: "2024-06-01T00:00:00Z",
      };

      mockOrder
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [serverTemplate], error: null });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockSaveStoredTemplatesLocal).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "tpl-c1", name: "Morning Oats" }),
        ])
      );
    });

    it("skips pullChanges when no session", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      await syncEngine.flush();

      expect(mockSaveMealsLocal).not.toHaveBeenCalled();
    });
  });
});
