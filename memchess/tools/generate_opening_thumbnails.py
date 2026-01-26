#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Memchess - Opening Thumbnails Generator (offline)

What it does:
- Reads Memchess opening book data from: memchess/js/opening_names.js (opening_book_moves)
- Computes the final position by replaying SAN moves (python-chess)
- Renders a 720x720 PNG thumbnail with coordinates (a-h / 1-8)
- Generates both:
    - <OpeningId>.png            (white-at-bottom)
    - <OpeningId>_black.png      (black-at-bottom perspective; NOT a raw rotation)

Default behavior:
- Only generates missing thumbnails in memchess/img/openings/
- Leaves existing thumbnails untouched unless --force is used

Dependencies:
  pip install pillow python-chess

Usage:
  python memchess/tools/generate_opening_thumbnails.py --root .
  python memchess/tools/generate_opening_thumbnails.py --root . --force
  python memchess/tools/generate_opening_thumbnails.py --root . --limit 50
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple, Optional

try:
    import chess  # python-chess
except ImportError:
    print("ERROR: Missing dependency 'python-chess'. Install with: pip install python-chess", file=sys.stderr)
    raise

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Missing dependency 'Pillow'. Install with: pip install pillow", file=sys.stderr)
    raise


# =========================
# Rendering configuration
# =========================

OUT_W = 720
OUT_H = 720
SQUARE = 90  # 720/8

# Board colors (matches existing Memchess thumbnails)
LIGHT = (239, 216, 180)
DARK  = (180, 135, 98)

# Text colors for coordinates (contrast)
TEXT_ON_LIGHT = DARK
TEXT_ON_DARK  = LIGHT

# Relative paths inside the memchess root
PIECE_DIR_REL = Path("img/chesspieces/wikipedia")
OPENINGS_DIR_REL = Path("img/openings")
OPENING_NAMES_JS_REL = Path("js/opening_names.js")


# =========================
# Helpers / data types
# =========================

@dataclass(frozen=True)
class OpeningEntry:
    name: str          # Display name (English)
    moves_str: str     # Concatenated SAN sequence from opening_book_moves
    element_id: str    # Memchess ID: name stripped of non-alphanumeric


def element_id_from_name(name: str) -> str:
    # Exactly the same rule as Memchess:
    # elementid = name.replace(/[^a-zA-Z0-9]/g,"")
    return re.sub(r"[^a-zA-Z0-9]", "", name)


def find_memchess_root(start: Path) -> Path:
    """
    Find the folder that contains:
      - js/opening_names.js
      - img/chesspieces/wikipedia
    Accepts:
      - a repo root that contains memchess/
      - or the memchess/ folder itself
    """
    start = start.resolve()
    candidates: List[Path] = []

    for p in [start, *start.parents]:
        if (p / OPENING_NAMES_JS_REL).exists() and (p / PIECE_DIR_REL).exists():
            candidates.append(p)
        if (p / "memchess" / OPENING_NAMES_JS_REL).exists() and (p / "memchess" / PIECE_DIR_REL).exists():
            candidates.append(p / "memchess")

    if candidates:
        return candidates[0]

    raise FileNotFoundError(
        "Could not locate Memchess root.\n"
        f"Expected: {OPENING_NAMES_JS_REL} and {PIECE_DIR_REL}\n"
        "Use --root to point at the memchess/ directory (or a repo containing it)."
    )


def parse_opening_book_moves(opening_names_js: Path) -> List[OpeningEntry]:
    """
    Parses:
      var opening_book_moves = { "Name":"<SAN...>", ... };
    """
    text = opening_names_js.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"var\s+opening_book_moves\s*=\s*\{\s*(.*?)\n\};", text, re.S)
    if not m:
        raise ValueError("Could not find 'opening_book_moves' in opening_names.js")

    body = m.group(1)
    line_re = re.compile(r'^\s*"([^"]+)":"([^"]*)"\s*,?\s*$', re.M)
    pairs = line_re.findall(body)

    entries: List[OpeningEntry] = []
    for name, moves in pairs:
        eid = element_id_from_name(name)
        entries.append(OpeningEntry(name=name, moves_str=moves, element_id=eid))
    return entries


