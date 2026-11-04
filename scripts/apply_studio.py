#!/usr/bin/env python3
"""Apply edits published from /studio.

The studio opens GitHub's "new file" page with a file named
incoming/edit-<time>.studio already filled in. Committing it runs this script
(via .github/workflows/apply-studio.yml), which merges the edit into
content.json, stamps the chosen theme into index.html and deletes the file.

Payload: "HSTUDIO1." + base64url(deflate-raw(JSON))   (or "HSTUDIO1J." + base64url(JSON))
JSON:    {"v":1, "site":{...}, "categories":[...], "style":[...],
          "works":[[id, title, category, blurb, featured, hidden, before], ...]}
"""
import base64
import json
import re
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content.json"
INDEX = ROOT / "index.html"
THEMES = {"suite", "archive", "noir", "teal"}
SITE_TEXT = ["name", "name_latin", "role", "tagline", "about", "whatsapp", "instagram",
             "tiktok", "youtube", "snapchat", "x", "email", "og_image"]
SITE_BOOL = ["show_style", "show_about"]


def text(v, limit=3000):
    return str(v if v is not None else "").strip()[:limit]


def decode(raw: str) -> dict:
    m = re.fullmatch(r"HSTUDIO1(J?)\.([A-Za-z0-9_-]+)", raw.strip())
    if not m:
        raise ValueError("not a studio file")
    b = m.group(2)
    data = base64.urlsafe_b64decode(b + "=" * (-len(b) % 4))
    if not m.group(1):
        data = zlib.decompress(data, -15)
    patch = json.loads(data.decode("utf-8"))
    if not isinstance(patch, dict) or patch.get("v") != 1:
        raise ValueError("unknown studio version")
    return patch


def exists(rel: str) -> bool:
    return bool(rel) and not rel.startswith(("/", "..")) and (ROOT / rel).is_file()


def merge(content: dict, patch: dict) -> dict:
    site = content.setdefault("site", {})
    psite = patch.get("site") or {}
    for k in SITE_TEXT:
        if k in psite:
            site[k] = text(psite[k])
    for k in SITE_BOOL:
        if k in psite:
            site[k] = bool(psite[k])
    if psite.get("theme") in THEMES:
        site["theme"] = psite["theme"]

    if isinstance(patch.get("categories"), list):
        cats = []
        for c in patch["categories"]:
            c = text(c, 80)
            if c and c not in cats:
                cats.append(c)
        content["categories"] = cats

    if isinstance(patch.get("style"), list):
        style = []
        for it in patch["style"]:
            if not isinstance(it, dict):
                continue
            clip, poster = text(it.get("clip"), 300), text(it.get("poster"), 300)
            if not (exists(clip) or exists(poster)):
                continue
            style.append({"title": text(it.get("title"), 120), "text": text(it.get("text"), 400),
                          "clip": clip if exists(clip) else "", "poster": poster if exists(poster) else "",
                          "work": text(it.get("work"), 40)})
        content["style"] = style

    works = content.get("works", [])
    by_id = {w["id"]: w for w in works}
    videos = {w.get("video") for w in works}
    order, seen = [], set()
    for row in patch.get("works") or []:
        if not isinstance(row, list) or not row or row[0] not in by_id or row[0] in seen:
            continue
        row = (row + [""] * 7)[:7]
        w = by_id[row[0]]
        w["title"] = text(row[1], 160) or w.get("title", "")
        w["category"] = text(row[2], 80)
        w["blurb"] = text(row[3], 400)
        w["featured"] = bool(row[4])
        w["hidden"] = bool(row[5])
        before = text(row[6], 300)
        w["before"] = before if before in videos and before != w.get("video") else ""
        order.append(w)
        seen.add(row[0])
    # works added after the studio was opened (e.g. a fresh upload) are kept, at the end
    order += [w for w in works if w["id"] not in seen]
    content["works"] = order
    return content


def stamp_theme(theme: str):
    html = INDEX.read_text(encoding="utf-8")
    new = re.sub(r'(<html\b[^>]*?\sdata-theme=")[^"]*(")', rf"\g<1>{theme}\g<2>", html, count=1)
    if new != html:
        INDEX.write_text(new, encoding="utf-8")


def main():
    files = sorted((ROOT / "incoming").glob("*.studio"))
    if not files:
        print("no studio edits")
        return 0
    content = json.loads(CONTENT.read_text(encoding="utf-8"))
    errors = 0
    for f in files:
        try:
            content = merge(content, decode(f.read_text(encoding="utf-8")))
            print(f"applied {f.name}")
        except Exception as e:  # noqa: BLE001
            errors += 1
            print(f"::error::{f.name}: {e}")
        f.unlink()
    CONTENT.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stamp_theme(content.get("site", {}).get("theme", "suite"))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
