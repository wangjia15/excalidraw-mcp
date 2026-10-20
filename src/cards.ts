/**
 * Visual zettel cards: one framed 1600x900 card per idea, drawn mostly as graphics (an annotated paper figure,
 * a concept diagram, a chart) with a few numbered points beside it. Cards are built at the origin and later
 * placed as mind-map nodes by `buildMindmap`, so one drawing holds the map and all of its cards.
 */
import { createHash } from "node:crypto";
import { wOf, wrap, linesOf } from "./slides.js";
import { buildTemplate, TEMPLATE_KINDS, type TemplateKind } from "./templates.js";
import { mix, onColor, type Theme } from "./slide-theme.js";

type El = any;
export type FigureVisual = {
  kind: "figure"; path: string; w?: number; h?: number; caption?: string;
  /** numbered markers, x/y as fractions of the image (0..1) */
  marks?: { n: number | string; x: number; y: number }[];
  /** highlighted regions, fractions of the image */
  boxes?: { n?: number | string; x: number; y: number; w: number; h: number }[];
};
export type Visual =
  | FigureVisual
  | { kind: "template"; template: TemplateKind; spec: any }
  | { kind: "bars"; title?: string; unit?: string; items: { label: string; value: number; hl?: boolean }[] }
  | { kind: "matrix"; title?: string; rows?: string[]; cols?: string[]; values?: number[][]; pattern?: "causal" | "diagonal" | "local" | "full"; size?: number; showValues?: boolean }
  | { kind: "tensor"; steps: { label: string; dims?: number[]; op?: string }[] }
  | { kind: "stack"; title?: string; input?: string; output?: string; repeat?: string; layers: { label: string; kind?: "norm" | "attn" | "mlp" | "add" | "embed" | "head" | "other" }[]; residual?: [number, number][] }
  | { kind: "patches"; rows: number; cols: number; label?: string; cls?: boolean }
  | { kind: "sketch"; elements: El[] };
export type CardSpec = {
  id: string; title: string; type?: string; subtitle?: string;
  visual?: Visual | Visual[];
  points?: ({ n?: number | string; text: string } | string)[];
  takeaway?: string; source?: string; notes?: string; back?: string;
};
export type BuiltCard = { els: El[]; w: number; h: number; bgId: string; frameId: string; heading: string };

export const CARD_W = 1600, CARD_H = 900;
const LH = 1.3;
export const CARD_TYPES: Record<string, [string, string]> = {
  Q: ["问题", "#e8590c"], C: ["概念", "#1971c2"], M: ["方法", "#2f9e44"], D: ["推导", "#7048e8"],
  E: ["实验设置", "#495057"], R: ["结果", "#f08c00"], A: ["消融", "#0c8599"], K: ["批判", "#c92a2a"],
  I: ["启发", "#d6336c"], Z: ["永久卡", "#5f3dc4"],
};
const TYPE_ALIAS: Record<string, string> = {
  question: "Q", concept: "C", method: "M", derivation: "D", setup: "E", result: "R", ablation: "A", critique: "K", insight: "I", permanent: "Z",
};
const MARK = "#e03131";

export function cardType(c: CardSpec): [string, string] {
  const t = c.type ? TYPE_ALIAS[c.type.toLowerCase()] ?? c.type.toUpperCase() : /^Z-/.test(c.id) ? "Z" : c.id.match(/-([A-Z])\d*$/)?.[1] ?? "C";
  return CARD_TYPES[t] ?? CARD_TYPES.C;
}

/* ---- geometry ---- */

function bounds(els: El[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of els) {
    if (e.points?.length) for (const [px, py] of e.points) { x0 = Math.min(x0, e.x + px); y0 = Math.min(y0, e.y + py); x1 = Math.max(x1, e.x + px); y1 = Math.max(y1, e.y + py); }
    else { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x + (e.width ?? 0)); y1 = Math.max(y1, e.y + (e.height ?? 0)); }
  }
  return { x0, y0, x1, y1 };
}

