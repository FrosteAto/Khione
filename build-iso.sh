#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$REPO_ROOT/out"

sudo rm -rf /tmp/work-desktop /tmp/work-server "$OUT_DIR"
mkdir -p "$OUT_DIR"

sudo mkarchiso -v -w /tmp/work-desktop -o "$OUT_DIR" "$REPO_ROOT/iso-desktop"
sudo mkarchiso -v -w /tmp/work-server  -o "$OUT_DIR" "$REPO_ROOT/iso-server"

ls -lah "$OUT_DIR"