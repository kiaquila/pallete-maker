/**
 * harmony.mjs — pure palette logic, no DOM, no global state.
 * All functions accept the current palette array as an explicit parameter
 * so they are unit-testable without a browser environment.
 */

// ── Palette data ─────────────────────────────────────────────────────────────

export const PM_PALETTE = [
  // Achromatics (3) — compatible with all 51
  { hex: "#1C1C1C", name: "Black", isAchromatic: true },
  { hex: "#8C8C8C", name: "Gray", isAchromatic: true },
  { hex: "#FFFFFF", name: "White", isAchromatic: true },
  // Brights warm (6)
  { hex: "#E82535", name: "Scarlet", group: "bright", temp: "warm" },
  { hex: "#E84B20", name: "Vermillion", group: "bright", temp: "warm" },
  { hex: "#E87820", name: "Tangerine", group: "bright", temp: "warm" },
  { hex: "#E8AA20", name: "Amber", group: "bright", temp: "warm" },
  { hex: "#E8D520", name: "Canary", group: "bright", temp: "warm" },
  { hex: "#7EC820", name: "Chartreuse", group: "bright", temp: "warm" },
  // Brights cool (6)
  { hex: "#20A84E", name: "Emerald", group: "bright", temp: "cool" },
  { hex: "#10A896", name: "Teal", group: "bright", temp: "cool" },
  { hex: "#186AE8", name: "Cobalt", group: "bright", temp: "cool" },
  { hex: "#3828E8", name: "Indigo", group: "bright", temp: "cool" },
  { hex: "#8820E8", name: "Violet", group: "bright", temp: "cool" },
  { hex: "#D020AA", name: "Fuchsia", group: "bright", temp: "cool" },
  // Pastels warm (6) — aligned to the bright hue order
  { hex: "#F5B5BB", name: "Blush", group: "pastel", temp: "warm" },
  { hex: "#F5CDB0", name: "Nectarine", group: "pastel", temp: "warm" },
  { hex: "#E8D5B5", name: "Beige", group: "pastel", temp: "warm" },
  { hex: "#F5EADC", name: "Off-White", group: "pastel", temp: "warm" },
  { hex: "#F7EDA5", name: "Primrose", group: "pastel", temp: "warm" },
  { hex: "#D8EEB0", name: "Pistachio", group: "pastel", temp: "warm" },
  // Pastels cool (6)
  { hex: "#B0EEC5", name: "Mint", group: "pastel", temp: "cool" },
  { hex: "#B0EEDE", name: "Aqua", group: "pastel", temp: "cool" },
  { hex: "#B0CDEE", name: "Sky", group: "pastel", temp: "cool" },
  { hex: "#C0B8EE", name: "Periwinkle", group: "pastel", temp: "cool" },
  { hex: "#DCB8EE", name: "Lavender", group: "pastel", temp: "cool" },
  { hex: "#EEB8E5", name: "Orchid", group: "pastel", temp: "cool" },
  // Desaturated warm (6) — aligned to the bright hue order
  { hex: "#B86068", name: "Brick", group: "desaturated", temp: "warm" },
  { hex: "#C07860", name: "Coral", group: "desaturated", temp: "warm" },
  { hex: "#C08A65", name: "Terracotta", group: "desaturated", temp: "warm" },
  { hex: "#C0A268", name: "Sand", group: "desaturated", temp: "warm" },
  { hex: "#B8B268", name: "Straw", group: "desaturated", temp: "warm" },
  { hex: "#88A865", name: "Sage", group: "desaturated", temp: "warm" },
  // Desaturated cool (6)
  { hex: "#60A878", name: "Fern", group: "desaturated", temp: "cool" },
  { hex: "#50A095", name: "Dusty Teal", group: "desaturated", temp: "cool" },
  { hex: "#5082B8", name: "Slate", group: "desaturated", temp: "cool" },
  { hex: "#6860B8", name: "Dusty Indigo", group: "desaturated", temp: "cool" },
  { hex: "#9860B8", name: "Mauve", group: "desaturated", temp: "cool" },
  { hex: "#B860A2", name: "Antique Rose", group: "desaturated", temp: "cool" },
  // Darks warm (6) — aligned to the bright hue order
  { hex: "#8C1820", name: "Burgundy", group: "dark", temp: "warm" },
  { hex: "#8C3015", name: "Rust", group: "dark", temp: "warm" },
  { hex: "#8C5018", name: "Burnt Orange", group: "dark", temp: "warm" },
  { hex: "#8C6C15", name: "Ochre", group: "dark", temp: "warm" },
  { hex: "#787815", name: "Olive Gold", group: "dark", temp: "warm" },
  { hex: "#4A7A18", name: "Olive", group: "dark", temp: "warm" },
  // Darks cool (6)
  { hex: "#187838", name: "Forest", group: "dark", temp: "cool" },
  { hex: "#187870", name: "Pine", group: "dark", temp: "cool" },
  { hex: "#182878", name: "Navy", group: "dark", temp: "cool" },
  { hex: "#201878", name: "Midnight", group: "dark", temp: "cool" },
  { hex: "#5A1878", name: "Plum", group: "dark", temp: "cool" },
  { hex: "#781860", name: "Mulberry", group: "dark", temp: "cool" },
];

