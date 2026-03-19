#!/bin/bash
set -euo pipefail

timestamp() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(timestamp)] $*"; }

section() {
  echo
  echo "=================================================="
  echo "== $*"
  echo "=================================================="
  echo
}

LOG_DIR="/var/log/arch-linux-setups"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install-$(date +%F_%H-%M-%S).log"

if [[ -w /dev/tty1 ]]; then
  exec > >(tee -a "$LOG_FILE" /dev/tty1) 2>&1
else
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

log "Running installer"
log "Logging to $LOG_FILE"

TEMP_SUDOERS=""
SUDO_KEEPALIVE_PID=""

on_error() {
  local rc=$?
  echo
  echo "[$(timestamp)] ❌ Installer failed (exit $rc)."
  echo "Check log: $LOG_FILE"
  exit "$rc"
}

cleanup() {
  if [[ -n "$SUDO_KEEPALIVE_PID" ]]; then
    kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
    wait "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
  fi

  if [[ -n "$TEMP_SUDOERS" ]]; then
    if [[ "$(id -u)" -eq 0 ]]; then
      rm -f "$TEMP_SUDOERS" 2>/dev/null || true
    else
      sudo rm -f "$TEMP_SUDOERS" 2>/dev/null || true
    fi
  fi
}

trap on_error ERR
trap cleanup EXIT INT TERM

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
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
  log "ERROR: Could not auto-detect a non-root user (UID >= 1000)."
  log "Create a user during archinstall, or run with ARCH_USER=username."
  exit 1
fi

require_user "$ARCH_USER"

case "$MODE" in
  desktop) MODE_FILE="$REPO_ROOT/modes/desktop.sh" ;;
  server)  MODE_FILE="$REPO_ROOT/modes/server.sh" ;;
  *)
    log "ERROR: MODE must be 'desktop' or 'server' (got: $MODE)"
    exit 1
    ;;
esac

if [[ ! -f "$MODE_FILE" ]]; then
  log "Missing mode file: $MODE_FILE"
  exit 1
fi

log "Starting installer"
log "Mode: $MODE"
log "User: $ARCH_USER"

TEMP_SUDOERS="/etc/sudoers.d/99-installer-nopasswd-$ARCH_USER"

if [[ "$(id -u)" -ne 0 ]]; then
  sudo -v

  (
    while true; do
      sleep 60
      sudo -n true >/dev/null 2>&1 || exit 0
    done
  ) &
  SUDO_KEEPALIVE_PID="$!"
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

# shellcheck source=/dev/null
source "$MODE_FILE"

init_paths "$REPO_ROOT" "$ARCH_USER"

section "System setup"
system_update
enable_multilib
ensure_git

section "Installing official packages"
install_official_packages OFFICIAL_PACKAGES

section "Installing yay"
install_yay "$ARCH_USER"

section "Installing AUR packages"
install_aur_packages "$ARCH_USER" AUR_PACKAGES

section "Configuring services and firewall"
enable_services SERVICES_ENABLE
mask_services SERVICES_MASK
configure_firewall FIREWALL_RULES

section "Configuring greetd and PAM"
configure_greetd
configure_pam_kwallet
set_wallet_enabled "$ARCH_USER"

section "Applying icons and cursor theme"
install_icon_theme "$ARCH_USER" "$ICON_ARCHIVE"

if [[ -n "${CURSOR_ARCHIVE:-}" ]]; then
  install_cursor_theme "$ARCH_USER" "$CURSOR_ARCHIVE" "${CURSOR_ARCHIVE_TYPE:-xz}"
fi

section "Applying dotfiles and desktop configuration"
apply_dotfiles "$ARCH_USER" "$DOTFILES_DIR"
apply_konsave "$ARCH_USER" "$KNSV_FILE" "$KNSV_NAME"
set_color_scheme "$ARCH_USER" "$COLOR_SCHEME"
set_icon_theme "$ARCH_USER" "YAMIS"

if [[ -n "${CURSOR_ARCHIVE:-}" ]]; then
  set_cursor_theme "$ARCH_USER" "${CURSOR_THEME_NAME:-Miku Cursor}" "${CURSOR_SIZE:-24}"
fi

section "Installing wallpaper first-login helper"
install_wallpaper_autostart_required \
  "$ARCH_USER" "$REPO_ROOT/shared/set-wallpaper-once.sh"

log "Installation complete."
log "Rebooting in 3 seconds..."
sleep 3
reboot || true