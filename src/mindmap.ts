/**
 * Mind Map Builder compatible mindmap generator for Obsidian Excalidraw.
 *
 * Emits the same element model as the "Mindmap Builder" script: text nodes with
 * `customData.mindmapOrder`, bound curved arrows with `customData.isBranch`, and
 * the Growth Strategy stored as `customData.growthMode` on the root node.
 * Image nodes (vault files) are supported; their pixel size is read from the file.
 */
import { createHash } from "node:crypto";
import { wOf, wrap, linesOf } from "./slides.js";
import { FRESH, luminance, mix, onColor, type Theme } from "./slide-theme.js";

export const GROWTH_MODES = ["Radial", "Right-facing", "Left-facing", "Right-Left", "Up-facing", "Down-facing", "Up-Down"] as const;
export type GrowthMode = (typeof GROWTH_MODES)[number];
export type MindImage = { path: string; w?: number; h?: number };
export type MindNode = { t: string; c?: MindNode[]; img?: MindImage };
export type MindOptions = { theme?: Theme; maxWidth?: number; imageWidth?: number; fontFamily?: number };

const FS = [30, 24, 20, 18];
const SW = [2, 3.5, 2.5, 2];
const GAPX = 80, GAPY = 16, GAPV = 70;

const fsOf = (l: number) => FS[Math.min(l, 3)];

/** Parse an indented markdown outline (first line = root) into a tree. `![alt](path)` lines become image nodes. */
export function parseOutline(md: string): MindNode {
  const rows = md.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const m = l.match(/^(\s*)(?:[-*+]\s+|#+\s+)?(.*)$/)!;
    return { d: m[1].replace(/\t/g, "  ").length, t: m[2].trim() };
  });
  if (!rows.length) throw new Error("Empty outline");
  const mk = (t: string): MindNode => {
    const im = t.match(/^!\[(.*?)\]\((.+?)\)$/);
    return im ? { t: im[1], img: { path: decodeURI(im[2]) } } : { t };
  };
  const root = mk(rows[0].t);
  const stack: { d: number; n: MindNode }[] = [{ d: rows[0].d - 1, n: root }];
  for (const r of rows.slice(1)) {
    while (stack.length > 1 && stack[stack.length - 1].d >= r.d) stack.pop();
    const n = mk(r.t);
    const p = stack[stack.length - 1].n;
    (p.c ??= []).push(n);
    stack.push({ d: r.d, n });
  }
  return root;
}

/** collect image nodes that still need their pixel size */
export function imageNodes(tree: MindNode): MindNode[] {
  return [...(tree.img && (!tree.img.w || !tree.img.h) ? [tree] : []), ...(tree.c ?? []).flatMap(imageNodes)];
}

type Box = { id: string; x: number; y: number; w: number; h: number };

