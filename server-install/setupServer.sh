#!/bin/bash
set -e

read -rp "Enter the name of your user (must already exist): " arch_user
if ! id "$arch_user" &>/dev/null; then
  echo "User '$arch_user' does not exist. Exiting."
  exit 1
fi

echo "Updating system and installing basic package list."
sudo pacman -Syu --noconfirm

if ! grep -q "^\[multilib\]" /etc/pacman.conf; then
  echo "Enabling [multilib] repository."
  sudo sed -i '/#\[multilib\]/,/#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' /etc/pacman.conf
  sudo pacman -Syu --noconfirm
fi

official_packages=(
  linux-lts linux-lts-headers linux-firmware # LTS kernel
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret # Environment
  ufw nano btop flatpak kitty dolphin # Tools
  firefox # Programs
  python python-pip python-pipx # Programming
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono # Fonts
  sof-firmware # Laptop thing
)

echo "Installing official packages."
sudo pacman -S --noconfirm "${official_packages[@]}"

echo "Installing CPU microcode (Just in case)."
if grep -q "GenuineIntel" /proc/cpuinfo; then
  sudo pacman -S --noconfirm intel-ucode
elif grep -q "AuthenticAMD" /proc/cpuinfo; then
  sudo pacman -S --noconfirm amd-ucode
else
  echo "Unknown CPU vendor, skipping microcode."
fi

pipx ensurepath
pipx install konsave
pipx inject konsave setuptools
export PATH="$HOME/.local/bin:$PATH"

echo "Installing yay (AUR helper)."
if ! command -v yay &>/dev/null; then
  git clone https://aur.archlinux.org/yay.git /tmp/yay
  pushd /tmp/yay
  makepkg -si --noconfirm
  popd
  rm -rf /tmp/yay
else
  echo "yay is already installed. Skipping."
fi

aur_packages=(
  plex-media-server
)

echo "Installing AUR packages (non-fatal on failure)."

FAILED_AUR_PKGS=()

for pkg in "${aur_packages[@]}"; do
  echo "→ Installing AUR package: $pkg"
  if yay -S --needed --noconfirm "$pkg"; then
    echo "✓ $pkg installed successfully"
  else
    echo "✗ Failed to install $pkg — skipping"
    FAILED_AUR_PKGS+=("$pkg")
  fi
done

if [ ${#FAILED_AUR_PKGS[@]} -ne 0 ]; then
  echo
  echo "⚠ The following AUR packages failed to install:"
  for pkg in "${FAILED_AUR_PKGS[@]}"; do
    echo "  - $pkg"
  done
  echo "You can try installing them manually later."
fi


echo "Enabling critical services."
sudo systemctl enable NetworkManager.service
sudo systemctl enable greetd.service
sudo systemctl enable plexmediaserver.service
sudo systemctl enable avahi-daemon.service
sudo systemctl enable ufw.service
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

echo "Configuring firewall rules."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 32400/tcp
sudo ufw allow 1900/udp
sudo ufw allow 5353/udp
sudo ufw --force enable

echo "Adding $arch_user to docker group."
sudo usermod -aG docker "$arch_user"

echo "Adding Flathub remote."
sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

echo "Configuring greetd"

sudo bash -c "cat > /etc/greetd/config.toml" <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --remember --remember-session --time --time-format '%Y-%m-%d %H:%M:%S' --width 80 --container-padding 2 --greeting 'Please enter your password.' --cmd /usr/bin/startplasma-wayland"
EOF

echo "Installing YAMIS icon theme..."

ICON_URL="https://raw.githubusercontent.com/FrosteAto/Arch-Linux-Setups/main/YAMIS.tar.gz"
DEST_DIR="/home/$arch_user/.local/share/icons"
sudo -u "$arch_user" mkdir -p "$DEST_DIR"
sudo -u "$arch_user" curl -L "$ICON_URL" -o /home/$arch_user/YAMIS.tar.gz
sudo -u "$arch_user" tar -xzf /home/$arch_user/YAMIS.tar.gz -C "$DEST_DIR"
rm /home/$arch_user/YAMIS.tar.gz
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key Theme "YAMIS"

echo "Installing cursor theme..."

CURSOR_URL="https://raw.githubusercontent.com/FrosteAto/Arch-Linux-Setups/main/server-install/miku-cursor.tar.gz"
ICON_DIR="/home/$arch_user/.local/share/icons"

sudo -u "$arch_user" mkdir -p "$ICON_DIR"
sudo -u "$arch_user" curl -L "$CURSOR_URL" -o "/home/$arch_user/MyCursor.tar.gz"
sudo -u "$arch_user" tar -xzf "/home/$arch_user/MyCursor.tar.gz" -C "$ICON_DIR"
rm "/home/$arch_user/MyCursor.tar.gz"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorTheme "Miku Cursor"
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key CursorSize 24

echo "Downloading and applying Konsave profile..."

KNSV_URL="https://github.com/FrosteAto/Arch-Linux-Setups/releases/download/Main/desktopSetup.knsv"
KNSV_PATH="/home/$arch_user/desktopSetup.knsv"
sudo -u "$arch_user" curl -L "$KNSV_URL" -o "$KNSV_PATH"
konsave -i "$KNSV_PATH"
konsave -a "desktopSetup"

echo "Cloning Arch-Linux-Setups repo and applying dotfiles..."

REPO_URL="https://github.com/FrosteAto/Arch-Linux-Setups.git"
REPO_DIR="/home/$arch_user/Arch-Linux-Setups"
DOTFILES_DIR="$REPO_DIR/desktop-install/arch-dotfiles"

# Clone repo as the user
if [ ! -d "$REPO_DIR" ]; then
  sudo -u "$arch_user" -- git clone "$REPO_URL" "$REPO_DIR"
else
  sudo -u "$arch_user" -- git -C "$REPO_DIR" pull
fi

# Ensure config directories exist
sudo -u "$arch_user" -- mkdir -p "/home/$arch_user/.config"
sudo -u "$arch_user" -- mkdir -p "/home/$arch_user/.local"

# Apply ~/.config dotfiles
for dir in kitty btop nano; do
  if [ -d "$DOTFILES_DIR/config/$dir" ]; then
    sudo -u "$arch_user" -- cp -r \
      "$DOTFILES_DIR/config/$dir" \
      "/home/$arch_user/.config/"
  fi
done

# Apply ~/.local/share dotfiles (e.g. Krita)
if [ -d "$DOTFILES_DIR/local" ]; then
  sudo -u "$arch_user" -- cp -r \
    "$DOTFILES_DIR/local/"* \
    "/home/$arch_user/.local/"
fi

echo "Dotfiles applied successfully."


echo "Setting colors..."
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorScheme "CatppuccinMocha"

echo "Configuring PAM for greetd and KWallet..."
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

sudo -u "$arch_user" kwriteconfig6 --file kdeglobals \
  --group KDE \
  --key WalletEnabled true

echo -e "Setup complete, please reboot."
