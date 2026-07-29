#!/bin/bash
set -euo pipefail

MODE_NAME="node"

OFFICIAL_PACKAGES=(
  linux-lts linux-lts-headers linux-firmware
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  ufw nano btop flatpak kitty dolphin fastfetch firefox sof-firmware git partitionmanager p7zip
  python python-markdown python-pip python-pipx
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
)

AUR_PACKAGES=()

SERVICES_ENABLE=( NetworkManager.service greetd.service ufw.service )
SERVICES_MASK=( sleep.target suspend.target hibernate.target hybrid-sleep.target )

FIREWALL_RULES=()

DOTFILES_SUBDIR="themes/node/dotfiles"

FIRST_BOOT_DIALOG_TITLE="Welcome to FrosteArch Node"
FIRST_BOOT_DIALOG_MARKDOWN_REL="shared/first-boot-node.md"
