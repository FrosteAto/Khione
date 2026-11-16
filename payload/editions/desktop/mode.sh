#!/bin/bash
set -euo pipefail

MODE_NAME="desktop"

OFFICIAL_PACKAGES=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  curl unzip
  ufw nano btop fastfetch flatpak kitty dolphin
  firefox steam krita godot obs-studio audacity elisa blender kdenlive libreoffice gwenview mpv easyeffects calf darktable anki
  python python-markdown python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake git archiso partitionmanager
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  libinput libwacom xf86-input-wacom
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  sof-firmware
  wine wine-mono wine-gecko winetricks 7zip
  realtime-privileges
  lib32-pipewire lib32-libpulse lib32-alsa-lib lib32-alsa-plugins
  vulkan-radeon lib32-vulkan-radeon xf86-video-amdgpu
  gimp inkscape carla ark qbittorrent prismlauncher protontricks
  arch-audit informant audit
)

AUR_PACKAGES=(
  discord betterdiscord-installer-bin betterdiscordctl spotify visual-studio-code-bin
  gamescope unityhub adwsteamgtk proton-vpn-gtk-app
  kwin-effects-forceblur kwin-effect-rounded-corners-git kwin-scripts-krohnkite-git
  lsp-plugins hayase-desktop-bin input-wacom-dkms-git
  spicetify-cli konsave
  # tone3000-plugin disabled: slow install
  aide
)

FLATPAK_PACKAGES=(
  com.usebottles.bottles
)

SERVICES_ENABLE=( ufw.service greetd.service NetworkManager.service )
SERVICES_MASK=()

FIREWALL_RULES=()

FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Desktop"

SETUP_AUDIO_PRODUCTION=true
SETUP_THEMING_GUARDS=true
ICON_THEME_REL="YAMIS.tar.gz"

# No fail2ban/CrowdSec/apparmor here -- no sshd on this edition to
# protect, and AppArmor's documented systemd-boot+UKI+Secure-Boot boot
# risk can't be ruled out on hardware this installer doesn't control
# the way it could be confirmed safe on the server. AIDE/auditd/sysctls/
# pam_faillock/the update timer/the GRUB password all still apply --
# generic hardening, not tied to running an exposed service.
SETUP_SECURITY_HARDENING="true"
FIM_SCOPE="system-only"