def list_targets(memchess_root: Path, entries: List[OpeningEntry], force: bool) -> List[Tuple[OpeningEntry, bool, bool]]:
    """
    Returns list of (entry, generate_white, generate_black)
    """
    openings_dir = memchess_root / OPENINGS_DIR_REL
    openings_dir.mkdir(parents=True, exist_ok=True)
    existing = {p.name for p in openings_dir.glob("*.png")}

    targets: List[Tuple[OpeningEntry, bool, bool]] = []
    for e in entries:
        w = f"{e.element_id}.png"
        b = f"{e.element_id}_black.png"
        do_w = force or (w not in existing)
        do_b = force or (b not in existing)
        if do_w or do_b:
            targets.append((e, do_w, do_b))
    return targets


# =========================
# SAN parsing & FEN compute
# =========================

def split_string_into_moves(history: str) -> List[str]:
    """
    Legacy Memchess format: SAN moves concatenated without separators.
    This replicates the original split logic used by Memchess.
    """
    moves: List[str] = []
    while history:
        if history.startswith("O-O-O"):
            moves.append("O-O-O")
            history = history[5:]
            continue
        if history.startswith("O-O"):
            moves.append("O-O")
            history = history[3:]
            continue

        digit_index = 0
        for i, c in enumerate(history):
            if c.isdigit():
                # legacy quirk: avoid cutting after N/R immediately before a digit
                if i > 0 and history[i - 1] in ("N", "R"):
                    continue
                digit_index = i
                break

        # suffix check (+ / #)
        if len(history) > digit_index + 1 and history[digit_index + 1] in ("+", "#"):
            digit_index += 1

        # promotion: e8=Q
        if len(history) > digit_index + 1 and history[digit_index + 1] == "=":
            digit_index += 2

        moves.append(history[: digit_index + 1])
        history = history[digit_index + 1 :]
    return moves


def sanitize_san(san: str) -> str:
    """
    Fixes occasional dataset quirks.
    Example:
      '+Ke1' -> 'Ke1+'
      '#Qh5' -> 'Qh5#'
    """
    san = san.strip()
    if not san:
        return san
    if san[0] in ("+", "#") and len(san) > 1:
        san = san[1:] + san[0]
    return san


def fen_after_moves_san(moves_str: str) -> str:
    board = chess.Board()
    moves = split_string_into_moves(moves_str or "")
    for i, san in enumerate(moves):
        san2 = sanitize_san(san)
        try:
            board.push_san(san2)
        except Exception as e:
            raise ValueError(f"Invalid SAN at index {i}: '{san}' -> '{san2}' ({e})") from e
    return board.fen()


# =========================
# Rendering
# =========================

def load_piece_images(memchess_root: Path) -> Dict[str, Image.Image]:
    """
    Loads 'wikipedia' piece sprites and resizes them to 90x90.
    Keys: 'wP','bK',...
    """
    piece_dir = memchess_root / PIECE_DIR_REL
    pieces: Dict[str, Image.Image] = {}

    for code in ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"]:
        p = piece_dir / f"{code}.png"
        if not p.exists():
            raise FileNotFoundError(f"Missing piece sprite: {p}")
        im = Image.open(p).convert("RGBA").resize((SQUARE, SQUARE), Image.Resampling.LANCZOS)
        pieces[code] = im

    return pieces


