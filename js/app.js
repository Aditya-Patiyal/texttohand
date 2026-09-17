(() => {
"use strict";

const DPI = 150; // canvas resolution target, also used for physical unit conversions

const PAGE_SIZES = {
  a4: { w: 8.27, h: 11.69, jspdf: "a4" },
  letter: { w: 8.5, h: 11, jspdf: "letter" },
};

const FONT_DEFS = [
  { id: "caveat", label: "Caveat", family: "Caveat", weight: 400 },
  { id: "kalam", label: "Kalam", family: "Kalam", weight: 300 },
  { id: "shadows", label: "Shadows Into Light", family: "Shadows Into Light", weight: 400 },
  { id: "homemade", label: "Homemade Apple", family: "Homemade Apple", weight: 400 },
  { id: "reenie", label: "Reenie Beanie", family: "Reenie Beanie", weight: 400 },
  { id: "indie", label: "Indie Flower", family: "Indie Flower", weight: 400 },
  { id: "rocksalt", label: "Rock Salt", family: "Rock Salt", weight: 400 },
  { id: "justanotherhand", label: "Just Another Hand (light)", family: "Just Another Hand", weight: 400 },
  { id: "nycd", label: "Nothing You Could Do", family: "Nothing You Could Do", weight: 400 },
  { id: "archdaughter", label: "Architects Daughter", family: "Architects Daughter", weight: 400 },
  { id: "neucha", label: "Neucha (light)", family: "Neucha", weight: 400 },
  { id: "annie", label: "Annie Use Your Telescope", family: "Annie Use Your Telescope", weight: 400 },
  { id: "beaurivage", label: "Beau Rivage", family: "Beau Rivage", weight: 400 },
  { id: "playpen", label: "Playpen Sans", family: "Playpen Sans", weight: 300 },
  { id: "sriracha", label: "Sriracha (light)", family: "Sriracha", weight: 400 },
  { id: "yuyushort", label: "Yuyu Short", family: "Yuyu Short", weight: 400 },
  { id: "qwitcher", label: "Qwitcher Grypen", family: "Qwitcher Grypen", weight: 400 },
  { id: "slackside", label: "Slackside One", family: "Slackside One", weight: 400 },
  { id: "cedarville", label: "Cedarville Cursive", family: "Cedarville Cursive", weight: 400 },
];

const defaultState = {
  text: "Dear friend,\n\nThis is what your words look like in handwriting. Type or paste anything into the box on the left, pick a pen and a paper style, and watch it come to life on the page.\n\nEnjoy!",
  fontId: "kalam",
  inkColor: "#1a3c8f",
  fontSizePt: 22,
  lineSpacing: 1.6,
  boldness: 0.5,
  pageSize: "a4",
  marginIn: 0.8,
  pageType: "ruled",
  texture: true,
  aged: false,
  blackAndWhite: false,
  pressure: true,
  corrections: true,
  seed: 12345,
  // per-range style overrides on top of the settings above, e.g. [{start:0,end:12,boldness:2}].
  // start/end are character offsets into `text`; only the keys present are overridden,
  // everything else is inherited from the global settings.
  overrides: [],
};

let state = { ...defaultState, ...(loadAutosave() || {}) };

// ---------- persistence ----------

function loadAutosave() {
  try {
    const raw = localStorage.getItem("tth_autosave");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let autosaveTimer = null;
function saveAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try { localStorage.setItem("tth_autosave", JSON.stringify(state)); } catch {}
  }, 250);
}

// ---------- dom refs ----------

const el = {
  textInput: document.getElementById("textInput"),
  fontSwatches: document.getElementById("fontSwatches"),
  inkColorPicker: document.getElementById("inkColorPicker"),
  fontSizeRange: document.getElementById("fontSizeRange"),
  fontSizeVal: document.getElementById("fontSizeVal"),
  lineSpacingRange: document.getElementById("lineSpacingRange"),
  lineSpacingVal: document.getElementById("lineSpacingVal"),
  boldnessRange: document.getElementById("boldnessRange"),
  boldnessVal: document.getElementById("boldnessVal"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  pageTypeSelect: document.getElementById("pageTypeSelect"),
  marginRange: document.getElementById("marginRange"),
  marginVal: document.getElementById("marginVal"),
  agedCheckbox: document.getElementById("agedCheckbox"),
  textureCheckbox: document.getElementById("textureCheckbox"),
  bwCheckbox: document.getElementById("bwCheckbox"),
  pressureCheckbox: document.getElementById("pressureCheckbox"),
  correctionsCheckbox: document.getElementById("correctionsCheckbox"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  downloadPngBtn: document.getElementById("downloadPngBtn"),
  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  printBtn: document.getElementById("printBtn"),
  pagesContainer: document.getElementById("pages"),
  pageCountLabel: document.getElementById("pageCountLabel"),
  selectionInfo: document.getElementById("selectionInfo"),
  ovBoldnessToggle: document.getElementById("ovBoldnessToggle"),
  ovBoldnessRange: document.getElementById("ovBoldnessRange"),
  ovInkToggle: document.getElementById("ovInkToggle"),
  ovInkColorPicker: document.getElementById("ovInkColorPicker"),
  ovFontToggle: document.getElementById("ovFontToggle"),
  ovFontSelect: document.getElementById("ovFontSelect"),
  applySelectionBtn: document.getElementById("applySelectionBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
};

// ---------- font helpers ----------

function fontById(id) { return FONT_DEFS.find(f => f.id === id) || FONT_DEFS[0]; }

function buildSwatches() {
  el.fontSwatches.innerHTML = "";
  FONT_DEFS.forEach(f => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "font-swatch" + (f.id === state.fontId ? " active" : "");
    btn.dataset.id = f.id;
    btn.innerHTML = `<span class="preview" style="font-family:'${f.family}',cursive;font-weight:${f.weight}">Ag</span><span class="label">${f.label}</span>`;
    btn.addEventListener("click", () => {
      state.fontId = f.id;
      refreshSwatchActive();
      saveAutosave();
      render();
    });
    el.fontSwatches.appendChild(btn);
  });
}
function refreshSwatchActive() {
  el.fontSwatches.querySelectorAll(".font-swatch").forEach(b => {
    b.classList.toggle("active", b.dataset.id === state.fontId);
  });
}

// ---------- per-range style overrides ----------
// Overrides are a flat, sorted, non-overlapping list of {start, end, boldness?, inkColor?, fontId?}
// covering slices of state.text. Only the keys present on an entry are overridden; anything
// absent falls back to the global setting. applyOverride() keeps that invariant when a new
// patch is stamped over an arbitrary (possibly overlapping) range.

const OVERRIDE_KEYS = ["boldness", "inkColor", "fontId"];

function hasAnyOverrideKey(o) {
  return OVERRIDE_KEYS.some(k => o[k] !== undefined);
}

function mergeOverrideProps(base, patch) {
  const merged = { ...base };
  OVERRIDE_KEYS.forEach(k => {
    if (!Object.prototype.hasOwnProperty.call(patch, k)) return;
    if (patch[k] === undefined) delete merged[k];
    else merged[k] = patch[k];
  });
  return merged;
}

function applyOverride(start, end, patch) {
  if (end <= start) return;
  const sorted = state.overrides.slice().sort((a, b) => a.start - b.start);
  const result = [];
  let cursor = start;

  sorted.forEach(seg => {
    if (seg.end <= start || seg.start >= end) { result.push(seg); return; }
    const segProps = OVERRIDE_KEYS.reduce((o, k) => (seg[k] !== undefined ? { ...o, [k]: seg[k] } : o), {});
    if (seg.start < start) result.push({ start: seg.start, end: start, ...segProps });
    const ovStart = Math.max(seg.start, start);
    const ovEnd = Math.min(seg.end, end);
    if (ovStart > cursor) result.push({ start: cursor, end: ovStart, ...patch });
    result.push({ start: ovStart, end: ovEnd, ...mergeOverrideProps(segProps, patch) });
    cursor = ovEnd;
    if (seg.end > end) result.push({ start: end, end: seg.end, ...segProps });
  });
  if (cursor < end) result.push({ start: cursor, end, ...patch });

  result.sort((a, b) => a.start - b.start);
  const cleaned = [];
  result.filter(hasAnyOverrideKey).forEach(seg => {
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.end === seg.start && OVERRIDE_KEYS.every(k => prev[k] === seg[k])) {
      prev.end = seg.end;
    } else {
      cleaned.push({ ...seg });
    }
  });
  state.overrides = cleaned;
}

function getOverrideAt(srcIndex) {
  return state.overrides.find(o => srcIndex >= o.start && srcIndex < o.end) || null;
}

function effectiveFontFor(srcIndex) {
  const o = getOverrideAt(srcIndex);
  return fontById((o && o.fontId) || state.fontId);
}

// Shifts/trims ranges to follow a text edit found by diffing oldText -> newText.
// Assumes a single contiguous edit region, true for normal typing/paste/delete.
function adjustRangesForEdit(ranges, oldText, newText) {
  if (ranges.length === 0) return ranges;
  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix++;
  let suffix = 0;
  const maxSuffix = Math.min(oldText.length, newText.length) - prefix;
  while (suffix < maxSuffix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) suffix++;
  const editStart = prefix;
  const oldEnd = oldText.length - suffix;
  const newEnd = newText.length - suffix;
  const delta = newEnd - oldEnd;

  return ranges.map(r => {
    let { start, end } = r;
    if (start >= oldEnd) { start += delta; end += delta; }
    else if (start >= editStart) {
      start = editStart;
      end = end >= oldEnd ? end + delta : editStart;
    } else if (end > editStart) {
      end = end >= oldEnd ? end + delta : editStart;
    }
    return { ...r, start, end };
  });
}

function adjustOverridesForEdit(oldText, newText) {
  if (state.overrides.length === 0) return;
  state.overrides = adjustRangesForEdit(state.overrides, oldText, newText).filter(o => o.end > o.start && hasAnyOverrideKey(o));
}

// ---------- ink color ----------

function refreshInkSwatches() {
  document.querySelectorAll(".ink-swatch").forEach(b => {
    b.classList.toggle("active", b.dataset.color.toLowerCase() === state.inkColor.toLowerCase());
  });
  el.inkColorPicker.value = state.inkColor;
}
document.querySelectorAll(".ink-swatch").forEach(b => {
  b.addEventListener("click", () => {
    state.inkColor = b.dataset.color;
    refreshInkSwatches();
    saveAutosave();
    render();
  });
});
el.inkColorPicker.addEventListener("input", () => {
  state.inkColor = el.inkColorPicker.value;
  refreshInkSwatches();
  saveAutosave();
  render();
});

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslToRgbString(h, s, l, a) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return `rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},${a})`;
}

// ---------- deterministic pseudo-random per character ----------
// Stateless hash keyed by (charIndex, seed, salt) so jitter stays stable across
// re-renders of the same text/seed, without needing a persisted random stream.
function rnd(i, seed, salt) {
  const v = Math.sin(i * 12.9898 + salt * 78.233 + seed * 0.1103) * 43758.5453;
  return v - Math.floor(v);
}

// ---------- layout ----------

const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

const scratchCanvas = document.createElement("canvas");
const scratchCtx = scratchCanvas.getContext("2d");

function fontStr(sizePx, family, weight) {
  return `${weight || 400} ${sizePx}px "${family}", cursive`;
}

function buildLines(fontSizePx, family, contentWidth, weight) {
  const defaultFontStr = fontStr(fontSizePx, family, weight);
  measureCtx.font = defaultFontStr;
  const spaceWidth = measureCtx.measureText(" ").width;
  const paragraphs = state.text.replace(/\r\n/g, "\n").split("\n");
  const lines = [];
  const wrapWidth = contentWidth - 4; // small buffer so per-char spacing jitter never visibly overflows
  const hasOverrides = state.overrides.length > 0;

  // measureCtx.font is a CSS shorthand string, expensive to reparse every call;
  // only reassign it when the effective font for a character actually differs.
  let measureFontSet = defaultFontStr;
  function widthOf(ch, srcIndex) {
    if (hasOverrides) {
      const eff = effectiveFontFor(srcIndex);
      const s = fontStr(fontSizePx, eff.family, eff.weight);
      if (s !== measureFontSet) { measureCtx.font = s; measureFontSet = s; }
    }
    return measureCtx.measureText(ch).width;
  }

  let paraOffset = 0;
  paragraphs.forEach(para => {
    if (para === "") { lines.push([]); paraOffset += 1; return; }
    const words = para.split(" ");
    let currentLine = [];
    let currentWidth = 0;
    let localCursor = 0;
    words.forEach((word, wi) => {
      const wordStart = localCursor;
      const chars = [...word].map((ch, ci) => {
        const srcIndex = paraOffset + wordStart + ci;
        return { ch, w: widthOf(ch, srcIndex), srcIndex };
      });
      const wordWidth = chars.reduce((s, c) => s + c.w, 0);
      const needsSpace = currentLine.length > 0;
      const projected = currentWidth + (needsSpace ? spaceWidth : 0) + wordWidth;
      if (projected > wrapWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
      }
      if (currentLine.length > 0) {
        currentLine.push({ ch: " ", w: spaceWidth, srcIndex: paraOffset + wordStart - 1 });
        currentWidth += spaceWidth;
      }
      chars.forEach(c => { currentLine.push(c); currentWidth += c.w; });
      localCursor += word.length;
      if (wi < words.length - 1) localCursor += 1;
    });
    lines.push(currentLine);
    paraOffset += para.length + 1;
  });

  let gIdx = 0;
  lines.forEach(line => line.forEach(c => { c.gi = gIdx++; }));

  let wordIdx = 0;
  lines.forEach(line => {
    let curWord = null;
    line.forEach(c => {
      if (c.ch === " ") { curWord = null; return; }
      if (curWord === null) { wordIdx++; curWord = wordIdx; }
      c.wordId = curWord;
    });
  });

  return lines;
}

function isWordCorrected(wordId, seed) {
  // deterministic ~1-in-130 words get a strikethrough + rewrite above, so the
  // page reads as genuinely hand-corrected rather than machine-perfect.
  return rnd(wordId, seed, 10) < 0.0077;
}

function paginate(lines, linesPerPage) {
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([]);
  return pages;
}

// ---------- paper backgrounds ----------

let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const t = document.createElement("canvas");
  t.width = 180; t.height = 180;
  const tctx = t.getContext("2d");
  const img = tctx.createImageData(180, 180);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = 140 + Math.random() * 90;
    const a = Math.random() * 120;
    img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v; img.data[p + 3] = a;
  }
  tctx.putImageData(img, 0, 0);
  noiseTile = t;
  return t;
}