export const MAX_TOTAL = 15;
export const MAX_CHROMATIC = 12;

/** Lookup map for O(1) palette-order sort (used in getGrouped). */
export const PM_INDEX = new Map(PM_PALETTE.map((c, i) => [c.hex, i]));

// ── Pure harmony functions ────────────────────────────────────────────────────

/**
 * Base = first non-achromatic in the palette. Achromatics never act
 * as the filter-determining base, so picking White first does not
 * leave the whole palette "unlocked" forever.
 *
 * @param {object[]} palette
 * @returns {object|null}
 */
export function getBase(palette) {
  return palette.find((c) => !c.isAchromatic) || null;
}

/** @param {object[]} palette */
export function countChromatic(palette) {
  return palette.filter((c) => !c.isAchromatic).length;
}

/**
 * @param {object[]} palette
 * @param {{ hex: string }} color
 */
export function isSelected(palette, color) {
  return palette.some((c) => c.hex === color.hex);
}

/**
 * Compatibility rule (soft temperature):
 *   achromatics always compatible;
 *   chromatics must share the same group, OR form the
 *   desaturated↔dark cross-pair. Temperature is NOT a hard filter —
 *   it only drives warm/cool sectioning in the final palette.
 *
 * Invariant: `base` is always non-achromatic (see `getBase()`), so we
 * only need to check `target.isAchromatic`.
 *
 * @param {object|null} base
 * @param {object} target
 */
export function isCompatible(base, target) {
  if (!base) return true;
  if (target.isAchromatic) return true;
  if (base.group === target.group) return true;
  const g1 = base.group,
    g2 = target.group;
  return (
    (g1 === "desaturated" && g2 === "dark") ||
    (g1 === "dark" && g2 === "desaturated")
  );
}

/**
 * A swatch is dimmed when it cannot be added:
 *   - incompatible with current base
 *   - total limit reached
 *   - chromatic limit reached (for chromatic colors)
 * Already-selected swatches are never dimmed.
 *
 * @param {object[]} palette
 * @param {object} color
 */
export function isDimmed(palette, color) {
  if (isSelected(palette, color)) return false;
  const base = getBase(palette);
  if (base && !isCompatible(base, color)) return true;
  if (palette.length >= MAX_TOTAL) return true;
  if (!color.isAchromatic && countChromatic(palette) >= MAX_CHROMATIC)
    return true;
  return false;
}

/**
 * Groups the selected palette into Warm / Cool / Universal sections.
 * - Warm: chromatics with temp === 'warm' (insertion order)
 * - Cool: chromatics with temp === 'cool' (insertion order)
 * - Universal: achromatics sorted by PM_PALETTE order (Black → Gray → White)
 *
 * @param {object[]} palette
 * @returns {{ warm: object[], cool: object[], universal: object[] }}
 */
export function getGrouped(palette) {
  const warm = palette.filter((c) => !c.isAchromatic && c.temp === "warm");
  const cool = palette.filter((c) => !c.isAchromatic && c.temp === "cool");
  const universal = palette
    .filter((c) => c.isAchromatic)
    .sort((a, b) => PM_INDEX.get(a.hex) - PM_INDEX.get(b.hex));
  return { warm, cool, universal };
}
