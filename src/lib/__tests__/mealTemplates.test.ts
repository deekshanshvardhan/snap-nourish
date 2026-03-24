import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

const mockGetMeals = vi.fn(() => [] as any[]);
const mockGetStoredTemplates = vi.fn(() => [] as any[]);
const mockSaveStoredTemplates = vi.fn();
const mockGetDismissedPrompts = vi.fn(() => [] as string[]);
const mockSaveDismissedPrompts = vi.fn();

vi.mock("@/lib/storage", () => ({
  getMeals: (...args: any[]) => mockGetMeals(...args),
  getStoredTemplates: (...args: any[]) => mockGetStoredTemplates(...args),
  saveStoredTemplates: (...args: any[]) => mockSaveStoredTemplates(...args),
  getDismissedPrompts: (...args: any[]) => mockGetDismissedPrompts(...args),
  saveDismissedPrompts: (...args: any[]) => mockSaveDismissedPrompts(...args),
}));

import {
  detectTemplateCandidates,
  createTemplateFromMeal,
  saveTemplate,
  dismissTemplatePrompt,
  removeTemplate,
  getTemplates,
  getCurrentTimeSuggestionLabel,
  getTimeSuggestedTemplates,
  getFrequentTemplates,
  getFrequentMealsFromHistory,
} from "@/lib/mealTemplates";
import { createMockMeal, createMockTemplate } from "@/test/helpers";

