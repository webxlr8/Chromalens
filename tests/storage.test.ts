// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { getData, removeData, setData } from "../utils/storage";

describe("storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when key is absent", () => {
    expect(getData("missing", ["default"])).toEqual(["default"]);
  });

  it("round-trips favorites and theme values", () => {
    setData("chromaLens_favorites", ["#ff0000", "#00ff00"]);
    setData("chromaLens_theme", "dark");

    expect(getData("chromaLens_favorites", [])).toEqual(["#ff0000", "#00ff00"]);
    expect(getData("chromaLens_theme", "auto")).toBe("dark");
  });

  it("falls back to the default when JSON is corrupt", () => {
    localStorage.setItem("broken", "{not valid json");

    expect(getData("broken", { fallback: true })).toEqual({ fallback: true });
  });

  it("removes stored data", () => {
    setData("chromaLens_recent", ["#123456"]);
    removeData("chromaLens_recent");

    expect(getData("chromaLens_recent", [])).toEqual([]);
  });
});
