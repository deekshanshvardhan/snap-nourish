import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createElement, type ReactElement } from "react";
import type { Meal } from "@/lib/mealUtils";
import type { MealTemplate } from "@/lib/mealTemplates";

export function renderWithRouter(ui: ReactElement, initialEntries = ["/"]) {
  return render(
    createElement(
      TooltipProvider,
      null,
      createElement(MemoryRouter, { initialEntries }, ui)
    )
  );
}

let mealCounter = 0;

export function createMockMeal(overrides: Partial<Meal> = {}): Meal {
  mealCounter++;
  return {
    id: `meal-${mealCounter}-${Date.now()}`,
    type: "text",
    timestamp: new Date().toISOString(),
    description: "Test meal",
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 15,
    ...overrides,
  };
}

let templateCounter = 0;

export function createMockTemplate(
  overrides: Partial<MealTemplate> = {}
): MealTemplate {
  templateCounter++;
  return {
    id: `tpl-${templateCounter}-${Date.now()}`,
    name: "Test Template",
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 15,
    count: 1,
    lastLogged: new Date().toISOString(),
    mealTiming: "lunch",
    ...overrides,
  };
}

export function seedMeals(meals: Meal[]) {
  localStorage.setItem("meals", JSON.stringify(meals));
}

export function seedAuthUser(
  overrides: Record<string, unknown> = {}
) {
  const user = {
    id: "user-123",
    provider: "google",
    name: "Test User",
    loggedIn: true,
    ...overrides,
  };
  localStorage.setItem("auth-user", JSON.stringify(user));
  return user;
}
