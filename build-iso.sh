#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$REPO_ROOT/out"
ISO_COMMON="$REPO_ROOT/iso-common"
TMP_PROFILE_ROOT="$(mktemp -d /tmp/khione-profiles.XXXXXX)"

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
		--exclude='splash-variants' \
		-C "$ISO_COMMON" -cf - . | tar -C "$dest_profile" -xf -

	# Per-edition boot splash: same cat icon, edition-specific wordmark.
	cp "$ISO_COMMON/splash-variants/splash-$edition.png" "$dest_profile/syslinux/splash.png"

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

# edition -> "iso_label_suffix hostname kernel"
edition_meta() {
	case "$1" in
		desktop) echo "DSK  Khione-PC   linux" ;;
		server)  echo "SRV  Khione-SVR  linux-lts" ;;
		node)    echo "NODE Khione-NODE linux-lts" ;;
		ulw)     echo "ULW  Khione-ULW  linux" ;;
		*) return 1 ;;
	esac
}
ALL_EDITIONS=(desktop server node ulw)

# ./build-iso.sh [edition] builds just that one; no argument builds all of them.
if [[ $# -gt 0 ]]; then
	if ! edition_meta "$1" >/dev/null; then
		echo "ERROR: Unknown edition '$1'. Valid editions: ${ALL_EDITIONS[*]}" >&2
		exit 1
	fi
	EDITIONS=("$1")
else
	EDITIONS=("${ALL_EDITIONS[@]}")
fi

for edition in "${EDITIONS[@]}"; do
	sudo rm -rf "/tmp/work-$edition"
done
mkdir -p "$OUT_DIR"

for edition in "${EDITIONS[@]}"; do
	read -r suffix hostname kernel <<<"$(edition_meta "$edition")"
	prepare_profile "$edition" "$suffix" "$hostname" "$kernel"
done

for edition in "${EDITIONS[@]}"; do
	sudo mkarchiso -v -w "/tmp/work-$edition" -o "$OUT_DIR" "$TMP_PROFILE_ROOT/iso-$edition"
done

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

declare -A ISO_NAME=(
	[desktop]="Khione_Desktop.iso"
	[server]="Khione_Server.iso"
	[node]="Khione_Node.iso"
	[ulw]="Khione_ULW.iso"
)
for edition in "${EDITIONS[@]}"; do
	rename_iso "Khione-$edition-*.iso" "${ISO_NAME[$edition]}"
done

ls -lah "$OUT_DIR"