/** uniformly scale elements by s about (ox, oy) then move that point to (tx, ty) */
export function transform(els: El[], s: number, ox: number, oy: number, tx: number, ty: number): El[] {
  return els.map((e) => {
    const o = { ...e, x: tx + (e.x - ox) * s, y: ty + (e.y - oy) * s };
    if (e.width !== undefined) o.width = e.width * s;
    if (e.height !== undefined) o.height = e.height * s;
    if (e.points) o.points = e.points.map(([px, py]: number[]) => [px * s, py * s]);
    if (e.fontSize) o.fontSize = e.fontSize * s;
    if (e.strokeWidth) o.strokeWidth = Math.max(1, e.strokeWidth * Math.max(s, 0.5));
    return o;
  });
}

/** fit elements into a box (uniform scale, centred, never enlarged beyond maxScale) */
function fit(els: El[], bx: number, by: number, bw: number, bh: number, maxScale = 1.6): El[] {
  if (!els.length) return els;
  const b = bounds(els), w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0);
  const s = Math.min(bw / w, bh / h, maxScale);
  return transform(els, s, b.x0, b.y0, bx + (bw - w * s) / 2, by + (bh - h * s) / 2);
}

/** give every element (and every reference to it) a fresh 8-char id with the given 3-char prefix */
export function reid(els: El[], prefix: string): El[] {
  const map = new Map<string, string>();
  let n = 0;
  for (const e of els) if (e.id && !map.has(e.id)) map.set(e.id, `${prefix}${(n++).toString(36).padStart(5, "0")}`);
  const m = (i: any) => (typeof i === "string" && map.has(i) ? map.get(i)! : i);
  return els.map((e) => {
    const o = { ...e, id: m(e.id) };
    if (o.containerId) o.containerId = m(o.containerId);
    if (o.frameId) o.frameId = m(o.frameId);
    if (o.boundElements) o.boundElements = o.boundElements.map((b: any) => ({ ...b, id: m(b.id) }));
    if (o.groupIds) o.groupIds = o.groupIds.map((g: string) => `${prefix}g${g}`);
    for (const k of ["startBinding", "endBinding"]) if (o[k]) o[k] = { ...o[k], elementId: m(o[k].elementId) };
    return o;
  });
}

/* ---- element factory ---- */

class Pen {
  els: El[] = [];
  private n = 0;
  constructor(public font: number, public ink: string) {}
  id() { return `e${++this.n}`; }
  rect(x: number, y: number, w: number, h: number, o: El = {}): El {
    const e = { id: this.id(), type: "rectangle", x, y, width: w, height: h, strokeColor: "transparent", strokeWidth: 0, backgroundColor: "transparent", fillStyle: "solid", roughness: 0, roundness: null, ...o };
    this.els.push(e); return e;
  }
  ell(x: number, y: number, d: number, o: El = {}): El {
    const e = { id: this.id(), type: "ellipse", x, y, width: d, height: d, strokeColor: "transparent", strokeWidth: 0, backgroundColor: MARK, fillStyle: "solid", roughness: 0, ...o };
    this.els.push(e); return e;
  }
  text(x: number, y: number, t: string, fs: number, color = this.ink, o: El = {}): El {
    const ls = t.split("\n"), w = Math.max(...ls.map((l) => wOf(l, fs))), align = o.textAlign ?? "left", bw = o.boxW ?? w;
    const dx = align === "center" ? (bw - w) / 2 : align === "right" ? bw - w : 0;
    const { boxW: _b, ...rest } = o;
    const e = { id: this.id(), type: "text", x: x + dx, y, width: w, height: Math.ceil(ls.length * fs * LH), text: t, originalText: t, fontSize: fs, fontFamily: this.font, lineHeight: LH, strokeColor: color, textAlign: align, verticalAlign: "top", roughness: 0, ...rest };
    this.els.push(e); return e;
  }
  /** rectangle with a bound, centred label */
  box(x: number, y: number, w: number, h: number, label: string, fs: number, fill: string, stroke: string, color = this.ink, o: El = {}): El {
    const t = wrap(label, fs, w - 20), th = Math.ceil(linesOf(t) * fs * LH), hh = Math.max(h, th + 20);
    const tw = Math.max(...t.split("\n").map((l) => wOf(l, fs)));
    const sid = this.id(), tid = this.id();
    const s = { id: sid, type: "rectangle", x, y, width: w, height: hh, strokeColor: stroke, strokeWidth: 2, backgroundColor: fill, fillStyle: "solid", roughness: 0, roundness: { type: 3 }, boundElements: [{ type: "text", id: tid }], ...o };
    this.els.push(s);
    this.els.push({ id: tid, type: "text", x: x + (w - tw) / 2, y: y + (hh - th) / 2, width: tw, height: th, text: t, originalText: t, fontSize: fs, fontFamily: this.font, lineHeight: LH, strokeColor: color, textAlign: "center", verticalAlign: "middle", containerId: sid, roughness: 0 });
    return s;
  }
  line(pts: [number, number][], o: El = {}, arrow = false): El {
    const [x0, y0] = pts[0], rel = pts.map(([x, y]) => [x - x0, y - y0]);
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
    const e = { id: this.id(), type: arrow ? "arrow" : "line", x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), points: rel, strokeColor: this.ink, strokeWidth: 2.5, roughness: 0, roundness: null, startArrowhead: null, endArrowhead: arrow ? "arrow" : null, ...o };
    this.els.push(e); return e;
  }
  poly(pts: [number, number][], fill: string, stroke: string): El {
    return this.line([...pts, pts[0]], { backgroundColor: fill, fillStyle: "solid", strokeColor: stroke, strokeWidth: 2, polygon: true });
  }
  badge(cx: number, cy: number, label: string | number, d = 46, fill = MARK) {
    this.ell(cx - d / 2, cy - d / 2, d, { backgroundColor: fill, strokeColor: "#ffffff", strokeWidth: 3 });
    const fs = Math.round(d * 0.55);
    this.text(cx - d / 2, cy - (fs * LH) / 2, String(label), fs, "#ffffff", { textAlign: "center", boxW: d });
  }
}

