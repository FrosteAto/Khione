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
CURSOR_ARCHIVE="$SCRIPT_DIR/miku-cursor.tar.xz"
KNSV_FILE="$SCRIPT_DIR/serverSetup.knsv"

echo "Updating system..."
sudo pacman -Syu --noconfirm

if ! grep -q "^\[multilib\]" /etc/pacman.conf; then
  sudo sed -i '/#\[multilib\]/,/#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' /etc/pacman.conf
  sudo pacman -Syu --noconfirm
fi

official_packages=(
  linux-lts linux-lts-headers linux-firmware
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  ufw nano btop flatpak kitty dolphin ark fastfetch firefox sof-firmware
  python python-pip python-pipx
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
)

echo "Installing official packages..."
sudo pacman -S --needed --noconfirm "${official_packages[@]}"

echo "Installing CPU microcode..."
if grep -q "GenuineIntel" /proc/cpuinfo; then
  sudo pacman -S --needed --noconfirm intel-ucode
elif grep -q "AuthenticAMD" /proc/cpuinfo; then
  sudo pacman -S --needed --noconfirm amd-ucode
fi

echo "Installing yay..."
if ! command -v yay &>/dev/null; then
  sudo -u "$arch_user" git clone https://aur.archlinux.org/yay.git /tmp/yay
  pushd /tmp/yay >/dev/null
  sudo -u "$arch_user" makepkg -si --noconfirm
  popd >/dev/null
  rm -rf /tmp/yay
fi

aur_packages=(
  plex-media-server
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
sudo systemctl enable NetworkManager.service
sudo systemctl enable greetd.service
sudo systemctl enable plexmediaserver.service
sudo systemctl enable avahi-daemon.service
sudo systemctl enable ufw.service
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

echo "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 32400/tcp
sudo ufw allow 1900/udp
sudo ufw allow 5353/udp
sudo ufw --force enable

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
sudo -u "$arch_user" tar -xJf "$CURSOR_ARCHIVE" -C "$ICON_DIR"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorTheme "Miku Cursor"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorSize 24

echo "Applying Konsave..."
if [ ! -f "$KNSV_FILE" ]; then
  echo "Missing: $KNSV_FILE"
  exit 1
fi
sudo -u "$arch_user" pipx install --force konsave
KONSAVE_BIN="/home/$arch_user/.local/bin/konsave"
sudo -u "$arch_user" "$KONSAVE_BIN" -i "$KNSV_FILE"
sudo -u "$arch_user" "$KONSAVE_BIN" -a "serverSetup"

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
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorScheme "Miku"

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
