import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/storage", () => ({
  getMeals: vi.fn(() => []),
  saveMeals: vi.fn(),
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

import { inferMealLabel, roundApprox, updateMealInStorage } from "@/lib/mealUtils";
import { getMeals, saveMeals } from "@/lib/storage";
import { createMockMeal } from "@/test/helpers";

describe("inferMealLabel", () => {
  it("returns Breakfast for 5-10 hours", () => {
    expect(inferMealLabel("2024-01-15T07:30:00")).toBe("Breakfast");
    expect(inferMealLabel("2024-01-15T05:00:00")).toBe("Breakfast");
    expect(inferMealLabel("2024-01-15T10:59:00")).toBe("Breakfast");
  });

  it("returns Lunch for 11-15 hours", () => {
    expect(inferMealLabel("2024-01-15T12:00:00")).toBe("Lunch");
    expect(inferMealLabel("2024-01-15T11:00:00")).toBe("Lunch");
    expect(inferMealLabel("2024-01-15T15:59:00")).toBe("Lunch");
  });

  it("returns Dinner for 16-21 hours", () => {
    expect(inferMealLabel("2024-01-15T19:00:00")).toBe("Dinner");
    expect(inferMealLabel("2024-01-15T16:00:00")).toBe("Dinner");
    expect(inferMealLabel("2024-01-15T21:59:00")).toBe("Dinner");
  });

  it("returns Snack for late night / early morning", () => {
    expect(inferMealLabel("2024-01-15T03:00:00")).toBe("Snack");
    expect(inferMealLabel("2024-01-15T23:30:00")).toBe("Snack");
    expect(inferMealLabel("2024-01-15T04:59:00")).toBe("Snack");
  });
});

describe("roundApprox", () => {
  it("rounds 147 to 150 (step=10)", () => {
    expect(roundApprox(147)).toBe(150);
  });

  it("rounds 143 to 140 (step=10)", () => {
    expect(roundApprox(143)).toBe(140);
  });

  it("rounds with custom step", () => {
    expect(roundApprox(5, 1)).toBe(5);
    expect(roundApprox(7, 5)).toBe(5);
    expect(roundApprox(8, 5)).toBe(10);
  });

  it("handles zero", () => {
    expect(roundApprox(0)).toBe(0);
  });
});

describe("updateMealInStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds and replaces the correct meal", () => {
    const meal1 = createMockMeal({ id: "m1", description: "Eggs" });
    const meal2 = createMockMeal({ id: "m2", description: "Toast" });
    vi.mocked(getMeals).mockReturnValue([meal1, meal2]);

    const updated = { ...meal1, description: "Scrambled eggs" };
    updateMealInStorage(updated);

    expect(saveMeals).toHaveBeenCalledWith([
      expect.objectContaining({ id: "m1", description: "Scrambled eggs" }),
      expect.objectContaining({ id: "m2", description: "Toast" }),
    ]);
  });

  it("does nothing if meal is not found", () => {
    vi.mocked(getMeals).mockReturnValue([]);

    const meal = createMockMeal({ id: "nonexistent" });
    updateMealInStorage(meal);

    expect(saveMeals).not.toHaveBeenCalled();
  });
});
