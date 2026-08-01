export type HexColor = string;

export interface PaletteItem {
  color: string;
  percentage: number;
}

export interface CaptureBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface Violation {
  element: string;
  text: string;
  fg: string;
  bg: string;
  ratio: string;
  required: string;
  fontSize: number;
  fontWeight: number;
  isLargeText: boolean;
  threshold: number;
}

export type MessageMap = {
  start_area_selection: { tabId: number };
  area_selected: { bounds: CaptureBounds };
  selection_cancelled: Record<string, never>;
  get_pending_image: Record<string, never>;
  extract_image: { imageUrl: string };
  scan_page: Record<string, never>;
  extract_palette: Record<string, never>;
};

export type CaptureMode = "site" | "screen" | "image";
