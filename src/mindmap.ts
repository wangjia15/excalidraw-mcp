/**
 * XMind-style mindmap generator, compatible with the Obsidian "Mindmap Builder" script.
 *
 * Visual language (XMind "colourful branches"):
 *   root      capsule in the theme accent colour
 *   level 1   solid rounded box in the branch colour, white text
 *   level 2   tinted rounded box with a branch-coloured border
 *   level 3+  plain text sitting on a branch-coloured underline
 *   branches  smooth curves that taper with depth
 *
 * Data model (Mindmap Builder): text-bearing nodes with `customData.mindmapOrder`, bound curved arrows with
 * `customData.isBranch`, the Growth Strategy in the root's `customData.growthMode`. Image nodes (vault files)
 * are supported. Optional marker frames (no children, not clipped) turn the map into a Slideshow deck: an overview
 * frame, then one 16:9 frame per branch (long branches are split) with the branch outline as presenter notes.
 */
import { createHash } from "node:crypto";
import { wOf, wrap, linesOf } from "./slides.js";
import { FRESH, onColor, type Theme } from "./slide-theme.js";

export const GROWTH_MODES = ["Radial", "Right-facing", "Left-facing", "Right-Left", "Up-facing", "Down-facing", "Up-Down"] as const;
export type GrowthMode = (typeof GROWTH_MODES)[number];
export type MindImage = { path: string; w?: number; h?: number };
export type MindNode = { t: string; c?: MindNode[]; img?: MindImage };
export type MindOptions = {
  theme?: Theme;
  maxWidth?: number;          // wrap width of level-3+ text (default 440)
  imageWidth?: number;        // display width of image nodes (default 640)
  fontFamily?: number;        // Excalidraw font id (2 = system sans)
  frames?: boolean;           // add Slideshow marker frames (default true)
  frameHeight?: number;       // content height that fits one frame (default 760)
};

const GAPX = 64, GAPY = 12, GAP_L2 = 22, GAP_L1 = 40, GAPV = 56;
const pad = [0, 24, 16, 0];
const FS = [36, 26, 21, 19, 18];
const SW = [3, 5, 3.5, 2.5, 2.5];
const fsOf = (l: number) => FS[Math.min(l, 4)];

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

/** markdown bullet list of a subtree, used as presenter notes */
function outline(n: MindNode, depth = 0): string[] {
  const label = n.img ? `[图] ${n.t}` : n.t;
  return [`${"  ".repeat(depth)}- ${label}`, ...(n.c ?? []).flatMap((k) => outline(k, depth + 1))];
}

type BB = { x0: number; y0: number; x1: number; y1: number };
type Box = { id: string; x: number; y: number; w: number; h: number; ay: number };
const union = (a: BB | null, b: BB): BB => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : b);
const bbOf = (b: Box): BB => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h });

