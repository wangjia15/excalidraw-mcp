/**
 * Slide deck generator for the Obsidian Excalidraw "Slideshow" script.
 *
 * Every slide is an Excalidraw frame (1920x1080, the script's default slide size). Slide order,
 * presenter notes and appearance animations live in `frame.customData.slideshow`
 * (schemaVersion 2, kind "frame"), exactly as the script's sidepanel writes them.
 */
export type SlideSpec = {
  title: string;
  subtitle?: string;
  bullets?: string[];
  code?: string;
  codeTitle?: string;
  flow?: string[];
  notes?: string;
  /** bullets appear one by one on presenter advance (default true) */
  animate?: boolean;
};
export type DeckSpec = { title?: string; slides: SlideSpec[] };

const W = 1920, H = 1080, GAP = 240;
const GREEN = "#42b883", NAVY = "#35495e", INK = "#2b2f36", MUTED = "#5f6368";

const wOf = (s: string, fs: number, mono = false) =>
  Math.ceil([...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? fs : fs * (mono ? 0.6 : 0.55)), 0));

function wrap(text: string, fs: number, maxW: number): string {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of para) {
      if (wOf(line + ch, fs) > maxW && line) { out.push(line); line = ch; } else line += ch;
    }
    out.push(line);
  }
  return out.join("\n");
}

