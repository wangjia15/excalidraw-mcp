/**
 * Diagram templates for Obsidian Excalidraw, tuned for Chinese text.
 *
 * Chinese typography choices:
 *  - font "sans" (Helvetica, id 2) falls back to the system CJK UI font (微软雅黑 / 苹方) and is the
 *    professional default; font "hand" (Excalifont, id 5) is the hand-drawn look and picks up the
 *    plugin's "Load Chinese fonts" (Xiaolai) fallback when that setting is on; code uses Cascadia (id 3)
 *  - CJK glyphs are 1em wide, so widths are measured per character and line height is 1.3
 *  - line breaking never leaves closing punctuation at the start of a line (禁则处理)
 *  - containers hold bound text, so labels stay centred when a shape is resized in Obsidian
 */
import { ACC, linesOf, wOf, wrap } from "./slides.js";

export const TEMPLATE_KINDS = ["layers", "timeline", "compare", "table", "tree", "swimlane", "quadrant", "funnel", "cycle", "cards", "flow"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export type FontStyle = "sans" | "hand";

const NAVY = "#35495e", INK = "#2b2f36", MUTED = "#5f6368";
const LH = 1.3; // comfortable line height for CJK text

type El = any;
type Box = { id: string; x: number; y: number; w: number; h: number };

class Kit {
  els: El[] = [];
  private n = 0;
  constructor(public font: number) {}
  id() { return `tp${(++this.n).toString(36).padStart(6, "0")}`; }

  text(x: number, y: number, t: string, fs: number, color = INK, o: El = {}): El {
    const ls = t.split("\n"), w = Math.max(...ls.map((l) => wOf(l, fs, o.fontFamily === 3)));
    const align = o.textAlign ?? "left", bw = o.boxW ?? w;
    const dx = align === "center" ? (bw - w) / 2 : align === "right" ? bw - w : 0;
    const { boxW: _b, ...rest } = o;
    const el = { id: this.id(), type: "text", x: x + dx, y, width: w, height: Math.ceil(ls.length * fs * LH), text: t, originalText: t, fontSize: fs, fontFamily: this.font, lineHeight: LH, strokeColor: color, textAlign: align, verticalAlign: "top", strokeWidth: 1.5, roughness: 0, ...rest };
    this.els.push(el);
    return el;
  }

  /** shape with bound, centred text. h is a minimum; the shape grows to fit the wrapped text. */
  box(x: number, y: number, w: number, h: number, label: string, o: { fill?: string; stroke?: string; fs?: number; color?: string; shape?: "rectangle" | "ellipse" | "diamond"; sw?: number; dashed?: boolean; pad?: number } = {}): Box {
    const fs = o.fs ?? 26, pad = o.pad ?? 18, shape = o.shape ?? "rectangle";
    const inner = shape === "diamond" ? w * 0.56 : shape === "ellipse" ? w * 0.8 : w - pad * 2;
    const t = wrap(label, fs, inner), th = Math.ceil(linesOf(t) * fs * LH);
    const hh = Math.max(h, th + (shape === "rectangle" ? 28 : shape === "diamond" ? th * 0.9 + 28 : 40));
    const sid = this.id(), tid = this.id();
    const tw = Math.max(...t.split("\n").map((l) => wOf(l, fs)));
    this.els.push({ id: sid, type: shape, x, y, width: w, height: hh, strokeColor: o.stroke ?? ACC[0].c, strokeWidth: o.sw ?? 2, backgroundColor: o.fill ?? "#ffffff", fillStyle: "solid", roughness: 0, roundness: shape === "rectangle" ? { type: 3 } : shape === "ellipse" ? null : { type: 2 }, strokeStyle: o.dashed ? "dashed" : "solid", boundElements: [{ type: "text", id: tid }] });
    this.els.push({ id: tid, type: "text", x: x + (w - tw) / 2, y: y + (hh - th) / 2, width: tw, height: th, text: t, originalText: t, fontSize: fs, fontFamily: this.font, lineHeight: LH, strokeColor: o.color ?? INK, textAlign: "center", verticalAlign: "middle", containerId: sid, strokeWidth: 1.5, roughness: 0 });
    return { id: sid, x, y, w, h: hh };
  }

  rect(x: number, y: number, w: number, h: number, o: El = {}): El {
    const el = { id: this.id(), type: "rectangle", x, y, width: w, height: h, strokeColor: "transparent", strokeWidth: 0, backgroundColor: "transparent", fillStyle: "solid", roughness: 0, roundness: null, ...o };
    this.els.push(el);
    return el;
  }
  ell(x: number, y: number, d: number, o: El = {}): El {
    const el = { id: this.id(), type: "ellipse", x, y, width: d, height: d, strokeColor: "transparent", strokeWidth: 0, backgroundColor: ACC[0].c, fillStyle: "solid", roughness: 0, ...o };
    this.els.push(el);
    return el;
  }
  /** polyline / polygon (closed polygons are filled) */
  poly(pts: [number, number][], o: El = {}, closed = false): El {
    const [x0, y0] = pts[0], rel = pts.map(([x, y]) => [x - x0, y - y0]);
    if (closed) rel.push([0, 0]);
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
    const el = { id: this.id(), type: "line", x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points: rel, strokeColor: NAVY, strokeWidth: 2, roughness: 0, roundness: null, startArrowhead: null, endArrowhead: null, backgroundColor: "transparent", fillStyle: "solid", polygon: closed, ...o };
    this.els.push(el);
    return el;
  }
  /** arrow through absolute points, optionally bound to shapes */
  arrow(pts: [number, number][], o: El = {}, from?: Box, to?: Box): El {
    const [x0, y0] = pts[0], rel = pts.map(([x, y]) => [x - x0, y - y0]);
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
    const el: El = { id: this.id(), type: "arrow", x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points: rel, strokeColor: NAVY, strokeWidth: 2.5, roughness: 0, roundness: null, startArrowhead: null, endArrowhead: "arrow", ...o };
    if (from) el.startBinding = { elementId: from.id, focus: 0, gap: 4 };
    if (to) el.endBinding = { elementId: to.id, focus: 0, gap: 4 };
    this.els.push(el);
    return el;
  }
  header(title?: string, subtitle?: string): number {
    if (!title) return 0;
    this.text(0, 0, title, 44, NAVY);
    let h = 44 * LH + 12;
    this.rect(0, h, Math.max(160, wOf(title, 44)), 5, { backgroundColor: ACC[0].c });
    h += 5 + 20;
    if (subtitle) { this.text(0, h, subtitle, 24, MUTED); h += 24 * LH + 12; }
    return h + 24;
  }
}

const palette = (i: number) => ACC[i % ACC.length];

/* ---------------------------------------------------------------- templates */

type LayersSpec = { title?: string; subtitle?: string; layers: { name: string; items: string[] }[]; width?: number };
function layers(k: Kit, s: LayersSpec) {
  let y = k.header(s.title, s.subtitle);
  const W = s.width ?? 1300, labelW = 220, gap = 22;
  s.layers.forEach((l, i) => {
    const a = palette(i), n = Math.max(1, l.items.length), iw = (W - labelW - 40 - gap * (n - 1) - 30) / n;
    const fs = 24, heights = l.items.map((t) => linesOf(wrap(t, fs, iw - 36)) * fs * LH + 36);
    const bh = Math.max(110, ...heights) + 0;
    const bandH = bh + 36;
    k.rect(0, y, W, bandH, { backgroundColor: a.bg, strokeColor: a.c, strokeWidth: 1.5, roundness: { type: 3 } });
    k.rect(0, y, labelW, bandH, { backgroundColor: a.c, roundness: { type: 3 } });
    k.rect(labelW - 20, y, 20, bandH, { backgroundColor: a.c });
    const nm = wrap(l.name, 30, labelW - 36);
    k.text(18, y + (bandH - linesOf(nm) * 30 * LH) / 2, nm, 30, "#ffffff", { textAlign: "center", boxW: labelW - 36 });
    l.items.forEach((t, j) => k.box(labelW + 20 + j * (iw + gap), y + 18, iw, bh, t, { fs, stroke: a.c, fill: "#ffffff" }));
    y += bandH + 22;
  });
}

type TimelineSpec = { title?: string; subtitle?: string; events: { time: string; title: string; desc?: string }[] };
function timeline(k: Kit, s: TimelineSpec) {
  const top = k.header(s.title, s.subtitle), n = s.events.length, step = 330, cw = 290;
  const axisY = top + 330;
  k.arrow([[-30, axisY], [step * n + 20, axisY]], { strokeColor: "#9aa7b0", strokeWidth: 5 });
  s.events.forEach((e, i) => {
    const a = palette(i), cx = 40 + i * step, up = i % 2 === 0;
    k.ell(cx - 16, axisY - 16, 32, { backgroundColor: a.c, strokeColor: "#ffffff", strokeWidth: 4 });
    const body = [e.title, e.desc].filter(Boolean).join("\n");
    const tFs = 28, dFs = 22;
    const th = linesOf(wrap(e.title, tFs, cw - 32)) * tFs * LH, dh = e.desc ? linesOf(wrap(e.desc, dFs, cw - 32)) * dFs * LH + 8 : 0;
    const bh = th + dh + 28 + 40; void body;
    const by = up ? axisY - 60 - bh : axisY + 60;
    k.poly([[cx, up ? axisY - 16 : axisY + 16], [cx, up ? axisY - 60 : axisY + 60]], { strokeColor: a.c, strokeWidth: 2.5 });
    k.rect(cx - cw / 2, by, cw, bh, { backgroundColor: "#ffffff", strokeColor: a.c, strokeWidth: 2, roundness: { type: 3 } });
    k.rect(cx - cw / 2, by, cw, 38, { backgroundColor: a.c, roundness: { type: 3 } });
    k.rect(cx - cw / 2, by + 20, cw, 18, { backgroundColor: a.c });
    k.text(cx - cw / 2, by + 5, e.time, 22, "#ffffff", { textAlign: "center", boxW: cw });
    k.text(cx - cw / 2 + 16, by + 50, wrap(e.title, tFs, cw - 32), tFs, a.c);
    if (e.desc) k.text(cx - cw / 2 + 16, by + 50 + th + 8, wrap(e.desc, dFs, cw - 32), dFs, INK);
  });
}

type CompareSpec = { title?: string; subtitle?: string; left: { title: string; items: string[] }; right: { title: string; items: string[] }; leftMark?: string; rightMark?: string };
function compare(k: Kit, s: CompareSpec) {
  const y0 = k.header(s.title, s.subtitle), cw = 620, gap = 120, fs = 26;
  [s.left, s.right].forEach((col, ci) => {
    const a = palette(ci === 0 ? 1 : 2), x = ci * (cw + gap);
    const lines = col.items.map((t) => wrap(t, fs, cw - 90));
    const hs = lines.map((t) => linesOf(t) * fs * LH + 30);
    const total = hs.reduce((p, q) => p + q, 0) + 100;
    k.rect(x, y0, cw, total, { backgroundColor: "#ffffff", strokeColor: a.c, strokeWidth: 2, roundness: { type: 3 } });
    k.rect(x, y0, cw, 76, { backgroundColor: a.c, roundness: { type: 3 } });
    k.rect(x, y0 + 40, cw, 36, { backgroundColor: a.c });
    k.text(x, y0 + 18, col.title, 34, "#ffffff", { textAlign: "center", boxW: cw });
    let y = y0 + 96;
    lines.forEach((t, i) => {
      k.ell(x + 28, y + 6, 22, { backgroundColor: a.bg, strokeColor: a.c, strokeWidth: 2 });
      k.text(x + 68, y, t, fs, INK);
      y += hs[i];
    });
  });
  const mid = y0 + 220;
  k.ell(cw + gap / 2 - 38, mid, 76, { backgroundColor: NAVY });
  k.text(cw + gap / 2 - 38, mid + 20, "VS", 32, "#ffffff", { textAlign: "center", boxW: 76 });
}

type TableSpec = { title?: string; subtitle?: string; columns: string[]; rows: string[][]; width?: number; firstColumnBold?: boolean };
function table(k: Kit, s: TableSpec) {
  let y = k.header(s.title, s.subtitle);
  const W = s.width ?? 1400, fs = 24;
  const nat = s.columns.map((c, i) => Math.max(wOf(c, fs + 2), ...s.rows.map((r) => Math.min(wOf(r[i] ?? "", fs), 520))) + 56);
  const sum = nat.reduce((p, q) => p + q, 0), widths = nat.map((v) => v * (W / sum));
  const hh = 64;
  k.rect(0, y, W, hh, { backgroundColor: NAVY, roundness: { type: 3 } });
  k.rect(0, y + hh - 20, W, 20, { backgroundColor: NAVY });
  let x = 0;
  s.columns.forEach((c, i) => { k.text(x + 24, y + 14, c, fs + 2, "#ffffff"); x += widths[i]; });
  y += hh;
  s.rows.forEach((r, ri) => {
    const cells = r.map((c, i) => wrap(c, fs, widths[i] - 48));
    const rh = Math.max(...cells.map((c) => linesOf(c) * fs * LH)) + 32;
    k.rect(0, y, W, rh, { backgroundColor: ri % 2 ? "#f1f6f4" : "#ffffff", strokeColor: "#dfeae4", strokeWidth: 1 });
    x = 0;
    cells.forEach((c, i) => { k.text(x + 24, y + 16, c, fs, i === 0 && s.firstColumnBold !== false ? ACC[0].c : INK); x += widths[i]; });
    y += rh;
  });
}

type TreeNode = { t: string; c?: TreeNode[] };
type TreeSpec = { title?: string; subtitle?: string; root: TreeNode };
function tree(k: Kit, s: TreeSpec) {
  const y0 = k.header(s.title, s.subtitle), gapX = 36, gapY = 90, fs = 24;
  const widthOf = (n: TreeNode): number => {
    const own = Math.min(260, wOf(n.t, fs) + 48);
    return n.c?.length ? Math.max(own, n.c.reduce((p, c) => p + widthOf(c), 0) + gapX * (n.c.length - 1)) : own;
  };
  const place = (n: TreeNode, depth: number, left: number, y: number, parent?: Box): void => {
    const sw = widthOf(n), bw = Math.min(260, wOf(n.t, depth === 0 ? 28 : fs) + 64), a = palette(depth);
    const b = k.box(left + (sw - bw) / 2, y, bw, 70, n.t, { fs: depth === 0 ? 28 : fs, fill: depth === 0 ? a.c : a.bg, stroke: a.c, color: depth === 0 ? "#ffffff" : INK });
    if (parent) {
      const px = parent.x + parent.w / 2, py = parent.y + parent.h, cx = b.x + b.w / 2, my = py + gapY / 2;
      k.arrow([[px, py], [px, my], [cx, my], [cx, b.y]], { strokeColor: "#9aa7b0", strokeWidth: 2 }, parent, b);
    }
    let x = left;
    n.c?.forEach((c) => { const cw = widthOf(c); place(c, depth + 1, x, y + b.h + gapY, b); x += cw + gapX; });
  };
  place(s.root, 0, 0, y0);
}

type SwimSpec = { title?: string; subtitle?: string; lanes: string[]; steps: { lane: string | number; text: string; decision?: boolean }[] };
function swimlane(k: Kit, s: SwimSpec) {
  const y0 = k.header(s.title, s.subtitle), laneH = 190, labelW = 150, bw = 210, gap = 70, n = s.steps.length;
  const W = labelW + 30 + n * (bw + gap);
  s.lanes.forEach((l, i) => {
    const a = palette(i), y = y0 + i * laneH;
    k.rect(0, y, W, laneH, { backgroundColor: i % 2 ? "#ffffff" : "#f6faf8", strokeColor: "#cfdad4", strokeWidth: 1.5 });
    k.rect(0, y, labelW, laneH, { backgroundColor: a.c, strokeColor: "#ffffff", strokeWidth: 1 });
    const t = wrap(l, 28, labelW - 24);
    k.text(12, y + (laneH - linesOf(t) * 28 * LH) / 2, t, 28, "#ffffff", { textAlign: "center", boxW: labelW - 24 });
  });
  const boxes: Box[] = [];
  s.steps.forEach((st, i) => {
    const li = typeof st.lane === "number" ? st.lane : Math.max(0, s.lanes.indexOf(st.lane)), a = palette(li);
    const x = labelW + 30 + i * (bw + gap), h = 100, y = y0 + li * laneH + (laneH - h) / 2;
    boxes.push(k.box(x, y, bw, h, st.text, { fs: 22, fill: a.bg, stroke: a.c, shape: st.decision ? "diamond" : "rectangle" }));
  });
  boxes.forEach((b, i) => {
    if (i === 0) return;
    const p = boxes[i - 1], sameLane = Math.abs(p.y + p.h / 2 - (b.y + b.h / 2)) < 4;
    if (sameLane) k.arrow([[p.x + p.w, p.y + p.h / 2], [b.x, b.y + b.h / 2]], {}, p, b);
    else {
      const sx = p.x + p.w, sy = p.y + p.h / 2, ex = b.x, ey = b.y + b.h / 2, mx = sx + gap / 2;
      k.arrow([[sx, sy], [mx, sy], [mx, ey], [ex, ey]], {}, p, b);
    }
  });
}

type QuadSpec = { title?: string; subtitle?: string; xAxis?: [string, string]; yAxis?: [string, string]; quadrants?: [string, string, string, string]; items?: { text: string; x: number; y: number }[] };
function quadrant(k: Kit, s: QuadSpec) {
  const y0 = k.header(s.title, s.subtitle), S = 900, x0 = 90;
  const q = s.quadrants ?? ["", "", "", ""];
  // order: top-left, top-right, bottom-left, bottom-right
  [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy], i) => {
    const a = palette([1, 0, 4, 2][i]);
    k.rect(x0 + cx * S / 2, y0 + cy * S / 2, S / 2, S / 2, { backgroundColor: a.bg, strokeColor: "#ffffff", strokeWidth: 3 });
    if (q[i]) k.text(x0 + cx * S / 2 + 20, y0 + cy * S / 2 + 16, q[i], 28, a.c);
  });
  k.arrow([[x0, y0 + S + 20], [x0 + S + 30, y0 + S + 20]], { strokeColor: MUTED });
  k.arrow([[x0 - 20, y0 + S], [x0 - 20, y0 - 30]], { strokeColor: MUTED });
  if (s.xAxis) { k.text(x0, y0 + S + 34, s.xAxis[0], 24, MUTED); k.text(x0 + S - wOf(s.xAxis[1], 24), y0 + S + 34, s.xAxis[1], 24, MUTED); }
  if (s.yAxis) {
    k.text(x0 - 30 - wOf(s.yAxis[1], 24), y0 - 6, s.yAxis[1], 24, MUTED);
    k.text(x0 - 30 - wOf(s.yAxis[0], 24), y0 + S - 30, s.yAxis[0], 24, MUTED);
  }
  (s.items ?? []).forEach((it, i) => {
    const a = palette(i), w = Math.min(240, wOf(it.text, 24) + 40);
    k.box(x0 + it.x * S - w / 2, y0 + (1 - it.y) * S - 30, w, 60, it.text, { fs: 24, fill: "#ffffff", stroke: a.c, shape: "ellipse" });
  });
}

