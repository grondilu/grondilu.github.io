#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Memchess — collisions audit (intra-bucket) + OPTIONAL auto-fix mode that prunes the opening book (js/lines.js).

Definitions
-----------
Collision (intra-bucket):
  Inside ONE opening bucket (parent_key), at some prefix where it's the repertoire side to play,
  2+ different next moves exist among the bucket's lines -> ambiguous next move.

Deepest-bucket attribution:
  A collision will often appear in broader ancestor buckets too (because they contain the same lines).
  We attribute each collision to the DEEPEST descendant bucket that fully contains ALL involved lines.
  This produces UNIQUE collisions to fix once.

Auto-fix
--------
With --apply-fix:
  For each unique collision (deepest bucket), we select the KEEP move exactly like in the report:
    - evaluate each option move with Stockfish at the collision position (POV = repertoire side),
    - pick the best eval as KEEP.
  Then we remove ALL lines that take any other option move at that collision.
  Removal is applied GLOBALLY for the side: the losing line strings are removed from EVERY bucket
  where they appear, so collisions don't persist in ancestor buckets.

--preserve-format
-----------------
When writing updated lines.js, preserve the *existing* formatting style as much as possible
(especially the upstream multi-line/tabbed style) to keep Git diffs clean.
If the source lines.js uses:
  - tabs and one-string-per-line arrays, we keep that format.
  - compact single-line maps, we keep that format.
Also preserves original line endings (\n vs \r\n) and trailing blank lines.

Requirements:
  pip install python-chess
  Stockfish in PATH or --stockfish "path/to/stockfish.exe"

Usage:
  # report only
  python audit_collisions.py --root . --out collisions.html --side both --stockfish "C:\\path\\stockfish.exe"

  # report + fix -> write js/lines.fixed.js (safe)
  python audit_collisions.py --root . --out collisions.html --side both --stockfish "C:\\path\\stockfish.exe" --apply-fix

  # report + fix -> overwrite js/lines.js (creates backup)
  python audit_collisions.py --root . --out collisions.html --side both --stockfish "C:\\path\\stockfish.exe" --apply-fix --in-place --preserve-format

  # verify after fix (should show 0)
  python audit_collisions.py --root . --out post_fix.html --side both --stockfish "C:\\path\\stockfish.exe"
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, DefaultDict, Set
from collections import defaultdict, OrderedDict

try:
    import chess  # type: ignore
    import chess.engine  # type: ignore
except Exception:
    chess = None


LINES_JS_REL = Path("js/lines.js")
OPENING_NAMES_JS_REL = Path("js/opening_names.js")


# ----------------------------
# Root discovery + parsing
# ----------------------------

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


def parse_opening_book_moves(opening_names_js: Path) -> Dict[str, List[str]]:
    """
    Returns moves_to_names: movesKey -> [opening names...]
    where movesKey is the 'parent_key' used in lines.js maps.
    """
    txt = opening_names_js.read_text(encoding="utf-8", errors="ignore")
    # tolerate \r\n
    m = re.search(r"var\s+opening_book_moves\s*=\s*\{\s*(.*?)\r?\n\};", txt, re.S)
    if not m:
        return {}

    body = m.group(1)
    pairs = re.findall(r'^\s*"([^"]+)":"([^"]*)"\s*,?\s*$', body, re.M)

    moves_to_names: DefaultDict[str, List[str]] = defaultdict(list)
    for name, moves in pairs:
        moves_to_names[moves].append(name)

    return dict(moves_to_names)


def parse_lines_js_preserve_order(lines_js: Path) -> Tuple["OrderedDict[str, List[str]]", "OrderedDict[str, List[str]]"]:
    """
    Parse lines.js and return OrderedDicts for whiteLines and blackLines (key order preserved).
    Works with both upstream multi-line formatting and compact formatting.
    """
    text = lines_js.read_text(encoding="utf-8", errors="ignore")

    # tolerate \r\n
    m_white = re.search(
        r"var\s+whiteLines\s*=\s*\{\s*(.*?)\r?\n\};\s*\r?\n\r?\nvar\s+blackLines",
        text,
        re.S
    )
    m_black = re.search(
        r"var\s+blackLines\s*=\s*\{\s*(.*?)\r?\n\};\s*$",
        text,
        re.S
    )
    if not m_white or not m_black:
        raise ValueError("Could not parse whiteLines/blackLines from lines.js")

    entry_re = re.compile(r'"\s*([^"]+)\s*"\s*:\s*\[(.*?)\]\s*,?', re.S)

    def parse_map(body: str) -> "OrderedDict[str, List[str]]":
        mp: "OrderedDict[str, List[str]]" = OrderedDict()
        for k, arr in entry_re.findall(body):
            mp[k] = re.findall(r'"([^"]+)"', arr)
        return mp

    return parse_map(m_white.group(1)), parse_map(m_black.group(1))


# ----------------------------
# Move tokenization (legacy compatible)
# ----------------------------

def split_string_into_moves(history: str) -> List[str]:
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
        for i, ch in enumerate(history):
            if ch.isdigit():
                if i > 0 and history[i - 1] in ("N", "R"):
                    continue
                digit_index = i
                break

        if len(history) > digit_index + 1 and history[digit_index + 1] in ("+", "#"):
            digit_index += 1

        if len(history) > digit_index + 1 and history[digit_index + 1] == "=":
            digit_index += 2

        moves.append(history[: digit_index + 1])
        history = history[digit_index + 1 :]

    return moves


def normalize_move_token(tok: str) -> str:
    tok = tok.strip()
    # Rare dataset quirk: '+Ke1' -> 'Ke1+'
    if tok and tok[0] in ("+", "#") and len(tok) > 1:
        tok = tok[1:] + tok[0]
    return tok


def format_pgnish(tokens: List[str], max_tokens: int = 200) -> str:
    toks = tokens[:max_tokens]
    out: List[str] = []
    for i, mv in enumerate(toks):
        if i % 2 == 0:
            out.append(f"{1 + i//2}. {mv}")
        else:
            out.append(mv)
    if len(tokens) > max_tokens:
        out.append("…")
    return " ".join(out)


# ----------------------------
# Chess helpers
# ----------------------------

def build_board_from_tokens(tokens: List[str]) -> Tuple[Optional["chess.Board"], Optional[str]]:
    if chess is None:
        return None, "python-chess not available"
    b = chess.Board()
    try:
        for t in tokens:
            b.push_san(normalize_move_token(t))
        return b, None
    except Exception as e:
        return None, f"SAN parse error: {e}"


def last_move_squares(board: "chess.Board") -> Tuple[Optional[str], Optional[str]]:
    if not board.move_stack:
        return None, None
    mv = board.peek()
    return chess.square_name(mv.from_square), chess.square_name(mv.to_square)


# ----------------------------
# Stockfish eval
# ----------------------------

@dataclass
class EvalResult:
    kind: str
    value: Optional[int]
    pretty: str
    raw_for_sort: int


def score_to_eval(score: Optional["chess.engine.PovScore"]) -> EvalResult:
    if score is None:
        return EvalResult(kind="none", value=None, pretty="—", raw_for_sort=-10**9)

    mate = score.mate()
    if mate is not None:
        mag = 100000 - min(9999, abs(mate))
        raw = mag if mate > 0 else -mag
        pretty = f"M{mate}" if mate > 0 else f"-M{abs(mate)}"
        return EvalResult(kind="mate", value=mate, pretty=pretty, raw_for_sort=raw)

    cp = score.score(mate_score=0)
    if cp is None:
        return EvalResult(kind="none", value=None, pretty="—", raw_for_sort=-10**9)

    return EvalResult(kind="cp", value=cp, pretty=f"{cp/100:+.2f}", raw_for_sort=cp)


