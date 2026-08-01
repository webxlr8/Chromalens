import { afterEach, describe, expect, it, vi } from "vitest";
import { extractColorsFromImage } from "../utils/image";

describe("extractColorsFromImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects when the image fails to load", async () => {
    class FailingImage {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 0;
      height = 0;

      set src(_value: string) {
        this.onerror?.();
      }
    }

    vi.stubGlobal("Image", FailingImage);

    await expect(extractColorsFromImage("bad-image")).rejects.toThrow(
      "Failed to load image",
    );
  });
});
