#!/bin/bash
set -e

read -rp "Enter the name of your user (must already exist): " arch_user
if ! id "$arch_user" &>/dev/null; then
  echo "❌ User '$arch_user' does not exist. Exiting."
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
  base-devel linux-headers sudo git wget curl reflector openssh man-db man-pages texinfo bash-completion
  networkmanager plasma-nm
  multilib-devel
  plasma-meta kde-applications-meta qt5-wayland qt6-wayland xdg-desktop-portal-kde kde-cli-tools kscreen dolphin
  qt5ct qt6ct
  xdg-user-dirs
  pipewire pipewire-audio pipewire-alsa pipewire-pulse pipewire-jack wireplumber
  flatpak
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  wlr-randr
  firefox steam
  acpid
  python python-pip python-virtualenv php composer nodejs npm docker docker-compose make cmake
  ufw
)

echo "Select CPU type:"
echo "  0 = AMD"
echo "  1 = Intel"
read -rp "Enter number [0/1]: " cpu_choice

microcode=""
gpu_packages=()

case "$cpu_choice" in
  0)
    microcode="amd-ucode"
    gpu_packages=(
      mesa vulkan-radeon lib32-mesa lib32-vulkan-radeon
      libva-mesa-driver lib32-libva-mesa-driver lib32-vulkan-icd-loader
    )
    ;;
  1)
    microcode="intel-ucode"
    gpu_packages=(
      mesa vulkan-intel libva-intel-driver intel-media-driver
      lib32-mesa lib32-vulkan-intel
    )
    ;;
  *)
    echo "Invalid input. Please enter 0 or 1."
    exit 1
    ;;
esac

official_packages=("$microcode" "${gpu_packages[@]}" "${official_packages[@]}")

echo "Installing official packages."
sudo pacman -S --noconfirm "${official_packages[@]}"

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
  greetd
  tuigreet
  discord
  spotify
  code
  wine winetricks protontricks
  lutris
  gamescope
)

echo "Installing AUR packages."
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

echo "Configuring firewall rules."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable

echo "Adding $arch_user to docker group."
sudo usermod -aG docker "$arch_user"

echo "Initializing user directories for $arch_user."
sudo -u "$arch_user" xdg-user-dirs-update

echo "Adding Flathub remote."
sudo flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

echo "Configuring greetd with tuigreet for $arch_user."
sudo tee /etc/greetd/config.toml > /dev/null <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --cmd 'dbus-run-session startplasma-wayland'"
user = "$arch_user"
EOF

echo -e "\e[1;32m✅ Setup complete. Reboot and enjoy your system!\e[0m"
