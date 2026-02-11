#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$REPO_ROOT/lib/common.sh"

read -rp "Enter the name of your user (must already exist): " ARCH_USER
require_user "$ARCH_USER"

echo "Select setup:"
echo "  1) Desktop"
echo "  2) Server"
read -rp "Enter 1 or 2: " CHOICE

case "$CHOICE" in
  1) MODE_FILE="$REPO_ROOT/modes/desktop.sh" ;;
  2) MODE_FILE="$REPO_ROOT/modes/server.sh" ;;
  *) echo "Invalid choice."; exit 1 ;;
esac

if [ ! -f "$MODE_FILE" ]; then
  echo "Missing mode file: $MODE_FILE"
  exit 1
fi

# shellcheck source=/dev/null
source "$MODE_FILE"

# Mode file must set:
# MODE_NAME, OFFICIAL_PACKAGES[], AUR_PACKAGES[], DOTFILES_SUBDIR,
# KNSV_REL, KNSV_NAME, COLOR_SCHEME, FIREWALL_RULES[], SERVICES_ENABLE[], SERVICES_MASK[],
# ICON_ARCHIVE_REL, and optionally CURSOR_ARCHIVE_REL + CURSOR_THEME_NAME + CURSOR_SIZE

init_paths "$REPO_ROOT" "$ARCH_USER"

system_update
enable_multilib
ensure_git
install_official_packages OFFICIAL_PACKAGES

install_yay "$ARCH_USER"
install_aur_packages "$ARCH_USER" AUR_PACKAGES

enable_services SERVICES_ENABLE
mask_services SERVICES_MASK
configure_firewall FIREWALL_RULES

add_flathub
configure_greetd
configure_pam_kwallet
set_wallet_enabled "$ARCH_USER"

install_icon_theme "$ARCH_USER" "$ICON_ARCHIVE"
set_icon_theme "$ARCH_USER" "YAMIS"

if [ -n "${CURSOR_ARCHIVE:-}" ]; then
  install_cursor_theme "$ARCH_USER" "$CURSOR_ARCHIVE" "$CURSOR_ARCHIVE_TYPE"
  set_cursor_theme "$ARCH_USER" "$CURSOR_THEME_NAME" "$CURSOR_SIZE"
fi

apply_dotfiles "$ARCH_USER" "$DOTFILES_DIR"
set_color_scheme "$ARCH_USER" "$COLOR_SCHEME"

apply_konsave "$ARCH_USER" "$KNSV_FILE" "$KNSV_NAME"

install_wallpaper_autostart_required "$ARCH_USER" "$REPO_ROOT/shared/set-wallpaper-once.sh"

echo "Setup complete, please reboot."
