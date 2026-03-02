#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ISO_DIR="$REPO_ROOT/iso"

WORK_DIR="$ISO_DIR/work"
OUT_DIR="$ISO_DIR/out"

INSTALLER_DEST="$ISO_DIR/airootfs/root/installer"

echo "==> Preparing ISO filesystem..."
rm -rf "$INSTALLER_DEST"
mkdir -p "$INSTALLER_DEST"

# Copy your repo into the live ISO at /root/installer
# Exclude build artifacts + git metadata
rsync -a --delete \
  --exclude '.git' \
  --exclude 'iso/work' \
  --exclude 'iso/out' \
  --exclude '*.iso' \
  "$REPO_ROOT/" "$INSTALLER_DEST/"

echo "==> Building ISO..."
sudo mkarchiso -v -w "$WORK_DIR" -o "$OUT_DIR" "$ISO_DIR"

echo "==> Done."
echo "ISO(s) in: $OUT_DIR"
ls -lah "$OUT_DIR" | sed -n '1,200p'