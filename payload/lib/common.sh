#!/bin/bash
set -euo pipefail

require_user() {
  local u="$1"
  if ! id "$u" &>/dev/null; then
    echo "User '$u' does not exist. Exiting."
    exit 1
  fi
}

init_paths() {
  local repo_root="$1"
  local arch_user="$2"

  DOTFILES_DIR="$repo_root/$DOTFILES_SUBDIR"
  KNSV_FILE="$repo_root/$KNSV_REL"

  USER_HOME="/home/$arch_user"
  USER_CONFIG="$USER_HOME/.config"
  USER_LOCAL="$USER_HOME/.local"
}

system_update() {
  echo "Updating system..."
  sudo pacman -Syu --noconfirm
}

ensure_git() {
  echo "Installing git..."
  sudo pacman -S --needed --noconfirm git
}

enable_multilib() {
  if ! grep -q "^\[multilib\]" /etc/pacman.conf; then
    echo "Enabling [multilib]..."
    sudo sed -i '/#\[multilib\]/,/#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' /etc/pacman.conf
    sudo pacman -Syu --noconfirm
  fi
}

install_official_packages() {
  local -n pkgs="$1"
  echo "Installing official packages..."
  sudo pacman -S --needed --noconfirm "${pkgs[@]}"
}

install_yay() {
  local arch_user="$1"

  log "Installing yay..."

  if command -v yay &>/dev/null; then
    log "yay already installed. Skipping."
    return 0
  fi

  local -a pacman_cmd=(pacman)
  if [[ "$(id -u)" -ne 0 ]]; then
    pacman_cmd=(sudo pacman)
  fi

  "${pacman_cmd[@]}" -S --needed --noconfirm git base-devel fakeroot
  if "${pacman_cmd[@]}" -Si debugedit &>/dev/null; then
    "${pacman_cmd[@]}" -S --needed --noconfirm debugedit
  fi

  if ! command -v fakeroot &>/dev/null; then
    echo "ERROR: fakeroot is missing after dependency install."
    exit 1
  fi

  rm -rf /tmp/yay
  sudo -u "$arch_user" git clone https://aur.archlinux.org/yay.git /tmp/yay
  pushd /tmp/yay >/dev/null

  sudo -u "$arch_user" env HOME="/home/$arch_user" PATH="/usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin" makepkg -s --noconfirm

  local pkg_file
  pkg_file="$(find /tmp/yay -maxdepth 1 -type f -name 'yay-[0-9]*-*.pkg.tar.*' ! -name '*.sig' | sort | head -n 1)"
  if [[ -z "$pkg_file" ]]; then
    echo "ERROR: Built yay package not found in /tmp/yay"
    exit 1
  fi

  "${pacman_cmd[@]}" -U --noconfirm "$pkg_file"

  popd >/dev/null
  rm -rf /tmp/yay
}

