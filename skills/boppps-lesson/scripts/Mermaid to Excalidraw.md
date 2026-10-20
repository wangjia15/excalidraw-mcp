/*
# Mermaid to Excalidraw

Replaces every Mermaid placeholder in the drawing (an element whose `customData.mermaid` holds Mermaid code,
written by the excalidraw MCP `obsidian_write_slides` `mermaid` field) with native Excalidraw elements made by the
plugin's built-in mermaid-to-excalidraw (`ea.addMermaid`). The diagram is scaled to fit the placeholder box, keeps
its frame (slide) and the placeholder is removed. Placeholders that fail to convert are kept and reported.

Run from the command palette, or through the native CLI:
  obsidian vault=<vault> obsidian-excalidraw-plugin:script path=<drawing> script="Excalidraw/Scripts/Mermaid to Excalidraw.md" trusted=true requestId=<id> args='{"maxScale":1.8}'

utils.input (all optional): { ids?: string[] (only these placeholders), maxScale?: number (default 1.8),
fontSize?: number (default 20, before scaling), fontFamily?: number (default 2, system sans),
sketch?: boolean (true keeps the hand-drawn look of mermaid-to-excalidraw),
style?: object (merged over the placeholder's customData.mermaidStyle — the slide theme palette written by the MCP:
  {fontFamily, text, line, edgeText, node:{fill,stroke}, decision:{…}, terminal:{…}, group:{…}, actor:{…}}),
theme?: boolean (false keeps mermaid's own colours) }
Each report entry has minFont: the smallest text size after scaling (below ~16 is hard to read on a 1920 slide).
*/
const input = (typeof utils !== "undefined" && utils.input) || {};
const maxScale = input.maxScale ?? 1.8;
const viewEls = ea.getViewElements();
const slots = viewEls.filter((e) => !e.isDeleted && typeof e.customData?.mermaid === "string" && (!input.ids || input.ids.includes(e.id)));
const report = [];

const merge = (a, b) => {
  const o = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(o[k], v) : v;
  return o;
};
const SHAPES = ["rectangle", "ellipse", "diamond"];
const inside = (a, b) => a !== b && a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
// paint the converted diagram with the slide theme
const paint = (els, st, isSeq) => {
  const shapes = els.filter((e) => SHAPES.includes(e.type));
  for (const e of els) {
    if (SHAPES.includes(e.type)) {
      const role = shapes.some((o) => inside(o, e)) ? "group" : isSeq && e.type === "rectangle" ? "actor"
        : e.type === "diamond" ? "decision" : e.type === "ellipse" ? "terminal" : "node";
      const c = st[role] ?? st.node;
      if (!c) continue;
      e.backgroundColor = c.fill; e.strokeColor = c.stroke; e.fillStyle = "solid"; e.strokeWidth = role === "group" ? 1 : 2;
      if (e.type === "rectangle" && role !== "actor") e.roundness = { type: 3 };
    } else if (e.type === "arrow" || e.type === "line") {
      if (st.line) e.strokeColor = st.line;
      e.strokeWidth = 2;
    } else if (e.type === "text") {
      const host = e.containerId && els.find((o) => o.id === e.containerId);
      const c = !host || host.type === "arrow" ? st.edgeText : st.text;
      if (c) e.strokeColor = c;
    }
  }
};

// make room for a widened shape: everything left of x moves left by d/2, everything right moves right by d/2
const spread = (els, x, d, skip) => {
  const mv = (px) => px + (px < x ? -d / 2 : d / 2);
  for (const o of els) {
    if (skip.includes(o.id) || skip.includes(o.containerId)) continue;
    if (o.points?.length) {
      const abs = o.points.map(([px, py]) => [mv(o.x + px), o.y + py]);
      o.x = abs[0][0]; o.points = abs.map(([ax, ay]) => [ax - o.x, ay - o.y]);
      o.width = Math.max(...abs.map((a) => a[0])) - Math.min(...abs.map((a) => a[0]));
    } else if (!o.containerId || !els.some((c) => c.id === o.containerId && c.points)) {
      o.x = mv(o.x + o.width / 2) - o.width / 2;
    }
  }
  // labels bound to arrows follow their arrow's midpoint when Excalidraw redraws; text in shapes moved with the centre rule
};