/* ---- visuals (drawn at their own scale, then fitted into the card) ---- */

function figure(p: Pen, v: FigureVisual) {
  const IW = 1000, IH = Math.round(((v.h ?? 600) * IW) / (v.w ?? 1000));
  p.rect(-6, -6, IW + 12, IH + 12, { backgroundColor: "#ffffff", strokeColor: "#ced4da", strokeWidth: 1.5 });
  p.els.push({ id: p.id(), type: "image", x: 0, y: 0, width: IW, height: IH, fileId: createHash("sha1").update(v.path).digest("hex"), status: "saved", scale: [1, 1], strokeColor: "transparent", strokeWidth: 0, roundness: null, customData: { vaultPath: v.path } });
  for (const b of v.boxes ?? []) {
    p.rect(b.x * IW, b.y * IH, b.w * IW, b.h * IH, { strokeColor: MARK, strokeWidth: 4, strokeStyle: "dashed", roundness: { type: 3 } });
    if (b.n !== undefined) p.badge(b.x * IW, b.y * IH, b.n);
  }
  for (const m of v.marks ?? []) p.badge(m.x * IW, m.y * IH, m.n);
  if (v.caption) p.text(0, IH + 18, wrap(v.caption, 26, IW), 26, "#5f6368");
}

function bars(p: Pen, v: Extract<Visual, { kind: "bars" }>, color: string) {
  const max = Math.max(...v.items.map((i) => Math.abs(i.value)), 1e-9), labW = Math.max(...v.items.map((i) => wOf(i.label, 26))) + 20, BL = 620;
  let y = 0;
  if (v.title) { p.text(0, 0, v.title, 30, p.ink); y = 56; }
  for (const it of v.items) {
    const w = Math.max(6, (Math.abs(it.value) / max) * BL), c = it.hl ? MARK : color;
    p.text(0, y + 8, it.label, 26, p.ink, { textAlign: "right", boxW: labW - 20 });
    p.rect(labW, y, w, 44, { backgroundColor: it.hl ? c : mix(c, "#ffffff", 0.35), roundness: { type: 3 } });
    p.text(labW + w + 12, y + 8, `${it.value}${v.unit ?? ""}`, 26, it.hl ? MARK : p.ink);
    y += 62;
  }
  p.line([[labW, -4 + (v.title ? 56 : 0)], [labW, y - 10]], { strokeColor: "#adb5bd", strokeWidth: 2 });
}

