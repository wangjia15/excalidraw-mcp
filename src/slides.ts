/**
 * Slide deck generator for the Obsidian Excalidraw "Slideshow" script.
 *
 * Every slide is an Excalidraw frame (default 1920x1080, the script's slide size). Slide order,
 * presenter notes and appearance animations live in `frame.customData.slideshow`
 * (schemaVersion 2, kind "frame"), exactly as the script's sidepanel writes them.
 *
 * Slides are laid out from content: cover, stage / section dividers, KPI tiles, VS panels, key-value
 * grids, cards, numbered steps, tables, process flows, highlighted code windows and list rows,
 * plus BOPPPS extras (six-dot stage progress, callouts, badges). Colours, fonts and slide size come
 * from a theme (built-in "fresh", or a Marp theme CSS such as the vault's theme/campus.css).
 */
import { detectLang, highlightLayers, type Lang } from "./highlight.js";
import { FRESH, mix, onColor, STAGES, type Theme } from "./slide-theme.js";

export type StageKey = "b" | "o" | "p1" | "p2" | "p3" | "s";
export type CalloutKind = "tip" | "warn" | "task" | "ask";
export type SlideSpec = {
  title: string;
  subtitle?: string;
  bullets?: string[];
  code?: string;
  codeTitle?: string;
  codeLang?: Lang | string;
  flow?: string[];
  notes?: string;
  /** force how bullets are rendered; default: auto-detected */
  layout?: "list" | "cards" | "steps" | "table";
  /** build items one by one on presenter advance (default true) */
  animate?: boolean;
  /** "stage" = BOPPPS stage divider, "divider" = section divider (default: slides without content) */
  type?: "cover" | "stage" | "divider";
  /** BOPPPS stage: lights the matching dot in the six-dot progress bar; colours stage dividers */
  stage?: StageKey;
  /** duration pill next to the title, e.g. "5 分钟" */
  badge?: string;
  /** student-action pill next to the title, e.g. "动手练习" */
  act?: string;
  callouts?: { kind: CalloutKind; text: string }[];
  kpis?: { num: string; label: string }[];
  vs?: { left: { title: string; items: string[] }; right: { title: string; items: string[] } };
  kv?: [string, string][];
};
export type FontChoice = "sans" | "hand" | "local";
export type DeckSpec = { title?: string; slides: SlideSpec[]; titleFont?: FontChoice; bodyFont?: FontChoice; progress?: boolean };

export let ACC: { c: string; bg: string }[] = FRESH.series;
const METHOD: Record<string, string> = { GET: "#2e8b57", POST: "#2f6fb5", PUT: "#c97a12", PATCH: "#6b4fb8", DELETE: "#c0392b" };
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";
const NON_ASCII = /[^\u0000-\u00ff]/;
const FONT_ID: Record<FontChoice, number> = { sans: 2, hand: 5, local: 4 };
const GAP = 240;
const CALLOUT_LABEL: Record<CalloutKind, string> = { tip: "提示", warn: "注意", task: "任务", ask: "思考" };

const NO_START = "，。、；：！？）》」』”’…·,.;:!?)]}";
const NO_END = "（《「『“‘([{";
const isCjk = (ch: string) => ch.charCodeAt(0) > 255;
export const wOf = (s: string, fs: number, mono = false) =>
  Math.ceil([...s].reduce((a, ch) => a + (isCjk(ch) ? fs : fs * (mono ? 0.6 : 0.56)), 0));
/** rough "longest unbreakable run" measure in em, used to pick a font size that avoids mid-word breaks */
const longestRun = (t: string) =>
  Math.max(1, ...t.split(/[\s：，。、（）()→/]+/).map((x) => (NON_ASCII.test(x) ? x.length * 0.95 : x.length * 0.6)));

