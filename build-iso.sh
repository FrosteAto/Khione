#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$REPO_ROOT/out"
TMP_PROFILE_ROOT="$(mktemp -d /tmp/frostearch-profiles.XXXXXX)"

cleanup() {
	rm -rf "$TMP_PROFILE_ROOT"
}

trap cleanup EXIT INT TERM

prepare_profile() {
	local src_profile="$1"
	local dest_profile="$2"
	local installer_dir="$dest_profile/airootfs/root/installer-src"

	rm -rf "$dest_profile"
	mkdir -p "$dest_profile"

	tar \
		--exclude='work' \
		--exclude='x86_64' \
		--exclude='airootfs/root/installer-src' \
		-C "$src_profile" -cf - . | tar -C "$dest_profile" -xf -

	rm -rf "$installer_dir"
	mkdir -p "$installer_dir/payload"

	cp -a "$REPO_ROOT/install.sh" "$installer_dir/install.sh"
	cp -a "$REPO_ROOT/payload/." "$installer_dir/payload/"
	chmod -R a+rX "$installer_dir"
}

sudo rm -rf /tmp/work-desktop /tmp/work-server "$OUT_DIR"
mkdir -p "$OUT_DIR"

prepare_profile "$REPO_ROOT/iso-desktop" "$TMP_PROFILE_ROOT/iso-desktop"
prepare_profile "$REPO_ROOT/iso-server" "$TMP_PROFILE_ROOT/iso-server"

sudo mkarchiso -v -w /tmp/work-desktop -o "$OUT_DIR" "$TMP_PROFILE_ROOT/iso-desktop"
sudo mkarchiso -v -w /tmp/work-server  -o "$OUT_DIR" "$TMP_PROFILE_ROOT/iso-server"

ls -lah "$OUT_DIR"