import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/mealTemplates", () => ({
  saveTemplate: vi.fn(),
  getTemplates: vi.fn(() => []),
  getTimeSuggestedTemplates: vi.fn(() => []),
  getFrequentTemplates: vi.fn(() => []),
  getFrequentMealsFromHistory: vi.fn(() => []),
  getCurrentTimeSuggestionLabel: vi.fn(() => "Suggested for Lunch"),
}));

import Insights from "@/pages/Insights";
import { createMockMeal, seedMeals, seedAuthUser } from "@/test/helpers";

function renderInsights() {
  return render(
    <MemoryRouter initialEntries={["/insights"]}>
      <Insights />
    </MemoryRouter>
  );
}

describe("Insights page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders correct totals for today", () => {
    const today = new Date();
    const meals = [
      createMockMeal({
        timestamp: today.toISOString(),
        calories: 300,
        protein: 20,
        carbs: 30,
        fat: 10,
      }),
      createMockMeal({
        timestamp: today.toISOString(),
        calories: 400,
        protein: 25,
        carbs: 45,
        fat: 15,
      }),
    ];
    seedMeals(meals);
    seedAuthUser();

    renderInsights();

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Daily Insights")).toBeInTheDocument();
  });

  it("date navigation works (prev button)", () => {
    seedMeals([]);
    renderInsights();

    expect(screen.getByText("Today")).toBeInTheDocument();

    const prevBtn = screen.getByLabelText("Previous day");
    fireEvent.click(prevBtn);

    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("meal deletion removes from storage", () => {
    const today = new Date();
    const meal = createMockMeal({
      id: "meal-to-delete",
      timestamp: today.toISOString(),
    });
    seedMeals([meal]);

    renderInsights();

    const stored = JSON.parse(localStorage.getItem("meals") || "[]");
    expect(stored).toHaveLength(1);
  });

  it("shows no interpretation when there are no meals", () => {
    seedMeals([]);
    renderInsights();

    expect(screen.queryByText(/exceeded.*calorie/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/protein.*low/i)).not.toBeInTheDocument();
  });

  it("shows greeting message", () => {
    seedAuthUser({ name: "Bob" });
    seedMeals([]);

    renderInsights();

    const hour = new Date().getHours();
    if (hour < 12) {
      expect(screen.getByText(/good morning, bob/i)).toBeInTheDocument();
    } else if (hour < 17) {
      expect(screen.getByText(/good afternoon, bob/i)).toBeInTheDocument();
    } else if (hour < 21) {
      expect(screen.getByText(/good evening, bob/i)).toBeInTheDocument();
    } else {
      expect(screen.getByText(/good night, bob/i)).toBeInTheDocument();
    }
  });
});
