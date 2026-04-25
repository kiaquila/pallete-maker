import {
  PM_PALETTE,
  MAX_TOTAL,
  MAX_CHROMATIC,
  PM_INDEX,
  getBase,
  countChromatic,
  isSelected,
  isCompatible,
  isDimmed,
  getGrouped,
} from "./harmony.mjs";

// ── State ─────────────────────────────────────────────────────
// userPalette[0] is always the base color
let userPalette = [];

// ── DOM refs — cached once (module scripts run after HTML parsing) ─
const DOM = {
  grid: document.getElementById("sourceGrid"),
  palette: document.getElementById("userPalette"),
  count: document.getElementById("count"),
  maxCount: document.getElementById("maxCount"),
  resetBtn: document.getElementById("resetBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  drawer: document.getElementById("paletteDrawer"),
  toggleBtn: document.getElementById("toggleBtn"),
  arrow: document.getElementById("arrow"),
};

const TRUE_WHITE_HEX = "#FFFFFF";
const WHITE_SWATCH_OUTLINE = "#d9d9d9";

function isPureWhite(color) {
  return color.hex.toUpperCase() === TRUE_WHITE_HEX;
}

function getSwatchInnerBorder(borderWidth, color) {
  return `${borderWidth} solid ${
    isPureWhite(color) ? WHITE_SWATCH_OUTLINE : "#FFFFFF"
  }`;
}

// ── Interaction ───────────────────────────────────────────────
function handleClick(color) {
  if (isSelected(userPalette, color)) {
    // Remove; new base = userPalette[0] after splice (Variant A)
    userPalette = userPalette.filter((c) => c.hex !== color.hex);
  } else if (!isDimmed(userPalette, color)) {
    // Belt-and-suspenders: never let a chromatic past MAX_CHROMATIC
    // even if a future change to isDimmed leaks through. The 3
    // remaining slots above 12 chromatic are reserved for
    // achromatics only.
    if (!color.isAchromatic && countChromatic(userPalette) >= MAX_CHROMATIC) {
      return;
    }
    if (userPalette.length >= MAX_TOTAL) return;
    userPalette.push(color);
  }
  renderAll();
}

// ── Shared swatch builder ─────────────────────────────────────
/**
 * Builds a color swatch DOM node (outer circle + inner circle + name + hex).
 * Caller adds interactivity (click handler, cursor) as needed.
 *
 * @param {{ hex: string, name: string }} color
 * @param {{
 *   outerSize: string,
 *   innerSize: string,
 *   innerBorderWidth: string,
 *   borderStyle: string,
 *   boxShadow: string,
 *   nameFontSize: string,
 *   hexFontSize: string,
 *   maxWidth: string,
 *   gap: string
 * }} opts
 */
function buildColorSwatch(color, opts) {
  const card = document.createElement("div");
  card.style.cssText =
    "display:flex;flex-direction:column;align-items:center;" +
    "flex-shrink:0;gap:" +
    opts.gap +
    ";";

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "width:" +
    opts.outerSize +
    ";height:" +
    opts.outerSize +
    ";border-radius:50%;display:flex;" +
    "align-items:center;justify-content:center;background:white;flex-shrink:0;" +
    (opts.borderStyle ? "border:" + opts.borderStyle + ";" : "") +
    (opts.boxShadow ? "box-shadow:" + opts.boxShadow + ";" : "");

  const inner = document.createElement("div");
  inner.style.cssText =
    "width:" +
    opts.innerSize +
    ";height:" +
    opts.innerSize +
    ";border-radius:50%;border:" +
    getSwatchInnerBorder(opts.innerBorderWidth, color) +
    ";background-color:" +
    color.hex +
    ";";

  const nameEl = document.createElement("div");
  nameEl.style.cssText =
    "font-size:" +
    opts.nameFontSize +
    ";font-weight:600;color:#111;text-align:center;" +
    "line-height:1.2;letter-spacing:0.01em;" +
    (opts.maxWidth ? "max-width:" + opts.maxWidth + ";" : "");
  nameEl.textContent = color.name;

  const hexEl = document.createElement("div");
  hexEl.style.cssText =
    "font-size:" +
    opts.hexFontSize +
    ";font-weight:400;color:#aaa;text-transform:uppercase;" +
    "letter-spacing:0.04em;text-align:center;";
  hexEl.textContent = color.hex;

  wrapper.appendChild(inner);
  card.appendChild(wrapper);
  card.appendChild(nameEl);
  card.appendChild(hexEl);

  return card;
}

// ── Render ────────────────────────────────────────────────────
function renderGrid() {
  DOM.grid.replaceChildren();
  const base = getBase(userPalette);

  PM_PALETTE.forEach((color) => {
    const selected = isSelected(userPalette, color);
    const dimmed = isDimmed(userPalette, color);
    const isBase = selected && base?.hex === color.hex;

    const card = document.createElement("button");
    card.type = "button";
    card.setAttribute("aria-label", color.name + " " + color.hex);

    let cls = "color-card";
    if (dimmed) {
      cls += " dimmed";
      card.setAttribute("aria-disabled", "true");
      card.setAttribute("tabindex", "-1");
    } else if (isBase) {
      cls += " is-base";
    } else if (selected) {
      cls += " is-selected";
    }
    card.className = cls;

    const wrapper = document.createElement("div");
    wrapper.className = "circle-wrapper";

    const inner = document.createElement("div");
    inner.className = "color-inner";
    inner.style.backgroundColor = color.hex;
    // White swatch reads as a flat disc when unselected because the
    // page background is white. Match the inner ring width to the
    // outer wrapper border (1.5px) so the disc has one unified edge
    // instead of competing concentric rings.
    const innerWidth = isPureWhite(color) && !selected ? "1.5px" : "3px";
    inner.style.border = getSwatchInnerBorder(innerWidth, color);
    wrapper.appendChild(inner);

    const nameEl = document.createElement("div");
    nameEl.className = "color-name";
    nameEl.textContent = color.name;

    const hexEl = document.createElement("div");
    hexEl.className = "hex-label";
    hexEl.textContent = color.hex;

    card.appendChild(wrapper);
    card.appendChild(nameEl);
    card.appendChild(hexEl);

    card.addEventListener("click", () => handleClick(color));
    DOM.grid.appendChild(card);
  });
}

// Build one drawer card (46px wrapper, 36px inner) for a given color
function buildDrawerCard(color, isBase) {
  const swatch = buildColorSwatch(color, {
    outerSize: "46px",
    innerSize: "36px",
    innerBorderWidth: "2px",
    borderStyle: "1.5px solid " + (isBase ? "#4a4a4a" : "#c4c4c4"),
    boxShadow: "0 0 0 " + (isBase ? "2.5px #4a4a4a" : "1.5px #c4c4c4"),
    nameFontSize: "7px",
    hexFontSize: "6.5px",
    maxWidth: "52px",
    gap: "4px",
  });
  swatch.style.cursor = "pointer";
  swatch.addEventListener("click", () => handleClick(color));
  return swatch;
}

function updatePaletteUI() {
  const { warm, cool, universal } = getGrouped(userPalette);
  const total = userPalette.length;
  DOM.count.textContent = total;
  DOM.palette.replaceChildren();

  const base = getBase(userPalette);

  const buildSection = (label, colors) => {
    if (colors.length === 0) return null;
    const section = document.createElement("div");
    section.className = "palette-section";

    const labelEl = document.createElement("div");
    labelEl.className = "section-label";
    labelEl.textContent = label;
    section.appendChild(labelEl);

    const row = document.createElement("div");
    row.className = "section-swatches";
    colors.forEach((color) => {
      const isBase = base && color.hex === base.hex;
      row.appendChild(buildDrawerCard(color, isBase));
    });
    section.appendChild(row);
    return section;
  };

  [
    buildSection("Warm", warm),
    buildSection("Cool", cool),
    buildSection("Universal", universal),
  ]
    .filter(Boolean)
    .forEach((s) => DOM.palette.appendChild(s));

  DOM.downloadBtn.disabled = total === 0;

  updateDrawerSpace();
}

function renderAll() {
  renderGrid();
  updatePaletteUI();
}

// ── Drawer ────────────────────────────────────────────────────
function updateDrawerSpace() {
  if (!DOM.drawer) return;
  const isClosed = DOM.drawer.classList.contains("drawer-closed");
  const visible = isClosed ? 25 : DOM.drawer.getBoundingClientRect().height;
  document.documentElement.style.setProperty(
    "--drawer-space",
    `${Math.max(visible, 25)}px`,
  );
}

function toggleDrawer() {
  const isClosed = DOM.drawer.classList.toggle("drawer-closed");
  DOM.arrow.classList.toggle("rotated", isClosed);
  DOM.toggleBtn.setAttribute("aria-expanded", String(!isClosed));
  DOM.toggleBtn.setAttribute(
    "aria-label",
    isClosed ? "Expand palette" : "Collapse palette",
  );
  updateDrawerSpace();
}

// ── Actions ───────────────────────────────────────────────────
function clearPalette() {
  userPalette = [];
  renderAll();
}

function exportPalette() {
  if (userPalette.length === 0) return;
  const { warm, cool, universal } = getGrouped(userPalette);

  const btn = DOM.downloadBtn;
  btn.disabled = true;
  btn.textContent = "Exporting...";

  // PNG export safety: build the render subtree in a fresh detached
  // node per call, attach offscreen, render, then remove. No persistent
  // export container in the visible DOM.
  const stage = document.createElement("div");
  stage.style.cssText =
    "position:absolute;left:-9999px;top:0;" +
    "display:flex;flex-direction:row;gap:56px;padding:60px;" +
    "background:white;align-items:flex-start;" +
    "font-family:Inter,Arial,sans-serif;";

  const buildExportSection = (label, colors) => {
    if (colors.length === 0) return null;
    const section = document.createElement("div");
    section.style.cssText =
      "display:flex;flex-direction:column;gap:24px;flex-shrink:0;";

    const labelEl = document.createElement("div");
    labelEl.style.cssText =
      "font-size:16px;font-weight:700;letter-spacing:0.22em;" +
      "text-transform:uppercase;color:#9a9a9a;" +
      "font-family:Inter,Arial,sans-serif;padding:0 4px;";
    labelEl.textContent = label;
    section.appendChild(labelEl);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-direction:row;gap:28px;";

    colors.forEach((color) => {
      const swatch = buildColorSwatch(color, {
        outerSize: "130px",
        innerSize: "115px",
        innerBorderWidth: "4px",
        borderStyle: "2px solid #e5e5e5",
        boxShadow: "",
        nameFontSize: "14px",
        hexFontSize: "12px",
        maxWidth: "",
        gap: "8px",
      });
      swatch.style.width = "170px";
      row.appendChild(swatch);
    });

    section.appendChild(row);
    return section;
  };

  [
    buildExportSection("Warm", warm),
    buildExportSection("Cool", cool),
    buildExportSection("Universal", universal),
  ]
    .filter(Boolean)
    .forEach((s) => stage.appendChild(s));

  document.body.appendChild(stage);

  // Defer capture one frame so the browser finishes layout + font
  // resolution before capture. Avoids missing styles on slow devices.
  setTimeout(() => {
    document.fonts.ready.then(() => {
      html2canvas(stage, { scale: 2 })
        .then(
          (canvas) =>
            new Promise((resolve, reject) => {
              const triggerDownload = (href, revoke) => {
                const link = document.createElement("a");
                link.download = "palette.png";
                link.href = href;
                document.body.appendChild(link);
                link.click();
                link.remove();
                // WebKit / Safari starts anchor downloads
                // asynchronously — revoking the blob URL right
                // after click() can race the download and produce
                // an empty file. Defer revocation so the browser
                // has time to start reading the blob.
                if (revoke) {
                  setTimeout(() => URL.revokeObjectURL(href), 60000);
                }
              };
              // iOS Safari ignores `link.download` on data URLs and
              // shows an empty filename in the share sheet. Blob
              // URLs honour the download attribute on every modern
              // mobile + desktop browser. Use toBlob + objectURL
              // when available; fall back to toDataURL on older
              // browsers/WebViews where toBlob is missing so the
              // export path stays functional everywhere.
              if (typeof canvas.toBlob === "function") {
                canvas.toBlob((blob) => {
                  if (!blob) {
                    reject(new Error("toBlob returned null"));
                    return;
                  }
                  triggerDownload(URL.createObjectURL(blob), true);
                  resolve();
                }, "image/png");
              } else {
                try {
                  triggerDownload(canvas.toDataURL("image/png"), false);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              }
            }),
        )
        .catch(() => {
          // Export failed silently; button state is restored in finally
        })
        .finally(() => {
          stage.remove();
          btn.disabled = userPalette.length === 0;
          btn.textContent = "Download PNG";
        });
    });
  }, 50);
}

// ── Init ──────────────────────────────────────────────────────
function setVh() {
  document.documentElement.style.setProperty(
    "--vh",
    `${window.innerHeight * 0.01}px`,
  );
}
window.addEventListener("resize", setVh, { passive: true });
window.addEventListener("resize", updateDrawerSpace, { passive: true });
DOM.resetBtn.addEventListener("click", clearPalette);
DOM.downloadBtn.addEventListener("click", exportPalette);
DOM.toggleBtn.addEventListener("click", toggleDrawer);
DOM.maxCount.textContent = MAX_TOTAL;
setVh();
setTimeout(updateDrawerSpace, 100);

renderAll();
