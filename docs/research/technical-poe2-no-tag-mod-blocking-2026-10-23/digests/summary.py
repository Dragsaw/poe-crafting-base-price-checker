"""Digest of RePoE-fork PoE2 mods.json: every mod that adds a no_* tag or is weighted on one.

Usage: uv run python -I summary.py <path/to/mods.json>
"""

import collections
import json
import re
import sys


def is_no(tag):
    return tag.startswith("no_")


def family_text(mod):
    text = (mod.get("text") or "").replace("\n", " / ")
    return re.sub(r"\(?-?[\d.]+(?:-[\d.]+)?\)?", "#", text)


def main(path):
    with open(path, encoding="utf-8") as fh:
        mods = json.load(fh)

    hits = {
        mid: m
        for mid, m in mods.items()
        if any(is_no(t) for t in m.get("adds_tags", []))
        or any(is_no(s["tag"]) for s in m.get("spawn_weights", []))
    }

    # Family = mod group(s) + text with numbers masked; tiers with identical
    # tag behaviour collapse into one row listing their mod ids.
    families = collections.defaultdict(lambda: collections.defaultdict(list))
    for mid, m in hits.items():
        fam = (tuple(m.get("groups", [])), family_text(m))
        row = (
            m["domain"],
            m["generation_type"],
            tuple(s["id"] for s in m.get("stats", [])),
            tuple(t for t in m.get("adds_tags", []) if is_no(t)),
            tuple(f'{s["tag"]}:{s["weight"]}' for s in m.get("spawn_weights", [])),
        )
        families[fam][row].append(mid)

    print(f"source: {path}")
    print(f"mods total: {len(mods)}; mods adding or weighted on a no_* tag: {len(hits)}")
    print()
    for (groups, text) in sorted(families, key=lambda f: (f[0], f[1])):
        print(f"=== groups={','.join(groups) or '-'} | {text}")
        for row, ids in sorted(families[(groups, text)].items()):
            domain, gen, stats, adds, spawn = row
            print(f"  domain={domain} gen={gen} stats={','.join(stats) or '-'}")
            print(f"    adds_no: {','.join(adds) or '-'}")
            print(f"    spawn_weights (ordered): {' '.join(spawn) or '-'}")
            print(f"    mods ({len(ids)}): {' '.join(sorted(ids))}")
        print()

    by_domain = collections.defaultdict(lambda: {"adds": set(), "spawn": set()})
    for m in hits.values():
        d = by_domain[m["domain"]]
        d["adds"].update(t for t in m.get("adds_tags", []) if is_no(t))
        d["spawn"].update(s["tag"] for s in m.get("spawn_weights", []) if is_no(s["tag"]))

    print("=== no_* tags by domain")
    for domain in sorted(by_domain):
        d = by_domain[domain]
        print(f"  {domain}: adds={sorted(d['adds'])}")
        print(f"  {domain}: spawn={sorted(d['spawn'])}")
    item = by_domain["item"]["adds"] | by_domain["item"]["spawn"]
    other = set().union(
        *(d["adds"] | d["spawn"] for k, d in by_domain.items() if k != "item")
    )
    print(f"  item-domain no_* tags ({len(item)}): {sorted(item)}")
    print(f"  other-domain no_* tags ({len(other)}): {sorted(other)}")
    print(f"  in both: {sorted(item & other)}")


if __name__ == "__main__":
    main(sys.argv[1])
