#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$REPO_ROOT/out"

stage_installer_snapshot() {
	local profile_dir="$1"
	local dest_dir="$profile_dir/airootfs/root/installer-src"

	rm -rf "$dest_dir"
	mkdir -p "$dest_dir"

	tar \
		--exclude='.git' \
		--exclude='out' \
		--exclude='iso-desktop/work' \
		--exclude='iso-server/work' \
		--exclude='iso-desktop/airootfs/root/installer-src' \
		--exclude='iso-server/airootfs/root/installer-src' \
		-C "$REPO_ROOT" -cf - . | tar -C "$dest_dir" -xf -
}

sudo rm -rf /tmp/work-desktop /tmp/work-server "$OUT_DIR"
mkdir -p "$OUT_DIR"

stage_installer_snapshot "$REPO_ROOT/iso-desktop"
stage_installer_snapshot "$REPO_ROOT/iso-server"

sudo mkarchiso -v -w /tmp/work-desktop -o "$OUT_DIR" "$REPO_ROOT/iso-desktop"
sudo mkarchiso -v -w /tmp/work-server  -o "$OUT_DIR" "$REPO_ROOT/iso-server"

ls -lah "$OUT_DIR"