type FunnelSpec = { title?: string; subtitle?: string; levels: { text: string; note?: string }[]; shape?: "funnel" | "pyramid" };
function funnel(k: Kit, s: FunnelSpec) {
  const y0 = k.header(s.title, s.subtitle), n = s.levels.length, H = 110, gap = 8, W = 900, pyramid = s.shape === "pyramid";
  s.levels.forEach((l, i) => {
    const a = palette(i), y = y0 + i * (H + gap);
    const top = pyramid ? (W * i) / n : W - (W * 0.7 * i) / n, bottom = pyramid ? (W * (i + 1)) / n : W - (W * 0.7 * (i + 1)) / n;
    const cx = W / 2;
    k.poly([[cx - top / 2, y], [cx + top / 2, y], [cx + bottom / 2, y + H], [cx - bottom / 2, y + H]], { backgroundColor: a.c, strokeColor: "#ffffff", strokeWidth: 3 }, true);
    k.text(cx - W / 2, y + (H - 30 * LH) / 2, l.text, 30, "#ffffff", { textAlign: "center", boxW: W });
    if (l.note) { k.poly([[W + 40, y + H / 2], [W + 90, y + H / 2]], { strokeColor: "#9aa7b0", strokeWidth: 2 }); k.text(W + 106, y + (H - 24 * LH) / 2, l.note, 24, INK); }
  });
}

