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
  xorg plasma plasma-workspace greetd greetd-tuigreet # Environment
  ufw nano btop flatpak kitty # Tools
  firefox steam krita godot obs-studio audacity blender kdenlive libreoffice gwenview mpv easyeffects calf # Programs
  python python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake git # Programming
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns # Printing
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono # Fonts
  papirus-icon-theme # Other
)

echo "Installing official packages."
sudo pacman -S --noconfirm "${official_packages[@]}"

pipx ensurepath
pipx install konsave
pipx inject konsave setuptools

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
  discord
  spotify
  visual-studio-code-bin
  wine winetricks protontricks
  lutris
  gamescope
  plex-desktop
  unityhub
  adwsteamgtk
  proton-vpn-gtk-app
  kwin-effects-forceblur
  kwin-effect-rounded-corners-git
  kwin-scripts-krohnkite-git
  lsp-plugins
)

echo "Installing AUR packages."
yay -S --needed --noconfirm "${aur_packages[@]}"

echo "Enabling critical services."
sudo systemctl enable ufw.service
sudo systemctl enable greetd.service
sudo systemctl enable NetworkManager.service

echo "Configuring firewall rules."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable

echo "Adding $arch_user to docker group."
sudo usermod -aG docker "$arch_user"

echo "Adding Flathub remote."
sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

echo "Configuring greetd"

sudo bash -c "cat > /etc/greetd/config.toml" <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --remember --remember-session --time --time-format '%Y-%m-%d %H:%M:%S' --width 80 --container-padding 2 --greeting 'It is said that God created Angels to carry his message.\nWhat will you have me transmit?' --greeting God created angels to carry his message. What will you have me transmit? --cmd /usr/bin/startplasma-wayland"
EOF

echo "Installing YAMIS icon theme..."

ICON_URL="https://raw.githubusercontent.com/FrosteAto/Arch-Linux-Setups/main/YAMIS.tar.gz"
DEST_DIR="/home/$arch_user/.local/share/icons"
sudo -u "$arch_user" mkdir -p "$DEST_DIR"
sudo -u "$arch_user" curl -L "$ICON_URL" -o /home/$arch_user/YAMIS.tar.gz
sudo -u "$arch_user" tar -xzf /home/$arch_user/YAMIS.tar.gz -C "$DEST_DIR"
rm /home/$arch_user/YAMIS.tar.gz
sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group Icons --key Theme "YAMIS"

echo "Downloading and applying Konsave profile..."

KNSV_URL="https://github.com/FrosteAto/Arch-Linux-Setups/releases/download/Main/mysetup.knsv"
KNSV_PATH="/home/$arch_user/mysetup.knsv"
sudo -u "$arch_user" curl -L "$KNSV_URL" -o "$KNSV_PATH"
sudo -u "$arch_user" konsave -i "$KNSV_PATH"
sudo -u "$arch_user" konsave -a "mysetup"

sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group General --key ColorScheme "CatppuccinMocha"

echo -e "Setup complete, please reboot."