class Engine:
    def __init__(self, path: str, threads: int, hash_mb: int, time_s: float, depth: int):
        self.path = path
        self.threads = threads
        self.hash_mb = hash_mb
        self.time_s = time_s
        self.depth = depth
        self._engine: Optional["chess.engine.SimpleEngine"] = None

    def __enter__(self):
        if chess is None:
            raise RuntimeError("python-chess not installed")
        self._engine = chess.engine.SimpleEngine.popen_uci(self.path)
        try:
            self._engine.configure({"Threads": self.threads})
        except Exception:
            pass
        try:
            self._engine.configure({"Hash": self.hash_mb})
        except Exception:
            pass
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._engine:
            try:
                self._engine.quit()
            except Exception:
                pass
        self._engine = None

    def analyse_pov(self, board: "chess.Board", pov_color: "chess.Color") -> EvalResult:
        assert self._engine is not None
        try:
            limit = chess.engine.Limit(time=self.time_s) if self.depth <= 0 else chess.engine.Limit(depth=self.depth)
            info = self._engine.analyse(board, limit)
            s = info.get("score")
            if s is None:
                return EvalResult(kind="none", value=None, pretty="—", raw_for_sort=-10**9)
            return score_to_eval(s.pov(pov_color))
        except Exception:
            return EvalResult(kind="none", value=None, pretty="—", raw_for_sort=-10**9)


# ----------------------------
# collisions (intra-bucket)
# ----------------------------

def find_collisions_in_bucket(
    bucket_lines: List[str],
    user_ply_parity: int,
    min_plies: int = 0,
) -> Dict[str, Dict[str, List[int]]]:
    """
    collisions[prefix_string][next_move_norm] = [line_idx, ...]
    Keep only prefixes where 2+ distinct next moves exist.

    prefix_string is the *concatenated* token prefix (legacy memchess style).
    """
    prefix_to_next: DefaultDict[str, DefaultDict[str, List[int]]] = defaultdict(lambda: defaultdict(list))

    for idx, child in enumerate(bucket_lines):
        tokens = split_string_into_moves(child)
        for ply in range(0, len(tokens)):
            if ply < min_plies:
                continue
            if ply % 2 != user_ply_parity:
                continue
            prefix_str = "".join(tokens[:ply])
            next_norm = normalize_move_token(tokens[ply])
            prefix_to_next[prefix_str][next_norm].append(idx)

    return {p: dict(mvmap) for p, mvmap in prefix_to_next.items() if len(mvmap) >= 2}


# ----------------------------
# Hierarchy dedup: deepest-bucket attribution
# ----------------------------

def is_descendant_key(tokens_parent: List[str], tokens_child: List[str]) -> bool:
    return len(tokens_child) >= len(tokens_parent) and tokens_child[: len(tokens_parent)] == tokens_parent


def intersect_bucket_sets(sets: List[Set[str]]) -> Set[str]:
    if not sets:
        return set()
    sets_sorted = sorted(sets, key=len)
    acc = set(sets_sorted[0])
    for s in sets_sorted[1:]:
        acc.intersection_update(s)
        if not acc:
            break
    return acc


def attribute_collision_to_deepest_descendant(
    parent_key: str,
    involved_lines: Set[str],
    line_to_buckets: Dict[str, Set[str]],
    key_tokens: Dict[str, List[str]],
) -> str:
    """
    Returns the bucket key to which this collision should be attributed:
    - deepest descendant of parent_key that contains ALL involved_lines
    - otherwise parent_key
    """
    parent_tokens = key_tokens[parent_key]

    bucket_sets = [line_to_buckets.get(ln, set()) for ln in involved_lines]
    candidates = intersect_bucket_sets(bucket_sets)
    if not candidates:
        return parent_key

    best = parent_key
    best_depth = len(parent_tokens)

    for cand in candidates:
        if cand not in key_tokens:
            continue
        cand_tokens = key_tokens[cand]
        if not is_descendant_key(parent_tokens, cand_tokens):
            continue
        d = len(cand_tokens)
        if d > best_depth:
            best_depth = d
            best = cand

    return best


# ----------------------------
# HTML report
# ----------------------------

