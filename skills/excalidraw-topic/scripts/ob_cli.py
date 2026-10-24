#!/usr/bin/env python3
"""Inspect and verify single-document Obsidian visual lessons through native CLI."""
import argparse
import json
import os
from pathlib import Path
import re
import select
import subprocess
import sys
import time


def execute(argv, timeout=90):
    if sys.platform == "darwin":
        import pty
        master, slave = pty.openpty()
        process = subprocess.Popen(argv, stdin=slave, stdout=slave, stderr=slave, close_fds=True)
        os.close(slave)
        chunks = []
        deadline = time.monotonic() + timeout
        try:
            while time.monotonic() < deadline:
                ready, _, _ = select.select([master], [], [], 0.5)
                if not ready:
                    if process.poll() is not None:
                        break
                    continue
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                chunks.append(chunk)
            else:
                process.kill()
                raise TimeoutError("Obsidian CLI timed out; recover mutation receipts before retry")
            process.wait(timeout=5)
            output = b"".join(chunks).decode("utf-8", errors="replace")
        finally:
            os.close(master)
            if process.poll() is None:
                process.kill()
    else:
        process = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
        output = process.stdout + process.stderr
    if process.returncode:
        raise RuntimeError(output)
    return output


def cli(vault, action, params=None):
    params = dict(params or {})
    params.pop("command", None)
    params["apiVersion"] = 1
    argv = ["obsidian", "vault=" + vault, "obsidian-excalidraw-plugin:" + action]
    if params:
        argv.append("json=" + json.dumps(params, ensure_ascii=False, separators=(",", ":")))
    output = execute(argv)
    receipts = []
    for line in output.splitlines():
        if line.startswith("{"):
            try:
                receipts.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    if not receipts:
        raise RuntimeError("CLI returned no JSON receipt. Do not retry a mutation blindly.\n" + output)
    receipt = receipts[-1]
    if not receipt.get("ok"):
        raise RuntimeError(json.dumps(receipt, ensure_ascii=False, indent=2))
    return receipt


def inspect(vault, path, source="disk"):
    first = cli(vault, "read", {"path": path, "source": source, "detail": "elements", "limit": 50})
    data = first["data"]
    elements = list(data["elements"])
    offset = data.get("nextOffset")
    while offset is not None:
        page = cli(vault, "read", {"path": path, "source": source, "detail": "elements", "limit": 50,
                                   "offset": offset, "revision": data["revision"]})
        elements.extend(page["data"]["elements"])
        offset = page["data"].get("nextOffset")
    return {**data, "elements": elements}


def vault_path(vault):
    output = execute(["obsidian", "vault=" + vault, "vault", "info=path"])
    candidates = [Path(line.strip()) for line in output.splitlines() if line.strip().startswith(("/", "C:\\", "D:\\"))]
    for candidate in reversed(candidates):
        if candidate.is_dir() and (candidate / ".obsidian").is_dir():
            return candidate
    raise RuntimeError("Could not resolve vault directory")


