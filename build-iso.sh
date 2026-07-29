#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$REPO_ROOT/out"
ISO_COMMON="$REPO_ROOT/iso-common"
TMP_PROFILE_ROOT="$(mktemp -d /tmp/frostearch-profiles.XXXXXX)"

cleanup() {
	rm -rf "$TMP_PROFILE_ROOT"
}

trap cleanup EXIT INT TERM

# Per-edition values that vary across the otherwise-identical archiso profile:
# edition name, iso_label suffix, archinstall hostname, kernel package.
render_template() {
	local template="$1" dest="$2" edition="$3" iso_label_suffix="$4" hostname="$5" kernel="$6"

	sed \
		-e "s/@@EDITION@@/$edition/g" \
		-e "s/@@ISO_LABEL_SUFFIX@@/$iso_label_suffix/g" \
		-e "s/@@HOSTNAME@@/$hostname/g" \
		-e "s/@@KERNEL@@/$kernel/g" \
		"$template" > "$dest"
}

prepare_profile() {
	local edition="$1" iso_label_suffix="$2" hostname="$3" kernel="$4"
	local dest_profile="$TMP_PROFILE_ROOT/iso-$edition"
	local installer_dir="$dest_profile/airootfs/root/installer-src"

	rm -rf "$dest_profile"
	mkdir -p "$dest_profile"

	tar \
		--exclude='work' \
		--exclude='x86_64' \
		--exclude='airootfs/root/installer-src' \
		--exclude='*.tmpl' \
		-C "$ISO_COMMON" -cf - . | tar -C "$dest_profile" -xf -

	render_template "$ISO_COMMON/profiledef.sh.tmpl" \
		"$dest_profile/profiledef.sh" "$edition" "$iso_label_suffix" "$hostname" "$kernel"
	chmod 644 "$dest_profile/profiledef.sh"

	render_template "$ISO_COMMON/airootfs/root/arch-install-config.json.tmpl" \
		"$dest_profile/airootfs/root/arch-install-config.json" "$edition" "$iso_label_suffix" "$hostname" "$kernel"
	chmod 644 "$dest_profile/airootfs/root/arch-install-config.json"

	rm -rf "$installer_dir"
	mkdir -p "$installer_dir/payload"

	cp -a "$REPO_ROOT/install.sh" "$installer_dir/install.sh"
	cp -a "$REPO_ROOT/payload/." "$installer_dir/payload/"
	chmod -R a+rX "$installer_dir"
}

sudo rm -rf /tmp/work-desktop /tmp/work-server /tmp/work-node "$OUT_DIR"
mkdir -p "$OUT_DIR"

prepare_profile desktop DSK  FrosteArch-PC   linux
prepare_profile server  SRV  FrosteArch-SVR  linux-lts
prepare_profile node    NODE FrosteArch-NODE linux-lts

sudo mkarchiso -v -w /tmp/work-desktop -o "$OUT_DIR" "$TMP_PROFILE_ROOT/iso-desktop"
sudo mkarchiso -v -w /tmp/work-server  -o "$OUT_DIR" "$TMP_PROFILE_ROOT/iso-server"
sudo mkarchiso -v -w /tmp/work-node    -o "$OUT_DIR" "$TMP_PROFILE_ROOT/iso-node"

rename_iso() {
	local pattern="$1"
	local target_name="$2"
	local source_iso

	source_iso="$(ls -1t "$OUT_DIR"/$pattern 2>/dev/null | head -n 1 || true)"
	if [[ -z "$source_iso" ]]; then
		echo "WARNING: No ISO matched pattern '$pattern' in $OUT_DIR"
		return 0
	fi

	rm -f "$OUT_DIR/$target_name"
	mv "$source_iso" "$OUT_DIR/$target_name"
}

rename_iso "FrosteArch-desktop-*.iso" "FrosteArch_Desktop.iso"
rename_iso "FrosteArch-server-*.iso" "FrosteArch_Server.iso"
rename_iso "FrosteArch-node-*.iso" "FrosteArch_Node.iso"

ls -lah "$OUT_DIR"