type CycleSpec = { title?: string; subtitle?: string; steps: string[]; center?: string };
function cycle(k: Kit, s: CycleSpec) {
  const y0 = k.header(s.title, s.subtitle), n = s.steps.length, R = Math.max(260, n * 62), bw = 230, bh = 90;
  const cx = R + bw, cy = y0 + R + bh / 2 + 20;
  const boxes: Box[] = s.steps.map((t, i) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n, a = palette(i);
    return k.box(cx + Math.cos(ang) * R * 1.25 - bw / 2, cy + Math.sin(ang) * R - bh / 2, bw, bh, t, { fs: 26, fill: a.bg, stroke: a.c });
  });
  boxes.forEach((b, i) => {
    const nx = boxes[(i + 1) % n], a0 = [b.x + b.w / 2, b.y + b.h / 2], a1 = [nx.x + nx.w / 2, nx.y + nx.h / 2];
    const clip = (bx: Box, tx: number, ty: number): [number, number] => {
      const c0 = bx.x + bx.w / 2, c1 = bx.y + bx.h / 2, dx = tx - c0, dy = ty - c1;
      const f = Math.min(dx ? (bx.w / 2 + 6) / Math.abs(dx) : Infinity, dy ? (bx.h / 2 + 6) / Math.abs(dy) : Infinity);
      return [c0 + dx * f, c1 + dy * f];
    };
    const mid: [number, number] = [(a0[0] + a1[0]) / 2 + (a0[1] - a1[1]) * 0.12, (a0[1] + a1[1]) / 2 + (a1[0] - a0[0]) * 0.12];
    k.arrow([clip(b, mid[0], mid[1]), mid, clip(nx, mid[0], mid[1])], { strokeColor: palette(i).c, roundness: { type: 2 } }, b, nx);
  });
  if (s.center) { k.ell(cx - 90, cy - 90, 180, { backgroundColor: NAVY }); const t = wrap(s.center, 28, 150); k.text(cx - 75, cy - (linesOf(t) * 28 * LH) / 2, t, 28, "#ffffff", { textAlign: "center", boxW: 150 }); }
}

