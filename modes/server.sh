#!/bin/bash
set -euo pipefail

MODE_NAME="server"

OFFICIAL_PACKAGES=(
  linux-lts linux-lts-headers linux-firmware
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  ufw nano btop flatpak kitty dolphin ark fastfetch firefox sof-firmware git
  python python-pip python-pipx
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
)

AUR_PACKAGES=( plex-media-server )

SERVICES_ENABLE=(
  NetworkManager.service
  greetd.service
  plexmediaserver.service
  avahi-daemon.service
  ufw.service
)

SERVICES_MASK=( sleep.target suspend.target hibernate.target hybrid-sleep.target )

FIREWALL_RULES=( 32400/tcp 1900/udp 5353/udp )

DOTFILES_SUBDIR="server-install/arch-dotfiles"

KNSV_REL="server-install/serverSetup.knsv"
KNSV_NAME="serverSetup"

COLOR_SCHEME="Miku"

ICON_ARCHIVE_REL="YAMIS.tar.gz"

CURSOR_ARCHIVE_REL="server-install/miku-cursor.tar.xz"
CURSOR_ARCHIVE_TYPE="xz"
CURSOR_THEME_NAME="Miku Cursor"
CURSOR_SIZE="24"