def verify(vault, path):
    data = inspect(vault, path)
    elements = [e for e in data["elements"] if not e.get("isDeleted")]
    frames = [e for e in elements if e["type"] == "frame"]
    frames.sort(key=lambda e: e.get("customData", {}).get("slideshow", {}).get("order", 99999))
    frame_ids = {e["id"] for e in frames}
    ids = {e["id"] for e in elements}
    root = vault_path(vault).resolve()
    target = (root / path).resolve()
    if root not in target.parents:
        raise ValueError("Drawing path must be inside vault")
    markdown = target.read_text(encoding="utf-8").split("# Excalidraw Data", 1)[0]
    embeds = re.findall(r'!\[\[([^\]|]+)#\^frame=([^\]|]+)(?:\|[^\]]+)?\]\]', markdown)
    self_base = path[:-3] if path.endswith(".md") else path
    self_ids = [frame for file, frame in embeds if file in (self_base, path)]
    placeholders = [e["id"] for e in elements if isinstance(e.get("customData", {}).get("mermaid"), str)]
    empty_notes = [f["id"] for f in frames if not f.get("customData", {}).get("slideshow", {}).get("notes", "").strip()]
    orders = [f.get("customData", {}).get("slideshow", {}).get("order") for f in frames]
    frame_map = {f["id"]: f for f in frames}
    overflow, orphans, dangling_animations = [], [], []
    for e in elements:
        fid = e.get("frameId")
        if fid and fid not in frame_ids:
            orphans.append(e["id"])
        if e.get("type") in ("text", "image") and fid in frame_map:
            f = frame_map[fid]
            if e["x"] < f["x"] - 2 or e["y"] < f["y"] - 2 or e["x"] + e["width"] > f["x"] + f["width"] + 2 or e["y"] + e["height"] > f["y"] + f["height"] + 2:
                overflow.append({"id": e["id"], "frame": fid, "text": e.get("text", "")[:80]})
    def find_targets(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("elementId", "elementIds", "targets", "targetIds"):
                    for ident in value if isinstance(value, list) else [value]:
                        target_id = ident.get("id") if isinstance(ident, dict) and ident.get("type") == "element" else ident
                        if isinstance(target_id, str) and target_id not in ids:
                            dangling_animations.append(target_id)
                else:
                    find_targets(value)
        elif isinstance(node, list):
            for value in node:
                find_targets(value)
    for f in frames:
        find_targets(f.get("customData", {}).get("slideshow", {}).get("animation", {}))
    bindings = []
    for e in elements:
        for binding in (e.get("startBinding"), e.get("endBinding")):
            if binding and binding.get("elementId") not in ids:
                bindings.append({"arrow": e["id"], "target": binding.get("elementId")})
    report = {
        "path": path, "revision": data["revision"], "elements": len(elements), "frames": len(frames),
        "orders": orders, "continuousOrder": orders == list(range(len(frames))),
        "selfFrameEmbeds": len(self_ids), "missingFrameEmbeds": sorted(frame_ids - set(self_ids)),
        "unknownFrameEmbeds": sorted(set(self_ids) - frame_ids), "emptyNotes": empty_notes,
        "mermaidBlocks": len(re.findall(r'(?:^|\n)(?:>\s*)?```mermaid\s*\n', markdown)),
        "pendingMermaid": placeholders, "outOfFrameTextOrImages": overflow,
        "orphanFrameReferences": orphans, "danglingAnimationTargets": dangling_animations,
        "danglingBindings": bindings,
        "smallDiagramText": [{"id": e["id"], "fontSize": e.get("fontSize"), "text": e.get("text", "")[:80]} for e in elements if e.get("type") == "text" and e.get("customData", {}).get("topicDiagram") and e.get("fontSize", 0) < 16],
        "types": {kind: sum(e["type"] == kind for e in elements) for kind in sorted({e["type"] for e in elements})},
        "frameList": [{k: f[k] for k in ("id", "name", "x", "y", "width", "height") if k in f} for f in frames]
    }
    report["ok"] = bool(frames) and report["continuousOrder"] and report["mermaidBlocks"] > 0 and not any(
        report[key] for key in ("missingFrameEmbeds", "unknownFrameEmbeds", "emptyNotes", "pendingMermaid", "outOfFrameTextOrImages", "orphanFrameReferences", "danglingAnimationTargets", "danglingBindings", "smallDiagramText"))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True)
    sub = parser.add_subparsers(dest="mode", required=True)
    call = sub.add_parser("call")
    call.add_argument("action")
    source = call.add_mutually_exclusive_group()
    source.add_argument("--params", help="JSON object")
    source.add_argument("--input", help="Local JSON request file")
    call.add_argument("--out")
    for mode in ("inspect", "verify"):
        cmd = sub.add_parser(mode)
        cmd.add_argument("--path", required=True)
        cmd.add_argument("--out")
    args = parser.parse_args()
    if args.mode == "call":
        params = json.loads(Path(args.input).read_text()) if args.input else json.loads(args.params or "{}")
        result = cli(args.vault, args.action, params)
    elif args.mode == "inspect":
        result = inspect(args.vault, args.path)
    else:
        result = verify(args.vault, args.path)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(json.dumps({"out": args.out, "ok": result.get("ok", True), "frames": result.get("frames")}, ensure_ascii=False))
    else:
        print(text)
    if result.get("ok") is False:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
