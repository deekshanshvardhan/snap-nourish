import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MealOverlay from "@/components/MealOverlay";
import { createMockMeal } from "@/test/helpers";

describe("MealOverlay", () => {
  const mockConfirm = vi.fn();
  const mockRetake = vi.fn();

  const defaultMeal = createMockMeal({
    description: "Grilled chicken",
    calories: 480,
    protein: 40,
    carbs: 35,
    fat: 15,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders meal description and calorie estimate", () => {
    render(
      <MealOverlay
        meal={defaultMeal}
        onConfirm={mockConfirm}
        onRetake={mockRetake}
      />
    );

    expect(screen.getByText("Grilled chicken")).toBeInTheDocument();
    expect(screen.getByText(/meal detected/i)).toBeInTheDocument();
    expect(screen.getByText(/480 kcal/i)).toBeInTheDocument();
  });

  it("auto-confirm triggers after IDLE_DELAY + RING_DURATION", async () => {
    render(
      <MealOverlay
        meal={defaultMeal}
        onConfirm={mockConfirm}
        onRetake={mockRetake}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockConfirm).toHaveBeenCalledWith(defaultMeal, "");
  });

  it("user interaction cancels auto-confirm ring", () => {
    render(
      <MealOverlay
        meal={defaultMeal}
        onConfirm={mockConfirm}
        onRetake={mockRetake}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const overlay = screen.getByText("Grilled chicken").closest("div[class*='backdrop']")
      ?? screen.getByText("Grilled chicken");
    fireEvent.click(overlay);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("manual confirm button works", () => {
    render(
      <MealOverlay
        meal={defaultMeal}
        onConfirm={mockConfirm}
        onRetake={mockRetake}
      />
    );

    const overlay = screen.getByText("Grilled chicken");
    fireEvent.click(overlay);

    const confirmBtn = screen.getByLabelText("Confirm meal");
    fireEvent.click(confirmBtn);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockConfirm).toHaveBeenCalledWith(defaultMeal, "");
  });

  it("retake removes the meal", () => {
    render(
      <MealOverlay
        meal={defaultMeal}
        onConfirm={mockConfirm}
        onRetake={mockRetake}
      />
    );

    const retakeBtn = screen.getByLabelText("Retake photo");
    fireEvent.click(retakeBtn);

    expect(mockRetake).toHaveBeenCalledWith(defaultMeal);
  });

  it("text input pauses auto-confirm", () => {
    render(
      <MealOverlay
        meal={defaultMeal}
        onConfirm={mockConfirm}
        onRetake={mockRetake}
      />
    );

    const input = screen.getByPlaceholderText(/add details/i);
    fireEvent.focus(input);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
