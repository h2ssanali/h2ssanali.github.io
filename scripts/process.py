#!/usr/bin/env python3
"""Turn raw videos into web-ready portfolio media and register them in content.json.

For every input video it produces, inside media/:
  <id>.mp4          H.264 720x1280 (9:16), CRF ~26, AAC, +faststart, < 12 MB
  <id>-loop.mp4     3.5 s muted preview loop (hover-to-play), < 1 MB
  <id>.webp         poster taken from the most striking frame
and, inside curation/ (helps choosing titles & categories):
  <id>.jpg          contact sheet of 8 frames
  <id>.txt          transcript of the opening seconds (only with --transcribe)

Usage:
  process.py [--transcribe] [--budget-mb 880] FILE_OR_DIR [...]

A file named "<driveFileId>__<name>.mp4" keeps its Drive id as a stable key so
re-running the import never duplicates a work.
"""
import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
CURATION = ROOT / "curation"
CONTENT = ROOT / "content.json"
LEDGER = ROOT / "scripts" / "imported.json"
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".3gp"}

W, H = 720, 1280
MAX_MB = 11.5
PREVIEW_SECONDS = 3.5


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    v = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
    a = next((s for s in data["streams"] if s.get("codec_type") == "audio"), None)
    if not v:
        raise ValueError("no video stream")
    w, h = int(v["width"]), int(v["height"])
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = abs(int(float(sd["rotation"])))
    if str(v.get("tags", {}).get("rotate", "0")) in ("90", "270"):
        rot = 90
    if rot in (90, 270):
        w, h = h, w
    num, den = (v.get("avg_frame_rate") or "30/1").split("/")
    fps = float(num) / float(den or 1) if float(den or 1) else 30.0
    dur = float(data["format"].get("duration") or v.get("duration") or 0)
    return {"w": w, "h": h, "fps": fps or 30.0, "dur": dur, "audio": a is not None}


def human_title(name: str) -> str:
    stem = Path(name).stem
    stem = re.sub(r"^[A-Za-z0-9_-]{20,}__", "", stem)          # drive id prefix
    stem = re.sub(r"[_\-.]+", " ", stem)
    stem = re.sub(r"(?i)\b(final|v\d+|copy|export|edit|reel|mp4|mov|\d{3,4}p)\b", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem or "عمل جديد"


def source_key(path: Path) -> str:
    m = re.match(r"^([A-Za-z0-9_-]{20,})__", path.name)
    if m:
        return "drive:" + m.group(1)
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read(4 * 1024 * 1024))
    h.update(str(path.stat().st_size).encode())
    return "sha1:" + h.hexdigest()


def new_id(key: str, taken: set) -> str:
    base = "w" + hashlib.sha1(key.encode()).hexdigest()[:7]
    i, cand = 1, base
    while cand in taken:
        i += 1
        cand = f"{base}{i}"
    return cand


# ---------------------------------------------------------------- frames ----

def sample_frames(src: Path, info: dict, tmp: Path, n: int = 40):
    """Grab ~n small frames evenly across the video. Returns [(t, path)]."""
    dur = max(info["dur"], 0.5)
    frames = []
    for i in range(n):
        t = dur * (0.04 + 0.92 * i / max(n - 1, 1))
        out = tmp / f"f{i:03d}.png"
        r = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1",
             "-vf", "scale=180:320:force_original_aspect_ratio=increase,crop=180:320", "-y", str(out)],
            capture_output=True,
        )
        if r.returncode == 0 and out.exists():
            frames.append((t, out))
    return frames


