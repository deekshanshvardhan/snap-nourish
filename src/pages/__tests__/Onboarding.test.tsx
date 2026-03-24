import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { mockNavigate, mockSignInWithOAuth } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
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
      signInWithOAuth: (...args: any[]) => mockSignInWithOAuth(...args),
    },
  },
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: new Proxy(actual.motion, {
      get: (_target, prop) => {
        if (typeof prop === "string") {
          return ({ children, ...props }: any) => {
            const { initial, animate, exit, transition, drag, dragConstraints, dragElastic, onDragEnd, whileTap, layout, ...domProps } = props;
            const tag = prop as keyof JSX.IntrinsicElements;
            const el = document.createElement(tag === "div" ? "div" : tag === "span" ? "span" : tag === "button" ? "button" : tag === "p" ? "p" : "div");
            return <div {...domProps}>{children}</div>;
          };
        }
        return (actual.motion as any)[prop];
      },
    }),
  };
});

import Onboarding from "@/pages/Onboarding";

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Onboarding />
    </MemoryRouter>
  );
}

describe("Onboarding page", () => {
  const origMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({ error: null });
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
    vi.restoreAllMocks();
  });

  it("renders intro step with Get Started button", () => {
    renderOnboarding();
    expect(
      screen.getByRole("button", { name: /get started/i })
    ).toBeInTheDocument();
  });

  it("Get Started advances to auth step", async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /sign in/i })
      ).toBeInTheDocument();
    });
  });

  it("Google button calls signInWithOAuth with 'google'", async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue with google/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i })
    );

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" })
      );
    });
  });

  it("Apple button calls signInWithOAuth with 'apple'", async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue with apple/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /continue with apple/i })
    );

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "apple" })
      );
    });
  });

  it("camera permission step requests getUserMedia and navigates to /home", async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Next step")).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole("button", { name: /allow camera/i })
    );

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

  it("skip camera navigates to /home with onboarded flag set", async () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Next step")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Next step")); // auth → profile
    await waitFor(() => {
      expect(screen.getByText(/about you/i)).toBeInTheDocument();
    });

    let skipButtons = screen.getAllByText(/skip for now/i);
    fireEvent.click(skipButtons[0]); // profile → camera

    await waitFor(() => {
      expect(screen.getByText(/camera access/i)).toBeInTheDocument();
    });

    skipButtons = screen.getAllByText(/skip for now/i);
    fireEvent.click(skipButtons[0]);

    expect(localStorage.getItem("onboarded")).toBe("true");
    expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
  });
});
