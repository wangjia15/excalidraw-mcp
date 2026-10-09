/**
 * Obsidian Excalidraw plugin (.excalidraw.md) support.
 * Reads/writes drawings stored in an Obsidian vault, in the plugin's
 * compressed-json markdown format.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import LZString from "lz-string";

const DRAWING_COMPRESSED_REG = /\n##? Drawing\n[^`]*```compressed-json\n([\s\S]*?)```/m;
const DRAWING_JSON_REG = /\n##? Drawing\n[^`]*```json\n([\s\S]*?)```/m;

export function getVaultRoot(): string {
  const v = process.env.OBSIDIAN_VAULT;
  if (!v) throw new Error("OBSIDIAN_VAULT environment variable is not set (path to the Obsidian vault)");
  return path.resolve(v);
}

/** Resolve a vault-relative path, rejecting anything that escapes the vault. */
export function resolveVaultPath(rel: string): string {
  const root = getVaultRoot();
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Path escapes the vault");
  }
  return full;
}

export function compressScene(json: string): string {
  const b64 = LZString.compressToBase64(json);
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 256) chunks.push(b64.slice(i, i + 256));
  return chunks.join("\n\n");
}

export function parseExcalidrawMd(md: string): { scene: any; frontmatter: string } {
  const fm = md.match(/^---\n[\s\S]*?\n---/)?.[0] ?? "";
  let json: string | null = null;
  const c = md.match(DRAWING_COMPRESSED_REG);
  if (c) {
    json = LZString.decompressFromBase64(c[1].replace(/[\r\n]/g, ""));
  } else {
    const j = md.match(DRAWING_JSON_REG);
    if (j) json = j[1];
  }
  if (!json) throw new Error("No ## Drawing section found; not an Excalidraw plugin file");
  return { scene: JSON.parse(json), frontmatter: fm };
}

export function buildExcalidrawMd(scene: any, frontmatter?: string): string {
  const fm = frontmatter && frontmatter.includes("excalidraw-plugin")
    ? frontmatter
    : "---\n\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n\n---";
  const texts = (scene.elements ?? [])
    .filter((e: any) => e.type === "text" && !e.isDeleted)
    .map((e: any) => `${e.originalText ?? e.text} ^${e.id}\n`)
    .join("\n");
  // images stored as vault files: "<fileId>: [[path]]" under "## Embedded Files"
  const embedded = new Map<string, string>();
  for (const e of scene.elements ?? []) {
    if (e.type === "image" && !e.isDeleted && e.fileId && e.customData?.vaultPath) embedded.set(e.fileId, e.customData.vaultPath);
  }
  const files = embedded.size ? `## Embedded Files\n${[...embedded].map(([id, p]) => `${id}: [[${p}]]\n`).join("\n")}\n` : "";
  return `${fm}
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==


# Excalidraw Data

## Text Elements
${texts}
${files}%%
## Drawing
\`\`\`compressed-json
${compressScene(JSON.stringify(scene))}
\`\`\`
%%`;
}

/**
 * Default "professional" template: clean (non-sketchy) lines, Helvetica text,
 * 1.5px strokes. Only fills in properties the caller did not set explicitly.
 */
export const PROFESSIONAL_STYLE = { roughness: 0, strokeWidth: 1.5 };
export const PROFESSIONAL_FONT_FAMILY = 2; // Helvetica
export const PROFESSIONAL_APP_STATE = {
  currentItemRoughness: 0,
  currentItemStrokeWidth: 1.5,
  currentItemFontFamily: PROFESSIONAL_FONT_FAMILY,
  currentItemRoundness: "round",
};

export function applyProfessionalStyle(elements: any[]): any[] {
  return elements.map((e) => {
    const out = { ...PROFESSIONAL_STYLE, ...e };
    if (e.type === "text" && e.fontFamily === undefined) out.fontFamily = PROFESSIONAL_FONT_FAMILY;
    return out;
  });
}

const PLUGIN_ID = /^[A-Za-z0-9_-]{8}$/;

/**
 * The plugin only recognises "## Text Elements" entries whose id is exactly 8 chars of
 * [A-Za-z0-9_-]; any other id makes the text come back empty on load. Remap ids (and every
 * reference to them) to stable 8-char ids.
 */
export function normalizeIds(elements: any[]): any[] {
  const map = new Map<string, string>();
  const used = new Set<string>(elements.map((e) => e.id).filter((i: string) => PLUGIN_ID.test(i)));
  for (const e of elements) {
    if (!e?.id || PLUGIN_ID.test(e.id) || map.has(e.id)) continue;
    let n = 0, nid: string;
    do { nid = createHash("sha1").update(e.id + ":" + n++).digest("base64url").slice(0, 8); } while (used.has(nid) || !PLUGIN_ID.test(nid));
    used.add(nid);
    map.set(e.id, nid);
  }
  if (!map.size) return elements;
  const m = (i: any) => (typeof i === "string" && map.has(i) ? map.get(i)! : i);
  return elements.map((e) => {
    const o = { ...e, id: m(e.id) };
    if (o.containerId) o.containerId = m(o.containerId);
    if (o.frameId) o.frameId = m(o.frameId);
    if (o.boundElements) o.boundElements = o.boundElements.map((b: any) => ({ ...b, id: m(b.id) }));
    for (const k of ["startBinding", "endBinding"]) if (o[k]) o[k] = { ...o[k], elementId: m(o[k].elementId) };
    return o;
  });
}

export async function listDrawings(dir = ""): Promise<string[]> {
  const root = getVaultRoot();
  const out: string[] = [];
  const walk = async (d: string) => {
    for (const ent of await fs.readdir(d, { withFileTypes: true })) {
      if (ent.name.startsWith(".")) continue;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.name.endsWith(".excalidraw.md")) out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  await walk(resolveVaultPath(dir));
  return out;
}

export async function readDrawing(rel: string) {
  const md = await fs.readFile(resolveVaultPath(rel), "utf8");
  return parseExcalidrawMd(md).scene;
}

/** pixel size of a PNG / JPEG / GIF / WebP file, or null when unknown (e.g. SVG) */
export async function imageSize(rel: string): Promise<{ w: number; h: number } | null> {
  const b = await fs.readFile(resolveVaultPath(rel));
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    if (b.toString("ascii", 12, 16) === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}

export async function writeDrawing(rel: string, elements: any[], overwrite: boolean, style: "professional" | "none" = "professional", extra: { appState?: Record<string, any> } = {}) {
  elements = normalizeIds(elements);
  if (style === "professional") elements = applyProfessionalStyle(elements);
  if (!rel.endsWith(".excalidraw.md")) throw new Error("Path must end with .excalidraw.md");
  const full = resolveVaultPath(rel);
  let frontmatter: string | undefined;
  let scene: any = {
    type: "excalidraw", version: 2, source: "excalidraw-mcp",
    elements, appState: { theme: "light", viewBackgroundColor: "#ffffff", ...(style === "professional" ? PROFESSIONAL_APP_STATE : {}) }, files: {},
  };
  try {
    const existing = parseExcalidrawMd(await fs.readFile(full, "utf8"));
    if (!overwrite) throw new Error(`${rel} already exists (pass overwrite: true)`);
    frontmatter = existing.frontmatter;
    scene = { ...existing.scene, elements };
  } catch (e: any) {
    if (e.code !== "ENOENT" && !String(e.message).includes("No ## Drawing")) throw e;
  }
  if (extra.appState) scene.appState = { ...scene.appState, ...extra.appState };
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buildExcalidrawMd(scene, frontmatter), "utf8");
}