function matrix(p: Pen, v: Extract<Visual, { kind: "matrix" }>, color: string) {
  const n = v.values?.length ?? v.rows?.length ?? v.size ?? 6, m = v.values?.[0]?.length ?? v.cols?.length ?? n;
  const gen = (i: number, j: number) => {
    switch (v.pattern) {
      case "causal": return j > i ? NaN : 0.25 + 0.75 * ((i * 7 + j * 3) % 5) / 4;
      case "diagonal": return i === j ? 1 : 0.12;
      case "local": return Math.abs(i - j) <= 1 ? 0.9 - Math.abs(i - j) * 0.35 : 0.06;
      default: return 0.2 + 0.8 * ((i * 5 + j * 11) % 7) / 6;
    }
  };
  const vals = v.values ?? Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => gen(i, j)));
  const flat = vals.flat().filter((x) => Number.isFinite(x)), lo = Math.min(...flat), hi = Math.max(...flat);
  const C = 64, lw = v.rows ? Math.max(...v.rows.map((r) => wOf(r, 24))) + 16 : 0, top = (v.title ? 56 : 0) + (v.cols ? 44 : 0);
  if (v.title) p.text(0, 0, v.title, 30, p.ink);
  v.cols?.forEach((c, j) => p.text(lw + j * C, top - 40, c, 24, "#5f6368", { textAlign: "center", boxW: C }));
  vals.forEach((row, i) => {
    if (v.rows?.[i]) p.text(0, top + i * C + 18, v.rows[i], 24, "#5f6368", { textAlign: "right", boxW: lw - 12 });
    row.forEach((x, j) => {
      const masked = !Number.isFinite(x), t = masked ? 0 : hi > lo ? (x - lo) / (hi - lo) : 1;
      p.rect(lw + j * C, top + i * C, C, C, { backgroundColor: masked ? "#e9ecef" : mix(color, "#ffffff", 1 - (0.12 + 0.88 * t)), strokeColor: "#ffffff", strokeWidth: 2 });
      if (masked) p.text(lw + j * C, top + i * C + 18, "−∞", 22, "#adb5bd", { textAlign: "center", boxW: C });
      else if (v.showValues) p.text(lw + j * C, top + i * C + 18, String(+x.toFixed(2)), 20, t > 0.55 ? "#ffffff" : p.ink, { textAlign: "center", boxW: C });
    });
  });
}

function tensor(p: Pen, v: Extract<Visual, { kind: "tensor" }>, colors: string[]) {
  const f = (d: number) => Math.min(230, 34 + 24 * Math.log2(Math.max(1, d) + 1));
  const sizes = v.steps.map((s) => {
    const dims = s.dims ?? (s.label.match(/\d+/g) ?? []).map(Number).slice(-3);
    const [a, b, c] = dims.length >= 3 ? dims.slice(-3) : dims.length === 2 ? [dims[0], dims[1], 0] : [dims[0] ?? 8, 1, 0];
    return { h: f(a), w: dims.length === 1 ? 40 : f(b), d: c ? f(c) * 0.45 : 0 };
  });
  const H = Math.max(...sizes.map((s) => s.h + s.d)), GAP = 220;
  let x = 0;
  v.steps.forEach((s, i) => {
    const { w, h, d } = sizes[i], col = colors[i % colors.length], y = H - h;
    if (d) {
      p.poly([[x, y], [x + d, y - d], [x + d + w, y - d], [x + w, y]], mix(col, "#ffffff", 0.55), col);
      p.poly([[x + w, y], [x + w + d, y - d], [x + w + d, y - d + h], [x + w, y + h]], mix(col, "#000000", 0.15), col);
    }
    p.rect(x, y, w, h, { backgroundColor: mix(col, "#ffffff", 0.25), strokeColor: col, strokeWidth: 2 });
    const lw = Math.max(w + d, wOf(s.label, 26));
    p.text(x + (w + d - lw) / 2, H + 18, s.label, 26, p.ink, { textAlign: "center", boxW: lw });
    if (i < v.steps.length - 1) {
      const ax = x + w + d + 24, ay = H - h / 2;
      p.line([[ax, ay], [ax + GAP - 48, ay]], { strokeWidth: 3 }, true);
      const op = v.steps[i + 1].op;
      if (op) { const t = wrap(op, 22, GAP + 40); p.text(ax, ay - 12 - Math.ceil(linesOf(t) * 22 * LH), t, 22, MARK, { textAlign: "center", boxW: GAP - 48 }); }
    }
    x += w + d + GAP;
  });
}

