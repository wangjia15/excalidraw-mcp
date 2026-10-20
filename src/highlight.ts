/**
 * Minimal syntax highlighter for code slides.
 * Excalidraw text is single-coloured, so highlighting is done by splitting a block into one
 * text layer per colour: in each layer every character that is not of that colour is blanked
 * with a space (CJK -> ideographic space), keeping a monospace grid so the layers overlay exactly.
 */
export type Lang = "java" | "ts" | "vue" | "yaml" | "json" | "http" | "sh" | "xml" | "text";

export const THEME = {
  default: "#abb2bf",
  keyword: "#c678dd",
  string: "#98c379",
  comment: "#7f848e",
  annotation: "#e5c07b",
  type: "#e5c07b",
  func: "#61afef",
  number: "#d19a66",
  tag: "#e06c75",
  attr: "#d19a66",
  key: "#e06c75",
  punct: "#abb2bf",
} as const;
export const THEME_LIGHT: Record<keyof typeof THEME, string> = {
  default: "#24302a", keyword: "#7c3aed", string: "#15803d", comment: "#6b7280", annotation: "#b45309", type: "#b45309",
  func: "#1d4ed8", number: "#c2410c", tag: "#be123c", attr: "#b45309", key: "#be123c", punct: "#24302a",
};
export type Tok = keyof typeof THEME;

const KW = {
  java: "public private protected static final class interface enum extends implements new return if else for while switch case break continue try catch finally throw throws import package void int long double boolean this super null true false default abstract synchronized var record instanceof",
  ts: "const let var function return if else for while switch case break continue try catch finally throw import export from default class extends implements interface type new async await typeof instanceof void null undefined true false in of as",
  sh: "if then else fi for do done echo export cd mvn java curl git npm sudo",
  http: "GET POST PUT PATCH DELETE HEAD OPTIONS HTTP",
};
const set = (s: string) => new Set(s.split(" "));
const KWS: Record<string, Set<string>> = { java: set(KW.java), ts: set(KW.ts), vue: set(KW.ts), sh: set(KW.sh), http: set(KW.http) };

