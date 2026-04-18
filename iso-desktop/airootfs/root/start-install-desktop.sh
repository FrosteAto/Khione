#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SNAPSHOT_SRC="/root/installer-src"
SNAPSHOT_RUN="/run/frostearch-installer"

echo
echo "Starting Arch installer with recommended defaults."
echo "You can change disk layout, users, locale, etc. in the UI."
echo

if [[ -d "$SNAPSHOT_SRC" ]]; then
	echo "Staging local installer snapshot..."
	rm -rf "$SNAPSHOT_RUN"
	cp -a "$SNAPSHOT_SRC" "$SNAPSHOT_RUN"
fi

archinstall --config "$SCRIPT_DIR/arch-install-config-desktop.json"