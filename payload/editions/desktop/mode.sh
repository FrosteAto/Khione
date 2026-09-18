#!/bin/bash
set -euo pipefail

MODE_NAME="desktop"

OFFICIAL_PACKAGES=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  ufw nano btop fastfetch flatpak kitty dolphin
  firefox steam krita godot obs-studio audacity elisa blender kdenlive libreoffice gwenview mpv easyeffects calf darktable anki
  python python-markdown python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake git archiso partitionmanager
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  libinput libwacom wacomtablet xf86-input-wacom
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  sof-firmware
  wine wine-mono wine-gecko winetricks p7zip
  realtime-privileges
  lib32-pipewire lib32-libpulse lib32-alsa-lib lib32-alsa-plugins
  vulkan-radeon lib32-vulkan-radeon xf86-video-amdgpu
  gimp inkscape carla ark qbittorrent prismlauncher protontricks
)

AUR_PACKAGES=(
  discord spotify visual-studio-code-bin
  gamescope unityhub adwsteamgtk proton-vpn-gtk-app
  kwin-effects-forceblur kwin-effect-rounded-corners-git kwin-scripts-krohnkite-git
  lsp-plugins hayase-desktop-bin input-wacom-dkms-git
  spicetify-cli konsave
  # tone3000-plugin disabled: its AUR build compiles a JUCE/Eigen-heavy plugin
  # (NeuralAmpModelerCore) that is extremely slow and RAM-hungry, and can look
  # like a hung installer on modest hardware. Re-enable once a prebuilt
  # package or a lighter build path is available.
)

FLATPAK_PACKAGES=(
  com.usebottles.bottles
)

SERVICES_ENABLE=( ufw.service greetd.service NetworkManager.service )
SERVICES_MASK=()

FIREWALL_RULES=()

FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Desktop"

SETUP_AUDIO_PRODUCTION=true