export function detectLang(code: string, hint?: string): Lang {
  const h = (hint ?? "").toLowerCase();
  if (["java", "kotlin"].includes(h)) return "java";
  if (["ts", "js", "typescript", "javascript"].includes(h)) return "ts";
  if (["vue", "html"].includes(h)) return "vue";
  if (["yaml", "yml", "properties"].includes(h)) return "yaml";
  if (["json"].includes(h)) return "json";
  if (["http", "rest"].includes(h)) return "http";
  if (["sh", "bash", "shell"].includes(h)) return "sh";
  if (["xml"].includes(h)) return "xml";
  const t = code.trim();
  if (/^<(template|script|style)\b/m.test(t) || /<script setup/.test(t)) return "vue";
  if (/^(GET|POST|PUT|PATCH|DELETE)\s|^###|^@\w+\s*=\s*http/m.test(t) && !/;\s*$/m.test(t)) return "http";
  if (/^\s*<\?xml|^\s*<\w+[^>]*>\s*$/m.test(t) && !/;\s*$/m.test(t) && /<\/\w+>/.test(t)) return "xml";
  if (/^\s*[\w.-]+:\s*(\S.*)?$/m.test(t) && !/[;{}]/.test(t)) return "yaml";
  if (/^\s*[{[]/.test(t) && /"\s*:/.test(t) && !/;\s*$/m.test(t)) return "json";
  if (/^\s*(\$|mvn |curl |java -|npm )/m.test(t)) return "sh";
  if (/\b(public|private|class|interface|import java|@\w+)\b/.test(t)) return "java";
  if (/\b(const|let|function|=>|import .* from)\b/.test(t)) return "ts";
  return "text";
}

/** Tokenise one line; returns an array of token kind per character. */
function tokenizeLine(line: string, lang: Lang, state: { block: boolean }): Tok[] {
  const kinds: Tok[] = new Array(line.length).fill("default");
  const paint = (a: number, b: number, k: Tok) => { for (let i = a; i < b && i < line.length; i++) kinds[i] = k; };
  if (lang === "text") return kinds;

  let i = 0;
  if (state.block) {
    const end = line.indexOf("*/");
    if (end < 0) { paint(0, line.length, "comment"); return kinds; }
    paint(0, end + 2, "comment"); state.block = false; i = end + 2;
  }
  const kw = KWS[lang];
  const lineComment = lang === "yaml" || lang === "sh" ? "#" : lang === "http" ? "#" : lang === "java" || lang === "ts" || lang === "vue" ? "//" : "";

  if (lang === "yaml") {
    const m = line.match(/^(\s*-?\s*)([\w.\-/$*{}]+)(\s*:)(\s|$)/);
    if (m) paint(m[1].length, m[1].length + m[2].length, "key");
  }
  if (lang === "http" && /^###/.test(line)) { paint(0, line.length, "comment"); return kinds; }
  if (lang === "json") {
    const re = /"([^"\\]|\\.)*"(\s*:)?/g; let m: RegExpExecArray | null;
    while ((m = re.exec(line))) paint(m.index, m.index + m[0].length - (m[2] ? m[2].length : 0), m[2] ? "key" : "string");
    const nre = /\b(true|false|null|-?\d+(\.\d+)?)\b/g;
    while ((m = nre.exec(line))) if (kinds[m.index] === "default") paint(m.index, m.index + m[0].length, "number");
    return kinds;
  }

  while (i < line.length) {
    const rest = line.slice(i), ch = line[i];
    if (lineComment && rest.startsWith(lineComment) && !(lang === "yaml" && i > 0 && !/\s/.test(line[i - 1]))) {
      if (!(lang === "java" && line[i - 1] === ":")) { paint(i, line.length, "comment"); break; }
    }
    if ((lang === "java" || lang === "ts" || lang === "vue") && rest.startsWith("/*")) {
      const end = line.indexOf("*/", i + 2);
      if (end < 0) { paint(i, line.length, "comment"); state.block = true; break; }
      paint(i, end + 2, "comment"); i = end + 2; continue;
    }
    if ((lang === "vue" || lang === "xml") && rest.startsWith("<!--")) {
      const end = line.indexOf("-->", i);
      paint(i, end < 0 ? line.length : end + 3, "comment"); i = end < 0 ? line.length : end + 3; continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === "\\" ? 2 : 1;
      paint(i, Math.min(j + 1, line.length), "string"); i = j + 1; continue;
    }
    if ((lang === "vue" || lang === "xml") && (ch === "<")) {
      const m = rest.match(/^<\/?([\w-]+)/);
      if (m) {
        paint(i, i + m[0].length, "tag"); i += m[0].length;
        // attributes up to '>'
        const close = line.indexOf(">", i);
        const seg = line.slice(i, close < 0 ? line.length : close);
        const re = /([:@#\w.-]+)(=)?/g; let am: RegExpExecArray | null;
        while ((am = re.exec(seg))) if (am[1]) paint(i + am.index, i + am.index + am[1].length, "attr");
        const sre = /"[^"]*"|'[^']*'/g;
        while ((am = sre.exec(seg))) paint(i + am.index, i + am.index + am[0].length, "string");
        if (close >= 0) { paint(close, close + 1, "tag"); i = close + 1; } else i = line.length;
        continue;
      }
    }
    if (ch === "@" && (lang === "java" || lang === "ts")) {
      const m = rest.match(/^@[\w.]+/);
      if (m) { paint(i, i + m[0].length, "annotation"); i += m[0].length; continue; }
    }
    if (/[0-9]/.test(ch) && !/[\w]/.test(line[i - 1] ?? " ")) {
      const m = rest.match(/^\d[\d._xL]*/);
      if (m) { paint(i, i + m[0].length, "number"); i += m[0].length; continue; }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const m = rest.match(/^[A-Za-z_$][\w$]*/)!;
      const w = m[0], next = line[i + w.length];
      if (kw?.has(w)) paint(i, i + w.length, "keyword");
      else if (next === "(" ) paint(i, i + w.length, "func");
      else if (/^[A-Z]/.test(w) && lang !== "http" && lang !== "sh") paint(i, i + w.length, "type");
      i += w.length; continue;
    }
    i++;
  }
  return kinds;
}

export type Layer = { color: string; text: string };

/** Split code into colour layers sharing one monospace grid. */
export function highlightLayers(code: string, lang: Lang, light = false): Layer[] {
  const lines = code.replace(/\t/g, "  ").split("\n");
  const state = { block: false };
  const grid = lines.map((l) => ({ l, k: tokenizeLine(l, lang, state) }));
  const used = new Map<Tok, string[]>();
  const blank = (ch: string) => (ch.charCodeAt(0) > 255 ? "　" : " ");
  for (const { l, k } of grid) {
    const kinds = new Set<Tok>(k.filter((_, i) => l[i] !== " "));
    for (const kind of kinds) if (!used.has(kind)) used.set(kind, []);
  }
  for (const kind of used.keys()) {
    used.set(kind, grid.map(({ l, k }) => l.split("").map((ch, i) => (k[i] === kind && ch !== " " ? ch : blank(ch))).join("")));
  }
  const layers: Layer[] = [];
  for (const [kind, rows] of used) {
    const text = rows.join("\n");
    if (text.trim()) layers.push({ color: (light ? THEME_LIGHT : THEME)[kind], text });
  }
  return layers;
}
