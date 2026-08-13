// Shared look for all Task 1 Academic charts.
// Font: Arial — the real text font in the Goldman deck and TechNet agenda; a
// standard system font, so it renders in-browser and survives SVG rasterization
// with no font file to embed. Colours: Goldman Sachs palette.
export const FONT = "Arial, Helvetica, sans-serif";

export const GS = {
  navy: "#12284B",
  steel: "#8FAAC9",
  plum: "#6E1E50",
  gold: "#B4894A",
  ink: "#23282B",
  muted: "#5B6266",
  grid: "#E4DFD3",
  rule: "#C9C2B2",
} as const;

// Default categorical order for multi-series charts.
export const SERIES = [GS.navy, GS.steel, GS.plum, GS.gold];

// Up-to-6 categorical palette for pies / multi-category charts.
export const CAT = [GS.navy, GS.steel, GS.plum, GS.gold, "#3E7C7B", "#9AA3AE"];

// Light fills need dark labels; everything else takes white.
export function labelOn(fill: string): string {
  return fill === GS.steel || fill === "#9AA3AE" ? GS.ink : "#ffffff";
}