type CardsSpec = { title?: string; subtitle?: string; cards: { title: string; body?: string }[]; columns?: number };
function cards(k: Kit, s: CardsSpec) {
  const y0 = k.header(s.title, s.subtitle), cols = s.columns ?? (s.cards.length <= 4 ? 2 : 3), cw = 520, gap = 28;
  const rows: number[] = [];
  const meta = s.cards.map((c) => {
    const t = wrap(c.title, 30, cw - 100), b = c.body ? wrap(c.body, 24, cw - 56) : "";
    return { t, b, h: linesOf(t) * 30 * LH + (b ? linesOf(b) * 24 * LH + 14 : 0) + 76 };
  });
  for (let r = 0; r * cols < meta.length; r++) rows.push(Math.max(...meta.slice(r * cols, r * cols + cols).map((m) => m.h)));
  s.cards.forEach((_, i) => {
    const r = Math.floor(i / cols), c = i % cols, a = palette(i), x = c * (cw + gap), y = y0 + rows.slice(0, r).reduce((p, q) => p + q + gap, 0), m = meta[i];
    k.rect(x, y, cw, rows[r], { backgroundColor: "#ffffff", strokeColor: "#dfeae4", strokeWidth: 1.5, roundness: { type: 3 } });
    k.rect(x + 2, y, cw - 4, 10, { backgroundColor: a.c });
    k.ell(x + 24, y + 32, 44, { backgroundColor: a.bg, strokeColor: a.c, strokeWidth: 2 });
    k.text(x + 24, y + 32 + (44 - 24 * LH) / 2, String(i + 1), 24, a.c, { textAlign: "center", boxW: 44 });
    k.text(x + 84, y + 34, m.t, 30, a.c);
    if (m.b) k.text(x + 28, y + 34 + linesOf(m.t) * 30 * LH + 18, m.b, 24, INK);
  });
}