HTML_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Memchess collisions report</title>
<style>
:root{
  --bg:#070b10;
  --text:#eaf1fb;
  --muted:#9fb0c3;
  --border:rgba(255,255,255,.10);
  --shadow:0 24px 60px rgba(0,0,0,.58);
  --radius:18px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

  --accent:#4aa3ff;
  --green:#38d996;
  --amber:#ffcc66;
  --red:#ff6b6b;

  --light:#f6e6cd;
  --dark:#b28262;
}
html,body{
  margin:0;
  color:var(--text);
  font-family:var(--sans);
  background:
    radial-gradient(1000px 700px at 10% 0%, rgba(74,163,255,.16), transparent 60%),
    radial-gradient(1000px 700px at 90% 10%, rgba(56,217,150,.14), transparent 60%),
    radial-gradient(900px 700px at 50% 120%, rgba(255,204,102,.10), transparent 55%),
    var(--bg);
}
.wrap{max-width:1320px; margin:22px auto; padding:0 18px 70px;}
.hero{
  border:1px solid var(--border);
  background:linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:16px 16px 14px;
  backdrop-filter: blur(10px);
}
h1{margin:0; font-size:18px; letter-spacing:.2px;}
.sub{color:var(--muted); font-size:12px; margin-top:3px;}
.meta{display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;}
.pill{
  display:inline-flex; align-items:center; gap:8px;
  padding:7px 11px; border-radius:999px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.05);
  color:var(--muted);
  font-size:13px;
}
.pill b{color:var(--text); font-weight:800;}
.controls{
  margin-top:12px;
  display:grid;
  grid-template-columns: 1.4fr .9fr .9fr;
  gap:10px;
}
input,select{
  width:100%; box-sizing:border-box;
  padding:11px 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
  color:var(--text);
  outline:none;
}
label.toggle{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:rgba(255,255,255,.03);
  color:var(--muted);
  font-size:13px;
  user-select:none;
}
.app{
  margin-top:16px;
  display:grid;
  grid-template-columns: 440px 1fr;
  gap:12px;
  align-items:start;
}
.panel{
  border:1px solid var(--border);
  background:rgba(255,255,255,.03);
  border-radius:var(--radius);
  box-shadow: 0 14px 40px rgba(0,0,0,.35);
  overflow:hidden;
}
.panelHead{
  padding:12px 12px 10px;
  border-bottom:1px solid rgba(255,255,255,.08);
  background:rgba(0,0,0,.08);
  display:flex; align-items:center; justify-content:space-between; gap:10px;
}
.panelTitle{font-weight:900; letter-spacing:.2px;}
.panelBody{padding:12px;}
.small{color:var(--muted); font-size:12px;}
.mono{font-family:var(--mono);}
.list{display:grid; gap:10px;}
.item{
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.02);
  border-radius:16px;
  padding:10px;
  cursor:pointer;
  transition: transform .08s ease, border-color .08s ease;
}
.item:hover{transform: translateY(-1px); border-color: rgba(74,163,255,.35);}
.item.active{border-color: rgba(74,163,255,.70); background: rgba(74,163,255,.08);}
.badges{display:flex; gap:8px; flex-wrap:wrap;}
.badge{
  display:inline-flex; align-items:center; gap:8px;
  padding:5px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.03);
  font-size:12px;
  white-space:nowrap;
}
.badge.good{border-color:rgba(56,217,150,.35); background:rgba(56,217,150,.10);}
.badge.warn{border-color:rgba(255,204,102,.35); background:rgba(255,204,102,.10);}
.badge.bad{border-color:rgba(255,107,107,.35); background:rgba(255,107,107,.10);}
.side{font-weight:950; letter-spacing:.5px; text-transform:uppercase;}
.side.white{color:#ff79c6;}
.side.black{color:#8be9fd;}
.history{
  margin-top:8px;
  padding:8px 10px;
  border:1px solid rgba(255,255,255,.07);
  border-radius:14px;
  background:rgba(0,0,0,.12);
  color:rgba(234,241,251,.95);
  line-height:1.35;
  font-size:12.5px;
}
.detail .box{
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.02);
  border-radius:16px;
  padding:12px;
  margin-bottom:12px;
}
.boxTitle{font-weight:900;}
.board svg{width:100%; height:auto; display:block;}
.collCard{
  border:1px solid rgba(255,255,255,.08);
  background:rgba(0,0,0,.10);
  border-radius:16px;
  padding:10px;
  margin-top:10px;
}
.collHead{
  display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;
}
.collTitle{font-weight:900;}
.table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
}
.table th,.table td{
  text-align:left;
  padding:10px 10px;
  border-bottom:1px solid rgba(255,255,255,.08);
  font-size:13px;
  vertical-align:top;
}
.table th{color:var(--muted); font-size:12px;}
.btn{
  cursor:pointer;
  border:1px solid var(--border);
  background:rgba(255,255,255,.04);
  color:var(--text);
  padding:8px 10px;
  border-radius:12px;
  font-size:12.5px;
}
.btn:hover{border-color: rgba(74,163,255,.55);}
.lines{
  margin-top:8px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:14px;
  overflow:hidden;
}
.linesHead{
  padding:9px 10px;
  background:rgba(255,255,255,.03);
  border-bottom:1px solid rgba(255,255,255,.07);
  display:flex; align-items:center; justify-content:space-between;
  gap:10px; flex-wrap:wrap;
}
.linesBody{padding:10px; display:none;}
.lineItem{
  padding:8px 10px;
  border:1px solid rgba(255,255,255,.06);
  border-radius:12px;
  background:rgba(255,255,255,.02);
  margin-top:8px;
  font-size:12.5px;
  line-height:1.35;
}
a.link{color:var(--accent); text-decoration:none;}
a.link:hover{text-decoration:underline;}
.keep{
  display:inline-flex; align-items:center; gap:6px;
  padding:4px 9px;
  border-radius:999px;
  border:1px solid rgba(56,217,150,.35);
  background:rgba(56,217,150,.10);
  color:var(--text);
  font-size:12px;
  font-weight:800;
}
@media (max-width: 1120px){
  .controls{grid-template-columns: 1fr;}
}
@media (max-width: 980px){
  .app{grid-template-columns: 1fr;}
}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>Memchess collisions report</h1>
    <div class="sub">
      Generated: __GENERATED_AT__ · side=__SIDE__ · engine=__ENGINE__ · move-eval=__MOVE_EVAL__ · line-eval=__LINE_EVAL__
    </div>
    <div class="sub" style="margin-top:6px;">
      <b>Dedup:</b> collisions are attributed to the <b>deepest bucket</b> that fully contains all involved lines.
    </div>
    <div class="meta">
      <span class="pill"><b>Unique collision buckets</b> <span id="kCount">__COUNT__</span></span>
      <span class="pill"><b>Root</b> <span class="mono">__ROOT__</span></span>
    </div>

    <div class="controls">
      <input id="q" placeholder="Search… (opening name, history, move, parent_key)"/>
      <select id="side">
        <option value="all">All sides</option>
        <option value="white">White</option>
        <option value="black">Black</option>
      </select>
      <label class="toggle" title="Flip boards when side=BLACK (black at bottom)">
        <span>Flip black boards</span>
        <input id="flipBlack" type="checkbox" checked/>
      </label>
    </div>
  </div>

  <div class="app">
    <div class="panel">
      <div class="panelHead">
        <div class="panelTitle">Buckets to fix</div>
        <div class="small" id="kShown">0 shown</div>
      </div>
      <div class="panelBody">
        <div class="list" id="list"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panelHead">
        <div class="panelTitle">Details</div>
        <div class="small" id="kSelected">–</div>
      </div>
      <div class="panelBody detail" id="detail">
        <div class="small">Select an opening on the left.</div>
      </div>
    </div>
  </div>

  <div class="small" style="margin-top:14px; text-align:center;">
    Unique intra-bucket collisions only (deepest attribution). No cross-opening collisions.
  </div>
</div>

<script id="data" type="application/json">__DATA_JSON__</script>
<script>
let DATA = null;
try{
  DATA = JSON.parse(document.getElementById('data').textContent);
}catch(e){
  document.body.innerHTML = '<pre style="color:#fff; padding:24px;">JSON parse error: '+String(e)+'</pre>';
}
const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const kShown = document.getElementById('kShown');
const kSelected = document.getElementById('kSelected');
const qEl = document.getElementById('q');
const sideSel = document.getElementById('side');
const flipBlackToggle = document.getElementById('flipBlack');
let filtered = [];
let selectedIdx = -1;

