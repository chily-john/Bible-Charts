/**
 * Muted, colorblind-safe qualitative palette (Paul Tol "muted").
 * Theme colors are assigned cyclically so themes can be added without
 * ever choosing a color by hand.
 */
export const THEME_PALETTE: readonly string[] = [
  "#332288",
  "#88CCEE",
  "#44AA99",
  "#117733",
  "#999933",
  "#DDCC77",
  "#CC6677",
  "#882255",
  "#AA4499",
];

/** color = palette[i % palette.length] */
export function themeColor(index: number): string {
  return THEME_PALETTE[index % THEME_PALETTE.length];
}

/** Color for a theme id, based on its position in the themes list. */
export function themeColorFor(themeIds: readonly string[], themeId: string): string {
  const i = themeIds.indexOf(themeId);
  return themeColor(i < 0 ? 0 : i);
}