const boundsOf = (els) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of els) {
    if (e.points?.length) for (const [px, py] of e.points) { x0 = Math.min(x0, e.x + px); y0 = Math.min(y0, e.y + py); x1 = Math.max(x1, e.x + px); y1 = Math.max(y1, e.y + py); }
    else { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x + e.width); y1 = Math.max(y1, e.y + e.height); }
  }
  return { x0, y0, x1, y1 };
};

for (const ph of slots) {
  ea.clear();
  ea.style.fontSize = input.fontSize ?? 20;
  ea.style.fontFamily = input.fontFamily ?? ph.customData.mermaidStyle?.fontFamily ?? 2;
  ea.style.roughness = 0;
  const res = await ea.addMermaid(ph.customData.mermaid, true);
  if (typeof res === "string") { report.push({ id: ph.id, ok: false, error: res }); continue; }
  const els = ea.getElements();
  if (!els.length) { report.push({ id: ph.id, ok: false, error: "mermaid produced no elements" }); continue; }
  const st = merge(ph.customData.mermaidStyle, input.style);
  if (input.theme !== false) paint(els, st, /^\s*sequenceDiagram/.test(ph.customData.mermaid));
  // match the slide: clean lines and the slide font (mermaid-to-excalidraw uses the sketchy defaults)
  if (input.sketch !== true) {
    for (const e of els) if ("roughness" in e) e.roughness = 0;
    for (const e of els.filter((x) => x.type === "text")) {
      e.fontFamily = input.fontFamily ?? st.fontFamily ?? 2;
      if (e.originalText) e.text = e.originalText;
      const box = e.containerId && ea.getElement(e.containerId);
      if (box) {
        // the label should fit on its lines: shrink the font a little, then widen the shape
        ea.style.fontFamily = e.fontFamily; ea.style.fontSize = e.fontSize;
        const tw = Math.max(...e.text.split("\n").map((l) => ea.measureText(l).width));
        const inner = box.type === "diamond" ? box.width / 2 - 8 : box.width - 16; // Excalidraw wraps diamond labels at half the width
        if (tw > inner) {
          e.fontSize = Math.max(e.fontSize * 0.85, (e.fontSize * inner) / tw);
          const need = (tw * e.fontSize) / ea.style.fontSize, w = box.type === "diamond" ? (need + 24) * 2 : need + 20;
          if (w > box.width) { spread(els, box.x + box.width / 2, w - box.width, [box.id, e.id]); box.x -= (w - box.width) / 2; box.width = w; }
        }
      }
      ea.refreshTextElementSize(e.id);
      if (box) {
        e.x = box.x + (box.width - e.width) / 2;
        e.y = box.y + (box.height - e.height) / 2;
      }
    }
  }
  const b = boundsOf(els), w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0);
  const pad = 16, s = Math.min((ph.width - 2 * pad) / w, (ph.height - 2 * pad) / h, maxScale);
  const ox = ph.x + (ph.width - w * s) / 2, oy = ph.y + (ph.height - h * s) / 2;
  for (const e of els) {
    e.x = ox + (e.x - b.x0) * s;
    e.y = oy + (e.y - b.y0) * s;
    e.width *= s;
    e.height *= s;
    if (e.points) e.points = e.points.map(([px, py]) => [px * s, py * s]);
    if (e.type === "text") e.fontSize *= s;
    e.frameId = ph.frameId ?? null;
  }
  // remove the placeholder box and its bound label
  const labelIds = (ph.boundElements ?? []).filter((x) => x.type === "text").map((x) => x.id);
  ea.copyViewElementsToEAforEditing(viewEls.filter((e) => e.id === ph.id || labelIds.includes(e.id)));
  for (const id of [ph.id, ...labelIds]) { const e = ea.getElement(id); if (e) e.isDeleted = true; }
  await ea.addElementsToView(false, true, true);
  const texts = els.filter((e) => e.type === "text");
  const minFont = texts.length ? Math.round(Math.min(...texts.map((e) => e.fontSize))) : null;
  report.push({ id: ph.id, ok: true, elements: els.length, scale: Math.round(s * 100) / 100, minFont });
}
ea.clear();
if (report.some((r) => r.ok)) await ea.targetView?.forceSave?.(true); // flush every conversion to disk
const summary = `Mermaid to Excalidraw: ${report.filter((r) => r.ok).length}/${slots.length} converted`;
if (typeof utils === "undefined" || !utils.input) new Notice(summary);
return { summary, report };
