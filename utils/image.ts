import { kMeansClustering, rgbToHex } from "./color";
import type { PaletteItem } from "./types";

export function extractColorsFromImage(imageUrl: string): Promise<PaletteItem[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Use higher resolution for better accuracy
      const maxSize = 150;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!imageData) {
        resolve([]);
        return;
      }
      const pixels: [number, number, number][] = [];

      // Collect all valid pixels
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i] ?? 0;
        const g = imageData[i + 1] ?? 0;
        const b = imageData[i + 2] ?? 0;
        const a = imageData[i + 3] ?? 0;

        if (a < 128) continue; // Skip transparent

        // Skip pure black and pure white
        if (r < 10 && g < 10 && b < 10) continue;
        if (r > 245 && g > 245 && b > 245) continue;

        pixels.push([r, g, b]);
      }

      if (pixels.length === 0) {
        resolve([]);
        return;
      }

      // Run k-means with 12 clusters for dominant colors
      const clusters = kMeansClustering(pixels, 12);
      const totalPixels = pixels.length;

      // Convert to hex and sort by frequency
      const sorted = clusters
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((c) => ({
          color: rgbToHex(c.r, c.g, c.b).toLowerCase(),
          percentage: Math.round((c.count / totalPixels) * 100),
        }));

      resolve(sorted);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

export function cropImageToBounds(
  imageUrl: string,
  bounds: { x: number; y: number; width: number; height: number },
  scale: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      // Scale bounds to actual image dimensions
      const sx = bounds.x / scale;
      const sy = bounds.y / scale;
      const sw = bounds.width / scale;
      const sh = bounds.height / scale;
      canvas.width = sw;
      canvas.height = sh;
      ctx?.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = imageUrl;
  });
}
