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
  xorg plasma plasma-workspace greetd greetd-tuigreet // Environment
  ufw nano btop flatpak kitty // Tools
  firefox steam krita godot obs-studio audacity blender kdenlive libreoffice gwenview mpv // Programs
  python python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake git // Programming
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns // Printing
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono // Fonts
  papirus-icon-theme // Other
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

echo -e "Setup complete, please reboot."
