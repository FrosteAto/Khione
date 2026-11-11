#!/usr/bin/env python3
"""One-off migration: copy the live Glance Meals data files verbatim into
the new HA/pyscript location. No transformation -- week1_monday doesn't
need recalculating (the rotation's date anchor is unaffected by which
engine computes from it), and this never overwrites with seed data, only
with whatever is really on disk at SRC_DIR.

Usage:
  migrate-meals-data.py --dry-run   # show what would happen, write nothing
  migrate-meals-data.py             # actually copy
"""
import filecmp
import json
import os
import shutil
import sys

SRC_DIR = "/var/lib/glance"
DST_DIR = "/var/lib/hass/meals"
FILES = ["recipes.json", "meal-plan.json", "weight-log.json", "weight-profile.json"]


def main():
    dry_run = "--dry-run" in sys.argv
    os.makedirs(DST_DIR, exist_ok=True)
    for name in FILES:
        src = os.path.join(SRC_DIR, name)
        dst = os.path.join(DST_DIR, name)
        if not os.path.exists(src):
            print(f"SKIP (no source file): {src}")
            continue
        with open(src) as f:
            try:
                json.load(f)
            except json.JSONDecodeError as e:
                print(f"ERROR: {src} is not valid JSON: {e}")
                sys.exit(1)
        if dry_run:
            print(f"WOULD COPY: {src} -> {dst}")
            continue
        shutil.copyfile(src, dst)
        if not filecmp.cmp(src, dst, shallow=False):
            print(f"ERROR: {dst} does not match {src} byte-for-byte after copy")
            sys.exit(1)
        print(f"COPIED (verified identical): {src} -> {dst}")


if __name__ == "__main__":
    main()
