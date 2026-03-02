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

  ICON_ARCHIVE="$repo_root/$ICON_ARCHIVE_REL"
  DOTFILES_DIR="$repo_root/$DOTFILES_SUBDIR"
  KNSV_FILE="$repo_root/$KNSV_REL"

  if [ -n "${CURSOR_ARCHIVE_REL:-}" ]; then
    CURSOR_ARCHIVE="$repo_root/$CURSOR_ARCHIVE_REL"
  else
    CURSOR_ARCHIVE=""
  fi

  USER_HOME="/home/$arch_user"
  USER_CONFIG="$USER_HOME/.config"
  USER_LOCAL="$USER_HOME/.local"
  USER_ICONS="$USER_LOCAL/share/icons"
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
  echo "Installing yay..."
  if command -v yay &>/dev/null; then
    return 0
  fi
  sudo -u "$arch_user" git clone https://aur.archlinux.org/yay.git /tmp/yay
  pushd /tmp/yay >/dev/null
  sudo -u "$arch_user" makepkg -si --noconfirm
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
  echo "Configuring firewall..."
  sudo pacman -S --needed --noconfirm ufw
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  for r in "${rules[@]}"; do
    sudo ufw allow "$r"
  done
  sudo ufw --force enable
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
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorScheme "$scheme"
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