export function buildMindmap(tree: MindNode, growthMode: GrowthMode = "Right-Left", opts: MindOptions = {}): any[] {
  const T = opts.theme ?? FRESH;
  const maxW3 = opts.maxWidth ?? 520, imgW = opts.imageWidth ?? 600, font = opts.fontFamily ?? 2;
  const wantFrames = opts.frames ?? true, frameH = opts.frameHeight ?? 760;
  const series = T.series;
  const els: any[] = [];
  let uid = 0;
  const id = (p: string) => `${p}${++uid}`;
  const kids = tree.c ?? [];

  type Sz = { w: number; h: number; text: string; fs: number; kind: "image" | "box" | "plain" };
  const size = (n: MindNode, l: number): Sz => {
    if (n.img) {
      const iw = n.img.w ?? 800, ih = n.img.h ?? 600, w = Math.min(imgW, iw), h = Math.round((ih * w) / iw);
      return { w: w + 16, h: h + 16, text: "", fs: 0, kind: "image" };
    }
    const fs = fsOf(l), boxed = l <= 2, px = boxed ? pad[l] : 4, py = boxed ? (l === 1 ? 12 : 8) : 5;
    const text = wrap(n.t, fs, l === 1 ? 340 : l === 2 ? 440 : maxW3);
    const tw = Math.max(...text.split("\n").map((x) => wOf(x, fs))), th = Math.ceil(linesOf(text) * fs * 1.3);
    return { w: tw + px * 2, h: th + py * 2 + (boxed ? 0 : 6), text, fs, kind: boxed ? "box" : "plain" };
  };

  // --- root: capsule ---
  const rootFs = FS[0], rootText = wrap(tree.t, rootFs, 620), rls = rootText.split("\n");
  const rtw = Math.max(...rls.map((x) => wOf(x, rootFs))), rth = Math.ceil(rls.length * rootFs * 1.3);
  const rw = rtw + 100, rh = rth + 56;
  const rootBox: Box = { id: "root", x: -rw / 2, y: -rh / 2, w: rw, h: rh, ay: 0 };
  els.push({ type: "rectangle", id: "root", x: rootBox.x, y: rootBox.y, width: rw, height: rh, strokeColor: T.brand, backgroundColor: T.accent, fillStyle: "solid", strokeWidth: 3, roundness: { type: 3 }, boundElements: [{ type: "text", id: "rootT" }], customData: { growthMode, multicolor: true, mindmapOrder: 0 } });
  els.push({ type: "text", id: "rootT", x: -rtw / 2, y: -rth / 2, width: rtw, height: rth, text: rootText, originalText: rootText, fontSize: rootFs, fontFamily: font, textAlign: "center", verticalAlign: "middle", containerId: "root", strokeColor: onColor(T.accent), lineHeight: 1.3 });

  const branchColor = (i: number) => series[i % series.length];

  const arrow = (from: Box, to: Box, color: string, lvl: number, a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const pts: [number, number][] = horizontal
      ? [[0, 0], [dx * 0.42, dy * 0.04], [dx * 0.62, dy * 0.86], [dx, dy]]
      : [[0, 0], [dx * 0.04, dy * 0.42], [dx * 0.86, dy * 0.62], [dx, dy]];
    els.push({ type: "arrow", id: id("b"), x: a[0], y: a[1], width: Math.abs(dx), height: Math.abs(dy), points: pts, strokeColor: color, strokeWidth: SW[Math.min(lvl, 4)], roundness: { type: 2 }, startArrowhead: null, endArrowhead: null, startBinding: { elementId: from.id, focus: 0, gap: 2 }, endBinding: { elementId: to.id, focus: 0, gap: 2 }, customData: { isBranch: true } });
  };

  /** create the element(s) of a node; (x, y) is the top-left corner */
  const makeNode = (n: MindNode, lvl: number, x: number, y: number, bi: number, order: number, align: string): Box => {
    const s = size(n, lvl), c = branchColor(bi), nid = id("n");
    if (s.kind === "image") {
      const fileId = createHash("sha1").update(n.img!.path).digest("hex");
      els.push({ type: "rectangle", id: nid, x, y, width: s.w, height: s.h, strokeColor: c.c, strokeWidth: 3, backgroundColor: T.card, fillStyle: "solid", roundness: { type: 3 }, customData: { mindmapOrder: order } });
      els.push({ type: "image", id: id("i"), x: x + 8, y: y + 8, width: s.w - 16, height: s.h - 16, fileId, status: "saved", scale: [1, 1], strokeColor: "transparent", strokeWidth: 0, roundness: null, customData: { vaultPath: n.img!.path } });
      return { id: nid, x, y, w: s.w, h: s.h, ay: y + s.h / 2 };
    }
    if (s.kind === "box") {
      const tid = id("t"), fill = lvl === 1 ? c.c : c.bg, ink = lvl === 1 ? onColor(c.c) : T.ink;
      els.push({ type: "rectangle", id: nid, x, y, width: s.w, height: s.h, strokeColor: c.c, strokeWidth: lvl === 1 ? 0 : 2.5, backgroundColor: fill, fillStyle: "solid", roundness: { type: 3 }, boundElements: [{ type: "text", id: tid }], customData: { mindmapOrder: order } });
      const tw = s.w - pad[lvl] * 2, th = s.h - (lvl === 1 ? 24 : 16);
      els.push({ type: "text", id: tid, x: x + (s.w - tw) / 2, y: y + (s.h - th) / 2, width: tw, height: th, text: s.text, originalText: s.text, fontSize: s.fs, fontFamily: font, lineHeight: 1.3, textAlign: "center", verticalAlign: "middle", containerId: nid, strokeColor: ink, customData: { mindmapOrder: order } });
      return { id: nid, x, y, w: s.w, h: s.h, ay: y + s.h / 2 };
    }
    // plain text on an underline
    els.push({ type: "text", id: nid, x: x + 4, y: y + 2, width: s.w - 8, height: s.h - 8, text: s.text, originalText: s.text, fontSize: s.fs, fontFamily: font, lineHeight: 1.3, textAlign: align, verticalAlign: "top", strokeColor: T.ink, customData: { mindmapOrder: order } });
    els.push({ type: "line", id: id("u"), x, y: y + s.h - 2, width: s.w, height: 0, points: [[0, 0], [s.w, 0]], strokeColor: c.c, strokeWidth: 2.5, roundness: null, startArrowhead: null, endArrowhead: null });
    return { id: nid, x, y, w: s.w, h: s.h, ay: y + s.h - 2 };
  };

  // --- directional (left / right) ---
  const gapBetween = (l: number) => (l === 1 ? GAP_L2 : GAPY);
  const subH = (n: MindNode, l: number): number => {
    const own = size(n, l).h;
    if (!n.c?.length) return own;
    const g = gapBetween(l + 1);
    return Math.max(own, n.c.reduce((a, k) => a + subH(k, l + 1), 0) + g * (n.c.length - 1));
  };
  type Branch = { n: MindNode; box: Box; childBBs: BB[]; bb: BB };
  const branches: Branch[] = [];
  const placeH = (n: MindNode, l: number, s: 1 | -1, parent: Box, bi: number, order: number, cy: number): { bb: BB; box: Box } => {
    const sz = size(n, l);
    const pe = s === 1 ? parent.x + parent.w : parent.x;
    const x = s === 1 ? pe + GAPX : pe - GAPX - sz.w;
    const b = makeNode(n, l, x, cy - sz.h / 2, bi, order, s === 1 ? "left" : "right");
    arrow(parent, b, branchColor(bi).c, l, [pe, parent.ay], [s === 1 ? x : x + sz.w, b.ay]);
    let bb = bbOf(b);
    const childBBs: BB[] = [];
    if (n.c?.length) {
      const g = gapBetween(l + 1), sum = n.c.reduce((a, k) => a + subH(k, l + 1), 0) + g * (n.c.length - 1);
      let y = cy - sum / 2;
      n.c.forEach((k, i) => {
        const kh = subH(k, l + 1), r = placeH(k, l + 1, s, b, bi, i, y + kh / 2);
        bb = union(bb, r.bb); childBBs.push(r.bb); y += kh + g;
      });
    }
    if (l === 1) branches.push({ n, box: b, childBBs, bb });
    return { bb, box: b };
  };
  const sideH = (list: MindNode[], s: 1 | -1, firstIndex: number) => {
    const total = list.reduce((a, k) => a + subH(k, 1), 0) + GAP_L1 * (list.length - 1);
    let y = -total / 2;
    list.forEach((n, i) => { const kh = subH(n, 1); placeH(n, 1, s, rootBox, firstIndex + i, i, y + kh / 2); y += kh + GAP_L1; });
  };

  // --- vertical (up / down) ---
  const subW = (n: MindNode, l: number): number => {
    const w = size(n, l).w + 30;
    if (!n.c?.length) return w;
    return Math.max(w, n.c.reduce((a, k) => a + subW(k, l + 1), 0));
  };
  const placeV = (n: MindNode, l: number, s: 1 | -1, parent: Box, bi: number, order: number, cx: number): BB => {
    const sz = size(n, l);
    const py = s === 1 ? parent.y + parent.h : parent.y;
    const y = s === 1 ? py + GAPV : py - GAPV - sz.h;
    const b = makeNode(n, l, cx - sz.w / 2, y, bi, order, "center");
    arrow(parent, b, branchColor(bi).c, l, [parent.x + parent.w / 2, py], [cx, s === 1 ? y : y + sz.h]);
    let bb = bbOf(b);
    if (n.c?.length) {
      const sum = n.c.reduce((a, k) => a + subW(k, l + 1), 0);
      let x = cx - sum / 2;
      n.c.forEach((k, i) => { const kw = subW(k, l + 1); bb = union(bb, placeV(k, l + 1, s, b, bi, i, x + kw / 2)); x += kw; });
    }
    if (l === 1) branches.push({ n, box: b, childBBs: [], bb });
    return bb;
  };
  const sideV = (list: MindNode[], s: 1 | -1, firstIndex: number) => {
    const total = list.reduce((a, k) => a + subW(k, 1), 0);
    let x = -total / 2;
    list.forEach((n, i) => { const kw = subW(n, 1); placeV(n, 1, s, rootBox, firstIndex + i, i, x + kw / 2); x += kw; });
  };

  // --- radial (clockwise from the top) ---
  const leaves = (n: MindNode): number => (n.c?.length ? n.c.reduce((a, k) => a + leaves(k), 0) : 1);
  const clip = (b: Box, tx: number, ty: number): [number, number] => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
    const k = Math.min(dx ? (b.w / 2 + 3) / Math.abs(dx) : Infinity, dy ? (b.h / 2 + 3) / Math.abs(dy) : Infinity);
    return [cx + dx * k, cy + dy * k];
  };
  const placeR = (n: MindNode, l: number, parent: Box, a0: number, a1: number, bi: number, order: number, r0: number): BB => {
    const ang = (a0 + a1) / 2, r = r0 + (l === 1 ? 0 : 200 + (l - 1) * 30);
    const sz = size(n, l);
    const cx = Math.sin(ang) * r * 1.3, cy = -Math.cos(ang) * r;
    const b = makeNode(n, l, cx - sz.w / 2, cy - sz.h / 2, bi, order, "center");
    const pc = [parent.x + parent.w / 2, parent.y + parent.h / 2];
    arrow(parent, b, branchColor(bi).c, l, clip(parent, cx, cy), clip(b, pc[0], pc[1]));
    let bb = bbOf(b);
    if (n.c?.length) {
      const tot = leaves(n); let a = a0;
      n.c.forEach((k, i) => { const span = ((a1 - a0) * leaves(k)) / tot; bb = union(bb, placeR(k, l + 1, b, a, a + span, bi, i, r)); a += span; });
    }
    if (l === 1) branches.push({ n, box: b, childBBs: [], bb });
    return bb;
  };

  /** split point that balances the total size of the first and second half */
  const balanced = (sizeOf: (n: MindNode) => number) => {
    const sz = kids.map(sizeOf), total = sz.reduce((a, b) => a + b, 0);
    let best = Math.ceil(kids.length / 2), bestDiff = Infinity, acc = 0;
    for (let k = 1; k < kids.length; k++) { acc += sz[k - 1]; const d = Math.abs(total - 2 * acc); if (d < bestDiff) { bestDiff = d; best = k; } }
    return best;
  };
  const half = kids.length < 2 ? kids.length : growthMode === "Up-Down" ? balanced((k) => subW(k, 1)) : balanced((k) => subH(k, 1));
  switch (growthMode) {
    case "Right-facing": sideH(kids, 1, 0); break;
    case "Left-facing": sideH(kids, -1, 0); break;
    case "Right-Left": sideH(kids.slice(0, half), 1, 0); sideH(kids.slice(half), -1, half); break;
    case "Down-facing": sideV(kids, 1, 0); break;
    case "Up-facing": sideV(kids, -1, 0); break;
    case "Up-Down": sideV(kids.slice(0, half), 1, 0); sideV(kids.slice(half), -1, half); break;
    case "Radial": {
      const tot = kids.reduce((a, k) => a + leaves(k), 0); let a = 0;
      const r0 = Math.max(320, tot * 34);
      kids.forEach((k, i) => { const span = (2 * Math.PI * leaves(k)) / tot; placeR(k, 1, rootBox, a, a + span, i, i, r0); a += span; });
      break;
    }
  }

  if (!wantFrames) return els;

  // --- Slideshow marker frames: overview + one (or more) 16:9 frame per branch ---
  const ratio = 16 / 9;
  const frames: any[] = [];
  const mkFrame = (bb: BB, name: string, notes: string, minW = 1280, padding = 70) => {
    const cw = bb.x1 - bb.x0 + padding * 2, ch = bb.y1 - bb.y0 + padding * 2;
    let w = Math.max(minW, cw, ch * ratio);
    const h = w / ratio;
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    w = Math.round(w);
    const f: any = {
      type: "frame", id: id("f"), x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: Math.round(h), name,
      strokeColor: T.line, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, roundness: null,
      customData: { slideshow: { schemaVersion: 2, kind: "frame", order: frames.length, ...(notes ? { notes } : {}) } },
    };
    frames.push(f);
  };
  let all: BB | null = bbOf(rootBox);
  for (const b of branches) all = union(all, b.bb);
  mkFrame(all!, "00 全图概览", outline(tree).slice(0, 1).join("\n") + "\n" + kids.map((k) => `- ${k.t}`).join("\n"), 1600, 90);
  [...branches].sort((a, b) => kids.indexOf(a.n) - kids.indexOf(b.n)).forEach((br) => {
    const idx = kids.indexOf(br.n) + 1, label = `${String(idx).padStart(2, "0")} ${br.n.t}`;
    const items = br.n.c ?? [];
    if (!items.length || !br.childBBs.length) { mkFrame(br.bb, label, outline(br.n).join("\n")); return; }
    // pack consecutive children while the group still fits one slide
    const groups: { bb: BB; ix: number[] }[] = [];
    let curBB: BB | null = null, curIx: number[] = [];
    for (const [i, cb] of br.childBBs.entries()) {
      const next: BB = curBB ? union(curBB, cb) : cb;
      if (curBB && next.y1 - next.y0 > frameH) { groups.push({ bb: curBB, ix: curIx }); curBB = cb; curIx = [i]; } else { curBB = next; curIx = [...curIx, i]; }
    }
    if (curBB) groups.push({ bb: curBB, ix: curIx });
    groups.forEach((g, gi) => {
      let bb = g.bb;
      const withNode = union(bb, bbOf(br.box));
      if (withNode.y1 - withNode.y0 <= frameH * 1.35) bb = withNode; // keep the branch title in view when possible
      const notes = [`- ${br.n.t}`, ...g.ix.flatMap((i) => outline(items[i], 1))].join("\n");
      mkFrame(bb, groups.length > 1 ? `${label} (${gi + 1}/${groups.length})` : label, notes);
    });
  });
  return [...frames, ...els]; // marker frames sit behind the map and own nothing
}
