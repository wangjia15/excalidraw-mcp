/**
 * Slide themes. A theme is derived from a Marp CSS theme (e.g. `theme/campus.css` in the vault): the
 * palette variables in its `:root` block (--bg, --ink, --accent, --alt, --c-b ... --c-s, callout colours)
 * and the slide size are read from the file, so the Excalidraw deck looks like the Marp deck.
 */
import fs from "node:fs";
import path from "node:path";

export type Series = { c: string; bg: string };
export type Theme = {
  name: string;
  w: number; h: number;                 // slide size in Excalidraw units (Marp px x 1.5)
  dark: boolean;                        // dark page background
  formal: boolean;                      // campus-like: dark cover + centred cover/stage pages + brand rules
  bg: string; soft: string; card: string; line: string;
  ink: string; ink2: string; ink3: string;
  title: string;                        // heading colour
  brand: string;                        // bars, rules, dots, progress
  accent: string; alt: string;
  coverBg: string; coverTitle: string; coverSub: string;
  codeBg: string; codeBar: string; codeLight: boolean;
  hintBg: string; hintInk: string;
  series: Series[];
  callout: Record<"tip" | "warn" | "task" | "ask", { bg: string; bd: string }>;
  stage: Record<"b" | "o" | "p1" | "p2" | "p3" | "s", string>;
};

/* ---- colour helpers ---- */
type RGBA = [number, number, number, number];
export function parseColor(s: string): RGBA | null {
  s = s.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1) as RGBA;
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}
const hex = (c: number[]) => "#" + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
/** blend colour over a background (alpha-aware) and return #rrggbb */
export function over(fg: string, bg: string): string {
  const f = parseColor(fg), b = parseColor(bg);
  if (!f || !b) return fg;
  const a = f[3];
  return hex([0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a)));
}
export const mix = (a: string, b: string, t: number) => {
  const x = parseColor(a), y = parseColor(b);
  return x && y ? hex([0, 1, 2].map((i) => x[i] * (1 - t) + y[i] * t)) : a;
};
export const luminance = (c: string) => {
  const p = parseColor(c);
  if (!p) return 0;
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
};
/** readable text colour on a filled background */
export const onColor = (bg: string, light = "#ffffff", dark = "#16202f") => (luminance(bg) > 0.45 ? dark : light);

/* ---- built-in default (the original green look) ---- */
export const FRESH: Theme = {
  name: "fresh", w: 1920, h: 1080, dark: false, formal: false,
  bg: "#f6faf8", soft: "#eef6f2", card: "#ffffff", line: "#dfeae4",
  ink: "#2b2f36", ink2: "#5f6368", ink3: "#8a9a93",
  title: "#35495e", brand: "#42b883", accent: "#35495e", alt: "#42b883",
  coverBg: "#35495e", coverTitle: "#ffffff", coverSub: "#d6f3e6",
  codeBg: "#282c34", codeBar: "#21252b", codeLight: false,
  hintBg: "#e3f4ec", hintInk: "#1e6b45",
  series: [
    { c: "#2e8b57", bg: "#e8f5ec" }, { c: "#2f6fb5", bg: "#e7f0fb" }, { c: "#c97a12", bg: "#fdf0e0" },
    { c: "#6b4fb8", bg: "#f1eafa" }, { c: "#c0392b", bg: "#fbeaea" }, { c: "#1f8a8a", bg: "#e6f6f6" },
  ],
  callout: { tip: { bg: "#e7f0fb", bd: "#2f6fb5" }, warn: { bg: "#fdf0e0", bd: "#c97a12" }, task: { bg: "#e8f5ec", bd: "#2e8b57" }, ask: { bg: "#f1eafa", bd: "#6b4fb8" } },
  stage: { b: "#c97a12", o: "#b8944d", p1: "#2e8b57", p2: "#2f6fb5", p3: "#6b4fb8", s: "#5f6368" },
};

