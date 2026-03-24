import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRoutes } from "@/App";

function renderApp(path = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("onboarding flow (localStorage cleared)", () => {
  const origMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: origMediaDevices,
    });
  });

  it("intro → sign in → camera permission → first meal log → personalization prompt", async () => {
    renderApp("/");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /get started/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/track your nutrition/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(screen.getByText(/camera access/i)).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /allow camera/i }));
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("camera-capture")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("camera-capture"));

    await waitFor(() => {
      expect(screen.getByText(/meal detected/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Confirm"));

    await waitFor(
      () => {
        expect(
          screen.getByText(/get more accurate insights/i)
        ).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(localStorage.getItem("onboarded")).toBe("true");
    expect(JSON.parse(localStorage.getItem("meals") || "[]")).toHaveLength(1);
  });
});