function esc(s){
  return (s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}
const PIECE = {
  'P':'♙','N':'♘','B':'♗','R':'♖','Q':'♕','K':'♔',
  'p':'♟','n':'♞','b':'♝','r':'♜','q':'♛','k':'♚'
};
function fenToArray(fen){
  const part = (fen||"").split(" ")[0] || "";
  const ranks = part.split("/");
  if (ranks.length !== 8) return null;
  const squares = [];
  for (const r of ranks){
    for (const ch of r){
      if (ch>='1' && ch<='8'){
        const n = parseInt(ch,10);
        for (let i=0;i<n;i++) squares.push('');
      }else squares.push(ch);
    }
  }
  return squares.length===64 ? squares : null;
}
function squareNameToFenIndex(sq){
  if (!sq || sq.length!==2) return null;
  const file = sq.charCodeAt(0)-97;
  const rank = parseInt(sq[1],10)-1;
  if (file<0||file>7||rank<0||rank>7) return null;
  return (7-rank)*8 + file;
}
function boardSVG(fen, flip, lastFrom, lastTo){
  const arr0 = fenToArray(fen);
  if (!arr0){
    return `<div class="board"><svg viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="0" width="8" height="8" fill="rgba(0,0,0,.15)"/>
    </svg></div>`;
  }
  const arr = flip ? arr0.slice().reverse() : arr0;
  let fromIdx = squareNameToFenIndex(lastFrom);
  let toIdx   = squareNameToFenIndex(lastTo);
  if (flip){
    if (fromIdx!==null) fromIdx = 63-fromIdx;
    if (toIdx!==null)   toIdx   = 63-toIdx;
  }
  function idxToXY(i){
    const r = Math.floor(i/8);
    const c = i%8;
    return {x:1+c, y:r};
  }
  const css = getComputedStyle(document.documentElement);
  const light = css.getPropertyValue('--light').trim() || '#f6e6cd';
  const dark  = css.getPropertyValue('--dark').trim()  || '#b28262';
  const files = flip ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
  const ranks = flip ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];

  let svg = `<div class="board"><svg viewBox="0 0 9 9" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
    <style>
      .p { font-family: "Segoe UI Symbol","Noto Sans Symbols2","DejaVu Sans",sans-serif; font-size:0.86px; dominant-baseline:central; text-anchor:middle; }
      .c { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:0.34px; fill: rgba(159,176,195,.95); text-anchor:middle; dominant-baseline:central; }
      .r { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size:0.34px; fill: rgba(159,176,195,.95); text-anchor:middle; dominant-baseline:central; }
    </style>`;
  for (let i=0;i<64;i++){
    const {x,y} = idxToXY(i);
    const isDark = ((Math.floor(i/8)+(i%8))%2)===1;
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${isDark?dark:light}"/>`;
  }
  if (fromIdx !== null){
    const {x,y} = idxToXY(fromIdx);
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="none" stroke="rgba(74,163,255,.9)" stroke-width="0.10"/>`;
  }
  if (toIdx !== null){
    const {x,y} = idxToXY(toIdx);
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="none" stroke="rgba(56,217,150,.9)" stroke-width="0.10"/>`;
  }
  for (let i=0;i<64;i++){
    const p = arr[i];
    if (!p) continue;
    const glyph = PIECE[p] || '';
    const {x,y} = idxToXY(i);
    svg += `<text class="p" x="${x+0.5}" y="${y+0.56}">${glyph}</text>`;
  }
  for (let r=0;r<8;r++){
    svg += `<text class="r" x="0.55" y="${r+0.52}">${ranks[r]}</text>`;
  }
  for (let f=0;f<8;f++){
    svg += `<text class="c" x="${1+f+0.5}" y="8.52">${files[f]}</text>`;
  }
  svg += `</svg></div>`;
  return svg;
}
function lichessURL(fen){
  return "https://lichess.org/analysis/standard/" + encodeURIComponent(fen);
}
function applyFilters(){
  const q = (qEl.value || '').trim().toLowerCase();
  const side = sideSel.value;
  let items = DATA.openings.slice();
  if (side !== 'all') items = items.filter(o => o.side === side);
  if (q){
    items = items.filter(o => {
      const hay = [
        o.side,
        o.opening_primary,
        (o.opening_names||[]).join(" "),
        o.parent_key,
        (o.collisions||[]).slice(0,10).map(c => c.history_pgn + " " + (c.options||[]).map(x=>x.move).join(" ")).join(" ")
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  items.sort((a,b) => {
    const ea = a.earliest_move_no ?? 9999;
    const eb = b.earliest_move_no ?? 9999;
    if (ea !== eb) return ea - eb;
    const wa = a.worst_options ?? 0;
    const wb = b.worst_options ?? 0;
    if (wa !== wb) return wb - wa;
    return (b.collision_count ?? 0) - (a.collision_count ?? 0);
  });
  filtered = items;
  if (filtered.length === 0) selectedIdx = -1;
  else if (selectedIdx < 0) selectedIdx = 0;
  else if (selectedIdx >= filtered.length) selectedIdx = filtered.length-1;
}
function renderList(){
  listEl.innerHTML = '';
  filtered.forEach((o, i) => {
    const active = i===selectedIdx;
    const el = document.createElement('div');
    el.className = 'item' + (active ? ' active' : '');
    const sideCls = o.side === 'white' ? 'white' : 'black';
    const sev = o.worst_options >= 5 ? 'bad' : (o.worst_options >= 4 ? 'warn' : 'good');
    const first = (o.collisions||[])[0] || null;
    const flip = (flipBlackToggle.checked && o.side === 'black');
    const mini = (first && first.pos && first.pos.fen) ? boardSVG(first.pos.fen, flip, first.pos.last_from, first.pos.last_to) : boardSVG("", false);
    el.innerHTML = `
      <div style="display:grid; grid-template-columns: 120px 1fr; gap:10px; align-items:start;">
        <div>${mini}</div>
        <div>
          <div class="badges">
            <span class="badge"><span class="side ${sideCls}">${o.side.toUpperCase()}</span></span>
            <span class="badge ${sev}">worst options ${o.worst_options}</span>
            <span class="badge">collisions ${o.collision_count}</span>
            <span class="badge">lines ${o.total_lines}</span>
            <span class="badge">earliest move ${o.earliest_move_no}</span>
          </div>
          <div class="history"><b>${esc(o.opening_primary)}</b></div>
          <div class="small" style="margin-top:8px;">parent_key: <span class="mono">${esc(o.parent_key)}</span></div>
        </div>
      </div>
    `;
    el.onclick = () => { selectedIdx=i; renderAll(); };
    listEl.appendChild(el);
  });
  kShown.textContent = `${filtered.length} shown`;
}
function renderDetail(){
  if (selectedIdx < 0 || selectedIdx >= filtered.length){
    detailEl.innerHTML = '<div class="small">Select an opening on the left.</div>';
    kSelected.textContent = '–';
    return;
  }
  const o = filtered[selectedIdx];
  const sideCls = o.side === 'white' ? 'white' : 'black';
  kSelected.textContent = `${o.side.toUpperCase()} · lines ${o.total_lines} · collisions ${o.collision_count}`;

  const allLinesId = "allLines";
  const allLinesHTML = (o.lines||[]).map(l => {
    const endEval = l.eval_end?.pretty ?? "—";
    const endLink = l.fen_end ? `<a class="link" href="${lichessURL(l.fen_end)}" target="_blank" rel="noopener">Lichess</a>` : '';
    const warn = l.parse_error ? `<span class="badge warn">parse error</span>` : '';
    return `
      <div class="lineItem mono">
        <b>#${l.idx+1}</b> · ${esc(l.pgn)}
        <div class="small" style="margin-top:6px;">
          end eval: <b>${esc(endEval)}</b> ${endLink} ${warn}
        </div>
        ${l.parse_error ? `<div class="small" style="margin-top:6px;">${esc(l.parse_error)}</div>` : ''}
      </div>
    `;
  }).join('');

  function optionLinesBox(cid, opt){
    const boxId = `opt_${cid}_${opt._key}`;
    return `
      <div class="lines">
        <div class="linesHead">
          <div>
            <b class="mono">${esc(opt.move)}</b>
            ${opt.suggested ? `<span class="keep">KEEP</span>` : ''}
            <span class="small"> · lines: <b>${opt.count}</b> · move eval: <b>${esc(opt.eval_move?.pretty ?? "—")}</b>
              ${opt.fen_after ? ` · <a class="link" href="${lichessURL(opt.fen_after)}" target="_blank" rel="noopener">Lichess</a>` : ''}
            </span>
          </div>
          <button class="btn" data-toggle="${boxId}">Show affected lines</button>
        </div>
        <div class="linesBody" id="${boxId}">
          <div class="small">
            Lines in this bucket that play <b class="mono">${esc(opt.move)}</b> here (sorted by <b>line-end eval</b>).
          </div>
          <div id="${boxId}_body"></div>
        </div>
      </div>
    `;
  }

  function collisionCard(c, idx){
    const flip = (flipBlackToggle.checked && o.side === 'black');
    const board = (c.pos && c.pos.fen) ? boardSVG(c.pos.fen, flip, c.pos.last_from, c.pos.last_to) : boardSVG("", false);

    const optionsRows = (c.options||[]).map(opt => `
      <tr>
        <td class="mono">
          <b>${esc(opt.move)}</b> ${opt.suggested ? `<span class="keep">KEEP</span>` : ''}
        </td>
        <td>${opt.count}</td>
        <td><b>${esc(opt.eval_move?.pretty ?? "—")}</b></td>
        <td>
          ${opt.fen_after ? `<a class="link" href="${lichessURL(opt.fen_after)}" target="_blank" rel="noopener">after-move</a>` : '<span class="small">—</span>'}
        </td>
      </tr>
    `).join('');

    const optBoxes = (c.options||[]).map(opt => optionLinesBox(idx, opt)).join('');

    const pruneHint = c.suggested_move
      ? `<div class="small" style="margin-top:10px;">
           Suggested prune: keep <b class="mono">${esc(c.suggested_move)}</b>,
           remove <b>${c.remove_lines.length}</b> line(s) (all other options).
         </div>`
      : '';

    return `
      <div class="collCard">
        <div class="collHead">
          <div>
            <div class="collTitle">Collision #${idx+1} · move ${c.move_no} (ply=${c.ply})</div>
            <div class="small mono" style="margin-top:6px;">${esc(c.history_pgn)}</div>
            ${c.pos && c.pos.fen ? `<div class="small" style="margin-top:6px;"><a class="link" href="${lichessURL(c.pos.fen)}" target="_blank" rel="noopener">Lichess (collision position)</a></div>` : ''}
            ${pruneHint}
            ${c.parse_error ? `<div class="small" style="margin-top:6px;">${esc(c.parse_error)}</div>` : ''}
          </div>
          <div style="width:240px; max-width:100%;">${board}</div>
        </div>

        <table class="table">
          <thead><tr><th>Next move</th><th>Lines</th><th>Stockfish (move)</th><th>Lichess</th></tr></thead>
          <tbody>${optionsRows}</tbody>
        </table>

        ${optBoxes}
      </div>
    `;
  }

  detailEl.innerHTML = `
    <div class="box">
      <div class="badges">
        <span class="badge"><span class="side ${sideCls}">${o.side.toUpperCase()}</span></span>
        <span class="badge">lines ${o.total_lines}</span>
        <span class="badge">collisions ${o.collision_count}</span>
        <span class="badge ${o.worst_options>=5?'bad':(o.worst_options>=4?'warn':'good')}">worst options ${o.worst_options}</span>
        <span class="badge">earliest move ${o.earliest_move_no}</span>
      </div>
      <div style="margin-top:10px;">
        <div class="boxTitle">Deepest bucket to fix</div>
        <div class="history"><b>${esc(o.opening_primary)}</b></div>
        <div class="small" style="margin-top:8px;">parent_key: <span class="mono">${esc(o.parent_key)}</span></div>
      </div>
      <div class="small" style="margin-top:10px;">
        Labels: ${esc((o.opening_names||[]).slice(0,12).join(" · "))}${(o.opening_names||[]).length>12 ? " …" : ""}
      </div>
    </div>

    <div class="box">
      <div class="boxTitle">Unique collisions inside this bucket</div>
      <div class="small" style="margin-top:6px;">
        These collisions were not fully contained by any deeper descendant bucket — so you fix them here.
      </div>
      ${(o.collisions||[]).map((c,i)=>collisionCard(c,i)).join('') || '<div class="small">(none)</div>'}
    </div>

    <div class="box">
      <div class="boxTitle">All lines in this bucket</div>
      <div class="lines" style="margin-top:10px;">
        <div class="linesHead">
          <div class="small">Total: <b>${o.total_lines}</b></div>
          <button class="btn" data-toggle="${allLinesId}">Show lines</button>
        </div>
        <div class="linesBody" id="${allLinesId}">
          ${allLinesHTML}
        </div>
      </div>
    </div>
  `;

  // Toggle sections
  detailEl.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-toggle');
      const el = document.getElementById(id);
      const open = el.style.display === 'block';
      el.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'Show' + btn.textContent.replace(/^Show/,'') : 'Hide' + btn.textContent.replace(/^Show/,'');
    };
  });

  // Render option line bodies
  (o.collisions||[]).forEach((c, ci) => {
    (c.options||[]).forEach(opt => {
      const boxId = `opt_${ci}_${opt._key}`;
      const bodyEl = document.getElementById(boxId + "_body");
      if (!bodyEl) return;

      const lines = (opt.line_idxs||[]).map(idx => o.lines[idx]).filter(Boolean);
      lines.sort((a,b) => (b.eval_end?.raw_for_sort ?? -999999999) - (a.eval_end?.raw_for_sort ?? -999999999));

      bodyEl.innerHTML = lines.map(l => {
        const endEval = l.eval_end?.pretty ?? "—";
        const endLink = l.fen_end ? `<a class="link" href="${lichessURL(l.fen_end)}" target="_blank" rel="noopener">Lichess (end)</a>` : '';
        const warn = l.parse_error ? `<span class="badge warn">parse error</span>` : '';
        return `
          <div class="lineItem mono">
            <b>#${l.idx+1}</b> · ${esc(l.pgn)}
            <div class="small" style="margin-top:6px;">
              end eval: <b>${esc(endEval)}</b> ${endLink} ${warn}
            </div>
          </div>
        `;
      }).join('') || `<div class="small">No lines.</div>`;
    });
  });
}
function renderAll(){
  applyFilters();
  renderList();
  renderDetail();
}
qEl.addEventListener('input', () => { selectedIdx = 0; renderAll(); });
sideSel.addEventListener('change', () => { selectedIdx = 0; renderAll(); });
flipBlackToggle.addEventListener('change', renderAll);
selectedIdx = 0;
renderAll();
</script>
</body>
</html>
"""


def write_html_report(out_path: Path, meta: dict, openings: List[dict]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"meta": meta, "openings": openings}
    # prevent </script> injection edge in JSON
    data_json = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")

    doc = HTML_TEMPLATE
    doc = doc.replace("__GENERATED_AT__", html.escape(meta["generated_at"], quote=True))
    doc = doc.replace("__SIDE__", html.escape(meta["side"], quote=True))
    doc = doc.replace("__ENGINE__", html.escape(meta["engine"], quote=True))
    doc = doc.replace("__MOVE_EVAL__", html.escape(meta["move_eval"], quote=True))
    doc = doc.replace("__LINE_EVAL__", html.escape(meta["line_eval"], quote=True))
    doc = doc.replace("__ROOT__", html.escape(meta["root"], quote=True))
    doc = doc.replace("__COUNT__", str(len(openings)))
    doc = doc.replace("__DATA_JSON__", data_json)

    out_path.write_text(doc, encoding="utf-8")


# ----------------------------
# JS writing (lines.js) + preserve-format
# ----------------------------

def js_escape(s: str) -> str:
    # conservative escaping for JS string literal in double quotes
    return s.replace("\\", "\\\\").replace('"', '\\"')


@dataclass
class LinesJsFormat:
    newline: str
    indent: str
    style: str  # "multiline" or "compact"
    trailing: str
    white_inline_last_close: bool
    black_inline_last_close: bool


def detect_lines_js_format(template_text: str) -> LinesJsFormat:
    # newline
    newline = "\r\n" if "\r\n" in template_text else "\n"

    # trailing newline(s)/blank lines
    trailing = template_text[len(template_text.rstrip("\r\n")):]
    if trailing == "":
        trailing = newline

    # indent (best effort)
    indent = "\t" if re.search(r'^\t"', template_text, re.M) else "  "

    # determine style (multiline arrays if we see closing bracket on its own indented line)
    multiline = bool(re.search(r'^\s*\]\s*,?\s*$', template_text, re.M) and re.search(r'^\s*"\s*[^"]+"\s*:\s*\[', template_text, re.M))
    style = "multiline" if multiline else "compact"

    def map_inline_last_close(map_name: str) -> bool:
        # Extract the map block and inspect last non-empty line before "};"
        m = re.search(rf"var\s+{re.escape(map_name)}\s*=\s*\{{(.*?)\r?\n\}};\s*", template_text, re.S)
        if not m:
            return False
        block = m.group(1)
        lines = [ln for ln in re.split(r"\r?\n", block) if ln.strip() != ""]
        if not lines:
            return False
        last = lines[-1].rstrip()
        # inline style: ..."]   (array closed on the element line)
        return last.endswith('"]') or last.endswith('"] ,')  # tolerate weird spacing

    return LinesJsFormat(
        newline=newline,
        indent=indent,
        style=style,
        trailing=trailing,
        white_inline_last_close=map_inline_last_close("whiteLines"),
        black_inline_last_close=map_inline_last_close("blackLines"),
    )


def dump_js_map_compact(name: str, mp: "OrderedDict[str, List[str]]") -> str:
    out = [f"var {name} = {{"]
    items = list(mp.items())
    for i, (k, lines) in enumerate(items):
        arr = ",".join(f"\"{js_escape(x)}\"" for x in lines)
        comma = "," if i < len(items) - 1 else ""
        out.append(f'  "{js_escape(k)}":[{arr}]{comma}')
    out.append("};")
    return "\n".join(out)


def dump_js_map_multiline(
    name: str,
    mp: "OrderedDict[str, List[str]]",
    fmt: LinesJsFormat,
    inline_last_close: bool,
) -> str:
    """
    Upstream-like style:
      var whiteLines = {
        "key":["first",
        "second",
        ...
        "last"
        ],
        "nextkey":["first", ...]
      };
    BUT upstream specifically uses:
      - tabs (usually)
      - same indent level for key lines and array elements
      - closing line for non-last keys:    \t],
      - closing for last key: either \t] or inline ..."]
    We replicate that.
    """
    nl = fmt.newline
    ind = fmt.indent

    keys = list(mp.keys())
    out: List[str] = [f"var {name} = {{"]

    for ki, k in enumerate(keys):
        arr = mp[k]
        is_last_key = (ki == len(keys) - 1)

        # Empty array (not seen in upstream, but keep valid)
        if not arr:
            # keep one-line for empty to avoid weird output
            tail = "" if is_last_key else ","
            out.append(f'{ind}"{js_escape(k)}":[]' + tail)
            continue

        # first element on the same line as key (upstream style)
        if len(arr) == 1:
            if is_last_key and inline_last_close:
                out.append(f'{ind}"{js_escape(k)}":["{js_escape(arr[0])}"]')
            else:
                out.append(f'{ind}"{js_escape(k)}":["{js_escape(arr[0])}"')
                # close array
                out.append(f"{ind}]" + ("" if is_last_key else ","))
            continue

        out.append(f'{ind}"{js_escape(k)}":["{js_escape(arr[0])}",')

        # middle elements
        for elem in arr[1:-1]:
            out.append(f'{ind}"{js_escape(elem)}",')

        # last element
        last_elem = arr[-1]
        if is_last_key and inline_last_close:
            out.append(f'{ind}"{js_escape(last_elem)}"]')
        else:
            out.append(f'{ind}"{js_escape(last_elem)}"')
            out.append(f"{ind}]" + ("" if is_last_key else ","))

    out.append("};")
    return nl.join(out)


def write_lines_js(
    out_path: Path,
    white: "OrderedDict[str, List[str]]",
    black: "OrderedDict[str, List[str]]",
    preserve_format: bool,
    template_text: Optional[str],
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if preserve_format and template_text:
        fmt = detect_lines_js_format(template_text)
        if fmt.style == "multiline":
            txt = (
                dump_js_map_multiline("whiteLines", white, fmt, inline_last_close=fmt.white_inline_last_close)
                + fmt.newline + fmt.newline
                + dump_js_map_multiline("blackLines", black, fmt, inline_last_close=fmt.black_inline_last_close)
                + fmt.newline
                + fmt.trailing
            )
        else:
            # preserve compact style if template is compact
            txt = dump_js_map_compact("whiteLines", white) + "\n\n" + dump_js_map_compact("blackLines", black) + "\n"
    else:
        # default: compact (stable) output
        txt = dump_js_map_compact("whiteLines", white) + "\n\n" + dump_js_map_compact("blackLines", black) + "\n"

    out_path.write_text(txt, encoding="utf-8")


# ----------------------------
# Helpers
# ----------------------------

def pick_primary_opening_name(names: List[str]) -> str:
    if not names:
        return "(unknown opening)"
    for n in names:
        if not n.strip().endswith(", General"):
            return n
    return names[0]


def analyse_move_options_for_collision(
    engine: Engine,
    base_board: "chess.Board",
    pov_color: "chess.Color",
    options: List[str],
) -> Tuple[List[dict], Optional[str]]:
    out: List[dict] = []
    parse_error: Optional[str] = None

    for mv in options:
        b = base_board.copy(stack=True)
        try:
            b.push_san(normalize_move_token(mv))
            fen_after = b.fen()
        except Exception as e:
            parse_error = parse_error or f"Move parse error on '{mv}': {e}"
            out.append({"move": mv, "eval_move": None, "fen_after": None, "parse_error": str(e)})
            continue

        ev = engine.analyse_pov(b, pov_color)
        out.append({
            "move": mv,
            "eval_move": {"kind": ev.kind, "value": ev.value, "pretty": ev.pretty, "raw_for_sort": ev.raw_for_sort},
            "fen_after": fen_after,
            "parse_error": None,
        })

    return out, parse_error


def stable_opt_key(move: str, count: int) -> str:
    return re.sub(r"[^a-zA-Z0-9_]+", "_", move) + "_" + str(count)


# ----------------------------
# Core: build report + optional fix plan
# ----------------------------

@dataclass
class FixPlan:
    # raw line strings to remove globally for a side
    remove_lines_global: Set[str]
    # debug / stats
    collisions_count: int
    removed_count: int


def process_side_build_report_and_fixplan(
    side: str,
    line_map: "OrderedDict[str, List[str]]",
    moves_to_names: Dict[str, List[str]],
    user_ply_parity: int,
    user_color: "chess.Color",
    engine: Optional[Engine],
    min_plies: int,
    apply_fix: bool,
) -> Tuple[List[dict], FixPlan]:
    """
    Returns (openings_report, fix_plan)
    openings_report: list of bucket dicts for HTML
    fix_plan: global removal set for that side (empty if apply_fix=False)
    """
    keys = list(line_map.keys())
    key_tokens: Dict[str, List[str]] = {k: split_string_into_moves(k) for k in keys}

    # line -> buckets containing it
    line_to_buckets: DefaultDict[str, Set[str]] = defaultdict(set)
    for k, lines in line_map.items():
        for ln in lines:
            line_to_buckets[ln].add(k)

    # 1) collisions per bucket + involved raw lines per (bucket,prefix)
    collisions_by_bucket: Dict[str, Dict[str, Dict[str, List[int]]]] = {}
    involved_lines_by_bucket_prefix: Dict[Tuple[str, str], Set[str]] = {}

    for parent_key, child_lines in line_map.items():
        if len(child_lines) < 2:
            continue
        col = find_collisions_in_bucket(child_lines, user_ply_parity, min_plies=min_plies)
        if not col:
            continue
        collisions_by_bucket[parent_key] = col

        for prefix, mvmap in col.items():
            involved: Set[str] = set()
            for idxs in mvmap.values():
                for i in idxs:
                    involved.add(child_lines[i])
            involved_lines_by_bucket_prefix[(parent_key, prefix)] = involved

    if not collisions_by_bucket:
        return [], FixPlan(remove_lines_global=set(), collisions_count=0, removed_count=0)

    # 2) assign each collision to deepest bucket
    assigned_prefixes_by_bucket: DefaultDict[str, Set[str]] = defaultdict(set)
    for parent_key, colmap in collisions_by_bucket.items():
        for prefix in colmap.keys():
            involved = involved_lines_by_bucket_prefix.get((parent_key, prefix), set())
            if not involved:
                continue
            assigned = attribute_collision_to_deepest_descendant(
                parent_key=parent_key,
                involved_lines=involved,
                line_to_buckets=line_to_buckets,
                key_tokens=key_tokens,
            )
            assigned_prefixes_by_bucket[assigned].add(prefix)

    # 3) build report ONLY for assigned prefixes; build fix plan from those too
    openings_report: List[dict] = []
    remove_lines_global: Set[str] = set()
    collisions_total = 0

    for bucket_key, prefixes in assigned_prefixes_by_bucket.items():
        if bucket_key not in collisions_by_bucket:
            continue

        child_lines = line_map[bucket_key]
        colmap = collisions_by_bucket[bucket_key]

        kept_prefixes = [p for p in prefixes if p in colmap]
        if not kept_prefixes:
            continue

        def prefix_sort_key(p: str) -> Tuple[int, int]:
            ply = len(split_string_into_moves(p))
            move_no = 1 + ply // 2
            distinct = len(colmap[p])
            return (move_no, -distinct)

        kept_prefixes.sort(key=prefix_sort_key)

        affected_idxs: Set[int] = set()
        for p in kept_prefixes:
            for idxs in colmap[p].values():
                affected_idxs.update(idxs)

        fen_eval_cache: Dict[str, dict] = {}
        lines_data: List[dict] = []

        for idx, child in enumerate(child_lines):
            toks = split_string_into_moves(child)
            pgn = format_pgnish(toks, max_tokens=220)
            parse_error = None
            fen_end = None
            eval_end = None

            if idx in affected_idxs:
                b, err = build_board_from_tokens(toks)
                if err:
                    parse_error = err
                else:
                    assert b is not None
                    fen_end = b.fen()
                    if engine and fen_end:
                        if fen_end in fen_eval_cache:
                            eval_end = fen_eval_cache[fen_end]
                        else:
                            ev = engine.analyse_pov(b, user_color)
                            eval_end = {"kind": ev.kind, "value": ev.value, "pretty": ev.pretty, "raw_for_sort": ev.raw_for_sort}
                            fen_eval_cache[fen_end] = eval_end

            lines_data.append({
                "idx": idx,
                "raw": child,
                "pgn": pgn,
                "fen_end": fen_end,
                "eval_end": eval_end,
                "parse_error": parse_error,
            })

        collisions_out: List[dict] = []
        earliest_move_no: Optional[int] = None
        worst_options = 0

        for prefix in kept_prefixes:
            mvmap = colmap[prefix]
            prefix_tokens = split_string_into_moves(prefix)
            ply = len(prefix_tokens)
            move_no = 1 + ply // 2
            earliest_move_no = move_no if earliest_move_no is None else min(earliest_move_no, move_no)
            worst_options = max(worst_options, len(mvmap))
            history_pgn = format_pgnish(prefix_tokens, max_tokens=180)

            base_board, prefix_err = build_board_from_tokens(prefix_tokens)
            pos = None
            if base_board is not None:
                lf, lt = last_move_squares(base_board)
                pos = {"fen": base_board.fen(), "last_from": lf, "last_to": lt}

            option_moves = sorted(mvmap.keys(), key=lambda s: (-len(mvmap[s]), s))

            options_out: List[dict] = []
            suggested_move = None
            parse_err = prefix_err

            if engine and base_board is not None:
                enriched, move_parse_err = analyse_move_options_for_collision(engine, base_board, user_color, option_moves)
                parse_err = parse_err or move_parse_err
                opt_map = {o["move"]: o for o in enriched}

                # choose KEEP: best eval raw_for_sort
                best_raw = None
                for mv in option_moves:
                    evm = opt_map[mv].get("eval_move")
                    raw = evm.get("raw_for_sort") if evm else None
                    if raw is None:
                        continue
                    if best_raw is None or raw > best_raw:
                        best_raw = raw
                        suggested_move = mv

                for mv in option_moves:
                    d = opt_map[mv]
                    options_out.append({
                        "move": mv,
                        "count": len(mvmap[mv]),
                        "line_idxs": mvmap[mv],
                        "eval_move": d.get("eval_move"),
                        "fen_after": d.get("fen_after"),
                        "parse_error": d.get("parse_error"),
                        "suggested": (mv == suggested_move) if suggested_move else False,
                        "_key": stable_opt_key(mv, len(mvmap[mv])),
                    })
            else:
                for mv in option_moves:
                    options_out.append({
                        "move": mv,
                        "count": len(mvmap[mv]),
                        "line_idxs": mvmap[mv],
                        "eval_move": None,
                        "fen_after": None,
                        "parse_error": None,
                        "suggested": False,
                        "_key": stable_opt_key(mv, len(mvmap[mv])),
                    })

            remove_lines_idx: List[int] = []
            if suggested_move:
                for mv, idxs in mvmap.items():
                    if mv != suggested_move:
                        remove_lines_idx.extend(idxs)
                remove_lines_idx = sorted(set(remove_lines_idx))

                if apply_fix:
                    for i in remove_lines_idx:
                        remove_lines_global.add(child_lines[i])

            collisions_total += 1

            collisions_out.append({
                "ply": ply,
                "move_no": move_no,
                "history_pgn": history_pgn,
                "pos": pos,
                "parse_error": parse_err,
                "options": options_out,
                "suggested_move": suggested_move,
                "remove_lines": remove_lines_idx,
            })

        opening_names = moves_to_names.get(bucket_key, [f"(unmapped key) {bucket_key}"])
        opening_primary = pick_primary_opening_name(opening_names)

        openings_report.append({
            "side": side,
            "parent_key": bucket_key,
            "opening_primary": opening_primary,
            "opening_names": opening_names,
            "total_lines": len(child_lines),
            "collision_count": len(collisions_out),
            "earliest_move_no": earliest_move_no or 0,
            "worst_options": worst_options,
            "lines": lines_data,
            "collisions": collisions_out,
        })

    openings_report.sort(key=lambda o: (o["earliest_move_no"], -o["worst_options"], -o["collision_count"], -o["total_lines"]))
    return openings_report, FixPlan(remove_lines_global=remove_lines_global, collisions_count=collisions_total, removed_count=len(remove_lines_global))


# ----------------------------
# Apply fix to a side map
# ----------------------------

def apply_global_removals(line_map: "OrderedDict[str, List[str]]", remove_set: Set[str]) -> Tuple[int, int]:
    """
    Filters each bucket list by removing raw line strings in remove_set.
    Returns (removed_total_occurrences, buckets_touched)
    """
    removed_occ = 0
    touched = 0
    for k, lines in list(line_map.items()):
        if not lines:
            continue
        before = len(lines)
        new_lines = [ln for ln in lines if ln not in remove_set]
        after = len(new_lines)
        if after != before:
            removed_occ += (before - after)
            touched += 1
            line_map[k] = new_lines
    return removed_occ, touched


# ----------------------------
# Main
# ----------------------------

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Memchess collisions audit + deepest-bucket dedup + optional auto-fix (prune js/lines.js).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--root", type=str, default=".", help="Path to memchess/ folder (or a repo containing it)")
    ap.add_argument("--side", choices=["white", "black", "both"], default="both", help="Which repertoire to analyze")
    ap.add_argument("--out", type=str, default="collisions.html", help="Output HTML report path")
    ap.add_argument("--min-plies", type=int, default=0, help="Ignore collisions before this ply (0 = disabled)")

    ap.add_argument("--stockfish", type=str, default="", help="Path to stockfish binary (optional; will try PATH)")
    ap.add_argument("--no-engine", action="store_true", help="Skip Stockfish evaluations (report only)")

    ap.add_argument("--engine-time", type=float, default=0.08, help="Seconds per position (used when depth <= 0)")
    ap.add_argument("--engine-depth", type=int, default=0, help="Fixed depth (0 = use engine-time)")
    ap.add_argument("--threads", type=int, default=2, help="Stockfish Threads")
    ap.add_argument("--hash", type=int, default=128, help="Stockfish Hash (MB)")

    ap.add_argument("--apply-fix", action="store_true", help="Prune losing lines to eliminate collisions (requires Stockfish)")
    ap.add_argument("--in-place", action="store_true", help="Overwrite js/lines.js (creates a timestamped .bak)")
    ap.add_argument("--write-lines-js", type=str, default="", help="Write updated lines.js to this path (default: js/lines.fixed.js)")
    ap.add_argument("--preserve-format", action="store_true", help="Preserve existing lines.js formatting to keep Git diffs clean")

    args = ap.parse_args()

    if chess is None:
        raise SystemExit("python-chess is required. Install with: pip install python-chess")

    memchess_root = find_memchess_root(Path(args.root))
    lines_js_path = memchess_root / LINES_JS_REL
    opening_names_js = memchess_root / OPENING_NAMES_JS_REL

    moves_to_names = parse_opening_book_moves(opening_names_js)

    # Keep template text (for preserve-format output)
    lines_js_template_text = lines_js_path.read_text(encoding="utf-8", errors="ignore")

    white_map, black_map = parse_lines_js_preserve_order(lines_js_path)

    # Engine path resolution
    engine_path = args.stockfish.strip()
    if not engine_path and not args.no_engine:
        engine_path = shutil.which("stockfish") or ""

    engine_enabled = (not args.no_engine) and bool(engine_path)

    if args.apply_fix and not engine_enabled:
        raise SystemExit(
            "❌ --apply-fix requires Stockfish to reproduce KEEP decisions exactly like the report.\n"
            "Provide --stockfish PATH or install stockfish in PATH."
        )

    meta = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "root": str(memchess_root),
        "side": args.side,
        "engine": engine_path if engine_enabled else ("disabled" if args.no_engine else "not found"),
        "move_eval": f"time={args.engine_time}s" if args.engine_depth <= 0 else f"depth={args.engine_depth}",
        "line_eval": f"time={args.engine_time}s" if args.engine_depth <= 0 else f"depth={args.engine_depth}",
    }

    openings_out_all: List[dict] = []
    fix_white = FixPlan(remove_lines_global=set(), collisions_count=0, removed_count=0)
    fix_black = FixPlan(remove_lines_global=set(), collisions_count=0, removed_count=0)

    engine_ctx: Optional[Engine] = None
    if engine_enabled:
        engine_ctx = Engine(engine_path, threads=args.threads, hash_mb=args.hash, time_s=args.engine_time, depth=args.engine_depth)
        engine_ctx.__enter__()

    try:
        if args.side in ("white", "both"):
            rep, plan = process_side_build_report_and_fixplan(
                side="white",
                line_map=white_map,
                moves_to_names=moves_to_names,
                user_ply_parity=0,
                user_color=chess.WHITE,
                engine=engine_ctx if engine_enabled else None,
                min_plies=args.min_plies,
                apply_fix=args.apply_fix,
            )
            openings_out_all.extend(rep)
            fix_white = plan

        if args.side in ("black", "both"):
            rep, plan = process_side_build_report_and_fixplan(
                side="black",
                line_map=black_map,
                moves_to_names=moves_to_names,
                user_ply_parity=1,
                user_color=chess.BLACK,
                engine=engine_ctx if engine_enabled else None,
                min_plies=args.min_plies,
                apply_fix=args.apply_fix,
            )
            openings_out_all.extend(rep)
            fix_black = plan

    finally:
        if engine_ctx:
            engine_ctx.__exit__(None, None, None)

    # Write report
    out_path = Path(args.out).resolve()
    write_html_report(out_path, meta, openings_out_all)

    print(f"✅ Report written: {out_path}")
    print(f"   Unique collision buckets: {len(openings_out_all)}")

    # Apply fix if requested
    if args.apply_fix:
        removed_occ_w = buckets_w = 0
        removed_occ_b = buckets_b = 0

        if args.side in ("white", "both") and fix_white.remove_lines_global:
            removed_occ_w, buckets_w = apply_global_removals(white_map, fix_white.remove_lines_global)

        if args.side in ("black", "both") and fix_black.remove_lines_global:
            removed_occ_b, buckets_b = apply_global_removals(black_map, fix_black.remove_lines_global)

        # Write updated lines.js
        if args.in_place:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            bak = lines_js_path.with_suffix(lines_js_path.suffix + f".bak.{ts}")
            shutil.copy2(lines_js_path, bak)
            target = lines_js_path
            print(f"🧷 Backup created: {bak}")
        else:
            target = Path(args.write_lines_js).resolve() if args.write_lines_js else (lines_js_path.parent / "lines.fixed.js")

        write_lines_js(
            target,
            white_map,
            black_map,
            preserve_format=bool(args.preserve_format),
            template_text=lines_js_template_text if args.preserve_format else None,
        )

        print(f"🛠️  Updated lines.js written: {target}")
        print(f"   WHITE: removed unique lines={len(fix_white.remove_lines_global)} · removed occurrences={removed_occ_w} · buckets touched={buckets_w}")
        print(f"   BLACK: removed unique lines={len(fix_black.remove_lines_global)} · removed occurrences={removed_occ_b} · buckets touched={buckets_b}")
        print("   👉 Tip: rerun the script after applying the fix to confirm collisions are gone.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
