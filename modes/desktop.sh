#!/bin/bash
set -euo pipefail

MODE_NAME="desktop"

OFFICIAL_PACKAGES=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  ufw nano btop flatpak kitty dolphin
  firefox steam krita godot obs-studio audacity blender kdenlive libreoffice gwenview mpv easyeffects calf darktable anki
  python python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake git
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  libinput libwacom wacomtablet xf86-input-wacom
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  sof-firmware
)

AUR_PACKAGES=(
  discord spotify visual-studio-code-bin
  wine winetricks protontricks
  lutris gamescope plex-desktop unityhub adwsteamgtk proton-vpn-gtk-app
  kwin-effects-forceblur kwin-effect-rounded-corners-git kwin-scripts-krohnkite-git
  lsp-plugins hayase-desktop-bin input-wacom-dkms-git
)

SERVICES_ENABLE=( ufw.service greetd.service NetworkManager.service )
SERVICES_MASK=()

FIREWALL_RULES=()

DOTFILES_SUBDIR="desktop-install/arch-dotfiles"

KNSV_REL="desktop-install/desktopSetup.knsv"
KNSV_NAME="desktopSetup"

COLOR_SCHEME="CatppuccinMocha"

ICON_ARCHIVE_REL="YAMIS.tar.gz"

# Optional cursor for desktop
CURSOR_ARCHIVE_REL="desktop-install/Ninomae-Ina-nis.tar.gz"
CURSOR_ARCHIVE_TYPE="gz"
CURSOR_THEME_NAME="Ninomae Ina'nis"
CURSOR_SIZE="24"
