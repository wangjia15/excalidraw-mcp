/**
 * Mind Map Builder compatible mindmap generator for Obsidian Excalidraw.
 *
 * Emits the same element model as the "Mindmap Builder" script: text nodes with
 * `customData.mindmapOrder`, bound curved arrows with `customData.isBranch`, and
 * the Growth Strategy stored as `customData.growthMode` on the root node.
 */
export const GROWTH_MODES = ["Radial", "Right-facing", "Left-facing", "Right-Left", "Up-facing", "Down-facing", "Up-Down"] as const;
export type GrowthMode = (typeof GROWTH_MODES)[number];
export type MindNode = { t: string; c?: MindNode[] };

const FS = [28, 22, 18, 16];
const SW = [2, 3, 2, 1.5];
const PAL = ["#2f6fb5", "#2e8b57", "#c97a12", "#6b4fb8", "#c0392b", "#1f8a8a", "#a0522d", "#5a6b7b"];
const GAPX = 70, GAPY = 16, GAPV = 60;

const fsOf = (l: number) => FS[Math.min(l, 3)];
const wOf = (s: string, fs: number) => Math.ceil([...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? fs : fs * 0.55), 0));
const hOf = (l: number) => Math.ceil(fsOf(l) * 1.25);

/** Parse an indented markdown outline (first line = root) into a tree. */
export function parseOutline(md: string): MindNode {
  const rows = md.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const m = l.match(/^(\s*)(?:[-*+]\s+|#+\s+)?(.*)$/)!;
    return { d: m[1].replace(/\t/g, "  ").length, t: m[2].trim() };
  });
  if (!rows.length) throw new Error("Empty outline");
  const root: MindNode = { t: rows[0].t };
  const stack: { d: number; n: MindNode }[] = [{ d: rows[0].d - 1, n: root }];
  for (const r of rows.slice(1)) {
    while (stack.length > 1 && stack[stack.length - 1].d >= r.d) stack.pop();
    const n: MindNode = { t: r.t };
    const p = stack[stack.length - 1].n;
    (p.c ??= []).push(n);
    stack.push({ d: r.d, n });
  }
  return root;
}

type Box = { id: string; x: number; y: number; w: number; h: number };