describe("mealTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectTemplateCandidates", () => {
    it("returns meal logged 3+ times with same description", () => {
      const meals = [
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
      ];
      mockGetMeals.mockReturnValue(meals);
      mockGetStoredTemplates.mockReturnValue([]);
      mockGetDismissedPrompts.mockReturnValue([]);

      const candidate = detectTemplateCandidates();
      expect(candidate).toBeTruthy();
      expect(candidate!.description).toBe("Oatmeal");
    });

    it("returns null when meals are logged fewer than 3 times", () => {
      mockGetMeals.mockReturnValue([
        createMockMeal({ description: "Eggs" }),
        createMockMeal({ description: "Eggs" }),
      ]);
      mockGetStoredTemplates.mockReturnValue([]);
      mockGetDismissedPrompts.mockReturnValue([]);

      expect(detectTemplateCandidates()).toBeNull();
    });

    it("skips meals with description 'Photo meal'", () => {
      mockGetMeals.mockReturnValue([
        createMockMeal({ description: "Photo meal" }),
        createMockMeal({ description: "Photo meal" }),
        createMockMeal({ description: "Photo meal" }),
      ]);
      mockGetStoredTemplates.mockReturnValue([]);
      mockGetDismissedPrompts.mockReturnValue([]);

      expect(detectTemplateCandidates()).toBeNull();
    });

    it("skips already-saved templates", () => {
      mockGetMeals.mockReturnValue([
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
      ]);
      mockGetStoredTemplates.mockReturnValue([
        createMockTemplate({ name: "oatmeal" }),
      ]);
      mockGetDismissedPrompts.mockReturnValue([]);

      expect(detectTemplateCandidates()).toBeNull();
    });

    it("skips dismissed descriptions", () => {
      mockGetMeals.mockReturnValue([
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
      ]);
      mockGetStoredTemplates.mockReturnValue([]);
      mockGetDismissedPrompts.mockReturnValue(["oatmeal"]);

      expect(detectTemplateCandidates()).toBeNull();
    });
  });

  describe("createTemplateFromMeal", () => {
    it("creates a valid MealTemplate with correct mealTiming", () => {
      const d = new Date(2024, 5, 15, 8, 30, 0);
      const meal = createMockMeal({
        timestamp: d.toISOString(),
        calories: 300,
        protein: 20,
        carbs: 30,
        fat: 10,
      });

      const tpl = createTemplateFromMeal(meal, "Morning Oats");
      expect(tpl.name).toBe("Morning Oats");
      expect(tpl.calories).toBe(300);
      expect(tpl.count).toBe(1);
      expect(tpl.mealTiming).toBe("breakfast");
      expect(tpl.id).toMatch(/^tpl_/);
    });

    it("sets lunch timing for noon meals", () => {
      const d = new Date(2024, 5, 15, 12, 30, 0);
      const meal = createMockMeal({ timestamp: d.toISOString() });
      const tpl = createTemplateFromMeal(meal, "Lunch bowl");
      expect(tpl.mealTiming).toBe("lunch");
    });

    it("sets dinner timing for evening meals", () => {
      const d = new Date(2024, 5, 15, 19, 0, 0);
      const meal = createMockMeal({ timestamp: d.toISOString() });
      const tpl = createTemplateFromMeal(meal, "Dinner plate");
      expect(tpl.mealTiming).toBe("dinner");
    });
  });

  describe("saveTemplate", () => {
    it("adds a new template to the list", () => {
      mockGetStoredTemplates.mockReturnValue([]);
      const tpl = createMockTemplate({ id: "tpl-new" });

      saveTemplate(tpl);

      expect(mockSaveStoredTemplates).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: "tpl-new" })])
      );
    });

    it("updates existing template by id", () => {
      const existing = createMockTemplate({ id: "tpl-exist", count: 1 });
      mockGetStoredTemplates.mockReturnValue([existing]);

      const updated = { ...existing, count: 5 };
      saveTemplate(updated);

      expect(mockSaveStoredTemplates).toHaveBeenCalledWith([
        expect.objectContaining({ id: "tpl-exist", count: 5 }),
      ]);
    });
  });

  describe("dismissTemplatePrompt", () => {
    it("adds normalized description to dismissed list", () => {
      mockGetDismissedPrompts.mockReturnValue([]);

      dismissTemplatePrompt("  Scrambled Eggs  ");

      expect(mockSaveDismissedPrompts).toHaveBeenCalledWith([
        "scrambled eggs",
      ]);
    });
  });

  describe("removeTemplate", () => {
    it("removes template by id and saves remaining", () => {
      const tplA = createMockTemplate({ id: "tpl-a", name: "A" });
      const tplB = createMockTemplate({ id: "tpl-b", name: "B" });
      mockGetStoredTemplates.mockReturnValue([tplA, tplB]);

      removeTemplate("tpl-a");

      expect(mockSaveStoredTemplates).toHaveBeenCalledWith([
        expect.objectContaining({ id: "tpl-b" }),
      ]);
    });
  });

  describe("getTemplates", () => {
    it("delegates to getStoredTemplates", () => {
      const templates = [createMockTemplate()];
      mockGetStoredTemplates.mockReturnValue(templates);
      expect(getTemplates()).toEqual(templates);
    });
  });

  describe("createTemplateFromMeal — snack timing", () => {
    it("sets snack timing for afternoon meals (15-17)", () => {
      const d = new Date(2024, 5, 15, 16, 0, 0);
      const meal = createMockMeal({ timestamp: d.toISOString() });
      const tpl = createTemplateFromMeal(meal, "Afternoon snack");
      expect(tpl.mealTiming).toBe("snack");
    });
  });

  describe("getCurrentTimeSuggestionLabel", () => {
    it("returns appropriate label for current hour", () => {
      const label = getCurrentTimeSuggestionLabel();
      expect(label).toMatch(
        /^Suggested for (Breakfast|Lunch|Snack|Dinner)$/
      );
    });
  });

  describe("getTimeSuggestedTemplates", () => {
    it("returns templates matching current timing sorted by count", () => {
      const hour = new Date().getHours();
      let expectedTiming: string;
      if (hour >= 5 && hour < 11) expectedTiming = "breakfast";
      else if (hour >= 11 && hour < 15) expectedTiming = "lunch";
      else if (hour >= 15 && hour < 17) expectedTiming = "snack";
      else expectedTiming = "dinner";

      const t1 = createMockTemplate({
        id: "t1",
        mealTiming: expectedTiming as any,
        count: 3,
      });
      const t2 = createMockTemplate({
        id: "t2",
        mealTiming: expectedTiming as any,
        count: 7,
      });
      const t3 = createMockTemplate({
        id: "t3",
        mealTiming: "snack",
        count: 10,
      });
      mockGetStoredTemplates.mockReturnValue([t1, t2, t3]);

      const results = getTimeSuggestedTemplates();
      const resultIds = results.map((r) => r.id);

      if (expectedTiming === "snack") {
        expect(resultIds).toContain("t3");
      } else {
        expect(resultIds).not.toContain("t3");
      }
    });
  });

  describe("getFrequentTemplates", () => {
    it("returns top 6 templates sorted by count", () => {
      const templates = Array.from({ length: 8 }, (_, i) =>
        createMockTemplate({ id: `tpl-${i}`, count: i })
      );
      mockGetStoredTemplates.mockReturnValue(templates);

      const result = getFrequentTemplates();
      expect(result).toHaveLength(6);
      expect(result[0].count).toBe(7);
      expect(result[5].count).toBe(2);
    });
  });

  describe("getFrequentMealsFromHistory", () => {
    it("returns top 6 unique meals by frequency", () => {
      const meals = [
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Oatmeal" }),
        createMockMeal({ description: "Rice" }),
        createMockMeal({ description: "Rice" }),
        createMockMeal({ description: "Eggs" }),
      ];
      mockGetMeals.mockReturnValue(meals);

      const result = getFrequentMealsFromHistory();
      expect(result[0].description).toBe("Oatmeal");
      expect(result[1].description).toBe("Rice");
      expect(result).toHaveLength(3);
    });

    it("skips 'Photo meal' entries", () => {
      const meals = [
        createMockMeal({ description: "Photo meal" }),
        createMockMeal({ description: "Photo meal" }),
        createMockMeal({ description: "Photo meal" }),
        createMockMeal({ description: "Salad" }),
      ];
      mockGetMeals.mockReturnValue(meals);

      const result = getFrequentMealsFromHistory();
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe("Salad");
    });
  });
});
