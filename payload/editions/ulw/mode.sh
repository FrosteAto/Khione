#!/bin/bash
set -euo pipefail

MODE_NAME="ulw"

OFFICIAL_PACKAGES=(
  xorg xfce4 greetd greetd-tuigreet gnome-keyring libsecret
  zenity
  ufw nano btop flatpak kitty thunar thunar-archive-plugin file-roller gvfs-smb smbclient fastfetch firefox sof-firmware git gparted p7zip geany
  python python-markdown python-pip python-pipx
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono ttf-jetbrains-mono-nerd
  xfce4-docklike-plugin xfce4-weather-plugin xfce4-genmon-plugin xfce4-pulseaudio-plugin
  playerctl pipewire-pulse wireplumber network-manager-applet adw-gtk-theme picom
  xfce4-screenshooter xfce4-taskmanager
)

AUR_PACKAGES=()

FLATPAK_PACKAGES=()

SERVICES_ENABLE=( NetworkManager.service greetd.service ufw.service )
SERVICES_MASK=()

FIREWALL_RULES=()

DESKTOP_ENVIRONMENT="xfce"
GREETD_SESSION_CMD="/usr/bin/startxfce4"

ROOTFS_OVERLAY_REL="editions/ulw/rootfs"
ICON_THEME_REL="YAMIS.tar.gz"

CURSOR_THEME_REL="editions/ulw/cursor/Rei-Moss-Regular.tar.gz"
CURSOR_THEME_NAME="Rei-Moss-Regular"
CURSOR_THEME_SIZE="32"

KITTY_TRANSLUCENCY_FIX_REL="editions/ulw/kitty-translucency-fix"

FIRST_BOOT_DIALOG_TITLE="Welcome to Khione ULW"
