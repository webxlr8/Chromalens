// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePalette,
  listPalettes,
  renamePalette,
  savePalette,
  type SavedPalette,
} from "../utils/palettes";

const STORAGE_KEY = "chromaLens_palettes";

describe("palettes storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("round-trips name, colors, and source through save + list", () => {
    const saved = savePalette("Sunset", ["#ff4500", "#ffd700", "#8a2be2"], "screen");
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe("Sunset");
    expect(saved!.colors).toEqual(["#ff4500", "#ffd700", "#8a2be2"]);
    expect(saved!.source).toBe("screen");
    expect(saved!.id).toBeTruthy();
    expect(saved!.createdAt).toBeGreaterThan(0);

    const listed = listPalettes();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(saved);
  });

  it("dedupes colors case-insensitively, preserving first occurrence", () => {
    const saved = savePalette("Dupe", ["#FF0000", "#ff0000", "#00FF00", "#FF0000", "#00ff00"], "manual");
    expect(saved!.colors).toEqual(["#FF0000", "#00FF00"]);
  });

  it("returns null for empty name or empty colors", () => {
    expect(savePalette("   ", ["#ff0000"], "manual")).toBeNull();
    expect(savePalette("Valid", [], "manual")).toBeNull();
  });

  it("trims the palette name", () => {
    const saved = savePalette("  Ocean  ", ["#0000ff"], "site");
    expect(saved!.name).toBe("Ocean");
  });

  it("caps at 50 palettes, newest first, oldest evicted", () => {
    const saved: SavedPalette[] = [];
    for (let i = 0; i < 55; i++) {
      const p = savePalette(`Palette ${i}`, [`#${i.toString(16).padStart(6, "0")}`], "manual");
      expect(p).not.toBeNull();
      saved.push(p!);
    }

    const listed = listPalettes();
    expect(listed).toHaveLength(50);
    expect(listed[0]).toEqual(saved[54]!);
    expect(listed[49]).toEqual(saved[5]!);
    for (let i = 0; i < 5; i++) {
      expect(listed.some((p) => p.id === saved[i]!.id)).toBe(false);
    }
  });

  it("keeps older palettes when saving under the cap", () => {
    for (let i = 0; i < 3; i++) {
      savePalette(`P${i}`, ["#000000"], "manual");
    }
    expect(listPalettes()).toHaveLength(3);
    expect(listPalettes().map((p) => p.name)).toEqual(["P2", "P1", "P0"]);
  });

  it("deletes a palette and ignores unknown ids", () => {
    const a = savePalette("A", ["#111111"], "manual")!;
    const b = savePalette("B", ["#222222"], "manual")!;

    deletePalette(a.id);
    expect(listPalettes().map((p) => p.id)).toEqual([b.id]);

    deletePalette("nonexistent");
    expect(listPalettes().map((p) => p.id)).toEqual([b.id]);
  });

  it("renames a palette and rejects empty names", () => {
    const saved = savePalette("Old", ["#333333"], "image")!;

    expect(renamePalette(saved.id, "New Name")).toBe(true);
    expect(listPalettes()[0]!.name).toBe("New Name");

    expect(renamePalette(saved.id, "   ")).toBe(false);
    expect(renamePalette("unknown", "Whatever")).toBe(false);
    expect(listPalettes()[0]!.name).toBe("New Name");
  });

  it("returns [] when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(listPalettes()).toEqual([]);
  });

  it("returns [] when stored value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "x" }));
    expect(listPalettes()).toEqual([]);
  });

  it("recovers from corrupt storage on save (persists fresh list)", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    const saved = savePalette("Fresh", ["#abcdef"], "site");
    expect(saved).not.toBeNull();
    expect(listPalettes()).toEqual([saved]);
  });

  it("returns [] when the key is absent", () => {
    expect(listPalettes()).toEqual([]);
  });

  it("uses Date.now() for id and createdAt", () => {
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    const saved = savePalette("Time", ["#010101"], "manual")!;
    expect(saved.id).toMatch(/^[a-z0-9]+-[a-z0-9]{5}$/);
    expect(saved.createdAt).toBe(new Date("2026-08-01T12:00:00Z").getTime());
  });
});