export function buildMindmap(tree: MindNode, growthMode: GrowthMode = "Right-Left", opts: MindOptions = {}): any[] {
  const T = opts.theme ?? FRESH;
  const maxW = opts.maxWidth ?? 460, imgW = opts.imageWidth ?? 640, font = opts.fontFamily ?? 2;
  const PAL = T.series.map((s) => s.c);
  const els: any[] = [];
  let uid = 0;
  const id = (p: string) => `${p}${++uid}`;
  const kids = tree.c ?? [];

  /** text colour per level: branch colour for level 1, body ink below */
  const textColor = (lvl: number, color: string) => (lvl === 1 ? (luminance(color) > 0.3 ? mix(color, T.ink, 0.45) : color) : T.ink);
  const size = (n: MindNode, l: number): { w: number; h: number; text: string } => {
    if (n.img) {
      const iw = n.img.w ?? 800, ih = n.img.h ?? 600, w = Math.min(imgW, iw), h = Math.round((ih * w) / iw);
      return { w, h, text: "" };
    }
    const fs = fsOf(l), text = wrap(n.t, fs, maxW);
    return { w: Math.max(...text.split("\n").map((x) => wOf(x, fs))), h: Math.ceil(linesOf(text) * fs * 1.25), text };
  };

  // --- root ---
  const rootText = wrap(tree.t, FS[0], 640), rls = rootText.split("\n");
  const rtw = Math.max(...rls.map((x) => wOf(x, FS[0]))), rth = Math.ceil(rls.length * FS[0] * 1.25);
  const rw = rtw + 80, rh = rth + 44;
  const rootBox: Box = { id: "root", x: -rw / 2, y: -rh / 2, w: rw, h: rh };
  els.push({ type: "rectangle", id: "root", x: rootBox.x, y: rootBox.y, width: rw, height: rh, strokeColor: T.brand, backgroundColor: T.accent, fillStyle: "solid", strokeWidth: 3, roundness: { type: 3 }, boundElements: [{ type: "text", id: "rootT" }], customData: { growthMode, multicolor: true, mindmapOrder: 0 } });
  els.push({ type: "text", id: "rootT", x: -rtw / 2, y: -rth / 2, width: rtw, height: rth, text: rootText, originalText: rootText, fontSize: FS[0], fontFamily: font, textAlign: "center", verticalAlign: "middle", containerId: "root", strokeColor: onColor(T.accent), lineHeight: 1.25 });

  const arrow = (from: Box, to: Box, color: string, lvl: number, a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const bend: [number, number] = Math.abs(dx) >= Math.abs(dy) ? [dx * 0.5, dy * 0.12] : [dx * 0.12, dy * 0.5];
    els.push({ type: "arrow", id: id("b"), x: a[0], y: a[1], width: Math.abs(dx), height: Math.abs(dy), points: [[0, 0], bend, [dx, dy]], strokeColor: color, strokeWidth: SW[Math.min(lvl, 3)], roundness: { type: 2 }, startArrowhead: null, endArrowhead: null, startBinding: { elementId: from.id, focus: 0, gap: 4 }, endBinding: { elementId: to.id, focus: 0, gap: 4 }, customData: { isBranch: true } });
  };
  /** create the element for a node; (x, y) is its top-left corner */
  const makeNode = (n: MindNode, lvl: number, x: number, y: number, color: string, order: number, align: string): Box => {
    const s = size(n, lvl), nid = id("n");
    if (n.img) {
      const fileId = createHash("sha1").update(n.img.path).digest("hex");
      els.push({ type: "image", id: nid, x, y, width: s.w, height: s.h, fileId, status: "saved", scale: [1, 1], strokeColor: color, strokeWidth: 2, roundness: null, customData: { mindmapOrder: order, vaultPath: n.img.path } });
    } else {
      els.push({ type: "text", id: nid, x, y, width: s.w, height: s.h, text: s.text, originalText: s.text, fontSize: fsOf(lvl), fontFamily: font, lineHeight: 1.25, textAlign: align, verticalAlign: "top", strokeColor: textColor(lvl, color), customData: { mindmapOrder: order } });
    }
    return { id: nid, x, y, w: s.w, h: s.h };
  };

  // --- directional (left / right) ---
  const subH = (n: MindNode, l: number): number => {
    const own = size(n, l).h;
    if (!n.c?.length) return own;
    return Math.max(own, n.c.reduce((a, k) => a + subH(k, l + 1), 0) + GAPY * (n.c.length - 1));
  };
  const placeH = (n: MindNode, l: number, s: 1 | -1, parent: Box, color: string, order: number, cy: number) => {
    const sz = size(n, l);
    const pe = s === 1 ? parent.x + parent.w : parent.x;
    const x = s === 1 ? pe + GAPX : pe - GAPX - sz.w;
    const b = makeNode(n, l, x, cy - sz.h / 2, color, order, s === 1 ? "left" : "right");
    const pcy = parent.y + parent.h / 2;
    arrow(parent, b, color, l, [pe, pcy], [s === 1 ? x : x + sz.w, cy]);
    if (n.c?.length) {
      const sum = n.c.reduce((a, k) => a + subH(k, l + 1), 0) + GAPY * (n.c.length - 1);
      let y = cy - sum / 2;
      n.c.forEach((k, i) => { const kh = subH(k, l + 1); placeH(k, l + 1, s, b, color, i, y + kh / 2); y += kh + GAPY; });
    }
  };
  const sideH = (list: MindNode[], s: 1 | -1, colorOffset: number) => {
    const gap = GAPY * 2.5;
    const total = list.reduce((a, k) => a + subH(k, 1), 0) + gap * (list.length - 1);
    let y = -total / 2;
    list.forEach((n, i) => { const kh = subH(n, 1); placeH(n, 1, s, rootBox, PAL[(i + colorOffset) % PAL.length], i, y + kh / 2); y += kh + gap; });
  };

  // --- vertical (up / down) ---
  const subW = (n: MindNode, l: number): number => {
    const w = size(n, l).w + 28;
    if (!n.c?.length) return w;
    return Math.max(w, n.c.reduce((a, k) => a + subW(k, l + 1), 0));
  };
  const placeV = (n: MindNode, l: number, s: 1 | -1, parent: Box, color: string, order: number, cx: number) => {
    const sz = size(n, l);
    const py = s === 1 ? parent.y + parent.h : parent.y;
    const y = s === 1 ? py + GAPV : py - GAPV - sz.h;
    const b = makeNode(n, l, cx - sz.w / 2, y, color, order, "center");
    arrow(parent, b, color, l, [parent.x + parent.w / 2, py], [cx, s === 1 ? y : y + sz.h]);
    if (n.c?.length) {
      const sum = n.c.reduce((a, k) => a + subW(k, l + 1), 0);
      let x = cx - sum / 2;
      n.c.forEach((k, i) => { const kw = subW(k, l + 1); placeV(k, l + 1, s, b, color, i, x + kw / 2); x += kw; });
    }
  };
  const sideV = (list: MindNode[], s: 1 | -1, colorOffset: number) => {
    const total = list.reduce((a, k) => a + subW(k, 1), 0);
    let x = -total / 2;
    list.forEach((n, i) => { const kw = subW(n, 1); placeV(n, 1, s, rootBox, PAL[(i + colorOffset) % PAL.length], i, x + kw / 2); x += kw; });
  };

  // --- radial (clockwise from the top) ---
  const leaves = (n: MindNode): number => (n.c?.length ? n.c.reduce((a, k) => a + leaves(k), 0) : 1);
  const clip = (b: Box, tx: number, ty: number): [number, number] => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
    const k = Math.min(dx ? (b.w / 2 + 4) / Math.abs(dx) : Infinity, dy ? (b.h / 2 + 4) / Math.abs(dy) : Infinity);
    return [cx + dx * k, cy + dy * k];
  };
  const placeR = (n: MindNode, l: number, parent: Box, a0: number, a1: number, color: string, order: number, r0: number) => {
    const ang = (a0 + a1) / 2, r = r0 + (l === 1 ? 0 : 180 + (l - 1) * 20);
    const sz = size(n, l);
    const cx = Math.sin(ang) * r * 1.25, cy = -Math.cos(ang) * r;
    const b = makeNode(n, l, cx - sz.w / 2, cy - sz.h / 2, color, order, "center");
    const pc = [parent.x + parent.w / 2, parent.y + parent.h / 2];
    arrow(parent, b, color, l, clip(parent, cx, cy), clip(b, pc[0], pc[1]));
    if (n.c?.length) {
      const tot = leaves(n); let a = a0;
      n.c.forEach((k, i) => { const span = ((a1 - a0) * leaves(k)) / tot; placeR(k, l + 1, b, a, a + span, color, i, r); a += span; });
    }
  };

  const half = Math.ceil(kids.length / 2);
  switch (growthMode) {
    case "Right-facing": sideH(kids, 1, 0); break;
    case "Left-facing": sideH(kids, -1, 0); break;
    case "Right-Left": sideH(kids.slice(0, half), 1, 0); sideH(kids.slice(half), -1, half); break;
    case "Down-facing": sideV(kids, 1, 0); break;
    case "Up-facing": sideV(kids, -1, 0); break;
    case "Up-Down": sideV(kids.slice(0, half), 1, 0); sideV(kids.slice(half), -1, half); break;
    case "Radial": {
      const tot = kids.reduce((a, k) => a + leaves(k), 0); let a = 0;
      const r0 = Math.max(300, tot * 32);
      kids.forEach((k, i) => { const span = (2 * Math.PI * leaves(k)) / tot; placeR(k, 1, rootBox, a, a + span, PAL[i % PAL.length], i, r0); a += span; });
      break;
    }
  }
  return els;
}