install_aur_packages() {
  local arch_user="$1"
  local -n pkgs="$2"

  echo "Installing AUR packages..."
  local failed=()
  for pkg in "${pkgs[@]}"; do
    echo "→ $pkg"
    if sudo -u "$arch_user" yay -S --needed --noconfirm "$pkg"; then
      :
    else
      failed+=("$pkg")
    fi
  done

  if [ ${#failed[@]} -ne 0 ]; then
    echo "AUR failures:"
    printf ' - %s\n' "${failed[@]}"
  fi
}

enable_services() {
  local -n svcs="$1"
  [ ${#svcs[@]} -eq 0 ] && return 0
  echo "Enabling services..."
  for s in "${svcs[@]}"; do
    sudo systemctl enable "$s"
  done
}

mask_services() {
  local -n svcs="$1"
  [ ${#svcs[@]} -eq 0 ] && return 0
  echo "Masking services..."
  sudo systemctl mask "${svcs[@]}"
}

configure_firewall() {
  local -n rules="$1"
  local kernel_release
  local in_chroot=0

  echo "Configuring firewall..."
  sudo pacman -S --needed --noconfirm ufw
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  for r in "${rules[@]}"; do
    sudo ufw allow "$r"
  done

  if command -v systemd-detect-virt &>/dev/null && systemd-detect-virt --chroot --quiet; then
    in_chroot=1
  fi

  if [[ "$in_chroot" -eq 1 ]]; then
    echo "Skipping immediate UFW activation inside chroot."
    echo "UFW rules are configured and ufw.service will activate firewall on first boot."
    return 0
  fi

  kernel_release="$(uname -r)"
  if [[ ! -d "/lib/modules/$kernel_release" ]]; then
    echo "Skipping immediate UFW activation (running kernel modules '$kernel_release' not present in target root)."
    echo "UFW rules are configured and ufw.service will activate firewall on first boot."
    return 0
  fi

  if ! sudo ufw --force enable; then
    echo "Warning: UFW could not be enabled during install."
    echo "ufw.service is enabled and will retry activation on first boot."
  fi
}

add_flathub() {
  echo "Adding Flathub..."
  sudo pacman -S --needed --noconfirm flatpak
  sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
}

configure_greetd() {
  echo "Configuring greetd..."
  sudo tee /etc/greetd/config.toml >/dev/null <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --remember --remember-session --time --time-format '%Y-%m-%d %H:%M:%S' --width 80 --container-padding 2 --greeting 'Please enter your password.' --cmd /usr/bin/startplasma-wayland"
EOF
}

configure_pam_kwallet() {
  echo "Configuring PAM..."
  sudo tee /etc/pam.d/greetd >/dev/null <<'EOF'
#%PAM-1.0
auth       required     pam_securetty.so
auth       requisite    pam_nologin.so
auth       include      system-local-login
auth       optional     pam_kwallet5.so
account    include      system-local-login
session    include      system-local-login
session    optional     pam_kwallet5.so auto_start force_run
EOF

  sudo tee /etc/pam.d/login >/dev/null <<'EOF'
auth            optional        pam_kwallet5.so
session         optional        pam_kwallet5.so auto_start force_run
EOF
}

set_wallet_enabled() {
  local arch_user="$1"
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group KDE --key WalletEnabled true
}

install_icon_theme() {
  local arch_user="$1"
  local archive="$2"

  echo "Installing icon theme..."
  if [ ! -f "$archive" ]; then
    echo "Missing: $archive"
    exit 1
  fi
  sudo -u "$arch_user" mkdir -p "$USER_ICONS"
  sudo -u "$arch_user" tar -xzf "$archive" -C "$USER_ICONS"
}

set_icon_theme() {
  local arch_user="$1"
  local theme="$2"
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key Theme "$theme"
}

install_cursor_theme() {
  local arch_user="$1"
  local archive="$2"
  local archive_type="$3" # "gz" or "xz"

  echo "Installing cursor theme..."
  if [ ! -f "$archive" ]; then
    echo "Missing: $archive"
    exit 1
  fi
  sudo -u "$arch_user" mkdir -p "$USER_ICONS"

  case "$archive_type" in
    gz) sudo -u "$arch_user" tar -xzf "$archive" -C "$USER_ICONS" ;;
    xz) sudo -u "$arch_user" tar -xJf "$archive" -C "$USER_ICONS" ;;
    *)
      echo "Unknown cursor archive type: $archive_type"
      exit 1
      ;;
  esac
}

set_cursor_theme() {
  local arch_user="$1"
  local theme="$2"
  local size="$3"
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorTheme "$theme"
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorSize "$size"
}

apply_dotfiles() {
  local arch_user="$1"
  local src="$2"

  echo "Applying dotfiles..."
  if [ ! -d "$src" ]; then
    echo "Missing dotfiles dir: $src"
    exit 1
  fi

  sudo -u "$arch_user" mkdir -p "$USER_CONFIG" "$USER_LOCAL"

  for dir in kitty btop nano; do
    [ -d "$src/config/$dir" ] || continue
    sudo -u "$arch_user" cp -r "$src/config/$dir" "$USER_CONFIG/"
  done

  if [ -d "$src/local" ]; then
    sudo -u "$arch_user" cp -r "$src/local/"* "$USER_LOCAL/"
  fi
}

set_color_scheme() {
  local arch_user="$1"
  local scheme="$2"
  # kwriteconfig6 is pure file I/O — safe inside a chroot (no Qt platform needed).
  # Set the scheme name, then delete any stale ColorSchemeHash so KDE recomputes
  # it on first login rather than rolling back due to a hash mismatch.
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorScheme "$scheme"
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorSchemeHash --delete
}

apply_konsave() {
  local arch_user="$1"
  local knsv_file="$2"
  local knsv_name="$3"

  echo "Applying Konsave..."
  if [ ! -f "$knsv_file" ]; then
    echo "Missing: $knsv_file"
    exit 1
  fi

  sudo pacman -S --needed --noconfirm python-pipx
  sudo -u "$arch_user" pipx install --force konsave
  local konsave_bin="/home/$arch_user/.local/bin/konsave"
  sudo -u "$arch_user" "$konsave_bin" -i "$knsv_file"
  sudo -u "$arch_user" "$konsave_bin" -a "$knsv_name"
}

install_kara_pager_from_source() {
  local arch_user="$1"
  local kara_git_url="${2:-https://github.com/dhruv8sh/kara.git}"
  local kara_git_ref="${3:-v1.0.0}"
  local source_dir="/home/$arch_user/.local/src/kara"
  local plasmoid_dir="/home/$arch_user/.local/share/plasma/plasmoids/org.dhruv8sh.kara"

  echo "Installing Kara pager from source..."

  sudo pacman -S --needed --noconfirm \
    base-devel cmake extra-cmake-modules git \
    qt6-base qt6-declarative kwin libplasma plasma-activities plasma-workspace

  sudo -u "$arch_user" mkdir -p "/home/$arch_user/.local/src"
  if [ -d "$source_dir/.git" ]; then
    sudo -u "$arch_user" git -C "$source_dir" fetch --tags --prune
  else
    sudo -u "$arch_user" git clone "$kara_git_url" "$source_dir"
  fi

  sudo -u "$arch_user" git -C "$source_dir" checkout --force "$kara_git_ref"

  # Konsave can restore an older Kara plasmoid snapshot. Clear it before reinstall.
  sudo -u "$arch_user" rm -rf "$plasmoid_dir"

  # Run upstream installer flow because Kara currently expects this path setup.
  sudo -u "$arch_user" env HOME="/home/$arch_user" bash -lc "
set -euo pipefail
cd '$source_dir'
bash ./install.sh
"

  # Refresh KDE cache so the new plugin paths/modules are discovered.
  sudo -u "$arch_user" env HOME="/home/$arch_user" bash -lc "
set -euo pipefail
if command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 || true
fi
"
}

install_wallpaper_autostart_required() {
  local arch_user="$1"
  local helper="$2"

  if [ ! -f "$helper" ]; then
    echo "Missing required wallpaper helper: $helper"
    exit 1
  fi

  echo "Installing wallpaper one-shot autostart..."

  local user_script="/home/$arch_user/.local/bin/set-wallpaper-once.sh"
  local autostart_dir="/home/$arch_user/.config/autostart"
  local desktop_file="$autostart_dir/set-wallpaper-once.desktop"

  sudo -u "$arch_user" mkdir -p "/home/$arch_user/.local/bin" "$autostart_dir"
  sudo -u "$arch_user" cp "$helper" "$user_script"
  sudo -u "$arch_user" chmod +x "$user_script"

  sudo -u "$arch_user" tee "$desktop_file" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Set Wallpaper Once
Exec=$user_script
X-KDE-autostart-after=plasma-desktop
OnlyShowIn=KDE;
EOF
}

disable_kde_welcome_popup() {
  local arch_user="$1"
  local autostart_dir="/home/$arch_user/.config/autostart"
  local override_file="$autostart_dir/org.kde.plasma-welcome.desktop"

  echo "Disabling KDE welcome popup..."

  sudo -u "$arch_user" mkdir -p "$autostart_dir"
  sudo -u "$arch_user" tee "$override_file" >/dev/null <<'EOF'
[Desktop Entry]
Hidden=true
EOF

  # Plasma Welcome's KDED module reads these values from ~/.config/plasma-welcomerc.
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key LastSeenVersion "999.0.0" || true
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key ShowUpdatePage false || true
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key LiveEnvironment false || true

  # Keep this for older/alternate implementations.
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key FirstRun false || true

  # Belt-and-suspenders: disable the KDED launcher module if present.
  sudo -u "$arch_user" kwriteconfig6 --file kded6rc --group Module-plasma-welcome --key autoload false || true
  sudo -u "$arch_user" kwriteconfig6 --file kded5rc --group Module-plasma-welcome --key autoload false || true
}

install_first_boot_dialog_autostart_required() {
  local arch_user="$1"
  local markdown_file="$2"
  local dialog_title="${3:-FrosteArch}"
  local renderer_source="${4:-$(dirname "$markdown_file")/render-first-boot-dialog.py}"

  if [ ! -f "$markdown_file" ]; then
    echo "Missing required first-boot dialog markdown: $markdown_file"
    exit 1
  fi

  if [ ! -f "$renderer_source" ]; then
    echo "Missing required first-boot renderer helper: $renderer_source"
    exit 1
  fi

  echo "Installing first-boot dialog one-shot autostart..."

  local state_dir="/home/$arch_user/.config/frostearch"
  local message_file="$state_dir/first-boot-dialog.md"
  local title_file="$state_dir/first-boot-dialog-title.txt"
  local renderer_script="/home/$arch_user/.local/bin/frostearch-render-first-boot-dialog.py"
  local user_script="/home/$arch_user/.local/bin/frostearch-first-boot-dialog-once.sh"
  local autostart_dir="/home/$arch_user/.config/autostart"
  local desktop_file="$autostart_dir/frostearch-first-boot-dialog.desktop"

  sudo -u "$arch_user" mkdir -p "/home/$arch_user/.local/bin" "$autostart_dir" "$state_dir"
  sudo -u "$arch_user" cp "$markdown_file" "$message_file"
  sudo -u "$arch_user" cp "$renderer_source" "$renderer_script"
  sudo -u "$arch_user" chmod +x "$renderer_script"
  printf '%s\n' "$dialog_title" | sudo -u "$arch_user" tee "$title_file" >/dev/null

  sudo -u "$arch_user" tee "$user_script" >/dev/null <<'EOF'
#!/bin/bash
set -euo pipefail

AUTOSTART_FILE="$HOME/.config/autostart/frostearch-first-boot-dialog.desktop"
STATE_DIR="$HOME/.config/frostearch"
STATE_FILE="$STATE_DIR/first-boot-dialog-shown"
MESSAGE_FILE="$STATE_DIR/first-boot-dialog.md"
TITLE_FILE="$STATE_DIR/first-boot-dialog-title.txt"
HTML_FILE="$STATE_DIR/first-boot-dialog.html"
RENDERER_SCRIPT="$HOME/.local/bin/frostearch-render-first-boot-dialog.py"

mkdir -p "$STATE_DIR"

if [ -f "$STATE_FILE" ]; then
  rm -f "$AUTOSTART_FILE" "$0"
  exit 0
fi

TITLE="FrosteArch"
if [ -f "$TITLE_FILE" ]; then
  TITLE="$(cat "$TITLE_FILE")"
fi

if [ ! -f "$MESSAGE_FILE" ]; then
  printf '%s\n' "Welcome to FrosteArch." >"$MESSAGE_FILE"
fi

calc_dialog_size() {
  local size sw sh
  DIALOG_WIDTH=960
  DIALOG_HEIGHT=680

  if command -v xrandr >/dev/null 2>&1; then
    size="$(xrandr 2>/dev/null | awk '/\*/{print $1; exit}')"
    if [[ "$size" =~ ^([0-9]+)x([0-9]+)$ ]]; then
      sw="${BASH_REMATCH[1]}"
      sh="${BASH_REMATCH[2]}"

      DIALOG_WIDTH=$((sw * 72 / 100))
      DIALOG_HEIGHT=$((sh * 76 / 100))

      (( DIALOG_WIDTH < 760 )) && DIALOG_WIDTH=760
      (( DIALOG_WIDTH > 1320 )) && DIALOG_WIDTH=1320
      (( DIALOG_HEIGHT < 520 )) && DIALOG_HEIGHT=520
      (( DIALOG_HEIGHT > 920 )) && DIALOG_HEIGHT=920
    fi
  fi
}

calc_dialog_size

if command -v kdialog >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3 || command -v python || true)"

  if [ -n "$PYTHON_BIN" ] && [ -f "$RENDERER_SCRIPT" ] && "$PYTHON_BIN" "$RENDERER_SCRIPT" "$MESSAGE_FILE" "$HTML_FILE"; then
    HTML_CONTENT="$(cat "$HTML_FILE")"
    kdialog --title "$TITLE" --msgbox "$HTML_CONTENT" || kdialog --title "$TITLE" --textbox "$MESSAGE_FILE" "$DIALOG_WIDTH" "$DIALOG_HEIGHT" || true
  else
    kdialog --title "$TITLE" --textbox "$MESSAGE_FILE" "$DIALOG_WIDTH" "$DIALOG_HEIGHT" || true
  fi
elif command -v zenity >/dev/null 2>&1; then
  zenity --text-info --title="$TITLE" --filename="$MESSAGE_FILE" --width="$DIALOG_WIDTH" --height="$DIALOG_HEIGHT" || true
elif command -v notify-send >/dev/null 2>&1; then
  notify-send "$TITLE" "$(head -n 6 "$MESSAGE_FILE" | tr '\n' ' ')" || true
fi

touch "$STATE_FILE"
rm -f "$AUTOSTART_FILE" "$HTML_FILE" "$0"
EOF

  sudo -u "$arch_user" chmod +x "$user_script"

  sudo -u "$arch_user" tee "$desktop_file" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=FrosteArch First Boot Message
Exec=$user_script
X-KDE-autostart-after=plasma-desktop
OnlyShowIn=KDE;
EOF
}

install_theme_switcher_required() {
  local arch_user="$1"
  local profiles_source_dir="$2"
  local metadata_source_file="$3"
  local switcher_source="$4"
  local wallpapers_source_dir="$5"

  if [ ! -d "$profiles_source_dir" ]; then
    echo "Missing required theme profile directory: $profiles_source_dir"
    exit 1
  fi

  if ! find "$profiles_source_dir" -maxdepth 1 -type f -name '*.knsv' | grep -q .; then
    echo "No .knsv profiles found in required directory: $profiles_source_dir"
    exit 1
  fi

  if [ ! -f "$switcher_source" ]; then
    echo "Missing required theme switcher helper: $switcher_source"
    exit 1
  fi

  if [ ! -f "$metadata_source_file" ]; then
    echo "Missing required theme metadata file: $metadata_source_file"
    exit 1
  fi

  if [ ! -d "$wallpapers_source_dir" ]; then
    echo "Missing required wallpaper source directory: $wallpapers_source_dir"
    exit 1
  fi

  echo "Installing theme switcher..."

  local user_home="/home/$arch_user"
  local user_bin="$user_home/.local/bin"
  local user_data_dir="$user_home/.local/share/frostearch"
  local user_profiles_dir="$user_data_dir/konsave-profiles"
  local user_metadata_file="$user_data_dir/theme-profiles.json"
  local user_wallpapers_dir="$user_data_dir/wallpapers"
  local switcher_script="$user_bin/frostearch-theme-switcher"
  local app_dir="$user_home/.local/share/applications"
  local desktop_file="$app_dir/frostearch-theme-switcher.desktop"
  sudo -u "$arch_user" mkdir -p "$user_bin" "$user_profiles_dir" "$user_wallpapers_dir" "$app_dir"
  sudo -u "$arch_user" cp "$switcher_source" "$switcher_script"
  sudo -u "$arch_user" chmod +x "$switcher_script"

  sudo -u "$arch_user" find "$user_profiles_dir" -maxdepth 1 -type f -name '*.knsv' -delete
  sudo -u "$arch_user" cp "$profiles_source_dir"/*.knsv "$user_profiles_dir/"
  sudo -u "$arch_user" cp "$metadata_source_file" "$user_metadata_file"

  # Keep wallpaper assets in a stable location for the theme switcher.
  sudo -u "$arch_user" find "$user_wallpapers_dir" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -delete
  sudo -u "$arch_user" find "$wallpapers_source_dir" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -exec cp -f {} "$user_wallpapers_dir/" \;

  sudo -u "$arch_user" tee "$desktop_file" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=FrosteArch Theme Switcher
Comment=Apply a saved KDE/Konsave profile
Exec=$switcher_script
Icon=preferences-desktop-theme
Terminal=false
Categories=Settings;DesktopSettings;
EOF
}

