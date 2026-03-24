import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function createMockBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() };
}

function setupCanvasMocks(blobSize: number = 100_000) {
  const ctxMock = { drawImage: vi.fn() };
  const convertToBlob = vi.fn().mockResolvedValue(
    new Blob(["x".repeat(blobSize)], { type: "image/jpeg" })
  );
  const canvasMock = {
    getContext: vi.fn(() => ctxMock),
    convertToBlob,
    width: 0,
    height: 0,
  };

  vi.stubGlobal(
    "OffscreenCanvas",
    vi.fn((w: number, h: number) => {
      canvasMock.width = w;
      canvasMock.height = h;
      return canvasMock;
    })
  );

  return { canvasMock, ctxMock, convertToBlob };
}

describe("preprocessImage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("outputs image/jpeg", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(createMockBitmap(800, 600))
    );
    const { convertToBlob } = setupCanvasMocks();

    const { preprocessImage } = await import("@/lib/imagePreprocess");
    const input = new Blob(["test"], { type: "image/png" });
    await preprocessImage(input);

    expect(convertToBlob).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image/jpeg" })
    );
  });

  it("does not resize images within MAX_DIMENSION", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(createMockBitmap(800, 600))
    );
    const { canvasMock } = setupCanvasMocks();

    const { preprocessImage } = await import("@/lib/imagePreprocess");
    await preprocessImage(new Blob(["test"]));

    expect(canvasMock.width).toBe(800);
    expect(canvasMock.height).toBe(600);
  });

  it("resizes large images to respect MAX_DIMENSION (1024)", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(createMockBitmap(4000, 3000))
    );
    const { canvasMock } = setupCanvasMocks();

    const { preprocessImage } = await import("@/lib/imagePreprocess");
    await preprocessImage(new Blob(["test"]));

    expect(canvasMock.width).toBeLessThanOrEqual(1024);
    expect(canvasMock.height).toBeLessThanOrEqual(1024);
    const scale = 1024 / 4000;
    expect(canvasMock.width).toBe(Math.round(4000 * scale));
    expect(canvasMock.height).toBe(Math.round(3000 * scale));
  });

  it("triggers second quality pass when blob > 500KB", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(createMockBitmap(800, 600))
    );

    const { convertToBlob } = setupCanvasMocks(600_000);

    const { preprocessImage } = await import("@/lib/imagePreprocess");
    await preprocessImage(new Blob(["test"]));

    expect(convertToBlob).toHaveBeenCalledTimes(2);
    expect(convertToBlob).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "image/jpeg", quality: 0.6 })
    );
  });

  it("does not trigger second pass when blob <= 500KB", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(createMockBitmap(800, 600))
    );

    const { convertToBlob } = setupCanvasMocks(400_000);

    const { preprocessImage } = await import("@/lib/imagePreprocess");
    await preprocessImage(new Blob(["test"]));

    expect(convertToBlob).toHaveBeenCalledTimes(1);
  });

  it("closes the bitmap after processing", async () => {
    const bitmap = createMockBitmap(500, 500);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    setupCanvasMocks();

    const { preprocessImage } = await import("@/lib/imagePreprocess");
    await preprocessImage(new Blob(["test"]));

    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