type FlowStep = string | { text: string; type?: "start" | "end" | "process" | "decision" };
type FlowSpec = { title?: string; subtitle?: string; steps: FlowStep[]; columns?: number };
function flow(k: Kit, s: FlowSpec) {
  const y0 = k.header(s.title, s.subtitle), n = s.steps.length, cols = s.columns ?? Math.min(n, 4), bw = 280, gapX = 90, gapY = 110;
  const boxes: Box[] = [];
  s.steps.forEach((raw, i) => {
    const st = typeof raw === "string" ? { text: raw, type: i === 0 ? "start" : i === n - 1 ? "end" : "process" } : { type: i === 0 ? "start" : i === n - 1 ? "end" : "process", ...raw };
    const r = Math.floor(i / cols), c0 = i % cols, c = r % 2 ? cols - 1 - c0 : c0, a = palette(i);
    const shape = st.type === "decision" ? "diamond" : st.type === "start" || st.type === "end" ? "ellipse" : "rectangle";
    const w = shape === "diamond" ? bw + 60 : bw, h = shape === "diamond" ? 150 : 90;
    boxes.push(k.box(c * (bw + gapX) + (bw - w) / 2, y0 + r * (150 + gapY) + (150 - h) / 2 + (shape === "diamond" ? 0 : 0), w, h, st.text, { fs: 24, fill: st.type === "start" || st.type === "end" ? a.c : a.bg, stroke: a.c, color: st.type === "start" || st.type === "end" ? "#ffffff" : INK, shape }));
  });
  boxes.forEach((b, i) => {
    if (i === 0) return;
    const p = boxes[i - 1], same = Math.abs(p.y + p.h / 2 - (b.y + b.h / 2)) < 20;
    if (same) { const right = b.x > p.x; k.arrow([[right ? p.x + p.w : p.x, p.y + p.h / 2], [right ? b.x : b.x + b.w, b.y + b.h / 2]], {}, p, b); }
    else k.arrow([[p.x + p.w / 2, p.y + p.h], [b.x + b.w / 2, b.y]], {}, p, b);
  });
}

