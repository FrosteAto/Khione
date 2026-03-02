#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ISO_DIR="$REPO_ROOT/iso"
PAYLOAD_DIR="$REPO_ROOT/payload"

WORK_DIR="/tmp/archiso-work"
OUT_DIR="$ISO_DIR/out"
INSTALLER_DEST="$ISO_DIR/airootfs/root/installer"

echo "==> Preparing ISO filesystem..."
rm -rf "$INSTALLER_DEST"
mkdir -p "$INSTALLER_DEST"

echo "==> Copying installer payload..."
rsync -a --delete "$PAYLOAD_DIR/" "$INSTALLER_DEST/"

echo "==> Cleaning previous build output..."
sudo rm -rf "$WORK_DIR" "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "==> Building ISO..."
sudo mkarchiso -v -w "$WORK_DIR" -o "$OUT_DIR" "$ISO_DIR"

echo "==> Done. ISO(s) in $OUT_DIR"
ls -lah "$OUT_DIR"