const STACK_COLORS: Record<string, string> = { norm: "#fab005", attn: "#fd7e14", mlp: "#4dabf7", add: "#ffffff", embed: "#ced4da", head: "#9775fa", other: "#e9ecef" };
function stack(p: Pen, v: Extract<Visual, { kind: "stack" }>) {
  const W = 380, BH = 64, G = 34, n = v.layers.length;
  const yOf = (i: number) => (n - 1 - i) * (BH + G) + (v.output ? 80 : 0) + (v.title ? 56 : 0); // layer 0 at the bottom
  if (v.title) p.text(0, 0, v.title, 30, p.ink, { textAlign: "center", boxW: W });
  const boxes = v.layers.map((l, i) => {
    const k = l.kind ?? "other", y = yOf(i);
    if (k === "add") {
      p.ell(W / 2 - 22, y + BH / 2 - 22, 44, { backgroundColor: "#ffffff", strokeColor: p.ink, strokeWidth: 2.5 });
      p.text(W / 2 - 22, y + BH / 2 - 20, "+", 32, p.ink, { textAlign: "center", boxW: 44 });
      return { y: y + BH / 2 - 22, h: 44, cy: y + BH / 2 };
    }
    p.box(0, y, W, BH, l.label, 26, mix(STACK_COLORS[k] ?? STACK_COLORS.other, "#ffffff", 0.45), mix(STACK_COLORS[k] ?? "#868e96", "#000000", 0.2));
    return { y, h: BH, cy: y + BH / 2 };
  });
  for (let i = 0; i < n - 1; i++) p.line([[W / 2, boxes[i].y], [W / 2, boxes[i + 1].y + boxes[i + 1].h]], { strokeWidth: 2.5 }, true);
  for (const [a, b] of v.residual ?? []) {
    const ya = (boxes[a]?.y ?? 0) + (boxes[a]?.h ?? 0) + 14, yb = boxes[b]?.cy ?? 0;
    p.line([[W / 2, ya], [W + 56, ya], [W + 56, yb], [W / 2 + 26, yb]], { strokeColor: "#868e96", strokeWidth: 2.5 }, true);
  }
  const bottom = yOf(0) + BH;
  if (v.input) { p.text(0, bottom + 50, v.input, 26, "#5f6368", { textAlign: "center", boxW: W }); p.line([[W / 2, bottom + 46], [W / 2, bottom + 6]], { strokeWidth: 2.5 }, true); }
  if (v.output) { const t = yOf(n - 1); p.text(0, t - 76, v.output, 26, "#5f6368", { textAlign: "center", boxW: W }); p.line([[W / 2, t - 6], [W / 2, t - 40]], { strokeWidth: 2.5 }, true); }
  if (v.repeat) {
    const t = yOf(n - 1) - 16, b = bottom + 16;
    p.rect(-24, t, W + 110, b - t, { strokeColor: "#868e96", strokeWidth: 2, strokeStyle: "dashed", roundness: { type: 3 } });
    p.text(W + 100, (t + b) / 2 - 20, v.repeat, 32, MARK);
  }
}

function patches(p: Pen, v: Extract<Visual, { kind: "patches" }>, colors: string[]) {
  const S = 320, cw = S / v.cols, ch = S / v.rows;
  for (let i = 0; i < v.rows; i++) for (let j = 0; j < v.cols; j++)
    p.rect(j * cw, i * ch, cw, ch, { backgroundColor: mix(colors[(i + j) % colors.length], "#ffffff", 0.55), strokeColor: "#ffffff", strokeWidth: 3 });
  p.rect(0, 0, S, S, { strokeColor: p.ink, strokeWidth: 2.5 });
  p.line([[S + 30, S / 2], [S + 130, S / 2]], { strokeWidth: 3 }, true);
  const total = v.rows * v.cols, show = Math.min(total, 7), T = 46;
  let x = S + 160;
  if (v.cls) { p.rect(x, S / 2 - T / 2, T, T, { backgroundColor: MARK, strokeColor: MARK, strokeWidth: 2, roundness: { type: 3 } }); p.text(x - 10, S / 2 + T / 2 + 10, "CLS", 22, MARK, { textAlign: "center", boxW: T + 20 }); x += T + 14; }
  for (let k = 0; k < show; k++) {
    const i = Math.floor(k / v.cols), j = k % v.cols;
    p.rect(x, S / 2 - T / 2, T, T, { backgroundColor: mix(colors[(i + j) % colors.length], "#ffffff", 0.55), strokeColor: p.ink, strokeWidth: 1.5 });
    x += T + 8;
  }
  if (total > show) { p.text(x, S / 2 - 20, "…", 32, p.ink); x += 40; }
  p.text(S + 160, S / 2 + T / 2 + 44, v.label ?? `${v.rows}×${v.cols} = ${total} 个 patch token`, 26, p.ink);
}