def load_font() -> ImageFont.ImageFont:
    """
    Tries common fonts. Falls back to PIL default.
    """
    size = 20
    for name in ["arial.ttf", "Arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            pass
    return ImageFont.load_default()


def square_is_light(r: int, f: int) -> bool:
    # r=0 top, f=0 left
    return ((r + f) % 2 == 0)


def draw_board_base(draw: ImageDraw.ImageDraw) -> None:
    for r in range(8):
        for f in range(8):
            color = LIGHT if square_is_light(r, f) else DARK
            x0 = f * SQUARE
            y0 = r * SQUARE
            draw.rectangle([x0, y0, x0 + SQUARE, y0 + SQUARE], fill=color)


def fen_to_grid(fen: str) -> List[List[str]]:
    """
    Returns an 8x8 grid of FEN chars ('.' for empty),
    indexed in "white view" coordinates:
      r=0 -> rank 8 (top)
      r=7 -> rank 1 (bottom)
      f=0 -> file a (left)
      f=7 -> file h (right)
    """
    board_part = fen.split()[0]
    ranks = board_part.split("/")
    if len(ranks) != 8:
        raise ValueError(f"Invalid FEN: {fen}")

    grid = [["." for _ in range(8)] for _ in range(8)]
    for r, rank_str in enumerate(ranks):
        f = 0
        for ch in rank_str:
            if ch.isdigit():
                f += int(ch)
            else:
                if f < 8:
                    grid[r][f] = ch
                f += 1
    return grid


def piece_key_from_fen_char(ch: str) -> str:
    if ch == ".":
        return ""
    if ch.isupper():
        return "w" + ch
    return "b" + ch.upper()


def _text_w_h(font: ImageFont.ImageFont, s: str) -> Tuple[int, int]:
    bbox = font.getbbox(s)
    return (bbox[2] - bbox[0], bbox[3] - bbox[1])


def draw_coordinates(draw: ImageDraw.ImageDraw, font: ImageFont.ImageFont, perspective: str) -> None:
    """
    Draws board coordinates aligned (no glyph wobble).
      - bottom: files
      - right: ranks
    perspective:
      - "white": bottom a..h, right 8..1
      - "black": bottom h..a, right 1..8
    """
    pad_x = 8
    pad_y = 10

    if perspective == "white":
        files = ["a","b","c","d","e","f","g","h"]
        ranks = ["8","7","6","5","4","3","2","1"]
    else:
        files = ["h","g","f","e","d","c","b","a"]
        ranks = ["1","2","3","4","5","6","7","8"]

    files_max_h = max(_text_w_h(font, ch)[1] for ch in files)

    # bottom files
    r_bottom = 7
    y_files_top = (r_bottom + 1) * SQUARE - pad_y - files_max_h
    for f in range(8):
        label = files[f]
        on_light = square_is_light(r_bottom, f)
        col = TEXT_ON_LIGHT if on_light else TEXT_ON_DARK
        x = f * SQUARE + pad_x
        draw.text((x, y_files_top), label, fill=col, font=font)

    # right ranks
    f_right = 7
    for r in range(8):
        label = ranks[r]
        on_light = square_is_light(r, f_right)
        col = TEXT_ON_LIGHT if on_light else TEXT_ON_DARK
        w, _ = _text_w_h(font, label)
        x = (f_right + 1) * SQUARE - pad_x - w
        y = r * SQUARE + pad_y
        draw.text((x, y), label, fill=col, font=font)


def render_from_fen_720(
    fen: str,
    pieces: Dict[str, Image.Image],
    font: ImageFont.ImageFont,
    perspective: str,
) -> Image.Image:
    """
    Renders 720x720 board with pieces + coordinates.
    perspective:
      - "white": white-at-bottom
      - "black": black-at-bottom (piece placement remapped)
    """
    grid = fen_to_grid(fen)

    img = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_board_base(draw)

    # Place pieces:
    # - white view: source cell = (r,f)
    # - black view: source cell = (7-r, 7-f)
    for r in range(8):
        for f in range(8):
            src_r, src_f = (r, f) if perspective == "white" else (7 - r, 7 - f)
            ch = grid[src_r][src_f]
            if ch == ".":
                continue
            key = piece_key_from_fen_char(ch)
            sprite = pieces.get(key)
            if sprite is None:
                continue
            img.alpha_composite(sprite, (f * SQUARE, r * SQUARE))

    draw_coordinates(draw, font, perspective=perspective)
    return img


def save_png_like_existing(img: Image.Image, out_path: Path) -> None:
    """
    Existing thumbnails are typically palettized; this keeps output compact & consistent.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("P", palette=Image.Palette.ADAPTIVE).save(out_path, format="PNG")


# =========================
# CLI / main
# =========================

def fmt_time(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    m = int(seconds // 60)
    s = seconds - 60 * m
    return f"{m}m{s:.0f}s"


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Generate Memchess opening thumbnails (offline) from opening_book_moves.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--root", type=str, default=".", help="Path to memchess/ folder (or a repo containing it)")
    ap.add_argument("--force", action="store_true", help="Regenerate even if thumbnails already exist")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of openings (debug)")
    ap.add_argument("--quiet", action="store_true", help="Reduce console output")
    ap.add_argument("--report", type=str, default="", help="Write a JSON report file (errors + summary)")
    args = ap.parse_args()

    t0 = time.time()

    memchess_root = find_memchess_root(Path(args.root))
    opening_names_js = memchess_root / OPENING_NAMES_JS_REL
    openings_dir = memchess_root / OPENINGS_DIR_REL
    openings_dir.mkdir(parents=True, exist_ok=True)

    entries = parse_opening_book_moves(opening_names_js)
    targets = list_targets(memchess_root, entries, force=args.force)

    if args.limit and args.limit > 0:
        targets = targets[: args.limit]

    if not targets:
        print("✅ Nothing to do: no missing thumbnails.")
        return 0

    pieces = load_piece_images(memchess_root)
    font = load_font()

    made_w = 0
    made_b = 0
    errors: List[Dict[str, str]] = []

    total = len(targets)
    if not args.quiet:
        print(f"Memchess root: {memchess_root}")
        print(f"Targets: {total} opening(s) (force={args.force})")
        print("Rendering 720x720 thumbnails with coordinates...\n")

    for idx, (e, do_w, do_b) in enumerate(targets, start=1):
        try:
            fen = fen_after_moves_san(e.moves_str)

            if do_w:
                img_w = render_from_fen_720(fen, pieces, font, perspective="white")
                save_png_like_existing(img_w, openings_dir / f"{e.element_id}.png")
                made_w += 1

            if do_b:
                img_b = render_from_fen_720(fen, pieces, font, perspective="black")
                save_png_like_existing(img_b, openings_dir / f"{e.element_id}_black.png")
                made_b += 1

        except Exception as ex:
            errors.append({
                "element_id": e.element_id,
                "opening_name": e.name,
                "error": str(ex),
            })

        if not args.quiet:
            # lightweight progress display
            if idx == 1 or idx == total or idx % 50 == 0:
                print(f"[{idx:4d}/{total}] white:+{made_w} black:+{made_b} err:{len(errors)}")

    elapsed = time.time() - t0

    print("\n=== Summary ===")
    print(f"Output dir : {openings_dir}")
    print(f"Created    : white={made_w}, black={made_b}")
    print(f"Errors     : {len(errors)}")
    print(f"Elapsed    : {fmt_time(elapsed)}")

    report_obj = {
        "memchess_root": str(memchess_root),
        "output_dir": str(openings_dir),
        "targets": total,
        "force": bool(args.force),
        "created_white": made_w,
        "created_black": made_b,
        "errors_count": len(errors),
        "errors": errors,
        "elapsed_seconds": round(elapsed, 3),
    }

    if args.report:
        rp = Path(args.report).resolve()
        rp.parent.mkdir(parents=True, exist_ok=True)
        rp.write_text(json.dumps(report_obj, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Report     : {rp}")

    # non-zero exit code if there are errors
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
