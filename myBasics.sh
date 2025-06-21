#!/bin/bash
set -e

echo "Updating system and installing my basic package list."
sudo pacman -Syu --noconfirm

if ! grep -q "^\[multilib\]" /etc/pacman.conf; then
  echo "Enabling [multilib] repository."
  sudo sed -i '/#\[multilib\]/,/#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' /etc/pacman.conf
  sudo pacman -Syu --noconfirm
fi

official_packages=(
  base-devel linux-headers amd-ucode sudo git wget curl reflector openssh man-db man-pages texinfo bash-completion
  networkmanager plasma-nm
  mesa vulkan-radeon lib32-mesa lib32-vulkan-radeon libva-mesa-driver lib32-libva-mesa-driver lib32-vulkan-icd-loader multilib-devel
  plasma-meta kde-applications-meta qt5-wayland qt6-wayland xdg-desktop-portal-kde kde-cli-tools kscreen dolphin
  qt5ct qt6ct
  xdg-user-dirs
  pipewire pipewire-audio pipewire-alsa pipewire-pulse pipewire-jack wireplumber
  flatpak
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  wlr-randr
  firefox steam steam-native-runtime
  acpid tlp tlp-rdw powertop
  python python-pip python-virtualenv php composer nodejs npm docker docker-compose make cmake
  ufw
)

sudo pacman -S --noconfirm "${official_packages[@]}"

echo "Installing and building yay."
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
  tuigreet
  greetd
  discord
  spotify
  code
  wine winetricks protontricks
  lutris
  gamescope
)

echo "Installing my AUR list."
yay -S --needed --noconfirm "${aur_packages[@]}"

echo "Enabling critical services."

sudo systemctl enable NetworkManager.service
sudo systemctl enable sshd.service
sudo systemctl enable tlp.service
sudo systemctl enable cups.service
sudo systemctl enable ufw.service
sudo systemctl enable systemd-timesyncd.service
sudo systemctl enable systemd-resolved.service
sudo systemctl enable greetd.service

echo "Setting up firewall rules."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable

echo "Adding dob to docker group."
sudo usermod -aG docker "dob"

echo "Initializing user directories."
sudo xdg-user-dirs-update

echo "Adding Flathub remote."
sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

echo "Configuring greetd with tuigreet."

# Note - dob is what I call my user on every linux install, it will already exist. YMMV.
sudo tee /etc/greetd/config.toml > /dev/null <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --cmd 'dbus-run-session startplasma-wayland'"
user = "dob"
EOF

echo "Success."
