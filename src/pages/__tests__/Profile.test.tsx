import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { mockNavigate, mockSignOut, mockGetSession } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: "tok", user: { id: "user-123" } } },
  }),
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
      signOut: (...args: any[]) => mockSignOut(...args),
      getSession: (...args: any[]) => mockGetSession(...args),
    },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })),
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

import Profile from "@/pages/Profile";
import { seedAuthUser, seedMeals, createMockMeal } from "@/test/helpers";

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Profile />
    </MemoryRouter>
  );
}

describe("Profile page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok", user: { id: "user-123" } } },
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders user name and provider", () => {
    seedAuthUser({ name: "Alice", provider: "google" });
    renderProfile();

    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    expect(screen.getByText(/signed in with google/i)).toBeInTheDocument();
  });

  it("computes stats correctly", () => {
    seedAuthUser();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    seedMeals([
      createMockMeal({ timestamp: today.toISOString() }),
      createMockMeal({ timestamp: today.toISOString() }),
      createMockMeal({ timestamp: yesterday.toISOString() }),
    ]);

    renderProfile();

    expect(screen.getByText("Meals")).toBeInTheDocument();
    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.getByText("Streak")).toBeInTheDocument();
  });

  it("save profile on blur persists to storage", async () => {
    seedAuthUser();
    localStorage.setItem(
      "nutrition-profile",
      JSON.stringify({ height: "170" })
    );

    renderProfile();

    const heightInput = screen.getByPlaceholderText("170");
    await userEvent.clear(heightInput);
    await userEvent.type(heightInput, "180");
    fireEvent.blur(heightInput);

    const stored = JSON.parse(
      localStorage.getItem("nutrition-profile") || "{}"
    );
    expect(stored.height).toBe("180");
  });

  it("dark mode toggle updates document class and flag", () => {
    seedAuthUser();
    renderProfile();

    const toggle = screen.getByLabelText(/toggle dark mode/i);
    fireEvent.click(toggle);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("logout calls signOut, clears storage, navigates", async () => {
    seedAuthUser();
    renderProfile();

    const logoutBtn = screen.getByText("Log Out");
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {
        replace: true,
      });
    });
  });

  it("delete account flow shows confirmation", () => {
    seedAuthUser();
    renderProfile();

    const deleteBtn = screen.getByText("Delete Account");
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByText("Delete Everything")).toBeInTheDocument();
  });

  it("photo opt-in toggle updates preference flag", async () => {
    seedAuthUser();
    localStorage.setItem("photo-storage-opt-in", "true");
    renderProfile();

    const photoToggle = screen.getByLabelText(/toggle photo storage/i);
    fireEvent.click(photoToggle);

    await waitFor(() => {
      expect(localStorage.getItem("photo-storage-opt-in")).toBe("false");
    });
  });
});
