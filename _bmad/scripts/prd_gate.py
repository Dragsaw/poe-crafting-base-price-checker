"""Mechanical altitude gate for the PRD.

Run after every FR rewrite, and as the first check of any PRD validation pass:

    uv run _bmad/scripts/prd_gate.py

Exit code 1 on any FAIL. Word-count targets are reported, not enforced.

What it guards, and why it outlived the simplification run that created it: the PRD's
altitude rule is "cite the owner by stable id, never restate it" (AGENTS.md, prd.md §0).
A citation only survives the spine changing if something checks that it still resolves.
These checks are that something -- FR/NFR/UJ/AD/OQ and IMPLEMENTATION-NOTES § references
against the live spine, plus the drift markers (contract version strings, revision
narrative, stray code fences) that caused ten of twelve past PRD revisions.
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
WS = ROOT / "docs" / "prds" / "prd-poe-crafting-base-price-checker-2026-09-12"
ARCH = ROOT / "docs" / "architecture" / "architecture-poe-crafting-base-price-checker-2026-09-12"
prd = (WS / "prd.md").read_text(encoding="utf-8")
spine = (ARCH / "ARCHITECTURE-SPINE.md").read_text(encoding="utf-8")
impl = (ARCH / "IMPLEMENTATION-NOTES.md").read_text(encoding="utf-8")

fails: list[str] = []
notes: list[str] = []

def check(ok: bool, msg: str) -> None:
    (notes if ok else fails).append(("PASS " if ok else "FAIL ") + msg)

# split body from frontmatter
body = prd.split("---", 2)[2] if prd.startswith("---") else prd
lines = body.splitlines()

# --- FR contiguity ------------------------------------------------------------
fr_defs = [int(m.group(1)) for m in re.finditer(r"^#### FR-(\d+):", body, flags=re.M)]
check(fr_defs == list(range(1, 34)), f"FR definitions contiguous FR-1..FR-33 (got {len(fr_defs)}, first gap/dup: "
      f"{next((i for i, n in enumerate(fr_defs, 1) if n != i), None)})")

# --- references resolve -------------------------------------------------------
def defs(pattern: str, text: str) -> set[str]:
    return set(re.findall(pattern, text))

fr_refs = set(re.findall(r"\bFR-\d+\b", body))
check(fr_refs <= {f"FR-{n}" for n in fr_defs}, f"FR references resolve (unresolved: {sorted(fr_refs - {f'FR-{n}' for n in fr_defs})})")

nfr_defs = defs(r"\*\*(NFR-\d+)", body)
nfr_refs = set(re.findall(r"\bNFR-\d+\b", body))
check(nfr_refs <= nfr_defs, f"NFR references resolve (unresolved: {sorted(nfr_refs - nfr_defs)})")

uj_defs = defs(r"\*\*(UJ-\d+)\.", body)
uj_refs = set(re.findall(r"\bUJ-\d+\b", body))
check(uj_refs <= uj_defs, f"UJ references resolve (unresolved: {sorted(uj_refs - uj_defs)})")

live_ads = set(re.findall(r"^### (AD-\d+)", spine, flags=re.M))
retired = set(re.findall(r"^\| (AD-\d+) — ", spine, flags=re.M))
ad_refs = set(re.findall(r"\bAD-\d+\b", body))
bad_ads = ad_refs - live_ads - retired
check(not bad_ads, f"AD citations name live or mapped-retired ids (unknown: {sorted(bad_ads)})")
retired_uses = [ln for ln in lines if any(re.search(rf"\b{r}\b", ln) for r in retired)]
notes.append(f"INFO {len(retired_uses)} lines mention a retired AD id (must each be an annotated historical record)")

oq_defs = defs(r"\*\*(OQ-\d+)\b", body)
oq_refs = set(re.findall(r"\bOQ-\d+\b", body)) - {"OQ-1", "OQ-2", "OQ-3"}
check(oq_refs <= oq_defs, f"OQ references resolve (unresolved: {sorted(oq_refs - oq_defs)})")

impl_secs = {s.rstrip(".") for s in re.findall(r"^##+ §?(\d+(?:\.\d+)*)\.?\s", impl, flags=re.M)}
impl_refs = set(re.findall(r"IMPLEMENTATION-NOTES\.md`? ?§([\d.]+)", body))
check(impl_refs <= impl_secs or not impl_secs, f"IMPLEMENTATION-NOTES § refs resolve (unresolved: {sorted(impl_refs - impl_secs)}; "
      f"if the companion has no numbered headings this check is skipped)")

# --- altitude rules ----------------------------------------------------------------
sec = {}
cur = "preamble"
for ln in lines:
    m = re.match(r"^## (\d+)\.", ln) or re.match(r"^### (7\.\d)", ln)
    if m:
        cur = m.group(1)
    sec.setdefault(cur, []).append(ln)
def text_of(*keys: str) -> str:
    return "\n".join(l for k in keys for l in sec.get(k, []))

versions = re.findall(r"\b[2-5]\.\d\.\d\b", body)
check(len(versions) == 0, f"no contract version strings in body (found {len(versions)}: {sorted(set(versions))})")

fences_in_4 = len(re.findall(r"^```", text_of("4"), flags=re.M)) // 2
check(fences_in_4 <= 1, f"at most one code fence in §4 (found {fences_in_4}; the one allowed is FR-1's EV)")

rev_mentions = [ln for ln in lines if re.search(r"\b[Rr]evision \d+\b|\brev \d+\b|\brevision 1[0-9]\b", ln)]
check(len(rev_mentions) == 0, f"no revision narrative in body (found {len(rev_mentions)} lines)")

withdrawn = [ln for ln in lines if re.search(r"\bwithdraws?\b|\bwithdrawn\b|\bsupersede[sd]?\b|\bcorrigendum\b", ln, flags=re.I)]
notes.append(f"INFO {len(withdrawn)} lines use withdraw/supersede language (review: narrative or live rule?)")

# --- assumptions index symmetry -------------------------------------------------------
inline = len(re.findall(r"\[ASSUMPTION:", body))
index_entries = len(re.findall(r"^- \*\*§", text_of("11"), flags=re.M))
notes.append(f"INFO inline ASSUMPTION tags: {inline}; §11 entries: {index_entries} (FR-2's entry historically covers two tags)")
check(abs(inline - index_entries) <= 1, "assumptions index symmetric within the known FR-2 tolerance")

# --- size report --------------------------------------------------------------------
total = len(body.split())
notes.append(f"INFO total body words: {total} (target <= 9,000; stretch 7,000)")
fr_sizes = []
for m in re.finditer(r"^#### (FR-\d+):[^\n]*\n(.*?)(?=^#### |^### |^## )", body, flags=re.M | re.S):
    fr_sizes.append((m.group(1), len(m.group(2).split())))
over = [(fr, w) for fr, w in fr_sizes if w > 350]
notes.append(f"INFO FRs over 350 words: {over if over else 'none'}")
gl = len(text_of("3").split())
notes.append(f"INFO §3 Glossary words: {gl} (target ~1,100)")
s0 = len(text_of("0").split())
notes.append(f"INFO §0 words: {s0} (target ~200)")

for n in notes:
    print(n)
for f in fails:
    print(f)
print(f"\n{len(fails)} FAIL, {sum(1 for n in notes if n.startswith('PASS'))} PASS")
sys.exit(1 if fails else 0)
