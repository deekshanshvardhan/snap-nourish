import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock-url";
  URL.revokeObjectURL = () => {};
}

if (typeof AbortSignal.timeout !== "function") {
  (AbortSignal as any).timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => {
      const hex = "0123456789abcdef";
      const s = (n: number) =>
        Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join("");
      return `${s(8)}-${s(4)}-4${s(3)}-${hex[8 + Math.floor(Math.random() * 4)]}${s(3)}-${s(12)}`;
    },
  });
}
