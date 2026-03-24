import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockUpsert, mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockUpsert: vi.fn().mockResolvedValue({ error: null }),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

import { migrateLocalDataToServer } from "@/lib/migrateLocalData";
import { createMockMeal, createMockTemplate, seedMeals } from "@/test/helpers";

describe("migrateLocalData", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc" } },
    });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips if migrationComplete flag is already set", async () => {
    localStorage.setItem("migrationComplete", "true");
    await migrateLocalDataToServer();

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("skips if no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await migrateLocalDataToServer();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uploads meals to the meals table", async () => {
    const meals = [createMockMeal({ id: "m1", description: "Eggs" })];
    seedMeals(meals);

    await migrateLocalDataToServer();

    expect(mockFrom).toHaveBeenCalledWith("meals");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: "user-abc",
          client_id: "m1",
        }),
      ]),
      expect.objectContaining({ onConflict: "user_id,client_id" })
    );
  });

  it("uploads templates to meal_templates table", async () => {
    const templates = [createMockTemplate({ id: "tpl-1" })];
    localStorage.setItem("mealTemplates", JSON.stringify(templates));

    await migrateLocalDataToServer();

    expect(mockFrom).toHaveBeenCalledWith("meal_templates");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: "user-abc",
          client_id: "tpl-1",
        }),
      ]),
      expect.objectContaining({ onConflict: "user_id,client_id" })
    );
  });

  it("uploads profile to user_profiles table", async () => {
    localStorage.setItem(
      "nutrition-profile",
      JSON.stringify({ name: "Alice", calorieGoal: "1800" })
    );

    await migrateLocalDataToServer();

    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-abc",
        name: "Alice",
      }),
      expect.objectContaining({ onConflict: "user_id" })
    );
  });

  it("uploads preferences to user_preferences table", async () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("personalization-completed", "true");

    await migrateLocalDataToServer();

    expect(mockFrom).toHaveBeenCalledWith("user_preferences");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-abc",
        theme: "dark",
        personalization_completed: true,
      }),
      expect.objectContaining({ onConflict: "user_id" })
    );
  });

  it("sets migrationComplete flag on success", async () => {
    await migrateLocalDataToServer();
    expect(localStorage.getItem("migrationComplete")).toBe("true");
  });

  it("handles empty data gracefully", async () => {
    await expect(migrateLocalDataToServer()).resolves.not.toThrow();
    expect(localStorage.getItem("migrationComplete")).toBe("true");
  });
});
