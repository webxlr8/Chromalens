export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
  source: "site" | "screen" | "image" | "manual";
  createdAt: number;
}

const STORAGE_KEY = "chromaLens_palettes";
const MAX_PALETTES = 50;

export function listPalettes(): SavedPalette[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as SavedPalette[]) : [];
  } catch {
    return [];
  }
}

export function savePalette(
  name: string,
  colors: string[],
  source: SavedPalette["source"],
): SavedPalette | null {
  const trimmed = name.trim();
  if (trimmed === "" || colors.length === 0) return null;

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const color of colors) {
    const key = color.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(color);
  }

  const palette: SavedPalette = {
    id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    name: trimmed,
    colors: deduped,
    source,
    createdAt: Date.now(),
  };

  const palettes = [palette, ...listPalettes()].slice(0, MAX_PALETTES);
  persist(palettes);
  return palette;
}

export function deletePalette(id: string): void {
  persist(listPalettes().filter((p) => p.id !== id));
}

export function renamePalette(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (trimmed === "") return false;

  const palettes = listPalettes();
  const palette = palettes.find((p) => p.id === id);
  if (!palette) return false;

  palette.name = trimmed;
  persist(palettes);
  return true;
}

function persist(palettes: SavedPalette[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes));
  } catch {
    // Quota/availability errors are non-fatal; in-memory state is lost.
  }
}
