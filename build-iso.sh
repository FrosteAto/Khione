#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ISO_DIR="$REPO_ROOT/iso"

WORK_DIR="/tmp/archiso-work"
OUT_DIR="$ISO_DIR/out"

sudo rm -rf "$WORK_DIR" "$OUT_DIR"
mkdir -p "$OUT_DIR"

sudo mkarchiso -v -w /tmp/work-desktop -o out iso-desktop
sudo mkarchiso -v -w /tmp/work-server  -o out iso-server
ls -lah "$OUT_DIR"