export function buildSlides(spec: DeckSpec): any[] {
  const out: any[] = [];
  let n = 0;
  const id = () => `sl${(++n).toString(36).padStart(6, "0")}`; // 8 chars, valid plugin id

  spec.slides.forEach((s, idx) => {
    const fx = 0, fy = idx * (H + GAP), fid = id();
    const cover = idx === 0;
    const kids: any[] = [];
    const add = (e: any) => { const el = { id: id(), frameId: fid, ...e }; kids.push(el); return el; };
    const text = (x: number, y: number, t: string, fs: number, color: string, extra: any = {}) => {
      const lines = t.split("\n");
      return add({ type: "text", x: fx + x, y: fy + y, text: t, originalText: t, fontSize: fs, fontFamily: 2, strokeColor: color, textAlign: "left", verticalAlign: "top",
        width: Math.max(...lines.map((l) => wOf(l, fs, extra.fontFamily === 3))), height: Math.ceil(lines.length * fs * 1.25), ...extra });
    };

    // background
    add({ type: "rectangle", x: fx, y: fy, width: W, height: H, strokeColor: "transparent", strokeWidth: 0, backgroundColor: cover ? NAVY : "#f6faf8", fillStyle: "solid" });

    if (cover) {
      add({ type: "rectangle", x: fx + 140, y: fy + 360, width: 16, height: 220, strokeColor: "transparent", backgroundColor: GREEN, fillStyle: "solid", strokeWidth: 0 });
      text(200, 350, s.title, 92, "#ffffff");
      if (s.subtitle) text(204, 500, s.subtitle, 40, "#b8d8c8");
      if (spec.title) text(204, 940, spec.title, 28, "#8fa9bd");
    } else {
      add({ type: "rectangle", x: fx, y: fy, width: 24, height: H, strokeColor: "transparent", backgroundColor: GREEN, fillStyle: "solid", strokeWidth: 0 });
      text(110, 70, s.title, 64, NAVY);
      add({ type: "line", x: fx + 110, y: fy + 170, width: 1700, height: 0, points: [[0, 0], [1700, 0]], strokeColor: "#cfe3d9", strokeWidth: 2, startArrowhead: null, endArrowhead: null });
      if (s.subtitle) text(112, 190, s.subtitle, 30, MUTED);
      text(1780, 1000, `${idx + 1} / ${spec.slides.length}`, 26, MUTED);

      const hasCode = !!s.code, hasBullets = !!s.bullets?.length, hasFlow = !!s.flow?.length;
      const bulletW = hasCode ? 640 : 1650;
      const steps: any[] = [];
      let by = s.subtitle ? 270 : 240;
      if (hasBullets) {
        const fs = hasCode ? 34 : 40;
        s.bullets!.forEach((b) => {
          const wrapped = wrap(b, fs, bulletW - 60);
          const dot = add({ type: "ellipse", x: fx + 120, y: fy + by + fs * 0.4, width: 18, height: 18, strokeColor: GREEN, backgroundColor: GREEN, fillStyle: "solid", strokeWidth: 1 });
          const t = text(160, by, wrapped, fs, INK);
          by += t.height + 34;
          if (s.animate !== false) {
            steps.push({ id: id(), effect: "fade", trigger: "advance", durationMs: 350, targets: [{ type: "element", id: dot.id }, { type: "element", id: t.id }] });
          }
        });
      }
      if (hasCode) {
        const cx = hasBullets ? 860 : 110, cw = hasBullets ? 950 : 1700;
        const fs = 26, lines = s.code!.replace(/\t/g, "  ").split("\n");
        const ch = Math.min(lines.length * fs * 1.25 + 130, 800);
        const top = 240;
        add({ type: "rectangle", x: fx + cx, y: fy + top, width: cw, height: ch, strokeColor: "#1c2430", backgroundColor: "#1f2937", fillStyle: "solid", strokeWidth: 1, roundness: { type: 3 } });
        add({ type: "ellipse", x: fx + cx + 28, y: fy + top + 24, width: 16, height: 16, strokeColor: "transparent", backgroundColor: "#ef4444", fillStyle: "solid", strokeWidth: 0 });
        add({ type: "ellipse", x: fx + cx + 54, y: fy + top + 24, width: 16, height: 16, strokeColor: "transparent", backgroundColor: "#f59e0b", fillStyle: "solid", strokeWidth: 0 });
        add({ type: "ellipse", x: fx + cx + 80, y: fy + top + 24, width: 16, height: 16, strokeColor: "transparent", backgroundColor: GREEN, fillStyle: "solid", strokeWidth: 0 });
        if (s.codeTitle) text(cx + 120, top + 20, s.codeTitle, 22, "#9ca3af");
        const code = text(cx + 36, top + 76, s.code!.replace(/\t/g, "  "), fs, "#e5e7eb", { fontFamily: 3 });
        if (s.animate !== false && !hasBullets) {
          // reveal code on advance
          steps.push({ id: id(), effect: "fade", trigger: "advance", durationMs: 350, targets: [{ type: "element", id: code.id }] });
        }
      }
      if (hasFlow) {
        const items = s.flow!, gap = 90, bw = Math.min(300, Math.floor((1700 - gap * (items.length - 1)) / items.length)), bh = 110;
        const total = items.length * bw + gap * (items.length - 1);
        const x0 = 110 + (1700 - total) / 2;
        const y0 = hasBullets || hasCode ? 800 : 420;
        const pal = [["#e8f5ec", "#2e8b57"], ["#e7f0fb", "#2f6fb5"], ["#fdf0e0", "#c97a12"], ["#f1eafa", "#6b4fb8"], ["#fbeaea", "#c0392b"], ["#e6f6f6", "#1f8a8a"]];
        const ids: string[] = [];
        items.forEach((t, i) => {
          const [bg, st] = pal[i % pal.length];
          const bx = x0 + i * (bw + gap);
          const box = add({ type: "rectangle", x: fx + bx, y: fy + y0, width: bw, height: bh, strokeColor: st, backgroundColor: bg, fillStyle: "solid", strokeWidth: 2, roundness: { type: 3 } });
          const label = wrap(t, 28, bw - 24), ln = label.split("\n");
          const lw = Math.max(...ln.map((l) => wOf(l, 28))), lh = Math.ceil(ln.length * 28 * 1.25);
          const tx = add({ type: "text", x: fx + bx + (bw - lw) / 2, y: fy + y0 + (bh - lh) / 2, text: label, originalText: label, fontSize: 28, fontFamily: 2, strokeColor: INK, textAlign: "center", verticalAlign: "middle", width: lw, height: lh });
          ids.push(box.id, tx.id);
          if (i > 0) {
            add({ type: "arrow", x: fx + bx - gap + 6, y: fy + y0 + bh / 2, width: gap - 12, height: 0, points: [[0, 0], [gap - 12, 0]], strokeColor: NAVY, strokeWidth: 2, startArrowhead: null, endArrowhead: "arrow" });
          }
        });
      }
      if (steps.length) (s as any)._steps = steps;
    }

    const frame: any = {
      type: "frame", id: fid, x: fx, y: fy, width: W, height: H, name: `${String(idx + 1).padStart(2, "0")} ${s.title}`,
      strokeColor: "#bbbbbb", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, roundness: null,
      customData: { slideshow: { schemaVersion: 2, kind: "frame", order: idx } },
    };
    if (s.notes) frame.customData.slideshow.notes = s.notes;
    if ((s as any)._steps?.length) frame.customData.slideshow.animation = { steps: (s as any)._steps };
    delete (s as any)._steps;
    out.push(...kids, frame); // frames sit after their children
  });
  return out;
}
