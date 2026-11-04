#!/usr/bin/env python3
"""List every video inside public Google Drive folders (recursively).

Usage: drive_list.py <folder-url-or-id> [...]
Prints one line per file:  <file_id>\t<file_name>
Folders must be shared as "Anyone with the link".
"""
import html
import re
import sys
import urllib.request

VIDEO_EXT = (".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".3gp")
UA = "Mozilla/5.0 (portfolio-import)"


def folder_id(arg: str) -> str:
    m = re.search(r"folders/([A-Za-z0-9_-]{10,})", arg) or re.search(r"[?&]id=([A-Za-z0-9_-]{10,})", arg)
    return m.group(1) if m else arg.strip()


def fetch(fid: str) -> str:
    url = f"https://drive.google.com/embeddedfolderview?id={fid}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


ENTRY = re.compile(
    r'<a href="(?P<href>[^"]+)"[^>]*>.*?<div class="flip-entry-title">(?P<title>.*?)</div>',
    re.S,
)


def walk(fid: str, prefix: str, seen: set):
    if fid in seen:
        return
    seen.add(fid)
    page = fetch(fid)
    for m in ENTRY.finditer(page):
        href, title = html.unescape(m.group("href")), html.unescape(m.group("title")).strip()
        f = re.search(r"/file/d/([A-Za-z0-9_-]+)", href)
        d = re.search(r"/folders/([A-Za-z0-9_-]+)", href)
        if f:
            if title.lower().endswith(VIDEO_EXT) or "." not in title[-6:]:
                print(f"{f.group(1)}\t{prefix}{title}")
        elif d:
            walk(d.group(1), f"{prefix}{title}/", seen)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    seen: set = set()
    for arg in sys.argv[1:]:
        walk(folder_id(arg), "", seen)


if __name__ == "__main__":
    main()
