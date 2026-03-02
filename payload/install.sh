#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

source "$REPO_ROOT/lib/common.sh"

MODE="${MODE:-desktop}"
ARCH_USER="${ARCH_USER:-}"

detect_user() {
  awk -F: '$3 >= 1000 && $3 < 65534 {print $1; exit}' /etc/passwd
}

if [[ -z "$ARCH_USER" ]]; then
  ARCH_USER="$(detect_user || true)"
fi

if [[ -z "$ARCH_USER" ]]; then
  echo "ERROR: Could not auto-detect a non-root user (UID >= 1000)."
  echo "Create a user during archinstall, or run with ARCH_USER=username."
  exit 1
fi

require_user "$ARCH_USER"

case "$MODE" in
  desktop) MODE_FILE="$REPO_ROOT/modes/desktop.sh" ;;
  server)  MODE_FILE="$REPO_ROOT/modes/server.sh" ;;
  *) echo "ERROR: MODE must be 'desktop' or 'server' (got: $MODE)"; exit 1 ;;
esac

if [ ! -f "$MODE_FILE" ]; then
  echo "Missing mode file: $MODE_FILE"
  exit 1
fi

TEMP_SUDOERS="/etc/sudoers.d/99-installer-nopasswd-$ARCH_USER"
cleanup() {
  if [[ "$(id -u)" -eq 0 ]]; then
    rm -f "$TEMP_SUDOERS" 2>/dev/null || true
  else
    sudo rm -f "$TEMP_SUDOERS" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "$(id -u)" -ne 0 ]]; then
  sudo -v
fi

write_sudoers_rule() {
  local content
  content="$ARCH_USER ALL=(ALL) NOPASSWD: /usr/bin/pacman"

  if [[ "$(id -u)" -eq 0 ]]; then
    printf '%s\n' "$content" >"$TEMP_SUDOERS"
    chmod 440 "$TEMP_SUDOERS"
    visudo -cf "$TEMP_SUDOERS"
  else
    printf '%s\n' "$content" | sudo tee "$TEMP_SUDOERS" >/dev/null
    sudo chmod 440 "$TEMP_SUDOERS"
    sudo visudo -cf "$TEMP_SUDOERS"
  fi
}

write_sudoers_rule

source "$MODE_FILE"

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

configure_greetd
configure_pam_kwallet
set_wallet_enabled "$ARCH_USER"

install_icon_theme "$ARCH_USER" "$ICON_ARCHIVE"
set_icon_theme "$ARCH_USER" "YAMIS"

if [ -n "${CURSOR_ARCHIVE:-}" ]; then
  install_cursor_theme "$ARCH_USER" "$CURSOR_ARCHIVE" "${CURSOR_ARCHIVE_TYPE:-xz}"
  set_cursor_theme "$ARCH_USER" "${CURSOR_THEME_NAME:-Miku Cursor}" "${CURSOR_SIZE:-24}"
fi

apply_dotfiles "$ARCH_USER" "$DOTFILES_DIR"
set_color_scheme "$ARCH_USER" "$COLOR_SCHEME"
apply_konsave "$ARCH_USER" "$KNSV_FILE" "$KNSV_NAME"

install_wallpaper_autostart_required \
  "$ARCH_USER" "$REPO_ROOT/shared/set-wallpaper-once.sh"

echo "Installation complete."

reboot