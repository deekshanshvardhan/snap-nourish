import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

import DailySummaryCard from "@/components/DailySummaryCard";
import { toast } from "sonner";

describe("DailySummaryCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders calorie and macro values", () => {
    render(
      <DailySummaryCard
        calories={1500}
        protein={80}
        carbs={180}
        fat={50}
      />
    );

    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Carbs")).toBeInTheDocument();
    expect(screen.getByText("Fat")).toBeInTheDocument();
    expect(screen.getByText(/of ~2000 kcal/)).toBeInTheDocument();
  });

  it("confetti triggers when calories >= goal", () => {
    render(
      <DailySummaryCard
        calories={2100}
        protein={100}
        carbs={200}
        fat={70}
        calorieGoal={2000}
      />
    );

    expect(toast).toHaveBeenCalledWith("Goal reached!", expect.any(Object));
  });

  it("confetti does not trigger when calories < goal", () => {
    render(
      <DailySummaryCard
        calories={1500}
        protein={80}
        carbs={180}
        fat={50}
        calorieGoal={2000}
      />
    );

    expect(toast).not.toHaveBeenCalledWith(
      "Goal reached!",
      expect.any(Object)
    );
  });

  it("confetti does not trigger twice on re-render", () => {
    const { rerender } = render(
      <DailySummaryCard
        calories={2100}
        protein={100}
        carbs={200}
        fat={70}
        calorieGoal={2000}
      />
    );

    expect(toast).toHaveBeenCalledTimes(1);

    rerender(
      <DailySummaryCard
        calories={2200}
        protein={110}
        carbs={210}
        fat={75}
        calorieGoal={2000}
      />
    );

    const goalCalls = vi.mocked(toast).mock.calls.filter(
      (call) => call[0] === "Goal reached!"
    );
    expect(goalCalls).toHaveLength(1);
  });

  it("renders macro progress bars with correct aria labels", () => {
    render(
      <DailySummaryCard
        calories={1500}
        protein={80}
        carbs={180}
        fat={50}
        proteinGoal={120}
        carbGoal={250}
        fatGoal={70}
      />
    );

    const proteinBar = screen.getByLabelText(/protein: 80g of 120g/i);
    expect(proteinBar).toBeInTheDocument();
    expect(proteinBar.getAttribute("aria-valuenow")).toBe("80");
    expect(proteinBar.getAttribute("aria-valuemax")).toBe("120");
  });

  it("handles zero calories without crashing", () => {
    expect(() =>
      render(
        <DailySummaryCard
          calories={0}
          protein={0}
          carbs={0}
          fat={0}
        />
      )
    ).not.toThrow();
  });
});
