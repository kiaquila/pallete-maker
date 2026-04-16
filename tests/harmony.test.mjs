/**
 * Unit tests for src/scripts/harmony.mjs
 * Run with: node --test tests/harmony.test.mjs
 *
 * Uses Node.js built-in test runner (node:test) — zero extra dependencies.
 * Requires Node >= 20.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PM_PALETTE,
  PM_INDEX,
  MAX_TOTAL,
  MAX_CHROMATIC,
  getBase,
  countChromatic,
  isSelected,
  isCompatible,
  isDimmed,
  getGrouped,
} from "../src/scripts/harmony.mjs";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const BLACK = PM_PALETTE.find((c) => c.name === "Black"); // achromatic
const GRAY = PM_PALETTE.find((c) => c.name === "Gray"); // achromatic
const WHITE = PM_PALETTE.find((c) => c.name === "White"); // achromatic

const SCARLET = PM_PALETTE.find((c) => c.name === "Scarlet"); // bright warm
const EMERALD = PM_PALETTE.find((c) => c.name === "Emerald"); // bright cool
const BLUSH = PM_PALETTE.find((c) => c.name === "Blush"); // pastel warm
const BRICK = PM_PALETTE.find((c) => c.name === "Brick"); // desaturated warm
const BURGUNDY = PM_PALETTE.find((c) => c.name === "Burgundy"); // dark warm
const FERN = PM_PALETTE.find((c) => c.name === "Fern"); // desaturated cool
const FOREST = PM_PALETTE.find((c) => c.name === "Forest"); // dark cool

const BRIGHT_ORDER = [
  "Scarlet",
  "Vermillion",
  "Tangerine",
  "Amber",
  "Canary",
  "Chartreuse",
  "Emerald",
  "Teal",
  "Cobalt",
  "Indigo",
  "Violet",
  "Fuchsia",
];

const PASTEL_ORDER = [
  "Blush",
  "Nectarine",
  "Beige",
  "Off-White",
  "Primrose",
  "Pistachio",
  "Mint",
  "Aqua",
  "Sky",
  "Periwinkle",
  "Lavender",
  "Orchid",
];

const DESATURATED_ORDER = [
  "Brick",
  "Coral",
  "Terracotta",
  "Sand",
  "Straw",
  "Sage",
  "Fern",
  "Dusty Teal",
  "Slate",
  "Dusty Indigo",
  "Mauve",
  "Antique Rose",
];

const DARK_ORDER = [
  "Burgundy",
  "Rust",
  "Burnt Orange",
  "Ochre",
  "Olive Gold",
  "Olive",
  "Forest",
  "Pine",
  "Navy",
  "Midnight",
  "Plum",
  "Mulberry",
];

// ── PM_PALETTE sanity ─────────────────────────────────────────────────────────

describe("PM_PALETTE", () => {
  it("contains exactly 51 colors", () => {
    assert.equal(PM_PALETTE.length, 51);
  });

  it("contains exactly 3 achromatics", () => {
    const achros = PM_PALETTE.filter((c) => c.isAchromatic);
    assert.equal(achros.length, 3);
  });

  it("uses a true white achromatic swatch", () => {
    assert.equal(WHITE.hex, "#FFFFFF");
  });

  it("PM_INDEX covers every entry", () => {
    assert.equal(PM_INDEX.size, PM_PALETTE.length);
    PM_PALETTE.forEach((c, i) => {
      assert.equal(PM_INDEX.get(c.hex), i);
    });
  });

  it("all chromatics have group and temp", () => {
    const chromatics = PM_PALETTE.filter((c) => !c.isAchromatic);
    chromatics.forEach((c) => {
      assert.ok(c.group, `${c.name} missing group`);
      assert.ok(c.temp === "warm" || c.temp === "cool", `${c.name} bad temp`);
    });
  });

  it("keeps every chromatic group aligned to the bright hue order", () => {
    const namesForGroup = (group) =>
      PM_PALETTE.filter((c) => c.group === group).map((c) => c.name);

    assert.deepEqual(namesForGroup("bright"), BRIGHT_ORDER);
    assert.deepEqual(namesForGroup("pastel"), PASTEL_ORDER);
    assert.deepEqual(namesForGroup("desaturated"), DESATURATED_ORDER);
    assert.deepEqual(namesForGroup("dark"), DARK_ORDER);
  });

  it("uses the updated selection limits", () => {
    assert.equal(MAX_CHROMATIC, 12);
    assert.equal(MAX_TOTAL, 15);
  });
});

// ── getBase ───────────────────────────────────────────────────────────────────

describe("getBase", () => {
  it("returns null for empty palette", () => {
    assert.equal(getBase([]), null);
  });

  it("returns null when only achromatics are selected", () => {
    assert.equal(getBase([BLACK, WHITE]), null);
  });

  it("returns the first non-achromatic", () => {
    assert.equal(getBase([SCARLET]), SCARLET);
  });

  it("skips leading achromatics to find the chromatic base", () => {
    assert.equal(getBase([BLACK, GRAY, SCARLET]), SCARLET);
  });

  it("returns the first chromatic even if others follow", () => {
    assert.equal(getBase([SCARLET, EMERALD]), SCARLET);
  });
});

// ── countChromatic ────────────────────────────────────────────────────────────

describe("countChromatic", () => {
  it("returns 0 for empty palette", () => {
    assert.equal(countChromatic([]), 0);
  });

  it("returns 0 when only achromatics present", () => {
    assert.equal(countChromatic([BLACK, GRAY, WHITE]), 0);
  });

  it("counts correctly with mixed palette", () => {
    assert.equal(countChromatic([BLACK, SCARLET, EMERALD]), 2);
  });
});

// ── isSelected ────────────────────────────────────────────────────────────────

describe("isSelected", () => {
  it("returns false for empty palette", () => {
    assert.equal(isSelected([], SCARLET), false);
  });

  it("returns true when color is in palette (by hex)", () => {
    assert.equal(isSelected([SCARLET], SCARLET), true);
  });

  it("returns false when color is not in palette", () => {
    assert.equal(isSelected([SCARLET], EMERALD), false);
  });
});

// ── isCompatible ──────────────────────────────────────────────────────────────

describe("isCompatible", () => {
  it("returns true when base is null (no base selected)", () => {
    assert.equal(isCompatible(null, SCARLET), true);
  });

  it("achromatics are always compatible regardless of base", () => {
    assert.equal(isCompatible(SCARLET, BLACK), true);
    assert.equal(isCompatible(BURGUNDY, WHITE), true);
  });

  it("same group is compatible", () => {
    assert.equal(isCompatible(SCARLET, EMERALD), true); // bright ↔ bright
    assert.equal(isCompatible(BLUSH, BLUSH), true); // pastel ↔ pastel
    assert.equal(isCompatible(BRICK, FERN), true); // desaturated ↔ desaturated
    assert.equal(isCompatible(BURGUNDY, FOREST), true); // dark ↔ dark
  });

  it("desaturated ↔ dark cross-pair is compatible", () => {
    assert.equal(isCompatible(BRICK, BURGUNDY), true); // desaturated → dark
    assert.equal(isCompatible(BURGUNDY, BRICK), true); // dark → desaturated
    assert.equal(isCompatible(FERN, FOREST), true); // desaturated cool → dark cool
  });

  it("bright is incompatible with pastel, desaturated, and dark", () => {
    assert.equal(isCompatible(SCARLET, BLUSH), false); // bright → pastel
    assert.equal(isCompatible(SCARLET, BRICK), false); // bright → desaturated
    assert.equal(isCompatible(SCARLET, BURGUNDY), false); // bright → dark
  });

  it("pastel is incompatible with bright, desaturated, and dark", () => {
    assert.equal(isCompatible(BLUSH, SCARLET), false); // pastel → bright
    assert.equal(isCompatible(BLUSH, BRICK), false); // pastel → desaturated
    assert.equal(isCompatible(BLUSH, BURGUNDY), false); // pastel → dark
  });
});

// ── isDimmed ──────────────────────────────────────────────────────────────────

describe("isDimmed", () => {
  it("nothing is dimmed when palette is empty", () => {
    PM_PALETTE.forEach((c) => {
      assert.equal(isDimmed([], c), false, `${c.name} should not be dimmed`);
    });
  });

  it("selected colors are never dimmed", () => {
    const palette = [SCARLET];
    assert.equal(isDimmed(palette, SCARLET), false);
  });

  it("incompatible color is dimmed when a base is set", () => {
    assert.equal(isDimmed([SCARLET], BLUSH), true); // bright base → pastel dimmed
    assert.equal(isDimmed([SCARLET], BURGUNDY), true); // bright base → dark dimmed
  });

  it("compatible color is not dimmed", () => {
    assert.equal(isDimmed([SCARLET], EMERALD), false); // same group (bright)
    assert.equal(isDimmed([BRICK], BURGUNDY), false); // desaturated ↔ dark cross
  });

  it("achromatics are never dimmed by the base rule", () => {
    assert.equal(isDimmed([SCARLET], BLACK), false);
    assert.equal(isDimmed([BLUSH], WHITE), false);
  });

  it("dims any unselected color when total limit is reached", () => {
    // Build a full 15-color palette: 3 achromatics + 12 chroms of same group
    const brights = PM_PALETTE.filter((c) => c.group === "bright").slice(
      0,
      MAX_CHROMATIC,
    );
    const full = [BLACK, GRAY, WHITE, ...brights];
    assert.equal(full.length, MAX_TOTAL);

    // Any unselected color should be dimmed (total cap)
    const unselected = PM_PALETTE.find((c) => !full.includes(c));
    assert.equal(isDimmed(full, unselected), true);
  });

  it("dims unselected chromatics when chromatic limit is reached", () => {
    // 11 bright chroms — chromatic cap hit, but total < 14
    const brights = PM_PALETTE.filter((c) => c.group === "bright").slice(
      0,
      MAX_CHROMATIC,
    );
    assert.equal(brights.length, MAX_CHROMATIC);

    const nextBright = PM_PALETTE.find(
      (c) => c.group === "bright" && !brights.includes(c),
    );
    const palette = brights;

    // Chromatic: dimmed (chromatic limit)
    if (nextBright) {
      assert.equal(isDimmed(palette, nextBright), true);
    }

    // Achromatic: not dimmed (limit is chromatic-only)
    assert.equal(isDimmed(palette, BLACK), false);
  });
});

// ── getGrouped ────────────────────────────────────────────────────────────────

describe("getGrouped", () => {
  it("returns empty sections for empty palette", () => {
    const { warm, cool, universal } = getGrouped([]);
    assert.deepEqual(warm, []);
    assert.deepEqual(cool, []);
    assert.deepEqual(universal, []);
  });

  it("puts warm chromatics in warm section", () => {
    const { warm, cool, universal } = getGrouped([SCARLET]); // bright warm
    assert.equal(warm.length, 1);
    assert.equal(warm[0], SCARLET);
    assert.equal(cool.length, 0);
    assert.equal(universal.length, 0);
  });

  it("puts cool chromatics in cool section", () => {
    const { warm, cool } = getGrouped([EMERALD]); // bright cool
    assert.equal(cool.length, 1);
    assert.equal(cool[0], EMERALD);
    assert.equal(warm.length, 0);
  });

  it("puts achromatics in universal section", () => {
    const { universal } = getGrouped([BLACK, WHITE]);
    assert.equal(universal.length, 2);
  });

  it("sorts universal by PM_PALETTE order (Black → Gray → White)", () => {
    // Insert in reverse order to verify sort
    const { universal } = getGrouped([WHITE, GRAY, BLACK]);
    assert.equal(universal[0], BLACK);
    assert.equal(universal[1], GRAY);
    assert.equal(universal[2], WHITE);
  });

  it("preserves insertion order within warm and cool sections", () => {
    const AMBER = PM_PALETTE.find((c) => c.name === "Amber"); // bright warm
    const { warm } = getGrouped([AMBER, SCARLET]);
    assert.equal(warm[0], AMBER);
    assert.equal(warm[1], SCARLET);
  });

  it("correctly splits a mixed palette", () => {
    const palette = [SCARLET, EMERALD, BLACK];
    const { warm, cool, universal } = getGrouped(palette);
    assert.equal(warm.length, 1);
    assert.equal(cool.length, 1);
    assert.equal(universal.length, 1);
  });
});
