"""Extract figures and tables from a paper PDF as PNG crops (PyMuPDF).

  python -I pdf_figures.py auto  <paper.pdf> <out_dir> [--zoom 3]
      find "Figure N" / "Table N" captions, crop the graphics next to each, write <out_dir>/fig<N>.png,
      tab<N>.png and <out_dir>/figures.json (page, bbox in PDF points, caption). Check every crop by eye.
  python -I pdf_figures.py pages <paper.pdf> <out_dir> [--zoom 1.5] [--pages 1,3-5]
      render whole pages to page<N>.png, to find or fix a figure by eye.
  python -I pdf_figures.py crop  <paper.pdf> <out_dir> <page> <x0> <y0> <x1> <y1> <name> [--zoom 3]
      crop a region given in PDF points (pages are 1-based; page size is printed by `pages`).
"""
import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

CAP = re.compile(r"^\s*(Figure|Fig\.|Table)\s*(\d+)\s*[:.|]", re.I)


def opt(name, default):
    if name in sys.argv:
        i = sys.argv.index(name)
        v = sys.argv[i + 1]
        del sys.argv[i:i + 2]
        return v
    return default


def save(page, rect, path, zoom):
    rect = rect & page.rect
    page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect, alpha=False).save(path)


def graphics(page):
    """bounding boxes of images and vector drawings on a page"""
    boxes = [fitz.Rect(b["bbox"]) for b in page.get_text("dict")["blocks"] if b["type"] == 1]
    for d in page.get_drawings():
        r = d["rect"]
        if r.width > 2 or r.height > 2:
            boxes.append(fitz.Rect(r))
    return boxes


def captions(page):
    """(kind, number, caption rect, caption text) for lines starting with Figure/Table N, to the end of their block"""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        lines = b["lines"]
        for i, ln in enumerate(lines):
            t = "".join(s["text"] for s in ln["spans"])
            m = CAP.match(t)
            if m:
                r = fitz.Rect(ln["bbox"])
                for l2 in lines[i + 1:]:
                    r |= fitz.Rect(l2["bbox"])
                txt = " ".join("".join(s["text"] for s in l2["spans"]) for l2 in lines[i:])
                out.append(("tab" if m.group(1).lower().startswith("tab") else "fig", m.group(2), r, txt))
                break
    return out


def grow(cap, cands, side, x0, x1, top, bottom, gap=22):
    """union of candidates reachable from the caption on one side, each within `gap` of the region so far"""
    pool = [c for c in cands if c.x1 > x0 and c.x0 < x1 and c.y0 >= top - 1 and c.y1 <= bottom + 1
            and (c.y1 <= cap.y0 + 2 if side < 0 else c.y0 >= cap.y1 - 2)]
    region, edge = fitz.Rect(), cap.y0 if side < 0 else cap.y1
    changed = True
    while changed:
        changed = False
        for c in list(pool):
            if (side < 0 and edge - c.y1 <= gap) or (side > 0 and c.y0 - edge <= gap):
                region |= c
                edge = min(edge, c.y0) if side < 0 else max(edge, c.y1)
                pool.remove(c)
                changed = True
    return region


def prose(text):
    """a body paragraph: long, with long lines (table cells and axis labels are many short lines)"""
    lines = [l for l in text.splitlines() if l.strip()]
    return len(text) > 160 and len(text) / max(len(lines), 1) > 40


