import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
  },
  supabaseConfigured: false,
}));

import { analyzeText } from "@/lib/analyzeText";

describe("analyzeText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("demo mode", () => {
    it('returns ~78 cal for "egg" input', async () => {
      const promise = analyzeText("egg");
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.calories).toBe(78);
      expect(result.protein).toBe(6);
      expect(result.confidence).toBe(0.6);
      expect(result.description).toBe("egg");
    });

    it("returns random values for unknown input", async () => {
      const promise = analyzeText("xyzfoodunknown");
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.calories).toBeGreaterThanOrEqual(300);
      expect(result.calories).toBeLessThan(500);
      expect(result.confidence).toBe(0.3);
    });

    it("sums macros for multiple keyword matches", async () => {
      const promise = analyzeText("egg toast coffee");
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.calories).toBe(78 + 120 + 5);
      expect(result.protein).toBe(6 + 4 + 0);
    });
  });

  describe("production mode", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("sends JSON body with description and mealLabel", async () => {
      vi.doMock("@/lib/supabaseClient", () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: { session: { access_token: "tok" } },
            }),
          },
        },
        supabaseConfigured: true,
      }));

      const mockResult = {
        description: "2 eggs",
        calories: 156,
        protein: 12,
        carbs: 2,
        fat: 10,
        confidence: 0.9,
        items: [{ name: "egg", quantity: 2 }],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockResult), { status: 200 })
      );

      const { analyzeText: prodAnalyzeText } = await import(
        "@/lib/analyzeText"
      );

      vi.useRealTimers();
      const result = await prodAnalyzeText("2 eggs", "Breakfast");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain("/functions/v1/analyze-text");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual(
        expect.objectContaining({ "Content-Type": "application/json" })
      );

      const body = JSON.parse(init?.body as string);
      expect(body.description).toBe("2 eggs");
      expect(body.mealLabel).toBe("Breakfast");

      expect(result.calories).toBe(156);
      fetchSpy.mockRestore();
    });

    it("throws when response is not ok", async () => {
      vi.doMock("@/lib/supabaseClient", () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: { session: { access_token: "tok" } },
            }),
          },
        },
        supabaseConfigured: true,
      }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Service down" }), { status: 500 })
      );

      const { analyzeText: failAnalyze } = await import("@/lib/analyzeText");
      vi.useRealTimers();

      await expect(failAnalyze("pasta")).rejects.toThrow("Service down");
      vi.mocked(globalThis.fetch).mockRestore();
    });

    it("throws when user is not authenticated", async () => {
      vi.doMock("@/lib/supabaseClient", () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: { session: null },
            }),
          },
        },
        supabaseConfigured: true,
      }));

      const { analyzeText: unauthAnalyze } = await import(
        "@/lib/analyzeText"
      );
      vi.useRealTimers();

      await expect(unauthAnalyze("food")).rejects.toThrow(
        /not authenticated/i
      );
    });
  });
});
