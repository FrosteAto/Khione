#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ISO_DIR="$REPO_ROOT/iso"

WORK_DIR="$ISO_DIR/work"
OUT_DIR="$ISO_DIR/out"
INSTALLER_DEST="$ISO_DIR/airootfs/root/installer"

if mount | grep -q "$ISO_DIR/work"; then
  echo "==> Detected leftover mounts in $ISO_DIR/work, unmounting..."
  sudo umount -R "$ISO_DIR/work" 2>/dev/null || true
fi

if [ -d "$ISO_DIR/work" ]; then
  sudo rm -rf "$ISO_DIR/work"
fi

echo "==> Preparing ISO filesystem..."
rm -rf "$INSTALLER_DEST"
mkdir -p "$INSTALLER_DEST"

# Copy repo into ISO at /root/installer
rsync -a --delete \
  --exclude '.git' \
  --exclude 'iso' \
  --exclude '*.iso' \
  "$REPO_ROOT/" "$INSTALLER_DEST/"

echo "==> Building ISO..."
sudo mkarchiso -v -w "$WORK_DIR" -o "$OUT_DIR" "$ISO_DIR"

echo "==> Done. ISO(s) in: $OUT_DIR"
ls -lah "$OUT_DIR"