export function buildMindmap(tree: MindNode, growthMode: GrowthMode = "Right-Left"): any[] {
  const els: any[] = [];
  let uid = 0;
  const id = (p: string) => `${p}${++uid}`;
  const kids = tree.c ?? [];

  // --- root ---
  const rw = wOf(tree.t, FS[0]) + 60, rh = 70;
  const rootBox: Box = { id: "root", x: -rw / 2, y: -rh / 2, w: rw, h: rh };
  els.push({ type: "rectangle", id: "root", x: rootBox.x, y: rootBox.y, width: rw, height: rh, strokeColor: "#2b2f36", backgroundColor: "#e7f0fb", fillStyle: "solid", strokeWidth: 2, roundness: { type: 3 }, boundElements: [{ type: "text", id: "rootT" }], customData: { growthMode, multicolor: true, mindmapOrder: 0 } });
  const tw = wOf(tree.t, FS[0]);
  els.push({ type: "text", id: "rootT", x: -tw / 2, y: -hOf(0) / 2, width: tw, height: hOf(0), text: tree.t, originalText: tree.t, fontSize: FS[0], textAlign: "center", verticalAlign: "middle", containerId: "root", strokeColor: "#2b2f36" });

  const arrow = (from: Box, to: Box, color: string, lvl: number, a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const bend: [number, number] = Math.abs(dx) >= Math.abs(dy) ? [dx * 0.5, dy * 0.12] : [dx * 0.12, dy * 0.5];
    els.push({ type: "arrow", id: id("b"), x: a[0], y: a[1], width: Math.abs(dx), height: Math.abs(dy), points: [[0, 0], bend, [dx, dy]], strokeColor: color, strokeWidth: SW[Math.min(lvl, 3)], roundness: { type: 2 }, startArrowhead: null, endArrowhead: null, startBinding: { elementId: from.id, focus: 0, gap: 4 }, endBinding: { elementId: to.id, focus: 0, gap: 4 }, customData: { isBranch: true } });
  };
  const textNode = (n: MindNode, lvl: number, x: number, y: number, color: string, order: number, align: string): Box => {
    const fs = fsOf(lvl), w = wOf(n.t, fs), h = hOf(lvl), nid = id("n");
    els.push({ type: "text", id: nid, x, y, width: w, height: h, text: n.t, originalText: n.t, fontSize: fs, textAlign: align, verticalAlign: "middle", strokeColor: color, customData: { mindmapOrder: order } });
    return { id: nid, x, y, w, h };
  };

  // --- directional (left / right) ---
  const subH = (n: MindNode, l: number): number => {
    if (!n.c?.length) return hOf(l);
    return Math.max(hOf(l), n.c.reduce((a, k) => a + subH(k, l + 1), 0) + GAPY * (n.c.length - 1));
  };
  const placeH = (n: MindNode, l: number, s: 1 | -1, parent: Box, color: string, order: number, cy: number) => {
    const w = wOf(n.t, fsOf(l));
    const pe = s === 1 ? parent.x + parent.w : parent.x;
    const x = s === 1 ? pe + GAPX : pe - GAPX - w;
    const b = textNode(n, l, x, cy - hOf(l) / 2, color, order, s === 1 ? "left" : "right");
    const pcy = parent.y + parent.h / 2;
    arrow(parent, b, color, l, [pe, pcy], [s === 1 ? x : x + w, cy]);
    if (n.c?.length) {
      const sum = n.c.reduce((a, k) => a + subH(k, l + 1), 0) + GAPY * (n.c.length - 1);
      let y = cy - sum / 2;
      n.c.forEach((k, i) => { const kh = subH(k, l + 1); placeH(k, l + 1, s, b, color, i, y + kh / 2); y += kh + GAPY; });
    }
  };
  const sideH = (list: MindNode[], s: 1 | -1, colorOffset: number) => {
    const total = list.reduce((a, k) => a + subH(k, 1), 0) + GAPY * 2 * (list.length - 1);
    let y = -total / 2;
    list.forEach((n, i) => { const kh = subH(n, 1); placeH(n, 1, s, rootBox, PAL[(i + colorOffset) % PAL.length], i, y + kh / 2); y += kh + GAPY * 2; });
  };

  // --- vertical (up / down) ---
  const subW = (n: MindNode, l: number): number => {
    const w = wOf(n.t, fsOf(l)) + 24;
    if (!n.c?.length) return w;
    return Math.max(w, n.c.reduce((a, k) => a + subW(k, l + 1), 0));
  };
  const placeV = (n: MindNode, l: number, s: 1 | -1, parent: Box, color: string, order: number, cx: number) => {
    const w = wOf(n.t, fsOf(l)), h = hOf(l);
    const py = s === 1 ? parent.y + parent.h : parent.y;
    const y = s === 1 ? py + GAPV : py - GAPV - h;
    const b = textNode(n, l, cx - w / 2, y, color, order, "center");
    arrow(parent, b, color, l, [parent.x + parent.w / 2, py], [cx, s === 1 ? y : y + h]);
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
    const ang = (a0 + a1) / 2, r = r0 + (l === 1 ? 0 : 150 + (l - 1) * 20);
    const w = wOf(n.t, fsOf(l)), h = hOf(l);
    const cx = Math.sin(ang) * r * 1.25, cy = -Math.cos(ang) * r;
    const b = textNode(n, l, cx - w / 2, cy - h / 2, color, order, "center");
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
      const r0 = Math.max(260, tot * 28);
      kids.forEach((k, i) => { const span = (2 * Math.PI * leaves(k)) / tot; placeR(k, 1, rootBox, a, a + span, PAL[i % PAL.length], i, r0); a += span; });
      break;
    }
  }
  return els;
}