/** Word-aware wrap with CJK line-breaking rules (禁则): Latin runs stay whole, closing punctuation never starts a line. */
export function wrap(text: string, fs: number, maxW: number): string {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const tokens = para.match(/[A-Za-z0-9_@./\-:<>{}()$#&*+=\\'"`,;!?|~%^[\]]+|\s+|[^\sA-Za-z0-9_@./\-:<>{}()$#&*+=\\'"`,;!?|~%^[\]]/g) ?? [""];
    let line = "";
    const push = () => {
      let l = line.replace(/\s+$/, ""), carry = "";
      const last = l.slice(-1);
      if (l.length > 1 && NO_END.includes(last)) { carry = last; l = l.slice(0, -1); } // 开括号不落行尾
      out.push(l); line = carry;
    };
    for (let tk of tokens) {
      if (!line && /^\s+$/.test(tk)) continue;
      if (line && NO_START.includes(tk[0]) && wOf(line + tk, fs) > maxW && wOf(line + tk, fs) <= maxW + fs * 1.6) { line += tk; continue; } // 标点不出现在行首
      while (wOf(line + tk, fs) > maxW) {
        if (line) { push(); if (/^\s+$/.test(tk)) { tk = ""; break; } continue; }
        // single token wider than the box: hard split
        let cut = tk.length;
        while (cut > 1 && wOf(tk.slice(0, cut), fs) > maxW) cut--;
        out.push(tk.slice(0, cut)); tk = tk.slice(cut);
      }
      line += tk;
    }
    push();
  }
  return out.join("\n");
}
export const linesOf = (t: string) => t.split("\n").length;

type El = any;
type Item = { els: El[]; ids: string[] };
type Block = { els: El[]; items: Item[]; h: number };

export function buildSlides(spec: DeckSpec, theme: Theme = FRESH): any[] {
  const T = theme, W = T.w, H = T.h, CW = W - 220;
  const TF = FONT_ID[spec.titleFont ?? "sans"], BF = FONT_ID[spec.bodyFont ?? "sans"];
  const NAVY = T.title, INK = T.ink, MUTED = T.ink2, BRAND = T.brand, PAPER = T.bg;
  const RULE = T.formal ? T.brand : mix(T.brand, T.bg, 0.55);
  ACC = T.series;
  const out: any[] = [];
  let n = 0;
  const nid = () => `sl${(++n).toString(36).padStart(6, "0")}`; // 8 chars, valid plugin id
  const total = spec.slides.length;
  const showDots = spec.progress ?? spec.slides.some((s) => s.stage);

  try {
    // ---- element factories (coordinates relative to the slide) ----
    const rect = (x: number, y: number, w: number, h: number, o: El = {}): El => ({ id: nid(), type: "rectangle", x, y, width: w, height: h, strokeColor: "transparent", strokeWidth: 0, backgroundColor: "transparent", fillStyle: "solid", roundness: null, ...o });
    const round = { type: 3 };
    const ell = (x: number, y: number, d: number, o: El = {}): El => ({ id: nid(), type: "ellipse", x, y, width: d, height: d, strokeColor: "transparent", strokeWidth: 0, backgroundColor: BRAND, fillStyle: "solid", ...o });
    const txt = (x: number, y: number, t: string, fs: number, color: string, o: El = {}): El => {
      const mono = o.fontFamily === 3, lh = mono ? 1.2 : 1.15;
      const ls = t.split("\n"), w = Math.max(...ls.map((l) => wOf(l, fs, mono)));
      const align = o.textAlign ?? "left";
      const bw = o.boxW ?? w;
      const dx = align === "center" ? (bw - w) / 2 : align === "right" ? bw - w : 0;
      const { boxW: _b, ...rest } = o;
      return { id: nid(), type: "text", x: x + dx, y, width: w, height: Math.ceil(ls.length * fs * lh), text: t, originalText: t, fontSize: fs, fontFamily: BF, lineHeight: lh, strokeColor: color, textAlign: align, verticalAlign: "top", ...rest };
    };
    const title = (x: number, y: number, t: string, fs: number, color: string, o: El = {}) => txt(x, y, t, fs, color, { fontFamily: TF, ...o });
    const arrow = (x: number, y: number, dx: number, dy: number, color = NAVY): El =>
      ({ id: nid(), type: "arrow", x, y, width: Math.abs(dx), height: Math.abs(dy), points: [[0, 0], [dx, dy]], strokeColor: color, strokeWidth: 3, startArrowhead: null, endArrowhead: "arrow" });
    const item = (els: El[]): Item => ({ els, ids: els.map((e) => e.id) });
    const shift = (els: El[], dx: number, dy: number) => els.forEach((e) => { e.x += dx; e.y += dy; });
    const cardStyle = { backgroundColor: T.card, strokeColor: T.line, strokeWidth: 1, roundness: round };

    // ---- blocks ----
    /** process flow: boxes with number badges, wrapped into serpentine rows */
    function flowBlock(items: string[], w: number, cols?: number, fsMax = 28): Block {
      const c = cols ?? (items.length <= 4 ? items.length : Math.ceil(items.length / 2));
      const gap = 74, bw = Math.min(520, Math.floor((w - gap * (c - 1)) / c));
      const prepared = items.map((raw) => {
        const num = raw.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*/);
        const body = raw.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "").replace(/\s*→\s*/g, "\n");
        return { num: num ? CIRCLED.indexOf(num[1]) + 1 : 0, body };
      });
      const longest = Math.max(...prepared.flatMap((p) => p.body.split(/\s+/).map((t) => (NON_ASCII.test(t) ? t.length * 0.9 : t.length * 0.58))));
      const fs = Math.max(18, Math.min(fsMax, Math.floor((bw - 36) / Math.max(longest, 1))));
      const labelled = prepared.map((p) => wrap(p.body, fs, bw - 36));
      const rows: number[][] = [];
      for (let i = 0; i < items.length; i += c) rows.push(items.slice(i, i + c).map((_, k) => i + k));
      const rowH = rows.map((r) => Math.max(...r.map((i) => linesOf(labelled[i]))) * fs * 1.15 + (fs > 28 ? 80 : 64));
      const els: El[] = [], its: Item[] = [];
      let y = 0;
      rows.forEach((r, ri) => {
        const rev = ri % 2 === 1;
        r.forEach((idx, k) => {
          const col = rev ? c - 1 - k : k, x = col * (bw + gap);
          const a = ACC[idx % ACC.length], bh = rowH[ri];
          const box = rect(x, y, bw, bh, { strokeColor: a.c, strokeWidth: 3, backgroundColor: a.bg, roundness: round });
          const lb = txt(x, y + (bh - linesOf(labelled[idx]) * fs * 1.15) / 2, labelled[idx], fs, INK, { textAlign: "center", boxW: bw });
          const mine = [box, lb];
          if (prepared[idx].num) {
            const d = 44, bd = ell(x - 12, y - 18, d, { backgroundColor: a.c });
            mine.push(bd, txt(x - 12, y - 18 + (d - 26 * 1.15) / 2, String(prepared[idx].num), 26, onColor(a.c), { textAlign: "center", boxW: d }));
          }
          if (idx > 0) {
            if (k > 0) {
              mine.push(rev ? arrow(x + bw + gap - 8, y + bh / 2, -(gap - 16), 0, a.c) : arrow(x - gap + 8, y + bh / 2, gap - 16, 0, a.c));
            } else {
              mine.push(arrow(col * (bw + gap) + bw / 2, y - 70 + 8, 0, 70 - 16, a.c)); // row wrap connector
            }
          }
          els.push(...mine); its.push(item(mine));
        });
        y += rowH[ri] + 70;
      });
      return { els, items: its, h: y - 70 };
    }

    const detectMode = (b: string[]): "table" | "steps" | "cards" | "list" => {
      const m = b.length;
      if (m >= 3 && b.filter((s) => s.includes("→")).length === m) return "table";
      if (m >= 3 && b.filter((s) => /^[①②③④⑤⑥⑦⑧⑨⑩]|^\d+[.、)]\s/.test(s)).length >= m * 0.6) return "steps";
      const heads = b.filter((s) => { const i = s.indexOf("："); return i > 0 && i <= 24 && i < s.length - 1; }).length;
      if (m >= 3 && heads >= m * 0.6) return "cards";
      return "list";
    };
    /** "A：x    B：y" on one line -> two entries */
    const splitMulti = (b: string[]): string[] =>
      b.flatMap((t) => {
        const parts = t.split(/\s{3,}/).map((x) => x.trim()).filter(Boolean);
        return parts.length > 1 && parts.every((x) => x.includes("：")) ? parts : [t];
      });

    function listBlock(bul: string[], w: number, scale: number): Block {
      const fs = Math.round(32 * scale), els: El[] = [], its: Item[] = [];
      let y = 0;
      bul.forEach((b, i) => {
        const a = ACC[i % ACC.length], t = wrap(b, fs, w - 96), h = linesOf(t) * fs * 1.15 + 40;
        const card = rect(0, y, w, h, cardStyle);
        const bar = rect(0, y + 14, 10, h - 28, { backgroundColor: a.c, roundness: round });
        const tx = txt(40, y + 20, t, fs, INK);
        els.push(card, bar, tx); its.push(item([card, bar, tx])); y += h + 18;
      });
      return { els, items: its, h: y - 18 };
    }

    function stepsBlock(bul: string[], w: number, scale: number): Block {
      const cols = bul.length <= 4 ? 1 : 2, gap = 28, cw = (w - gap * (cols - 1)) / cols, fs = Math.round(30 * scale);
      const rows = Math.ceil(bul.length / cols), els: El[] = [], its: Item[] = [];
      const ts = bul.map((b) => wrap(b.replace(/^([①②③④⑤⑥⑦⑧⑨⑩]|\d+[.、)])\s*/, ""), fs, cw - 130));
      const rh: number[] = [];
      for (let r = 0; r < rows; r++) rh.push(Math.max(...ts.slice(r * cols, r * cols + cols).map((t) => linesOf(t) * fs * 1.15 + 44), 84));
      const ys: number[] = []; let y = 0;
      rh.forEach((h) => { ys.push(y); y += h + 22; });
      bul.forEach((b, i) => {
        const r = Math.floor(i / cols), c = i % cols, a = ACC[i % ACC.length], x = c * (cw + gap), h = rh[r];
        const m = b.match(/^([①②③④⑤⑥⑦⑧⑨⑩])/), num = m ? CIRCLED.indexOf(m[1]) + 1 : parseInt(b) || i + 1;
        const card = rect(x, ys[r], cw, h, { ...cardStyle, strokeColor: a.c, strokeWidth: 2 });
        const d = 62, circ = ell(x + 24, ys[r] + (h - d) / 2, d, { backgroundColor: a.c });
        const nt = txt(x + 24, ys[r] + (h - 36 * 1.15) / 2, String(num), 36, onColor(a.c), { textAlign: "center", boxW: d });
        const tx = txt(x + 110, ys[r] + (h - linesOf(ts[i]) * fs * 1.15) / 2, ts[i], fs, INK);
        els.push(card, circ, nt, tx); its.push(item([card, circ, nt, tx]));
      });
      return { els, items: its, h: y - 22 };
    }

    function cardsBlock(bul: string[], w: number, scale: number): Block {
      const m = bul.length, gap = 28;
      const cols = m <= 2 ? m : m === 3 && w >= 900 ? 3 : m === 4 || m === 3 ? 2 : 3;
      const cw = (w - gap * (cols - 1)) / cols, bf = Math.round(27 * scale);
      const parts = bul.map((b) => {
        const i = b.indexOf("：");
        return i > 0 && i <= 24 ? [b.slice(0, i), b.slice(i + 1).trim()] : ["", b];
      });
      const hf = Math.max(20, Math.min(Math.round(32 * scale), Math.floor((cw - 120) / Math.max(...parts.map((p) => longestRun(p[0]))))));
      const hs = parts.map((p) => wrap(p[0], hf, cw - 120)), bs = parts.map((p) => wrap(p[1], bf, p[0] ? cw - 56 : cw - 120));
      const rows = Math.ceil(m / cols), rh: number[] = [];
      for (let r = 0; r < rows; r++) {
        rh.push(Math.max(...hs.slice(r * cols, r * cols + cols).map((h, k) => (h ? Math.max(46, linesOf(h) * hf * 1.15) + linesOf(bs[r * cols + k]) * bf * 1.2 + 84 : Math.max(46, linesOf(bs[r * cols + k]) * bf * 1.2) + 68))));
      }
      const ys: number[] = []; let y = 0;
      rh.forEach((h) => { ys.push(y); y += h + gap; });
      const els: El[] = [], its: Item[] = [];
      parts.forEach((_, i) => {
        const r = Math.floor(i / cols), c = i % cols, a = ACC[i % ACC.length], x = c * (cw + gap), h = rh[r];
        const card = rect(x, ys[r], cw, h, cardStyle);
        const top = rect(x + 2, ys[r], cw - 4, 12, { backgroundColor: a.c });
        const d = 46, circ = ell(x + 24, ys[r] + 34, d, { backgroundColor: a.bg, strokeColor: a.c, strokeWidth: 2 });
        const nt = txt(x + 24, ys[r] + 34 + (d - 26 * 1.15) / 2, String(i + 1), 26, a.c, { textAlign: "center", boxW: d });
        const mine = [card, top, circ, nt];
        let ty = ys[r] + 40;
        if (hs[i]) {
          const hh = linesOf(hs[i]) * hf * 1.15;
          mine.push(txt(x + 88, ys[r] + 34 + (linesOf(hs[i]) === 1 ? (d - hh) / 2 : 0), hs[i], hf, a.c));
          ty = ys[r] + 34 + Math.max(d, hh) + 14;
        }
        mine.push(hs[i] ? txt(x + 28, ty, bs[i], bf, INK) : txt(x + 88, ys[r] + 34 + Math.max(0, (d - linesOf(bs[i]) * bf * 1.2) / 2), bs[i], bf, INK));
        els.push(...mine); its.push(item(mine));
      });
      return { els, items: its, h: y - gap };
    }

    function tableBlock(bul: string[], w: number, scale: number): Block {
      const fs = Math.round(26 * scale);
      const rowsRaw = bul.map((b) => {
        let label = ""; let rest = b;
        const i = b.indexOf("：");
        if (i > 0 && i < b.indexOf("→")) { label = b.slice(0, i); rest = b.slice(i + 1).trim(); }
        const cells = rest.split(/\s*→\s*/).map((c) => c.trim());
        return label ? [label, ...cells] : cells;
      });
      const nc = Math.max(...rowsRaw.map((r) => r.length));
      const kind = (c: string) =>
        /^(GET|POST|PUT|PATCH|DELETE)\b/.test(c) ? "method"
          : /^\d{3}(\s*\/\s*\d{3})*\b/.test(c) && c.length < 14 ? "status"
            : /^[/@]|^\w+\([^)]*\)$|^[\w.]+<[\w<>[\], ?]+>$/.test(c) ? "mono" : "text";
      const nat = Array.from({ length: nc }, (_, k) => Math.max(...rowsRaw.map((r) => {
        const c = r[k] ?? "", kd = kind(c);
        return kd === "method" ? wOf(c.replace(/^\w+\s+/, ""), fs - 2, true) * 1.1 + 150 : wOf(c, kd === "mono" ? fs - 2 : fs, kd === "mono") * 1.1 + 48;
      })));
      const sum = nat.reduce((a, b) => a + b, 0);
      const widths = nat.map((v) => (sum > w ? (v / sum) * w : v + (w - sum) * (v / sum)));
      const els: El[] = [], its: Item[] = [];
      let y = 0;
      rowsRaw.forEach((r, ri) => {
        const cells = r.map((c, k) => {
          const kd = kind(c), mw = widths[k] - 40;
          return { c, kd, t: wrap(kd === "method" ? c.replace(/^\w+\s+/, "") : c, (kd === "mono" || kd === "method" ? fs - 2 : fs) * (kd === "mono" || kd === "method" ? 1.08 : 1), kd === "method" ? mw - 120 : mw) };
        });
        const rh = Math.max(...cells.map((x) => linesOf(x.t) * fs * 1.2)) + 36;
        const mine: El[] = [rect(0, y, w, rh, { backgroundColor: ri % 2 ? T.soft : T.card, strokeColor: T.line, strokeWidth: 1 })];
        let x = 0;
        cells.forEach((cell, k) => {
          const cy = y + 18;
          if (cell.kd === "method") {
            const mtd = cell.c.match(/^\w+/)![0], col = METHOD[mtd] ?? NAVY;
            const pill = rect(x + 20, y + (rh - 40) / 2, 38 + mtd.length * 15, 40, { backgroundColor: col, roundness: round });
            mine.push(pill, txt(x + 20, y + (rh - 40) / 2 + 7, mtd, 22, "#ffffff", { textAlign: "center", boxW: pill.width }), txt(x + 20 + pill.width + 14, cy, cell.t, fs - 2, INK, { fontFamily: 3 }));
          } else if (cell.kd === "status") {
            const col = cell.c.startsWith("2") ? "#2e8b57" : cell.c.startsWith("4") ? "#c97a12" : "#c0392b";
            mine.push(txt(x + 20, cy, cell.t, fs, col));
          } else if (cell.kd === "mono") mine.push(txt(x + 20, cy, cell.t, fs - 2, ACC[1].c, { fontFamily: 3 }));
          else mine.push(txt(x + 20, cy, cell.t, fs, k === 0 && nc > 2 ? NAVY : INK));
          x += widths[k];
        });
        els.push(...mine); its.push(item(mine)); y += rh;
      });
      return { els, items: its, h: y };
    }

    /** big-number tiles */
    function kpiBlock(kpis: { num: string; label: string }[], w: number): Block {
      const m = kpis.length, gap = 28, cw = (w - gap * (m - 1)) / m;
      const numFs = Math.max(40, Math.min(140, Math.floor((cw - 48) / (Math.max(...kpis.map((k) => k.num.length)) * 0.62))));
      const labels = kpis.map((k) => wrap(k.label, 32, cw - 40));
      const h = Math.max(300, numFs * 1.15 + Math.max(...labels.map((l) => linesOf(l))) * 32 * 1.25 + 100);
      const els: El[] = [], its: Item[] = [];
      kpis.forEach((k, i) => {
        const a = ACC[i % ACC.length], x = i * (cw + gap);
        const mine = [rect(x, 0, cw, h, cardStyle), rect(x + 2, 0, cw - 4, 10, { backgroundColor: a.c }),
          title(x, 50, k.num, numFs, T.formal ? T.accent : a.c, { textAlign: "center", boxW: cw }),
          txt(x, 50 + numFs * 1.15 + 18, labels[i], 32, MUTED, { textAlign: "center", boxW: cw })];
        els.push(...mine); its.push(item(mine));
      });
      return { els, items: its, h };
    }

    /** two-panel comparison with VS badge */
    function vsBlock(vs: NonNullable<SlideSpec["vs"]>, w: number, maxH: number): Block {
      const gap = 110, pw = (w - gap) / 2;
      let fs = 38, parts: { t: string; h: number }[][] = [], H0 = 0;
      for (; fs >= 20; fs -= 2) {
        parts = [vs.left, vs.right].map((col) => col.items.map((t) => { const x = wrap(t, fs, pw - 100); return { t: x, h: linesOf(x) * fs * 1.2 + 24 }; }));
        H0 = Math.max(...parts.map((p) => p.reduce((s, q) => s + q.h, 0))) + 120;
        if (H0 <= maxH) break;
      }
      const els: El[] = [], its: Item[] = [];
      [vs.left, vs.right].forEach((col, ci) => {
        const a = ACC[ci === 0 ? 1 : 0], x = ci * (pw + gap);
        const mine: El[] = [rect(x, 0, pw, H0, { ...cardStyle, strokeColor: a.c, strokeWidth: 2 }), rect(x, 0, pw, 72, { backgroundColor: a.c, roundness: round }), rect(x, 40, pw, 32, { backgroundColor: a.c }),
          title(x, 16, col.title, 34, onColor(a.c), { textAlign: "center", boxW: pw })];
        let y = 96;
        parts[ci].forEach((p) => { mine.push(ell(x + 28, y + fs * 0.35, 20, { backgroundColor: a.bg, strokeColor: a.c, strokeWidth: 2 }), txt(x + 68, y, p.t, fs, INK)); y += p.h; });
        els.push(...mine); its.push(item(mine));
      });
      const vsEls = [ell(pw + gap / 2 - 36, H0 / 2 - 36, 72, { backgroundColor: T.accent }), txt(pw + gap / 2 - 36, H0 / 2 - 18, "VS", 30, onColor(T.accent), { textAlign: "center", boxW: 72, fontFamily: TF })];
      els.push(...vsEls);
      return { els, items: its, h: H0 };
    }

    /** key / value grid */
    function kvBlock(pairs: [string, string][], w: number): Block {
      const fs = pairs.length <= 6 ? 38 : 32, kw = Math.min(w * 0.32, Math.max(...pairs.map((p) => wOf(p[0], fs))) + 56);
      const els: El[] = [], its: Item[] = [];
      let y = 0;
      pairs.forEach(([k, v], i) => {
        const vt = wrap(v, fs, w - kw - 48), h = Math.max(linesOf(vt) * fs * 1.2, fs * 1.2) + 30;
        const mine = [rect(0, y, w, h, { backgroundColor: i % 2 ? T.soft : T.card, strokeColor: T.line, strokeWidth: 1 }), rect(0, y, 8, h, { backgroundColor: BRAND }),
          txt(28, y + 15, wrap(k, fs, kw - 40), fs, T.formal ? T.accent : ACC[i % ACC.length].c), txt(kw + 8, y + 15, vt, fs, INK)];
        els.push(...mine); its.push(item(mine)); y += h;
      });
      return { els, items: its, h: y };
    }

    /** dark editor window with syntax-highlighted code (one overlay text layer per colour) */
    function codeBlock(code: string, ttl: string | undefined, langHint: string | undefined, w: number, maxH: number): Block {
      const lang = detectLang(code, langHint), src = code.replace(/\t/g, "  ").replace(/\s+$/, "");
      let fs = 34;
      const ls = src.split("\n");
      const maxLen = Math.max(...ls.map((x) => wOf(x, 1, true)));
      while (fs > 17 && (ls.length * fs * 1.2 + 110 > maxH || maxLen * fs > w - 72)) fs--;
      const h = Math.min(ls.length * fs * 1.2 + 110, Math.max(maxH, 200));
      const els: El[] = [
        rect(0, 0, w, h, { backgroundColor: T.codeBg, roundness: round, ...(T.codeLight ? { strokeColor: T.line, strokeWidth: 1 } : {}) }),
        rect(0, 0, w, 62, { backgroundColor: T.codeBar, roundness: round }),
        rect(0, 40, w, 22, { backgroundColor: T.codeBar }),
        ell(28, 23, 16, { backgroundColor: "#ef4444" }), ell(54, 23, 16, { backgroundColor: "#f59e0b" }), ell(80, 23, 16, { backgroundColor: "#22c55e" }),
      ];
      if (ttl) els.push(txt(116, 17, ttl, 22, T.codeLight ? "#6b7280" : "#9ca3af"));
      const codeEls = highlightLayers(src, lang, T.codeLight).map((l) => txt(36, 86, l.text, fs, l.color, { fontFamily: 3 }));
      els.push(...codeEls);
      return { els, items: [item(codeEls)], h };
    }

    const bulletsBlock = (bul: string[], mode: string, w: number, scale: number): Block =>
      mode === "table" ? tableBlock(bul, w, scale) : mode === "steps" ? stepsBlock(bul, w, scale) : mode === "cards" ? cardsBlock(bul, w, scale) : listBlock(bul, w, scale);

    const SCALES = [1.6, 1.45, 1.32, 1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.62, 0.55];
    /** largest scale (<= maxScale) whose block still fits maxH */
    const fit = (mk: (s: number) => Block, maxH: number, maxScale = 1.3): Block => {
      let b = mk(0.55);
      for (const sc of SCALES) {
        if (sc > maxScale) continue;
        b = mk(sc);
        if (b.h <= maxH) break;
      }
      return b;
    };
    const SCALE_CAP: Record<string, number> = { list: 1.25, cards: 1.55, steps: 1.3, table: 1.3 };
    /** y offset that gently centres a block in the free space */
    const centre = (h: number, avail: number) => Math.max(0, Math.min((avail - h) * 0.45, 260));

    /** six-dot BOPPPS progress, right aligned */
    const dots = (active?: StageKey): El[] => {
      const d = 44, gap = 10, total0 = STAGES.length * d + (STAGES.length - 1) * gap, x0 = W - 110 - total0, y0 = 52;
      return STAGES.flatMap((s, i) => {
        const on = s.key === active, col = on ? T.stage[s.key] : T.line;
        return [ell(x0 + i * (d + gap), y0, d, { backgroundColor: col }), txt(x0 + i * (d + gap), y0 + (d - 24 * 1.15) / 2, s.letter, 24, on ? onColor(col) : T.ink3, { textAlign: "center", boxW: d, fontFamily: TF })];
      });
    };
    const pill = (x: number, y: number, label: string, kind: "badge" | "act"): { els: El[]; w: number } => {
      const fs = 22, w = wOf(label, fs) + 36, h = 38;
      const bg = kind === "act" ? T.callout.task.bd : T.hintBg, ink = kind === "act" ? onColor(bg) : T.formal ? T.accent : T.hintInk;
      return { els: [rect(x, y, w, h, { backgroundColor: bg, strokeColor: kind === "badge" ? ink : "transparent", strokeWidth: kind === "badge" ? 1.5 : 0, roundness: { type: 3 } }), txt(x, y + (h - fs * 1.15) / 2, label, fs, ink, { textAlign: "center", boxW: w })], w };
    };

    // ---- slides ----
    spec.slides.forEach((s, idx) => {
      const fx = 0, fy = idx * (H + GAP), fid = nid();
      const cover = idx === 0 || s.type === "cover";
      const steps: El[] = [];
      const body: El[] = []; // slide-relative
      const animate = s.animate !== false;
      const addBlock = (b: Block, x: number, y: number, animateItems: boolean) => {
        shift(b.els, x, y); body.push(...b.els);
        if (animateItems) b.items.forEach((it) => steps.push({ id: nid(), effect: "fade", trigger: "advance", durationMs: 350, targets: it.ids.map((id) => ({ type: "element", id })) }));
      };

      const hasContent = !!(s.bullets?.length || s.code || s.flow?.length || s.kpis?.length || s.vs || s.kv?.length || s.callouts?.length);
      const divider = !cover && (s.type === "stage" || s.type === "divider" || !hasContent);
      const deckTitle = spec.title;

      if (cover) {
        body.push(rect(0, 0, W, H, { backgroundColor: T.coverBg }));
        if (T.formal) {
          body.push(rect(0, 0, W, 12, { backgroundColor: BRAND }), rect(0, H - 12, W, 12, { backgroundColor: BRAND }));
          const tt = wrap(s.title, 100, W - 400), th = linesOf(tt) * 100 * 1.15;
          const sy = H / 2 - th / 2 - 40;
          body.push(title(0, sy, tt, 100, T.coverTitle, { textAlign: "center", boxW: W }));
          let y = sy + th + 24;
          body.push(rect(W / 2 - 60, y, 120, 4, { backgroundColor: BRAND })); y += 34;
          if (s.subtitle) body.push(txt(0, y, wrap(s.subtitle, 38, W - 400), 38, T.coverSub, { textAlign: "center", boxW: W }));
          if (deckTitle) body.push(txt(0, H - 120, deckTitle, 28, T.coverSub, { textAlign: "center", boxW: W }));
        } else {
          body.push(ell(W - 740, -260, 900, { backgroundColor: BRAND, opacity: 18 }), ell(W - 500, 560, 620, { backgroundColor: T.dark ? T.ink : "#ffffff", opacity: 7 }), ell(-180, 700, 520, { backgroundColor: BRAND, opacity: 12 }));
          body.push(rect(140, 330, 18, 300, { backgroundColor: BRAND, roundness: round }));
          const tt = wrap(s.title, 96, 1250);
          body.push(title(200, 320, tt, 96, T.coverTitle));
          const y = 320 + linesOf(tt) * 96 * 1.15 + 36;
          if (s.subtitle) {
            const st = wrap(s.subtitle, 38, 1250), w = Math.max(...st.split("\n").map((l) => wOf(l, 38))) + 64, h = linesOf(st) * 38 * 1.15 + 36;
            const pb = T.coverBg === T.bg ? T.hintBg : mix(T.coverBg, BRAND, 0.35);
            body.push(rect(200, y, w, h, { backgroundColor: pb, roundness: round }), txt(232, y + 18, st, 38, T.coverBg === T.bg ? T.hintInk : T.coverSub));
          }
          if (deckTitle) body.push(txt(200, H - 120, deckTitle, 28, T.ink3));
        }
      } else if (divider) {
        const sc = s.stage ? T.stage[s.stage] : BRAND;
        const stageName = s.stage ? STAGES.find((x) => x.key === s.stage)!.name : "";
        const bgc = T.formal ? T.accent : s.stage ? sc : mix(BRAND, T.bg, 0.0);
        const fg = T.formal ? "#ffffff" : onColor(bgc);
        body.push(rect(0, 0, W, H, { backgroundColor: bgc }));
        if (T.formal) body.push(rect(0, 0, W, 12, { backgroundColor: sc }));
        else body.push(ell(W - 670, -200, 800, { backgroundColor: fg, opacity: 10 }));
        const m = s.title.match(/^(\d{1,2})\s+(.+)$/);
        const tt = wrap(m ? m[2] : s.title, 84, W - 440), th = linesOf(tt) * 84 * 1.15;
        let y = H / 2 - th / 2 - (m || s.subtitle || s.badge ? 70 : 0);
        if (T.formal) {
          if (m) { body.push(title(0, y - 150, m[1].padStart(2, "0"), 120, T.brand, { textAlign: "center", boxW: W })); }
          body.push(title(0, y, tt, 84, "#ffffff", { textAlign: "center", boxW: W })); y += th + 16;
          const uw = Math.min(W - 440, Math.max(...tt.split("\n").map((l) => wOf(l, 84))));
          body.push(rect(W / 2 - uw / 2, y, uw, 4, { backgroundColor: BRAND })); y += 36;
          if (s.subtitle) { body.push(txt(0, y, wrap(s.subtitle, 34, W - 440), 34, T.coverSub, { textAlign: "center", boxW: W })); y += 34 * 1.3 + 30; }
          const lab = [s.badge, stageName].filter(Boolean).join("  ·  ");
          if (lab) { const p = pill(W / 2 - (wOf(lab, 22) + 36) / 2, y, lab, "badge"); p.els[0].backgroundColor = mix(T.accent, BRAND, 0.35); p.els[0].strokeColor = BRAND; p.els[1].strokeColor = "#ffffff"; body.push(...p.els); }
        } else {
          if (m) { body.push(title(200, y - 190, m[1].padStart(2, "0"), 180, fg, { opacity: 55 })); }
          body.push(title(200, y, tt, 84, fg)); y += th + 24;
          if (s.subtitle) { body.push(txt(204, y, wrap(s.subtitle, 34, W - 440), 34, fg, { opacity: 85 })); y += 34 * 1.3 + 26; }
          const lab = [s.badge, stageName].filter(Boolean).join("  ·  ");
          if (lab) { const p = pill(204, y, lab, "badge"); p.els[0].backgroundColor = "transparent"; p.els[0].strokeColor = fg; p.els[1].strokeColor = fg; body.push(...p.els); }
        }
      } else {
        body.push(rect(0, 0, W, H, { backgroundColor: PAPER }));
        if (!T.formal) body.push(rect(0, 0, 22, H, { backgroundColor: BRAND }));
        else body.push(rect(0, 0, W, 10, { backgroundColor: BRAND }));
        // header
        const m = s.title.match(/^(\d{1,2})\s+(.+)$/);
        let tx = 110, ttl = s.title;
        if (m) {
          body.push(ell(110, 60, 84, { backgroundColor: BRAND }), title(110, 60 + (84 - 40 * 1.15) / 2, m[1], 40, onColor(BRAND), { textAlign: "center", boxW: 84 }));
          tx = 222; ttl = m[2];
        }
        const pills = [s.act ? { l: s.act, k: "act" as const } : null, s.badge ? { l: s.badge, k: "badge" as const } : null].filter(Boolean) as { l: string; k: "badge" | "act" }[];
        const pillsW = pills.reduce((a, p) => a + wOf(p.l, 22) + 36 + 14, 0);
        const reserve = (showDots ? 340 : 0) + pillsW;
        let tfs = 60;
        while (tfs > 38 && wOf(ttl, tfs) > W - tx - 110 - reserve) tfs -= 2;
        body.push(title(tx, 60 + (84 - tfs * 1.15) / 2, ttl, tfs, NAVY));
        let px = tx + wOf(ttl, tfs) + 24;
        pills.forEach((p) => { const pp = pill(px, 60 + (84 - 38) / 2, p.l, p.k); body.push(...pp.els); px += pp.w + 14; });
        if (showDots) body.push(...dots(s.stage));
        body.push(rect(110, 168, CW, 3, { backgroundColor: RULE }));
        let top = 210;
        if (s.subtitle) {
          const st = wrap(s.subtitle, 28, CW - 80), sw = Math.min(CW, Math.max(...st.split("\n").map((l) => wOf(l, 28))) + 56), sh = linesOf(st) * 28 * 1.15 + 28;
          body.push(rect(110, 196, sw, sh, { backgroundColor: T.hintBg, roundness: round }), rect(110, 196, 8, sh, { backgroundColor: BRAND }), txt(142, 210, st, 28, T.hintInk));
          top = 196 + sh + 28;
        }

        // callouts reserve space at the bottom
        const calls = (s.callouts ?? []).map((c) => {
          const lab = CALLOUT_LABEL[c.kind], lw = wOf(lab, 24) + 40, t = wrap(c.text, 26, CW - lw - 60);
          return { c, lab, lw, t, h: Math.max(70, linesOf(t) * 26 * 1.3 + 32) };
        });
        const callH = calls.reduce((a, c) => a + c.h + 14, 0);
        const bottom = H - 95 - (calls.length ? callH + 10 : 0);
        let cy = bottom + 10;
        calls.forEach((c) => {
          const col = T.callout[c.c.kind];
          const els = [rect(110, cy, CW, c.h, { backgroundColor: col.bg, strokeColor: "transparent", roundness: round }), rect(110, cy, 8, c.h, { backgroundColor: col.bd }),
            txt(138, cy + (c.h - 24 * 1.15) / 2, c.lab, 24, col.bd, { fontFamily: TF }), txt(138 + c.lw, cy + (c.h - linesOf(c.t) * 26 * 1.3) / 2, c.t, 26, INK, { lineHeight: 1.3 })];
          body.push(...els);
          if (animate) steps.push({ id: nid(), effect: "fade", trigger: "advance", durationMs: 350, targets: els.map((e) => ({ type: "element", id: e.id })) });
          cy += c.h + 14;
        });

        let y = top;
        const bul = splitMulti(s.bullets ?? []);
        const mode = s.layout ?? (bul.length ? detectMode(bul) : "list");
        const bare = !bul.length && !s.code && !s.kpis?.length && !s.vs && !s.kv?.length;

        if (s.flow?.length) {
          const alone = bare;
          let fb: Block;
          if (alone) {
            const cnt = s.flow.length, cands = cnt <= 4 ? [cnt] : [5, 4, 3, 2].filter((c) => c <= cnt);
            fb = flowBlock(s.flow, CW, cands[0], 34);
            let bestFs = 0;
            for (const c of cands) {
              const t = flowBlock(s.flow, CW, c, 34), f0 = (t.els.find((e) => e.type === "text") as El)?.fontSize ?? 0;
              if (t.h <= bottom - top - 60 && f0 > bestFs) { bestFs = f0; fb = t; }
            }
          } else fb = flowBlock(s.flow, CW, undefined, 28);
          const pad = alone ? Math.max(0, (bottom - top - fb.h) / 2 - 20) : 0;
          addBlock(fb, 110, y + 22 + pad, animate);
          y += fb.h + 22 + pad + 56;
        }
        if (s.kpis?.length) {
          const kb = kpiBlock(s.kpis, CW);
          addBlock(kb, 110, y + (bare ? centre(kb.h, bottom - y) : 0), animate);
          y += kb.h + 36;
        }
        if (s.vs) {
          const vb = vsBlock(s.vs, CW, bottom - y);
          addBlock(vb, 110, y + (bare ? centre(vb.h, bottom - y) : 0), animate);
          y += vb.h + 36;
        }
        if (s.kv?.length) {
          const kb = kvBlock(s.kv, CW);
          addBlock(kb, 110, y + (bare ? centre(kb.h, bottom - y) : 0), animate);
          y += kb.h + 36;
        }

        if (s.code && bul.length) {
          const gap = 36, lw = 640, cw = CW - lw - gap, avail = bottom - y;
          const cb = codeBlock(s.code, s.codeTitle, s.codeLang as string, cw, avail);
          const stacked = cb.h > avail + 1 || (!!s.flow?.length && avail < 380) || mode === "table";
          if (!stacked) {
            addBlock(fit((sc) => bulletsBlock(bul, mode, lw, sc), avail, 1.0), 110, y, animate);
            addBlock(cb, 110 + lw + gap, y, false);
          } else {
            const half = Math.max(160, Math.min(330, (bottom - y) * 0.4));
            const lb = fit((sc) => bulletsBlock(bul, mode, CW, sc), half, 1.0);
            addBlock(lb, 110, y, animate);
            y += lb.h + 28;
            addBlock(codeBlock(s.code, s.codeTitle, s.codeLang as string, CW, bottom - y), 110, y, false);
          }
        } else if (s.code) {
          const avail = bottom - y, lines = s.code.replace(/\s+$/, "").split("\n");
          const monoFs = (bl: Block) => (bl.els.find((e) => e.fontFamily === 3) as El)?.fontSize ?? 34;
          const single = codeBlock(s.code, s.codeTitle, s.codeLang as string, CW, avail);
          let two: { a: Block; b: Block } | null = null;
          if (lines.length > 20 && monoFs(single) < 26) {
            let cut = Math.floor(lines.length / 2);
            for (let d = 0; d < 8; d++) {
              if (!lines[cut + d]?.trim()) { cut += d + 1; break; }
              if (!lines[cut - d]?.trim()) { cut -= d - 1; break; }
            }
            const cw = (CW - 30) / 2, lang = (s.codeLang as string) ?? detectLang(s.code);
            const NL = String.fromCharCode(10);
            const A = codeBlock(lines.slice(0, cut).join(NL), s.codeTitle, lang, cw, avail);
            const B = codeBlock(lines.slice(cut).join(NL), undefined, lang, cw, avail);
            if (Math.min(monoFs(A), monoFs(B)) > monoFs(single) + 2) two = { a: A, b: B };
          }
          if (two) {
            addBlock(two.a, 110, y, false);
            addBlock(two.b, 110 + (CW - 30) / 2 + 30, y, false);
          } else {
            addBlock(single, 110, y + centre(single.h, avail), animate);
          }
        } else if (bul.length) {
          const avail = bottom - y, above = y > top;
          const bb = fit((sc) => bulletsBlock(bul, mode, CW, sc), avail, above ? 1.0 : SCALE_CAP[mode] ?? 1.25);
          addBlock(bb, 110, y + (above ? 0 : centre(bb.h, avail)), animate);
        }

        // footer
        body.push(rect(0, H - 10, (W * (idx + 1)) / total, 10, { backgroundColor: BRAND }));
        if (deckTitle) body.push(txt(110, H - 62, deckTitle, 22, T.ink3));
        body.push(txt(W - 260, H - 66, `${idx + 1} / ${total}`, 26, MUTED, { textAlign: "right", boxW: 150 }));
      }

      const kids = body.map((e) => ({ ...e, x: e.x + fx, y: e.y + fy, frameId: fid }));
      const frame: any = {
        type: "frame", id: fid, x: fx, y: fy, width: W, height: H, name: `${String(idx + 1).padStart(2, "0")} ${s.title}`,
        strokeColor: "#bbbbbb", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, roundness: null,
        customData: { slideshow: { schemaVersion: 2, kind: "frame", order: idx } },
      };
      if (s.notes) frame.customData.slideshow.notes = s.notes;
      if (animate && steps.length) frame.customData.slideshow.animation = { steps };
      out.push(...kids, frame); // frames sit after their children
    });
    return out;
  } finally {
    ACC = FRESH.series; // do not leak the theme into other templates
  }
}