function visual(v: Visual, font: number, color: string, T: Theme): El[] {
  const p = new Pen(font, T.ink), colors = T.series.map((s) => s.c);
  switch (v.kind) {
    case "figure": figure(p, v); break;
    case "bars": bars(p, v, color); break;
    case "matrix": matrix(p, v, color); break;
    case "tensor": tensor(p, v, colors); break;
    case "stack": stack(p, v); break;
    case "patches": patches(p, v, colors); break;
    case "template":
      if (!(TEMPLATE_KINDS as readonly string[]).includes(v.template)) throw new Error(`unknown template ${v.template}`);
      return buildTemplate(v.template, v.spec, font === 5 ? "hand" : "sans");
    case "sketch":
      return (v.elements ?? []).map((e, i) => {
        const o = { roughness: 1, strokeWidth: 2, ...e, id: e.id ?? `s${i}` };
        if (o.type === "text") { o.fontFamily ??= 5; o.originalText ??= o.text; o.lineHeight ??= 1.25; o.width ??= wOf(o.text, o.fontSize ?? 20); o.height ??= Math.ceil(linesOf(o.text) * (o.fontSize ?? 20) * 1.25); }
        return o;
      });
    default: throw new Error(`unknown visual kind ${(v as any).kind}`);
  }
  return p.els;
}

/* ---- card ---- */