def score_frame(path: Path) -> float:
    import numpy as np
    from PIL import Image

    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype("float32") / 255.0
    lum = a @ np.array([0.299, 0.587, 0.114], dtype="float32")
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = ((mx - mn) / (mx + 1e-4)).mean()
    contrast = lum.std()
    gy, gx = np.gradient(lum)
    sharp = np.sqrt(gx ** 2 + gy ** 2).mean()
    mean = lum.mean()
    exposure = 1.0 - min(abs(mean - 0.42) / 0.42, 1.0)       # punish black / blown frames
    # A centred subject: more detail in the middle third than at the edges
    h, w = lum.shape
    centre = np.sqrt(gx[h // 4: 3 * h // 4, w // 5: 4 * w // 5] ** 2 + gy[h // 4: 3 * h // 4, w // 5: 4 * w // 5] ** 2).mean()
    return (contrast * 2.2 + sat * 0.9 + sharp * 6 + centre * 3) * (0.35 + 0.65 * exposure)


def contact_sheet(frames, dest: Path):
    from PIL import Image

    pick = [frames[int(i * (len(frames) - 1) / 7)] for i in range(8)] if len(frames) >= 8 else frames
    if not pick:
        return
    tw, th = 180, 320
    sheet = Image.new("RGB", (tw * 4, th * math.ceil(len(pick) / 4)), (8, 8, 8))
    for i, (_, p) in enumerate(pick):
        sheet.paste(Image.open(p).convert("RGB"), ((i % 4) * tw, (i // 4) * th))
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, quality=78)


# ---------------------------------------------------------------- encode ----

def video_filter(info: dict, w: int, h: int) -> str:
    fps = ",fps=30" if info["fps"] > 31 else ""
    ratio = info["w"] / info["h"]
    if abs(ratio - w / h) < 0.03:
        return f"scale={w}:{h}:flags=lanczos,setsar=1{fps}"
    if ratio < w / h:  # taller than 9:16 -> crop a little
        return f"scale={w}:-2:flags=lanczos,crop={w}:{h},setsar=1{fps}"
    # wider than 9:16 (landscape): soft blurred backdrop + sharp centred frame
    return (
        f"split=2[bg][fg];[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"boxblur=24:2,eq=brightness=-0.12[b];[fg]scale={w}:-2:flags=lanczos[f];"
        f"[b][f]overlay=(W-w)/2:(H-h)/2,setsar=1{fps}"
    )


def encode_main(src: Path, info: dict, dest: Path):
    dur = max(info["dur"], 1)
    budget_kbps = int(MAX_MB * 8 * 1024 / dur) - 128
    maxrate = max(450, min(3200, budget_kbps))
    for attempt in range(3):
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(src),
               "-filter_complex", video_filter(info, W, H),
               "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-profile:v", "high", "-pix_fmt", "yuv420p",
               "-maxrate", f"{maxrate}k", "-bufsize", f"{maxrate * 2}k",
               "-movflags", "+faststart"]
        if info["audio"]:
            cmd += ["-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"]
        else:
            cmd += ["-an"]
        run(cmd + [str(dest)])
        mb = dest.stat().st_size / 1048576
        if mb <= 12:
            return mb
        maxrate = int(maxrate * 0.8)
    return dest.stat().st_size / 1048576


def encode_preview(src: Path, info: dict, start: float, dest: Path):
    start = max(0.0, min(start, max(info["dur"] - PREVIEW_SECONDS, 0)))
    vf = video_filter(info, 360, 640)
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", str(PREVIEW_SECONDS), "-i", str(src),
         "-filter_complex", vf, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "29",
         "-maxrate", "1500k", "-bufsize", "1500k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dest)])


def encode_poster(src: Path, info: dict, t: float, dest: Path):
    vf = video_filter(info, W, H)
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1",
         "-filter_complex", vf, "-c:v", "libwebp", "-quality", "80", str(dest)])


def transcribe(src: Path, dest: Path, seconds: int = 45):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("   (faster-whisper not installed, skipping transcript)")
        return
    global _MODEL
    if "_MODEL" not in globals():
        _MODEL = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "a.wav"
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-t", str(seconds), "-vn",
                            "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)], capture_output=True)
        if r.returncode or not wav.exists():
            return
        import wave

        import numpy as np

        with wave.open(str(wav)) as wf:
            pcm = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        segs, _ = _MODEL.transcribe(pcm, language="ar", vad_filter=True)
        text = " ".join(s.text.strip() for s in segs)
    dest.write_text(text.strip() + "\n", encoding="utf-8")


# ---------------------------------------------------------------- content ---

def load_json(p: Path, default):
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return default


def save_json(p: Path, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def dir_mb(p: Path) -> float:
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) / 1048576 if p.exists() else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--transcribe", action="store_true")
    ap.add_argument("--budget-mb", type=float, default=float(os.environ.get("MEDIA_BUDGET_MB", 880)))
    ap.add_argument("--category", default="")
    args = ap.parse_args()

    files = []
    for i in args.inputs:
        p = Path(i)
        if p.is_dir():
            files += sorted(f for f in p.rglob("*") if f.suffix.lower() in VIDEO_EXT)
        elif p.suffix.lower() in VIDEO_EXT:
            files.append(p)
    if not files:
        print("No videos found.")
        return

    MEDIA.mkdir(exist_ok=True)
    CURATION.mkdir(exist_ok=True)
    content = load_json(CONTENT, {"site": {}, "categories": [], "works": []})
    ledger = load_json(LEDGER, {})
    taken = {w.get("id") for w in content["works"]}
    added, skipped = [], []

    for src in files:
        key = source_key(src)
        if key in ledger and any(w.get("id") == ledger[key] for w in content["works"]):
            print(f"= already imported: {src.name}")
            continue
        if dir_mb(MEDIA) > args.budget_mb:
            skipped.append(src.name)
            print(f"! media budget reached, skipping {src.name}")
            continue
        try:
            info = probe(src)
        except Exception as e:  # noqa: BLE001
            print(f"! cannot read {src.name}: {e}")
            skipped.append(src.name)
            continue
        wid = new_id(key, taken)
        taken.add(wid)
        print(f"> {src.name}  ->  {wid}  ({info['w']}x{info['h']}, {info['dur']:.1f}s)")
        with tempfile.TemporaryDirectory() as td:
            frames = sample_frames(src, info, Path(td))
            scored = [(score_frame(p), t) for t, p in frames] if frames else []
            # prefer the middle of the piece a little (titles/outros sit at the ends)
            best_t = max(scored, key=lambda s: s[0] * (1 - 0.25 * abs(s[1] / info["dur"] - 0.5)))[1] if scored else info["dur"] / 3
            contact_sheet(frames, CURATION / f"{wid}.jpg")
        mb = encode_main(src, info, MEDIA / f"{wid}.mp4")
        encode_poster(src, info, best_t, MEDIA / f"{wid}.webp")
        encode_preview(src, info, best_t - 1.2, MEDIA / f"{wid}-loop.mp4")
        if args.transcribe:
            try:
                transcribe(src, CURATION / f"{wid}.txt")
            except Exception as e:  # noqa: BLE001 - transcripts are optional
                print(f"   (transcript failed: {e})")
        print(f"   main {mb:.1f} MB · loop {(MEDIA / f'{wid}-loop.mp4').stat().st_size / 1024:.0f} KB · poster @ {best_t:.1f}s")

        cats = content.get("categories") or []
        content["works"].append({
            "id": wid,
            "title": human_title(src.name),
            "category": args.category or (cats[0] if cats else ""),
            "blurb": "",
            "video": f"media/{wid}.mp4",
            "poster": f"media/{wid}.webp",
            "preview": f"media/{wid}-loop.mp4",
            "duration": round(info["dur"], 1),
            "featured": False,
            "hidden": False,
            "before": "",
        })
        ledger[key] = wid
        added.append(wid)
        save_json(CONTENT, content)
        save_json(LEDGER, ledger)

    print(f"\nAdded {len(added)} work(s). Media folder: {dir_mb(MEDIA):.0f} MB.")
    if skipped:
        print("Skipped:", ", ".join(skipped))
        (CURATION / "skipped.txt").write_text("\n".join(skipped) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