const AGED_STAINS = [
  { x: 0.12, y: 0.14, r: 0.16, a: 0.10 },
  { x: 0.85, y: 0.08, r: 0.12, a: 0.08 },
  { x: 0.78, y: 0.88, r: 0.20, a: 0.09 },
  { x: 0.08, y: 0.82, r: 0.14, a: 0.07 },
];

function drawBackground(ctx, w, h, opts) {
  const { pageType, aged, texture, marginPx, lineHeightPx, baselineOffsetPx, linesPerPage } = opts;

  ctx.fillStyle = aged ? "#f3e9d3" : "#ffffff";
  ctx.fillRect(0, 0, w, h);

  if (aged) {
    AGED_STAINS.forEach(s => {
      const cx = s.x * w, cy = s.y * h, r = s.r * Math.min(w, h);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(120,90,40,${s.a})`);
      g.addColorStop(1, "rgba(120,90,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(70,50,15,0.16)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  if (texture) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), "repeat");
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (pageType === "ruled" || pageType === "notebook" || pageType === "notebookMargin") {
    ctx.strokeStyle = pageType === "notebookMargin" ? "rgba(150,150,155,0.45)" : "rgba(70,110,190,0.32)";
    ctx.lineWidth = 1;
    const xStart = pageType === "notebookMargin" ? 0 : marginPx.left * 0.35;
    const xEnd = pageType === "notebookMargin" ? w : w - marginPx.right * 0.35;
    for (let i = 0; i < linesPerPage; i++) {
      const y = Math.round(marginPx.top + baselineOffsetPx + i * lineHeightPx) + 0.5;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();
    }
  }

  if (pageType === "grid") {
    const cell = 0.25 * DPI;
    ctx.strokeStyle = "rgba(100,140,200,0.28)";
    ctx.lineWidth = 1;
    for (let x = cell; x < w; x += cell) {
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); ctx.stroke();
    }
    for (let y = cell; y < h; y += cell) {
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); ctx.stroke();
    }
  }

  if (pageType === "notebook") {
    const mx = Math.round(Math.min(marginPx.left * 0.55, 0.55 * DPI)) + 0.5;
    ctx.strokeStyle = "rgba(210,70,85,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx, h);
    ctx.stroke();
  }

  if (pageType === "notebookMargin") {
    // classic US-ruled look: a thin double pink line close to the left edge
    const base = 0.42 * DPI;
    const gap = 0.07 * DPI;
    ctx.strokeStyle = "rgba(232,140,150,0.65)";
    ctx.lineWidth = 1.25;
    [base, base + gap].forEach(mx => {
      const x = Math.round(mx) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });
  }
}

// ---------- rendering ----------

let currentPagesMeta = []; // { canvas } for export

function drawCorrection(ctx, wordChars, xStart, xEnd, y, fontSizePx, lineHeightPx, baseHsl, family, weight) {
  // simulates a hand-written self-correction: strike the word, cap it with a caret,
  // and squeeze the same word back in smaller just above — never changes the text
  // that's actually read, just how it looks written. Sizing is capped by the actual
  // gap to the line above so it doesn't collide with it at tight line spacing.
  const inkColor = hslToRgbString(baseHsl[0], baseHsl[1], Math.max(8, Math.min(90, baseHsl[2])), 1);
  const wordId = wordChars[0].wordId;
  const headroom = Math.max(fontSizePx * 0.4, lineHeightPx - fontSizePx);

  const strikeY = y - fontSizePx * 0.32;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = Math.max(1, fontSizePx * 0.045);
  ctx.lineCap = "round";
  ctx.beginPath();
  const segs = 4;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const px = xStart - 3 + (xEnd - xStart + 6) * t;
    const wob = (rnd(wordId, state.seed, 11 + i) - 0.5) * fontSizePx * 0.05;
    if (i === 0) ctx.moveTo(px, strikeY + wob); else ctx.lineTo(px, strikeY + wob);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = Math.max(1, fontSizePx * 0.04);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const caretX = xStart + fontSizePx * 0.05;
  const caretY = y - Math.min(fontSizePx * 0.5, headroom * 0.42);
  ctx.beginPath();
  ctx.moveTo(caretX - fontSizePx * 0.09, caretY + fontSizePx * 0.09);
  ctx.lineTo(caretX, caretY - fontSizePx * 0.02);
  ctx.lineTo(caretX + fontSizePx * 0.09, caretY + fontSizePx * 0.09);
  ctx.stroke();
  ctx.restore();

  const smallSize = Math.min(fontSizePx * 0.6, headroom * 0.5);
  const smallY = y - Math.min(fontSizePx * 0.85, headroom * 0.78);
  ctx.save();
  ctx.font = fontStr(smallSize, family, weight);
  ctx.textBaseline = "alphabetic";
  let sx = xStart;
  wordChars.forEach(c => {
    const gi = c.gi;
    const rot = (rnd(gi, state.seed, 20) - 0.5) * 2 * (2.5 * Math.PI / 180);
    const jy = (rnd(gi, state.seed, 21) - 0.5) * 2 * (smallSize * 0.05);
    const w = ctx.measureText(c.ch).width;
    ctx.save();
    ctx.translate(sx, smallY + jy);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = inkColor;
    ctx.fillText(c.ch, 0, 0);
    ctx.restore();
    sx += w * 0.97;
  });
  ctx.restore();
}

function render() {
  const font = fontById(state.fontId);
  const size = PAGE_SIZES[state.pageSize];
  const canvasW = Math.round(size.w * DPI);
  const canvasH = Math.round(size.h * DPI);
  const marginPx = { left: state.marginIn * DPI, right: state.marginIn * DPI, top: state.marginIn * DPI, bottom: state.marginIn * DPI };
  const fontSizePx = (state.fontSizePt * DPI) / 72;
  const lineHeightPx = fontSizePx * state.lineSpacing;
  const baselineOffsetPx = fontSizePx * 0.82;
  const contentWidth = canvasW - marginPx.left - marginPx.right;
  const contentHeight = canvasH - marginPx.top - marginPx.bottom;
  const linesPerPage = Math.max(1, Math.floor(contentHeight / lineHeightPx));

  const lines = buildLines(fontSizePx, font.family, contentWidth, font.weight);
  const pages = paginate(lines, linesPerPage);

  syncCanvasCount(pages.length, canvasW, canvasH);

  const baseHsl = hexToHsl(state.inkColor);
  const hasOverrides = state.overrides.length > 0;
  const hslCache = new Map();
  function hslFor(hex) {
    if (hex === state.inkColor) return baseHsl;
    if (!hslCache.has(hex)) hslCache.set(hex, hexToHsl(hex));
    return hslCache.get(hex);
  }

  if (scratchCanvas.width !== canvasW || scratchCanvas.height !== canvasH) {
    scratchCanvas.width = canvasW;
    scratchCanvas.height = canvasH;
  }

  pages.forEach((pageLines, pIdx) => {
    const canvas = currentPagesMeta[pIdx].canvas;
    const ctx = scratchCtx;
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawBackground(ctx, canvasW, canvasH, {
      pageType: state.pageType, aged: state.aged, texture: state.texture,
      marginPx, lineHeightPx, baselineOffsetPx, linesPerPage,
    });

    let drawFontSet = fontStr(fontSizePx, font.family, font.weight);
    ctx.font = drawFontSet;
    ctx.textBaseline = "alphabetic";

    pageLines.forEach((line, li) => {
      const globalLine = pIdx * 10000 + li;
      const y = marginPx.top + li * lineHeightPx + baselineOffsetPx;
      // a whole line leans very slightly as it runs right — subtle enough to stay
      // readable as a straight, steady hand rather than a shaky one.
      const lineDrift = (rnd(globalLine, state.seed, 9) - 0.5) * 2 * (fontSizePx * 0.012);
      let x = marginPx.left;
      let wordStartX = null;
      let wordChars = [];
      let wordEff = null; // effective {hsl, font} of the current word's first character, for drawCorrection

      line.forEach((c, idx) => {
        if (c.ch === " ") { x += c.w; return; }
        const gi = c.gi;
        const rot = (rnd(gi, state.seed, 1) - 0.5) * 2 * (0.6 * Math.PI / 180);
        const jx = (rnd(gi, state.seed, 2) - 0.5) * 2 * (fontSizePx * 0.008);
        const driftFrac = Math.min(1, Math.max(0, (x - marginPx.left) / Math.max(1, contentWidth)));
        const jy = (rnd(gi, state.seed, 3) - 0.5) * 2 * (fontSizePx * 0.012) + lineDrift * driftFrac;
        const alpha = 1;
        const spacingJitter = (rnd(gi, state.seed, 6) - 0.5) * 2 * 0.35;
        const pressureScale = state.pressure ? (0.99 + rnd(gi, state.seed, 7) * 0.02) : 1;

        const ov = hasOverrides ? getOverrideAt(c.srcIndex) : null;
        const effBoldness = (ov && ov.boldness !== undefined) ? ov.boldness : state.boldness;
        const effHsl = hslFor((ov && ov.inkColor) || state.inkColor);
        const effFont = (ov && ov.fontId) ? fontById(ov.fontId) : font;
        const inkColor = hslToRgbString(effHsl[0], effHsl[1], effHsl[2], 1);

        if (wordStartX === null) { wordStartX = x; wordEff = { hsl: effHsl, font: effFont }; }
        wordChars.push(c);

        const fs = fontStr(fontSizePx, effFont.family, effFont.weight);
        if (fs !== drawFontSet) { ctx.font = fs; drawFontSet = fs; }

        ctx.save();
        ctx.translate(x + jx, y + jy);
        ctx.rotate(rot);
        if (pressureScale !== 1) ctx.scale(pressureScale, pressureScale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = inkColor;
        ctx.fillText(c.ch, 0, 0);
        if (effBoldness > 0) {
          // extra stroke on top of the fill fattens the glyph outline, simulating a bolder pen
          // without needing a separate bold font weight (custom-uploaded fonts are single-weight).
          // Kept crisp (round joins, no feathering) so it reads as a solid gel/ballpoint
          // line rather than a marker.
          ctx.lineWidth = effBoldness * fontSizePx * 0.02;
          ctx.strokeStyle = inkColor;
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;
          ctx.strokeText(c.ch, 0, 0);
        }
        ctx.restore();

        x += c.w + spacingJitter;

        const next = line[idx + 1];
        const isLastOfWord = !next || next.ch === " " || next.wordId !== c.wordId;
        if (isLastOfWord) {
          if (state.corrections && isWordCorrected(c.wordId, state.seed)) {
            // ctx.save/restore inside drawCorrection preserves ctx.font, so drawFontSet
            // stays in sync with the live context without needing to reset it here.
            drawCorrection(ctx, wordChars, wordStartX, x, y, fontSizePx, lineHeightPx, wordEff.hsl, wordEff.font.family, wordEff.font.weight);
          }
          wordStartX = null;
          wordChars = [];
          wordEff = null;
        }
      });
    });

    // composite the fully-drawn page in one shot. Grayscale is applied by hand on
    // pixel data rather than via ctx.filter, since canvas filter support (and its
    // interaction with drawImage/toDataURL) is inconsistent across browsers.
    const pageCtx = canvas.getContext("2d");
    pageCtx.clearRect(0, 0, canvasW, canvasH);
    if (state.blackAndWhite) {
      const imgData = scratchCtx.getImageData(0, 0, canvasW, canvasH);
      const d = imgData.data;
      for (let p = 0; p < d.length; p += 4) {
        const gray = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
        d[p] = d[p + 1] = d[p + 2] = gray;
      }
      pageCtx.putImageData(imgData, 0, 0);
    } else {
      pageCtx.drawImage(scratchCanvas, 0, 0);
    }
  });

  el.pageCountLabel.textContent = pages.length === 1 ? "1 page" : `${pages.length} pages`;
}

function syncCanvasCount(count, w, h) {
  while (currentPagesMeta.length < count) {
    const wrap = document.createElement("div");
    wrap.className = "page-shadow";
    const canvas = document.createElement("canvas");
    wrap.appendChild(canvas);
    el.pagesContainer.appendChild(wrap);
    currentPagesMeta.push({ canvas, wrap });
  }
  while (currentPagesMeta.length > count) {
    const meta = currentPagesMeta.pop();
    meta.wrap.remove();
  }
  currentPagesMeta.forEach(meta => {
    if (meta.canvas.width !== w || meta.canvas.height !== h) {
      meta.canvas.width = w;
      meta.canvas.height = h;
    }
  });
}

// ---------- debounced render on text input ----------

let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 90);
}

// ---------- wire up controls ----------

el.textInput.addEventListener("input", () => {
  const newText = el.textInput.value;
  adjustOverridesForEdit(state.text, newText);
  lastSelection = adjustRangesForEdit([lastSelection], state.text, newText)[0];
  state.text = newText;
  saveAutosave();
  updateSelectionUI();
  scheduleRender();
});

// ---------- selection-scoped style overrides ----------

let lastSelection = { start: 0, end: 0 };

function captureSelection() {
  const s = el.textInput.selectionStart, e = el.textInput.selectionEnd;
  if (typeof s === "number" && typeof e === "number") {
    lastSelection = { start: Math.min(s, e), end: Math.max(s, e) };
    updateSelectionUI();
  }
}
["select", "mouseup", "keyup"].forEach(evt => el.textInput.addEventListener(evt, captureSelection));

function refreshOverrideControlsEnabled() {
  const has = lastSelection.end > lastSelection.start;
  el.ovBoldnessToggle.disabled = !has;
  el.ovInkToggle.disabled = !has;
  el.ovFontToggle.disabled = !has;
  el.applySelectionBtn.disabled = !has;
  el.clearSelectionBtn.disabled = !has;
  el.ovBoldnessRange.disabled = !has || !el.ovBoldnessToggle.checked;
  el.ovInkColorPicker.disabled = !has || !el.ovInkToggle.checked;
  el.ovFontSelect.disabled = !has || !el.ovFontToggle.checked;
  document.querySelectorAll(".ov-ink-swatch").forEach(b => { b.disabled = !has || !el.ovInkToggle.checked; });
}

function updateSelectionUI() {
  const { start, end } = lastSelection;
  const n = end - start;
  el.selectionInfo.textContent = n > 0
    ? `${n} character${n === 1 ? "" : "s"} selected — styling below applies only to this text.`
    : "Select text in the box above to style just that part.";
  refreshOverrideControlsEnabled();
}

[el.ovBoldnessToggle, el.ovInkToggle, el.ovFontToggle].forEach(toggle => {
  toggle.addEventListener("change", refreshOverrideControlsEnabled);
});

document.querySelectorAll(".ov-ink-swatch").forEach(b => {
  b.addEventListener("click", () => {
    el.ovInkColorPicker.value = b.dataset.color;
    document.querySelectorAll(".ov-ink-swatch").forEach(o => o.classList.toggle("active", o === b));
  });
});
el.ovInkColorPicker.addEventListener("input", () => {
  document.querySelectorAll(".ov-ink-swatch").forEach(o => o.classList.remove("active"));
});

el.applySelectionBtn.addEventListener("click", () => {
  const { start, end } = lastSelection;
  if (end <= start) return;
  const patch = {};
  if (el.ovBoldnessToggle.checked) patch.boldness = Number(el.ovBoldnessRange.value);
  if (el.ovInkToggle.checked) patch.inkColor = el.ovInkColorPicker.value;
  if (el.ovFontToggle.checked) patch.fontId = el.ovFontSelect.value;
  if (Object.keys(patch).length === 0) return;
  applyOverride(start, end, patch);
  saveAutosave();
  render();
});

el.clearSelectionBtn.addEventListener("click", () => {
  const { start, end } = lastSelection;
  if (end <= start) return;
  applyOverride(start, end, { boldness: undefined, inkColor: undefined, fontId: undefined });
  saveAutosave();
  render();
});

el.fontSizeRange.addEventListener("input", () => {
  state.fontSizePt = Number(el.fontSizeRange.value);
  el.fontSizeVal.textContent = state.fontSizePt + "pt";
  saveAutosave();
  scheduleRender();
});

el.lineSpacingRange.addEventListener("input", () => {
  state.lineSpacing = Number(el.lineSpacingRange.value);
  el.lineSpacingVal.textContent = state.lineSpacing.toFixed(2) + "×";
  saveAutosave();
  scheduleRender();
});

el.boldnessRange.addEventListener("input", () => {
  state.boldness = Number(el.boldnessRange.value);
  el.boldnessVal.textContent = state.boldness.toFixed(1);
  saveAutosave();
  scheduleRender();
});

el.marginRange.addEventListener("input", () => {
  state.marginIn = Number(el.marginRange.value);
  el.marginVal.textContent = state.marginIn.toFixed(2) + "in";
  saveAutosave();
  scheduleRender();
});

el.pageSizeSelect.addEventListener("change", () => {
  state.pageSize = el.pageSizeSelect.value;
  saveAutosave();
  render();
});
el.pageTypeSelect.addEventListener("change", () => {
  state.pageType = el.pageTypeSelect.value;
  saveAutosave();
  render();
});
el.agedCheckbox.addEventListener("change", () => {
  state.aged = el.agedCheckbox.checked;
  saveAutosave();
  render();
});
el.textureCheckbox.addEventListener("change", () => {
  state.texture = el.textureCheckbox.checked;
  saveAutosave();
  render();
});
el.bwCheckbox.addEventListener("change", () => {
  state.blackAndWhite = el.bwCheckbox.checked;
  saveAutosave();
  render();
});
el.pressureCheckbox.addEventListener("change", () => {
  state.pressure = el.pressureCheckbox.checked;
  saveAutosave();
  render();
});
el.correctionsCheckbox.addEventListener("change", () => {
  state.corrections = el.correctionsCheckbox.checked;
  saveAutosave();
  render();
});
el.shuffleBtn.addEventListener("click", () => {
  state.seed = Math.floor(Math.random() * 1000000);
  saveAutosave();
  render();
});

// ---------- theme ----------

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  el.themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  try { localStorage.setItem("tth_theme", theme); } catch {}
}
el.themeToggleBtn.addEventListener("click", () => {
  const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

// ---------- export ----------

function download(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

el.downloadPngBtn.addEventListener("click", async () => {
  if (currentPagesMeta.length === 1) {
    download(currentPagesMeta[0].canvas.toDataURL("image/png"), "handwriting.png");
    return;
  }
  for (let i = 0; i < currentPagesMeta.length; i++) {
    download(currentPagesMeta[i].canvas.toDataURL("image/png"), `handwriting-page-${i + 1}.png`);
    await new Promise(r => setTimeout(r, 250));
  }
});

el.downloadPdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const format = PAGE_SIZES[state.pageSize].jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  currentPagesMeta.forEach((meta, i) => {
    if (i > 0) pdf.addPage(format, "portrait");
    // JPEG at high quality: the paper grain texture is essentially noise, which
    // PNG can't compress well but JPEG handles cleanly at a fraction of the size.
    const dataUrl = meta.canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(dataUrl, "JPEG", 0, 0, pw, ph);
  });

  pdf.save("handwriting.pdf");
});

el.printBtn.addEventListener("click", () => window.print());

// ---------- init ----------

function applyStateToControls() {
  el.textInput.value = state.text;
  buildSwatches();
  refreshInkSwatches();
  el.fontSizeRange.value = state.fontSizePt;
  el.fontSizeVal.textContent = state.fontSizePt + "pt";
  el.lineSpacingRange.value = state.lineSpacing;
  el.lineSpacingVal.textContent = state.lineSpacing.toFixed(2) + "×";
  el.boldnessRange.value = state.boldness;
  el.boldnessVal.textContent = state.boldness.toFixed(1);
  el.marginRange.value = state.marginIn;
  el.marginVal.textContent = state.marginIn.toFixed(2) + "in";
  el.pageSizeSelect.value = state.pageSize;
  el.pageTypeSelect.value = state.pageType;
  el.agedCheckbox.checked = state.aged;
  el.textureCheckbox.checked = state.texture;
  el.bwCheckbox.checked = state.blackAndWhite;
  el.pressureCheckbox.checked = state.pressure;
  el.correctionsCheckbox.checked = state.corrections;

  el.ovFontSelect.innerHTML = FONT_DEFS.map(f => `<option value="${f.id}">${f.label}</option>`).join("");
  updateSelectionUI();
}

function init() {
  const savedTheme = (() => { try { return localStorage.getItem("tth_theme"); } catch { return null; } })();
  applyTheme(savedTheme === "dark" ? "dark" : "light");

  applyStateToControls();

  Promise.all(FONT_DEFS.map(f => document.fonts.load(`${f.weight || 400} 16px "${f.family}"`).catch(() => {})))
    .finally(render);

  document.fonts.addEventListener("loadingdone", () => render());
}

init();
})();
