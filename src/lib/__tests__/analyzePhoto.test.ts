import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
  },
  supabaseConfigured: false,
}));

vi.mock("@/lib/imagePreprocess", () => ({
  preprocessImage: vi.fn(async (file: Blob) => file),
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn(), flush: vi.fn(), init: vi.fn() },
}));

import { analyzePhoto, type PhotoAnalysisResult } from "@/lib/analyzePhoto";

describe("analyzePhoto", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("demo mode (supabaseConfigured = false)", () => {
    it("returns a valid PhotoAnalysisResult after a delay", async () => {
      const blob = new Blob(["image-data"], { type: "image/jpeg" });
      const promise = analyzePhoto(blob, "Breakfast");

      await vi.advanceTimersByTimeAsync(1500);
      const result = await promise;

      expect(result.description).toBeTruthy();
      expect(result.calories).toBeGreaterThan(0);
      expect(result.protein).toBeGreaterThanOrEqual(0);
      expect(result.carbs).toBeGreaterThanOrEqual(0);
      expect(result.fat).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBe(0.85);
      expect(result.items).toHaveLength(1);
      expect(result.photoUrl).toBeDefined();
    });
  });

  describe("production mode", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("sends FormData with image and mealLabel to Edge Function", async () => {
      vi.doMock("@/lib/supabaseClient", () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: {
                session: { access_token: "tok-123" },
              },
            }),
          },
        },
        supabaseConfigured: true,
      }));

      vi.doMock("@/lib/imagePreprocess", () => ({
        preprocessImage: vi.fn(async (f: Blob) => f),
      }));

      const mockResponse: PhotoAnalysisResult = {
        description: "Pizza slice",
        calories: 280,
        protein: 12,
        carbs: 34,
        fat: 10,
        confidence: 0.9,
        items: [{ name: "Pizza", quantity: 1 }],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const { analyzePhoto: prodAnalyzePhoto } = await import(
        "@/lib/analyzePhoto"
      );

      vi.useRealTimers();
      const result = await prodAnalyzePhoto(new Blob(["data"]), "Lunch");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain("/functions/v1/analyze-photo");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);

      const fd = init?.body as FormData;
      expect(fd.get("image")).toBeTruthy();
      expect(fd.get("mealLabel")).toBe("Lunch");

      expect(result.description).toBe("Pizza slice");
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

      vi.doMock("@/lib/imagePreprocess", () => ({
        preprocessImage: vi.fn(async (f: Blob) => f),
      }));

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
        })
      );

      const { analyzePhoto: failAnalyze } = await import(
        "@/lib/analyzePhoto"
      );

      vi.useRealTimers();
      await expect(failAnalyze(new Blob(["data"]), "Dinner")).rejects.toThrow(
        "Rate limited"
      );

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

      vi.doMock("@/lib/imagePreprocess", () => ({
        preprocessImage: vi.fn(async (f: Blob) => f),
      }));

      const { analyzePhoto: unauthAnalyze } = await import(
        "@/lib/analyzePhoto"
      );

      vi.useRealTimers();
      await expect(unauthAnalyze(new Blob(["data"]))).rejects.toThrow(
        /not authenticated/i
      );
    });
  });
});
