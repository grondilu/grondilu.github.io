#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Recount Memchess `opening_book` totals after editing `lines.js`.

Why your UI "Lines" doesn't change
----------------------------------
Memchess displays totals from `js/opening_names.js`, not by recounting `whiteLines/blackLines`.
In `memchess.js`:
  - tooltip "Lines" uses `opening_book[key][1]` (white) / `[2]` (black)
  - progress bar % also uses those totals

So if you prune lines in `js/lines.js`, you must also refresh the totals stored in
`js/opening_names.js`.

What this script does
---------------------
- Parses `js/lines.js` and counts the length of each bucket list.
- Patches ONLY those keys inside `opening_book = { ... }` that are present in lines.js:
    opening_book[key][1] = len(whiteLines[key])
    opening_book[key][2] = len(blackLines[key])
- By default, it DOES NOT touch leaf flags to keep git diffs minimal.
  (Leaf flags are opening_book[key][8] and [9].)

Usage
-----
  # write a new file
  python recount_opening_names.py --root . --out js/opening_names.updated.js

  # overwrite opening_names.js (creates a timestamped backup)
  python recount_opening_names.py --root . --in-place

Optional:
  # also recompute leaf flags (bigger diff)
  python recount_opening_names.py --root . --in-place --update-leaf-flags