/** Parse the palette part of a Marp theme CSS into CSS variables. */
function cssVars(css: string): Record<string, string> {
  const marker = css.lastIndexOf("══ palette:");
  const part = marker >= 0 ? css.slice(marker) : css;
  const root = part.match(/:root\s*\{([\s\S]*?)\n\}/) ?? part.match(/:root\s*\{([\s\S]*?)\}/);
  const vars: Record<string, string> = {};
  if (!root) return vars;
  const body = root[1].replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

export function themeFromCss(css: string, name: string): Theme {
  const v = cssVars(css);
  if (!v.bg || !v.accent) throw new Error(`theme "${name}": no palette variables (--bg/--accent) found in :root`);
  const bg = over(v.bg, "#ffffff");
  const c = (key: string, fallback: string) => over(v[key] ?? fallback, bg);
  const accent = c("accent", FRESH.accent), alt = c("alt", FRESH.alt);
  const sizes = [...css.matchAll(/section\s*\{[^}]*?width:\s*(\d+)px[^}]*?height:\s*(\d+)px/g)].pop();
  const w = sizes ? Math.round(+sizes[1] * 1.5) : 1920, h = sizes ? Math.round(+sizes[2] * 1.5) : 1080;
  const dark = luminance(bg) < 0.25;
  const formal = /campus/i.test(name) || /section\.lead\s*\{[^}]*background:\s*var\(--accent\)/.test(css);
  const stageKey = (k: string, d: string) => c(k, d);
  const stage = { b: stageKey("c-b", accent), o: stageKey("c-o", alt), p1: stageKey("c-p1", accent), p2: stageKey("c-p2", accent), p3: stageKey("c-p3", alt), s: stageKey("c-s", "#64748b") };
  const brand = formal ? alt : accent;
  const seriesColors = formal ? [alt, accent, stage.p1, stage.p3, stage.b, stage.s] : [accent, alt, stage.p1, stage.p2, stage.p3, stage.b];
  const series = seriesColors.map((col) => ({ c: col, bg: mix(col, bg, dark ? 0.82 : 0.9) }));
  const codeBg = c("code-bg", "#282c34"), codeLight = luminance(codeBg) > 0.5;
  const soft = c("soft", FRESH.soft), card = dark ? soft : c("card-bg", "#ffffff");
  const callout = (k: "tip" | "warn" | "task" | "ask") => ({ bg: over(v[`${k}-bg`] ?? "#f2f2f2", bg), bd: c(`${k}-bd`, accent) });
  return {
    name, w, h, dark, formal, bg, soft, card, line: c("line", FRESH.line),
    ink: c("ink", FRESH.ink), ink2: c("ink2", FRESH.ink2), ink3: c("ink3", FRESH.ink3),
    title: accent, brand, accent, alt,
    coverBg: formal ? accent : bg, coverTitle: formal ? "#ffffff" : accent, coverSub: formal ? mix("#f5f2ea", accent, 0.25) : c("ink2", FRESH.ink2),
    codeBg, codeBar: codeLight ? mix(codeBg, "#000000", 0.06) : mix(codeBg, "#000000", 0.25), codeLight,
    hintBg: over(v["accent-soft"] ?? "rgba(0,0,0,0.05)", bg), hintInk: dark ? accent : formal ? accent : c("accent-dark", accent),
    series, callout: { tip: callout("tip"), warn: callout("warn"), task: callout("task"), ask: callout("ask") }, stage,
  };
}

/** "fresh" | theme name (looked up in <vault>/theme/<name>.css, then <bundledDir>/<name>.css) | path to a .css file */
export function loadTheme(spec: string | undefined, vaultRoot?: string, bundledDir?: string): Theme {
  if (!spec || spec === "fresh") return FRESH;
  const bare = !/[\/]/.test(spec);
  const candidates = [spec, spec.endsWith(".css") ? "" : `${spec}.css`]
    .filter(Boolean)
    .flatMap((p) => (path.isAbsolute(p) ? [p] : [
      vaultRoot ? path.join(vaultRoot, "theme", p) : "",
      vaultRoot ? path.join(vaultRoot, p) : "",
      bare && bundledDir ? path.join(bundledDir, p) : "", // themes shipped with the plugin; the vault's copy wins
    ]))
    .filter(Boolean);
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error(`theme "${spec}" not found (looked in: ${candidates.join(", ")})`);
  return themeFromCss(fs.readFileSync(file, "utf8"), path.basename(file, ".css"));
}

export const STAGES = [
  { key: "b", letter: "B", name: "导入" },
  { key: "o", letter: "O", name: "目标" },
  { key: "p1", letter: "P", name: "前测" },
  { key: "p2", letter: "P", name: "参与式学习" },
  { key: "p3", letter: "P", name: "后测" },
  { key: "s", letter: "S", name: "总结" },
] as const;
