import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let authChangeCallback: ((event: string, session: any) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: any) => {
        authChangeCallback = cb;
        return {
          data: { subscription: { unsubscribe: mockUnsubscribe } },
        };
      }),
    },
  },
}));

vi.mock("@/lib/migrateLocalData", () => ({
  migrateLocalDataToServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/syncEngine", () => ({
  syncEngine: { enqueue: vi.fn() },
}));

import AuthCallback from "@/pages/AuthCallback";

function renderAuthCallback() {
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <AuthCallback />
    </MemoryRouter>
  );
}

describe("AuthCallback page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    authChangeCallback = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state", () => {
    const { container } = renderAuthCallback();
    expect(container.textContent).toContain("Signing in");
  });

  it("on SIGNED_IN event, saves auth user and navigates to /home", async () => {
    renderAuthCallback();

    expect(authChangeCallback).toBeTruthy();

    const mockSession = {
      user: {
        id: "user-xyz",
        email: "test@example.com",
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Test User" },
      },
    };

    authChangeCallback!("SIGNED_IN", mockSession);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
    });

    const authUser = JSON.parse(
      localStorage.getItem("auth-user") || "{}"
    );
    expect(authUser.id).toBe("user-xyz");
    expect(authUser.name).toBe("Test User");
    expect(authUser.provider).toBe("google");

    expect(localStorage.getItem("auth-provider")).toBe("google");
    expect(localStorage.getItem("onboarded")).toBe("true");
  });

  it("calls migrateLocalDataToServer on sign in", async () => {
    renderAuthCallback();

    const { migrateLocalDataToServer } = await import(
      "@/lib/migrateLocalData"
    );

    authChangeCallback!("SIGNED_IN", {
      user: {
        id: "u1",
        email: "u@test.com",
        app_metadata: { provider: "apple" },
        user_metadata: { name: "Apple User" },
      },
    });

    await waitFor(() => {
      expect(migrateLocalDataToServer).toHaveBeenCalled();
    });
  });

  it("cleans up subscription on unmount", () => {
    const { unmount } = renderAuthCallback();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("ignores non-SIGNED_IN events", async () => {
    renderAuthCallback();

    authChangeCallback!("TOKEN_REFRESHED", { user: {} });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
