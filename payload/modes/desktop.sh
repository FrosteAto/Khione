#!/bin/bash
set -euo pipefail

MODE_NAME="desktop"

OFFICIAL_PACKAGES=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  ufw nano btop flatpak kitty dolphin
  firefox steam krita godot obs-studio audacity blender kdenlive libreoffice gwenview mpv easyeffects calf darktable anki
  python python-markdown python-pip python-pipx python-virtualenv php composer nodejs npm docker docker-compose make cmake git archiso
  cups cups-pdf print-manager sane skanlite hplip avahi nss-mdns
  libinput libwacom wacomtablet xf86-input-wacom
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  sof-firmware
)

AUR_PACKAGES=(
  discord spotify visual-studio-code-bin
  bottles gamescope unityhub adwsteamgtk proton-vpn-gtk-app
  kwin-effects-forceblur kwin-effect-rounded-corners-git kwin-scripts-krohnkite-git
  lsp-plugins hayase-desktop-bin input-wacom-dkms-git
)

SERVICES_ENABLE=( ufw.service greetd.service NetworkManager.service )
SERVICES_MASK=()

FIREWALL_RULES=()

DOTFILES_SUBDIR="themes/desktop/dotfiles"

FIRST_BOOT_DIALOG_TITLE="Welcome to FrosteArch Desktop"
FIRST_BOOT_DIALOG_MARKDOWN_REL="shared/first-boot-desktop.md"
