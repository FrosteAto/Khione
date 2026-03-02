#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo
echo "Starting Arch installer with recommended defaults."
echo "You can change disk layout, users, locale, etc. in the UI."
echo

archinstall --config "$SCRIPT_DIR/arch-install-config.json"