export function buildCard(c: CardSpec, T: Theme, font = 2, series?: string): BuiltCard {
  if (!c.id || !c.title) throw new Error("every card needs id and title");
  const W = CARD_W, H = CARD_H, [typeLabel, color] = cardType(c);
  const p = new Pen(font, T.ink);
  const bg = p.rect(0, 0, W, H, { backgroundColor: T.card, strokeColor: color, strokeWidth: 4, roundness: { type: 3 } });

  // header: type chip, id, assertion title
  const chipW = wOf(typeLabel, 28) + 44;
  p.box(44, 36, chipW, 52, typeLabel, 28, color, color, onColor(color));
  p.text(44 + chipW + 18, 46, c.id, 28, T.ink3);
  const tt = wrap(c.title, 48, W - 100), th = Math.ceil(linesOf(tt) * 48 * LH);
  p.text(44, 110, tt, 48, T.title);
  let top = 110 + th + 10;
  if (c.subtitle) { const st = wrap(c.subtitle, 28, W - 100); p.text(44, top, st, 28, T.ink2); top += Math.ceil(linesOf(st) * 28 * LH) + 6; }
  p.rect(44, top + 10, W - 88, 3, { backgroundColor: mix(color, T.card, 0.6) });
  top += 36;
  const bottom = H - 76;

  // footer
  if (c.source) p.text(44, H - 58, `来源：${c.source}`, 24, T.ink3);
  if (series) p.text(W - 44 - Math.max(200, wOf(series, 24)), H - 58, series, 24, T.ink3, { textAlign: "right", boxW: Math.max(200, wOf(series, 24)) });

  // side panel: numbered points + takeaway
  const pts = (c.points ?? []).map((x, i) => (typeof x === "string" ? { n: i + 1, text: x } : { n: x.n ?? i + 1, text: x.text }));
  const visuals = c.visual ? (Array.isArray(c.visual) ? c.visual : [c.visual]) : [];
  const hasSide = pts.length > 0 || !!c.takeaway;
  const sideW = visuals.length ? 480 : W - 88, sx = W - 44 - sideW;
  if (hasSide) {
    const marked = new Set(visuals.flatMap((v) => (v.kind === "figure" ? [...(v.marks ?? []), ...(v.boxes ?? [])].map((m) => String(m.n)) : [])));
    let fs = visuals.length ? 27 : 32;
    const layout = (fs: number) => pts.map((pt) => wrap(pt.text, fs, sideW - 70));
    let wrapped = layout(fs);
    const takeH = (f: number) => (c.takeaway ? Math.ceil(linesOf(wrap(c.takeaway, f, sideW - 44)) * f * LH) + 40 : 0);
    const need = (f: number, w: string[]) => w.reduce((a, t) => a + Math.max(46, linesOf(t) * f * LH) + 22, 0) + takeH(f) + 20;
    while (fs > 20 && need(fs, wrapped) > bottom - top) wrapped = layout(--fs);
    let y = top;
    pts.forEach((pt, i) => {
      p.badge(sx + 23, y + 23, pt.n, 46, marked.has(String(pt.n)) ? MARK : color);
      p.text(sx + 66, y + Math.max(0, (46 - fs * LH) / 2), wrapped[i], fs, T.ink);
      y += Math.max(46, linesOf(wrapped[i]) * fs * LH) + 22;
    });
    if (c.takeaway) {
      const t = wrap(c.takeaway, fs, sideW - 44), h = takeH(fs) - 10;
      p.rect(sx, Math.max(y + 8, bottom - h), sideW, h, { backgroundColor: mix(color, T.card, 0.88), strokeColor: color, strokeWidth: 2, roundness: { type: 3 } });
      p.text(sx + 22, Math.max(y + 8, bottom - h) + 15, t, fs, T.ink);
    }
  }

  // visuals fill the rest; two visuals sit side by side (wide area) or stacked
  if (visuals.length) {
    const ax = 44, aw = (hasSide ? sx - 40 : W - 44) - ax, ah = bottom - top;
    const parts = visuals.slice(0, 2).map((v, i) => reid(visual(v, font, color, T), `v${i}_`)); // keep sketch/template ids apart
    // diagrams are drawn small and may grow to fill their slot; figures are bitmaps and stay near native size
    const maxS = (i: number) => (visuals[i].kind === "figure" ? 1.6 : 3);
    const sideBySide = [[ax, top, aw / 2 - 16, ah], [ax + aw / 2 + 16, top, aw / 2 - 16, ah]];
    const stacked = [[ax, top, aw, ah / 2 - 12], [ax, top + ah / 2 + 12, aw, ah / 2 - 12]];
    // two visuals: the arrangement where the smaller of the two ends up larger
    const worst = (slots: number[][]) => Math.min(...parts.map((els, i) => {
      const b = bounds(els);
      return Math.min(slots[i][2] / Math.max(1, b.x1 - b.x0), slots[i][3] / Math.max(1, b.y1 - b.y0), maxS(i));
    }));
    const slots = parts.length === 1 ? [[ax, top, aw, ah]] : worst(sideBySide) >= worst(stacked) ? sideBySide : stacked;
    parts.forEach((els, i) => p.els.push(...fit(els, slots[i][0], slots[i][1], slots[i][2], slots[i][3], maxS(i))));
  }

  const frameId = p.id();
  const heading = `${c.id} ${c.title}`.replace(/[#|[\]^:\\]/g, " ").replace(/\s+/g, " ").trim();
  const els = p.els.map((e) => ({ ...e, frameId }));
  els.push({
    type: "frame", id: frameId, x: 0, y: 0, width: W, height: H, name: heading,
    strokeColor: "transparent", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, roundness: null,
    customData: { slideshow: { schemaVersion: 2, kind: "frame", order: 0, ...(c.notes ? { notes: c.notes } : {}) } },
  });
  return { els, w: W, h: H, bgId: bg.id, frameId, heading };
}

/** build, scale and re-id a card so many cards can share one drawing */
export function placeableCard(c: CardSpec, T: Theme, font: number, series: string | undefined, scale: number, index: number): BuiltCard {
  const b = buildCard(c, T, font, series);
  const prefix = `k${index.toString(36).padStart(2, "0")}`;
  const ids = new Map(b.els.map((e, i) => [e.id, i]));
  const els = reid(transform(b.els, scale, 0, 0, 0, 0), prefix);
  return { els, w: b.w * scale, h: b.h * scale, bgId: els[ids.get(b.bgId)!].id, frameId: els[ids.get(b.frameId)!].id, heading: b.heading };
}
