import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

import {
  getMeals,
  saveMeals,
  saveMealsLocal,
  getStoredTemplates,
  saveStoredTemplates,
  saveStoredTemplatesLocal,
  getDismissedPrompts,
  saveDismissedPrompts,
  getProfile,
  saveProfile,
  getAuthUser,
  saveAuthUser,
  getPinnedMeals,
  savePinnedMeals,
  getFlag,
  setFlag,
  removeFlag,
} from "@/lib/storage";
import { syncEngine } from "@/lib/syncEngine";
import { createMockMeal, createMockTemplate, seedAuthUser } from "@/test/helpers";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(syncEngine.enqueue).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("readJSON / getMeals", () => {
    it("returns empty array when localStorage has no meals", () => {
      expect(getMeals()).toEqual([]);
    });

    it("returns fallback on corrupt JSON", () => {
      localStorage.setItem("meals", "{{not json}");
      expect(getMeals()).toEqual([]);
    });

    it("round-trips meals correctly", () => {
      const meals = [createMockMeal({ description: "Eggs" })];
      saveMealsLocal(meals);
      expect(getMeals()).toEqual(meals);
    });
  });

  describe("saveMeals — sync enqueue logic", () => {
    it("skips sync when no userId is set", () => {
      const meal = createMockMeal();
      saveMeals([meal]);
      expect(syncEngine.enqueue).not.toHaveBeenCalled();
    });

    it("enqueues INSERT for a new meal", () => {
      seedAuthUser();
      const meal = createMockMeal();
      saveMeals([meal]);

      expect(syncEngine.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "meals",
          action: "INSERT",
          payload: expect.objectContaining({
            client_id: meal.id,
            user_id: "user-123",
          }),
        })
      );
    });

    it("enqueues DELETE when a meal is removed", () => {
      seedAuthUser();
      const meal = createMockMeal();
      saveMealsLocal([meal]);

      saveMeals([]);

      expect(syncEngine.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "meals",
          action: "DELETE",
          payload: { id: meal.id },
        })
      );
    });

    it("enqueues UPDATE when a meal's data changes", () => {
      seedAuthUser();
      const meal = createMockMeal({ description: "Old" });
      saveMealsLocal([meal]);

      const updated = { ...meal, description: "New" };
      saveMeals([updated]);

      expect(syncEngine.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "meals",
          action: "UPDATE",
          payload: expect.objectContaining({ id: meal.id }),
        })
      );
    });

    it("does not enqueue UPDATE when meal data is unchanged", () => {
      seedAuthUser();
      const meal = createMockMeal();
      saveMealsLocal([meal]);

      saveMeals([meal]);

      const updateCalls = vi.mocked(syncEngine.enqueue).mock.calls.filter(
        ([op]) => op.action === "UPDATE"
      );
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe("saveStoredTemplates — sync enqueue logic", () => {
    it("enqueues INSERT for new template", () => {
      seedAuthUser();
      const tpl = createMockTemplate();
      saveStoredTemplates([tpl]);

      expect(syncEngine.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "meal_templates",
          action: "INSERT",
          payload: expect.objectContaining({ client_id: tpl.id }),
        })
      );
    });

    it("enqueues DELETE for removed template", () => {
      seedAuthUser();
      const tpl = createMockTemplate();
      saveStoredTemplatesLocal([tpl]);

      saveStoredTemplates([]);

      expect(syncEngine.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "meal_templates",
          action: "DELETE",
          payload: { id: tpl.id },
        })
      );
    });
  });

  describe("saveProfile", () => {
    it("writes profile to localStorage and sets personalization flag", () => {
      const profile = { name: "Alice", calorieGoal: "1800" };
      saveProfile(profile);

      expect(getProfile()).toEqual(profile);
      expect(localStorage.getItem("personalization-completed")).toBe("true");
    });

    it("enqueues UPDATE to user_profiles when user is logged in", () => {
      seedAuthUser();
      saveProfile({ name: "Alice" });

      expect(syncEngine.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          table: "user_profiles",
          action: "UPDATE",
          payload: expect.objectContaining({
            user_id: "user-123",
            name: "Alice",
          }),
        })
      );
    });

    it("skips sync enqueue when no user is logged in", () => {
      saveProfile({ name: "Alice" });
      expect(syncEngine.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("getFlag / setFlag / removeFlag", () => {
    it("returns null for unset flag", () => {
      expect(getFlag("onboarded")).toBeNull();
    });

    it("sets and reads a flag", () => {
      setFlag("onboarded", "true");
      expect(getFlag("onboarded")).toBe("true");
    });

    it("removes a flag", () => {
      setFlag("theme", "dark");
      removeFlag("theme");
      expect(getFlag("theme")).toBeNull();
    });
  });

  describe("dismissed prompts", () => {
    it("returns empty array by default", () => {
      expect(getDismissedPrompts()).toEqual([]);
    });

    it("round-trips dismissed prompts", () => {
      saveDismissedPrompts(["eggs", "toast"]);
      expect(getDismissedPrompts()).toEqual(["eggs", "toast"]);
    });
  });

  describe("auth user", () => {
    it("returns empty object when not set", () => {
      expect(getAuthUser()).toEqual({});
    });

    it("round-trips auth user", () => {
      const user = { id: "abc", name: "Test", provider: "google" };
      saveAuthUser(user);
      expect(getAuthUser()).toEqual(user);
    });
  });

  describe("pinned meals", () => {
    it("returns empty object by default", () => {
      expect(getPinnedMeals()).toEqual({});
    });

    it("round-trips pinned meals", () => {
      const pinned = { "2024-01-01": ["meal-1"] };
      savePinnedMeals(pinned);
      expect(getPinnedMeals()).toEqual(pinned);
    });
  });
});