"""

from __future__ import annotations

import argparse
import re
import shutil
from collections import OrderedDict, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

LINES_JS_REL = Path("js/lines.js")
OPENING_NAMES_JS_REL = Path("js/opening_names.js")


def find_memchess_root(start: Path) -> Path:
    start = start.resolve()
    candidates: List[Path] = []

    for p in [start, *start.parents]:
        if (p / LINES_JS_REL).exists() and (p / OPENING_NAMES_JS_REL).exists():
            candidates.append(p)
        if (p / "memchess" / LINES_JS_REL).exists() and (p / "memchess" / OPENING_NAMES_JS_REL).exists():
            candidates.append(p / "memchess")

    if candidates:
        return candidates[0]

    raise FileNotFoundError(
        "Could not locate memchess root.\n"
        f"Expected: {LINES_JS_REL} and {OPENING_NAMES_JS_REL}\n"
        "Use --root to point to the memchess/ folder (or a repo containing it)."
    )


def parse_lines_js_counts(lines_js: Path) -> Tuple[Dict[str, int], Dict[str, int]]:
    """Return (white_counts, black_counts) where counts[key] = len(lines)."""
    text = lines_js.read_text(encoding="utf-8", errors="ignore")

    m_white = re.search(r"var\s+whiteLines\s*=\s*\{\s*(.*?)\n\}\s*;\s*var\s+blackLines", text, re.S)
    m_black = re.search(r"var\s+blackLines\s*=\s*\{\s*(.*?)\n\}\s*;\s*$", text, re.S)
    if not m_white or not m_black:
        raise ValueError("Could not parse whiteLines/blackLines from lines.js")

    entry_re = re.compile(r'^\s*"([^"]+)"\s*:\s*\[(.*?)\]\s*,?\s*$', re.S | re.M)

    def counts_from_body(body: str) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for k, arr in entry_re.findall(body):
            # Count JS string literals inside the array.
            n = len(re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', arr))
            out[k] = n
        return out

    return counts_from_body(m_white.group(1)), counts_from_body(m_black.group(1))


def parse_opening_book_block(opening_names_js: Path) -> Tuple[str, str, str]:
    """Return (prefix, block, suffix) for the `var opening_book = { ... };` section."""
    txt = opening_names_js.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"(.*?\n)\s*var\s+opening_book\s*=\s*\{\s*(.*?)\n\s*\}\s*;\s*(.*)$", txt, re.S)
    if not m:
        raise ValueError("Could not locate `var opening_book = { ... };` in opening_names.js")
    return m.group(1), m.group(2), m.group(3)


_ENTRY_RE = re.compile(
    r'^(?P<indent>\s*)"(?P<key>[^"]+)"\s*:\s*\["(?P<name>(?:[^"\\]|\\.)*)"\s*,'
    r'(?P<w>\d+)\s*,\s*(?P<b>\d+)\s*,\s*'
    r'(?P<rest>.*)$'
)


def patch_opening_book_counts(
    block: str,
    white_counts: Dict[str, int],
    black_counts: Dict[str, int],
    update_leaf_flags: bool,
    leaf_threshold: int,
) -> Tuple[str, int, int, int]:
    """Patch counts (and optionally leaf flags) in the opening_book block."""
    lines = block.splitlines()
    parsed: OrderedDict[str, dict] = OrderedDict()
    raw_lines: List[str] = []
    entries = 0

    for ln in lines:
        raw_lines.append(ln)
        m = _ENTRY_RE.match(ln)
        if not m:
            continue
        entries += 1
        key = m.group("key")
        parsed[key] = {
            "w": int(m.group("w")),
            "b": int(m.group("b")),
            "rest": m.group("rest"),
        }

    leaf_w: Dict[str, int] = {}
    leaf_b: Dict[str, int] = {}
    if update_leaf_flags:
        parent_re = re.compile(
            r'^\s*(?P<learnw>\d+)\s*,\s*(?P<learnb>\d+)\s*,\s*"(?P<parent>[^"]*)"\s*,\s*'
            r'(?P<duew>\d+)\s*,\s*(?P<dueb>\d+)\s*,\s*(?P<leafw>\d+)\s*,\s*(?P<leafb>\d+)\s*(?P<tail>,.*)$'
        )
        children: Dict[str, List[str]] = defaultdict(list)
        for k, d in parsed.items():
            pm = parent_re.match(d["rest"])
            if not pm:
                continue
            parent = pm.group("parent")
            if parent:
                children[parent].append(k)

        def get_w(k: str) -> int:
            return white_counts.get(k, parsed.get(k, {}).get("w", 0))

        def get_b(k: str) -> int:
            return black_counts.get(k, parsed.get(k, {}).get("b", 0))

        for k in parsed.keys():
            kids = children.get(k, [])
            leaf_w[k] = 1 if not any(get_w(ch) > leaf_threshold for ch in kids) else 0
            leaf_b[k] = 1 if not any(get_b(ch) > leaf_threshold for ch in kids) else 0

    parent_re_for_rebuild = re.compile(
        r'^(?P<learnw>\d+)\s*,\s*(?P<learnb>\d+)\s*,\s*"(?P<parent>[^"]*)"\s*,\s*'
        r'(?P<duew>\d+)\s*,\s*(?P<dueb>\d+)\s*,\s*(?P<leafw>\d+)\s*,\s*(?P<leafb>\d+)\s*(?P<tail>,.*)$'
    )

    out_lines: List[str] = []
    changed_counts = 0
    changed_leaf = 0

    for ln in raw_lines:
        m = _ENTRY_RE.match(ln)
        if not m:
            out_lines.append(ln)
            continue

        key = m.group("key")
        name = m.group("name")
        old_w = int(m.group("w"))
        old_b = int(m.group("b"))
        rest = m.group("rest")
        indent = m.group("indent")

        # Only patch counts if the key exists in lines.js for that side.
        new_w = white_counts.get(key, old_w)
        new_b = black_counts.get(key, old_b)

        if (new_w, new_b) != (old_w, old_b):
            changed_counts += 1

        if update_leaf_flags:
            pm = parent_re_for_rebuild.match(rest)
            if pm:
                lw_old = int(pm.group("leafw"))
                lb_old = int(pm.group("leafb"))
                lw_new = leaf_w.get(key, lw_old)
                lb_new = leaf_b.get(key, lb_old)
                if (lw_new, lb_new) != (lw_old, lb_old):
                    changed_leaf += 1
                rest = (
                    f'{pm.group("learnw")},{pm.group("learnb")},"{pm.group("parent")}",{pm.group("duew")},{pm.group("dueb")},'
                    f'{lw_new},{lb_new}{pm.group("tail")}'
                )

        out_lines.append(f'{indent}"{key}":["{name}",{new_w},{new_b},{rest}')

    return "\n".join(out_lines), entries, changed_counts, changed_leaf


def parsed_opening_book_keys(block: str) -> List[str]:
    keys: List[str] = []
    for ln in block.splitlines():
        m = _ENTRY_RE.match(ln)
        if m:
            keys.append(m.group("key"))
    return keys


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Recount and patch `opening_book` totals in js/opening_names.js after editing js/lines.js",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--root", default=".", help="Path to memchess/ folder (or a repo containing it)")
    ap.add_argument("--out", default="", help="Output file (default: js/opening_names.updated.js next to opening_names.js)")
    ap.add_argument("--in-place", action="store_true", help="Overwrite js/opening_names.js (creates a timestamped backup)")

    ap.add_argument("--update-leaf-flags", action="store_true", help="Also recompute isLeaf flags (opening_book[*][8]/[9]). Bigger diff.")
    ap.add_argument("--leaf-threshold", type=int, default=10, help="Child-count threshold for leaf calculation (only if --update-leaf-flags)")

    args = ap.parse_args()

    root = find_memchess_root(Path(args.root))
    lines_js = root / LINES_JS_REL
    opening_js = root / OPENING_NAMES_JS_REL

    white_counts, black_counts = parse_lines_js_counts(lines_js)

    prefix, block, suffix = parse_opening_book_block(opening_js)
    new_block, entries, changed_counts, changed_leaf = patch_opening_book_counts(
        block,
        white_counts=white_counts,
        black_counts=black_counts,
        update_leaf_flags=bool(args.update_leaf_flags),
        leaf_threshold=int(args.leaf_threshold),
    )

    out_txt = prefix + "var opening_book = {\n" + new_block + "\n};\n" + suffix

    if args.in_place:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bak = opening_js.with_suffix(opening_js.suffix + f".bak.{ts}")
        shutil.copy2(opening_js, bak)
        out_path = opening_js
        print(f"🧷 Backup created: {bak}")
    else:
        out_path = Path(args.out).resolve() if args.out else (opening_js.parent / "opening_names.updated.js")

    out_path.write_text(out_txt, encoding="utf-8")

    absent = 0
    for k in parsed_opening_book_keys(block):
        if k not in white_counts and k not in black_counts:
            absent += 1

    print(f"✅ Wrote: {out_path}")
    print(f"   keys in lines.js: white={len(white_counts)} · black={len(black_counts)}")
    print(f"   opening_book entries parsed: {entries}")
    print(f"   counts changed: {changed_counts}")
    if args.update_leaf_flags:
        print(f"   leaf flags changed: {changed_leaf}")
    print(f"   opening_book entries absent from lines.js (left untouched): {absent}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