def auto(doc, out, zoom):
    found, missing = {}, {}
    for pno, page in enumerate(doc):
        blocks = [b for b in page.get_text("blocks") if b[6] == 0]
        caps = captions(page)
        pw, ph = page.rect.width, page.rect.height
        gfx = [g for g in graphics(page) if g.width < pw * 0.98]
        short = [fitz.Rect(t[:4]) for t in blocks if not prose(t[4]) and not CAP.match(t[4])]
        long_ = [fitz.Rect(t[:4]) for t in blocks if prose(t[4]) and not CAP.match(t[4])]
        try:
            tables = [fitz.Rect(t.bbox) for t in page.find_tables().tables]
        except Exception:
            tables = []
        for kind, num, cap, ctext in caps:
            key = f"{kind}{num}"
            # column: full width when the caption spans past the middle, else its half
            if cap.x0 < pw * 0.45 and cap.x1 > pw * 0.55:
                x0, x1 = 20, pw - 20
            elif cap.x1 <= pw * 0.55:
                x0, x1 = 20, pw / 2
            else:
                x0, x1 = pw / 2, pw - 20
            # bands end at body paragraphs and other captions
            stops = long_ + [c[2] for c in caps if c[2] != cap]
            top = max([s.y1 for s in stops if s.y1 <= cap.y0 and s.x1 > x0 and s.x0 < x1] + [20])
            bottom = min([s.y0 for s in stops if s.y0 >= cap.y1 and s.x1 > x0 and s.x0 < x1] + [ph - 20])
            region = fitz.Rect()
            # find_tables also reports charts and may run through other captions: keep boxes inside the band
            near = [t for t in tables if (0 <= cap.y0 - t.y1 < 60 or 0 <= t.y0 - cap.y1 < 60) and t.x1 > x0 and t.x0 < x1
                    and t.y0 >= top - 1 and t.y1 <= bottom + 1]
            if kind == "tab" and near:
                region = min(near, key=lambda t: min(abs(cap.y0 - t.y1), abs(t.y0 - cap.y1)))
            else:
                cands = gfx + short  # axis labels and table cells are short text
                above, below = grow(cap, cands, -1, x0, x1, top, bottom), grow(cap, cands, 1, x0, x1, top, bottom)
                if kind == "fig":  # figure captions are normally below the figure
                    region = above if not above.is_empty and above.height >= 30 else below
                else:  # tables: the side whose content starts closer to the caption
                    # content directly above another caption belongs to that caption (e.g. a figure under the table)
                    others = [c[2] for c in caps if c[2] != cap and c[2].x1 > x0 and c[2].x0 < x1]
                    if not below.is_empty and any(0 <= o.y0 - below.y1 <= 30 for o in others):
                        below = fitz.Rect()
                    da = cap.y0 - above.y1 if not above.is_empty else 1e9
                    db = below.y0 - cap.y1 if not below.is_empty else 1e9
                    region = above if da <= db else below
            if region.is_empty or region.height < 20:
                missing.setdefault(key, {"name": key, "file": None, "page": pno + 1, "caption_bbox": [round(v, 1) for v in cap], "caption": " ".join(ctext.split())[:400]})
                continue
            region = fitz.Rect(region) | cap  # keep the caption in the crop
            b = (0, 0, 0, 0, ctext)
            region = fitz.Rect(region.x0 - 4, region.y0 - 4, region.x1 + 4, region.y1 + 4)
            area = region.width * region.height
            if key in found and found[key]["_area"] >= area:  # mid-text mentions give smaller hits
                continue
            found[key] = {"name": key, "file": f"{key}.png", "page": pno + 1, "bbox": [round(v, 1) for v in region],
                          "caption": " ".join(b[4].split())[:400], "_area": area}
    for f in found.values():
        save(doc[f["page"] - 1], fitz.Rect(f["bbox"]), out / f["file"], zoom)
        del f["_area"]
    items = sorted(list(found.values()) + [m for k, m in missing.items() if k not in found], key=lambda f: (f["name"][:3], int(f["name"][3:])))
    (out / "figures.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf8")
    for f in items:
        print(f"{f['file'] or 'MISSING':<10} p{f['page']:<3} {f['caption'][:90]}")
    print(f"{len(found)} crops, {len(items) - len(found)} missing (crop them with `pages` + `crop`) -> {out}")


def page_list(spec, n):
    if not spec:
        return range(1, n + 1)
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += range(int(a), int(b or a) + 1)
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    zoom = float(opt("--zoom", "0"))
    pages = opt("--pages", "")
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)
    cmd, pdf, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf)
    if cmd == "auto":
        auto(doc, out, zoom or 3)
    elif cmd == "pages":
        for p in page_list(pages, len(doc)):
            doc[p - 1].get_pixmap(matrix=fitz.Matrix(zoom or 1.5, zoom or 1.5), alpha=False).save(out / f"page{p}.png")
            print(f"page{p}.png  size {doc[p - 1].rect.width:.0f}x{doc[p - 1].rect.height:.0f} pt")
    elif cmd == "crop":
        p, x0, y0, x1, y1, name = sys.argv[4:10]
        save(doc[int(p) - 1], fitz.Rect(float(x0), float(y0), float(x1), float(y1)), out / f"{name}.png", zoom or 3)
        print(f"{name}.png")
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
