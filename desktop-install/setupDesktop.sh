#!/bin/bash
set -euo pipefail

read -rp "Enter the name of your user (must already exist): " arch_user
if ! id "$arch_user" &>/dev/null; then
  echo "User '$arch_user' does not exist. Exiting."
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

DOTFILES_DIR="$SCRIPT_DIR/arch-dotfiles"
ICON_ARCHIVE="$REPO_ROOT/YAMIS.tar.gz"
KNSV_FILE="$SCRIPT_DIR/desktopSetup.knsv"
CURSOR_ARCHIVE="$SCRIPT_DIR/Ninomae-Ina-nis.tar.gz"

echo "Updating system..."
sudo pacman -Syu --noconfirm

if ! grep -q "^\[multilib\]" /etc/pacman.conf; then
  echo "Enabling [multilib]..."
  sudo sed -i '/#\[multilib\]/,/#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' /etc/pacman.conf
  sudo pacman -Syu --noconfirm
fi

official_packages=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  ufw nano btop flatpak kitty dolphin
  firefox steam krita godot obs-studio audacity blender kdenlive libreoffice gwenview mpv easyeffects calf darktable anki
  python python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  libinput libwacom wacomtablet xf86-input-wacom
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  sof-firmware
)

echo "Installing official packages..."
sudo pacman -S --needed --noconfirm "${official_packages[@]}"

echo "Installing yay..."
if ! command -v yay &>/dev/null; then
  sudo -u "$arch_user" git clone https://aur.archlinux.org/yay.git /tmp/yay
  pushd /tmp/yay >/dev/null
  sudo -u "$arch_user" makepkg -si --noconfirm
  popd >/dev/null
  rm -rf /tmp/yay
fi

aur_packages=(
  discord spotify visual-studio-code-bin
  wine winetricks protontricks
  lutris gamescope plex-desktop unityhub adwsteamgtk proton-vpn-gtk-app
  kwin-effects-forceblur kwin-effect-rounded-corners-git kwin-scripts-krohnkite-git
  lsp-plugins hayase-desktop-bin input-wacom-dkms-git
)

echo "Installing AUR packages..."
FAILED_AUR_PKGS=()
for pkg in "${aur_packages[@]}"; do
  echo "→ $pkg"
  if sudo -u "$arch_user" yay -S --needed --noconfirm "$pkg"; then
    :
  else
    FAILED_AUR_PKGS+=("$pkg")
  fi
done

if [ ${#FAILED_AUR_PKGS[@]} -ne 0 ]; then
  echo "AUR failures:"
  printf ' - %s\n' "${FAILED_AUR_PKGS[@]}"
fi

echo "Enabling services..."
sudo systemctl enable ufw.service
sudo systemctl enable greetd.service
sudo systemctl enable NetworkManager.service

echo "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw --force enable

echo "Adding user to docker group..."
sudo usermod -aG docker "$arch_user"

echo "Adding Flathub..."
sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

echo "Configuring greetd..."
sudo tee /etc/greetd/config.toml >/dev/null <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --remember --remember-session --time --time-format '%Y-%m-%d %H:%M:%S' --width 80 --container-padding 2 --greeting 'Please enter your password.' --cmd /usr/bin/startplasma-wayland"
EOF

echo "Installing icon theme..."
if [ ! -f "$ICON_ARCHIVE" ]; then
  echo "Missing: $ICON_ARCHIVE"
  exit 1
fi
DEST_DIR="/home/$arch_user/.local/share/icons"
sudo -u "$arch_user" mkdir -p "$DEST_DIR"
sudo -u "$arch_user" tar -xzf "$ICON_ARCHIVE" -C "$DEST_DIR"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key Theme "YAMIS"

echo "Installing cursor theme..."
if [ ! -f "$CURSOR_ARCHIVE" ]; then
  echo "Missing: $CURSOR_ARCHIVE"
  exit 1
fi
ICON_DIR="/home/$arch_user/.local/share/icons"
sudo -u "$arch_user" mkdir -p "$ICON_DIR"
sudo -u "$arch_user" tar -xzf "$CURSOR_ARCHIVE" -C "$ICON_DIR"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorTheme "Ninomae Ina'nis"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorSize 24


echo "Applying Konsave..."
if [ ! -f "$KNSV_FILE" ]; then
  echo "Missing: $KNSV_FILE"
  exit 1
fi
sudo -u "$arch_user" pipx install --force konsave
KONSAVE_BIN="/home/$arch_user/.local/bin/konsave"
sudo -u "$arch_user" "$KONSAVE_BIN" -i "$KNSV_FILE"
sudo -u "$arch_user" "$KONSAVE_BIN" -a "desktopSetup"

echo "Applying dotfiles..."
sudo -u "$arch_user" mkdir -p "/home/$arch_user/.config" "/home/$arch_user/.local"

for dir in kitty btop nano; do
  [ -d "$DOTFILES_DIR/config/$dir" ] || continue
  sudo -u "$arch_user" cp -r "$DOTFILES_DIR/config/$dir" "/home/$arch_user/.config/"
done

if [ -d "$DOTFILES_DIR/local" ]; then
  sudo -u "$arch_user" cp -r "$DOTFILES_DIR/local/"* "/home/$arch_user/.local/"
fi

echo "Setting colors..."
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorScheme "CatppuccinMocha"

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

sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group KDE --key WalletEnabled true

echo "Setup complete, please reboot."
