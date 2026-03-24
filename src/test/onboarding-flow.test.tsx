import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
  };
});

import Onboarding from "@/pages/Onboarding";

function renderApp() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Onboarding />
      </MemoryRouter>
    </TooltipProvider>
  );
}

describe("onboarding flow (localStorage cleared)", () => {
  const origMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
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

  it("intro step renders and Get Started advances to Sign In", async () => {
    renderApp();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /get started/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /sign in/i })
      ).toBeInTheDocument();
    });
  });

  it("full flow: intro → auth → profile skip → camera → home", async () => {
    renderApp();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /get started/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /sign in/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Next step")); // auth → profile

    await waitFor(() => {
      expect(screen.getByText(/about you/i)).toBeInTheDocument();
    });

    const skipButtons = screen.getAllByText(/skip for now/i);
    fireEvent.click(skipButtons[0]); // profile → camera

    await waitFor(() => {
      expect(screen.getByText(/camera access/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /allow camera/i }));

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: true,
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
    });

    expect(localStorage.getItem("onboarded")).toBe("true");
  });
});