export type TemplateSpec = Record<string, any>;

export function buildTemplate(kind: TemplateKind, spec: TemplateSpec, fontStyle: FontStyle = "sans"): El[] {
  const k = new Kit(fontStyle === "hand" ? 5 : 2);
  const need = (cond: unknown, msg: string) => { if (!cond) throw new Error(`${kind}: ${msg}`); };
  switch (kind) {
    case "layers": need(Array.isArray(spec.layers) && spec.layers.length, "layers[] required"); layers(k, spec as LayersSpec); break;
    case "timeline": need(Array.isArray(spec.events) && spec.events.length, "events[] required"); timeline(k, spec as TimelineSpec); break;
    case "compare": need(spec.left && spec.right, "left and right required"); compare(k, spec as CompareSpec); break;
    case "table": need(Array.isArray(spec.columns) && Array.isArray(spec.rows), "columns[] and rows[][] required"); table(k, spec as TableSpec); break;
    case "tree": need(spec.root?.t, "root{t,c[]} required"); tree(k, spec as TreeSpec); break;
    case "swimlane": need(Array.isArray(spec.lanes) && Array.isArray(spec.steps), "lanes[] and steps[] required"); swimlane(k, spec as SwimSpec); break;
    case "quadrant": quadrant(k, spec as QuadSpec); break;
    case "funnel": need(Array.isArray(spec.levels) && spec.levels.length, "levels[] required"); funnel(k, spec as FunnelSpec); break;
    case "cycle": need(Array.isArray(spec.steps) && spec.steps.length > 2, "steps[] (3+) required"); cycle(k, spec as CycleSpec); break;
    case "cards": need(Array.isArray(spec.cards) && spec.cards.length, "cards[] required"); cards(k, spec as CardsSpec); break;
    case "flow": need(Array.isArray(spec.steps) && spec.steps.length, "steps[] required"); flow(k, spec as FlowSpec); break;
  }
  return k.els;
}
