import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockStart = vi.fn();
const mockCaptureFrame = vi.fn();

vi.mock("@/hooks/useCamera", () => ({
  useCamera: () => ({
    videoRef: { current: null },
    isActive: true,
    error: null,
    start: mockStart,
    stop: vi.fn(),
    captureFrame: mockCaptureFrame,
  }),
}));

vi.mock("@/lib/analyzePhoto", () => ({
  analyzePhoto: vi.fn(),
}));

vi.mock("@/lib/analyzeText", () => ({
  analyzeText: vi.fn(),
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
  };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/mealTemplates", () => ({
  detectTemplateCandidates: vi.fn(() => null),
  createTemplateFromMeal: vi.fn(),
  saveTemplate: vi.fn(),
  dismissTemplatePrompt: vi.fn(),
  getTemplates: vi.fn(() => []),
  getTimeSuggestedTemplates: vi.fn(() => []),
  getFrequentTemplates: vi.fn(() => []),
  getFrequentMealsFromHistory: vi.fn(() => []),
  getCurrentTimeSuggestionLabel: vi.fn(() => "Suggested for Lunch"),
  MealTemplate: {},
}));

import Home from "@/pages/Home";
import { analyzePhoto } from "@/lib/analyzePhoto";
import { analyzeText } from "@/lib/analyzeText";
import { toast } from "sonner";
import { createMockMeal } from "@/test/helpers";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <Home />
    </MemoryRouter>
  );
}

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockCaptureFrame.mockResolvedValue(
      new Blob(["frame"], { type: "image/jpeg" })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls startCamera on mount", () => {
    renderHome();
    expect(mockStart).toHaveBeenCalled();
  });

  it("capture button calls analyzePhoto, creates meal, shows overlay", async () => {
    vi.mocked(analyzePhoto).mockResolvedValue({
      description: "Chicken rice",
      calories: 500,
      protein: 40,
      carbs: 50,
      fat: 15,
      confidence: 0.9,
      items: [{ name: "Chicken rice", quantity: 1 }],
      photoUrl: "blob:test",
    });

    renderHome();

    const captureBtn = screen.getByTestId("camera-capture");
    fireEvent.click(captureBtn);

    await waitFor(() => {
      expect(analyzePhoto).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/meal detected/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Chicken rice")).toBeInTheDocument();
  });

  it("shows toast error when analyzePhoto fails", async () => {
    vi.mocked(analyzePhoto).mockRejectedValue(new Error("Analysis failed"));

    renderHome();

    fireEvent.click(screen.getByTestId("camera-capture"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Analysis failed");
    });
  });

  it("disables capture button while analyzing", async () => {
    let resolveAnalysis: (v: any) => void;
    vi.mocked(analyzePhoto).mockReturnValue(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      })
    );

    renderHome();

    const captureBtn = screen.getByTestId("camera-capture");
    fireEvent.click(captureBtn);

    await waitFor(() => {
      expect(captureBtn).toBeDisabled();
    });

    resolveAnalysis!({
      description: "Test",
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
      confidence: 0.8,
      items: [],
    });

    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
  });

  it("text input calls analyzeText and creates meal", async () => {
    vi.mocked(analyzeText).mockResolvedValue({
      description: "2 eggs",
      calories: 156,
      protein: 12,
      carbs: 2,
      fat: 10,
      confidence: 0.8,
      items: [{ name: "eggs", quantity: 2 }],
    });

    renderHome();

    const textButton = screen.getByLabelText("Add text");
    fireEvent.click(textButton);

    const input = screen.getByPlaceholderText(/e\.g\. 2 eggs/i);
    await userEvent.type(input, "2 eggs");

    const sendBtn = screen.getByLabelText("Send");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(analyzeText).toHaveBeenCalledWith("2 eggs", expect.any(String));
    });

    await waitFor(() => {
      expect(screen.getByText(/meal detected/i)).toBeInTheDocument();
    });
  });

  it("shows toast when captureFrame returns null", async () => {
    mockCaptureFrame.mockResolvedValue(null);

    renderHome();

    fireEvent.click(screen.getByTestId("camera-capture"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Could not capture frame. Please try again."
      );
    });
  });
});
