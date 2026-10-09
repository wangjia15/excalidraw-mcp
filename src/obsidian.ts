/**
 * Obsidian Excalidraw plugin (.excalidraw.md) support.
 * Reads/writes drawings stored in an Obsidian vault, in the plugin's
 * compressed-json markdown format.
 */
import fs from "node:fs/promises";
import path from "node:path";
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
  return `${fm}
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==


# Excalidraw Data

## Text Elements
${texts}
%%
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

export async function writeDrawing(rel: string, elements: any[], overwrite: boolean, style: "professional" | "none" = "professional") {
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
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buildExcalidrawMd(scene, frontmatter), "utf8");
}
