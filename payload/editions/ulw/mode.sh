#!/bin/bash
set -euo pipefail

MODE_NAME="ulw"

OFFICIAL_PACKAGES=(
  xorg xfce4 greetd greetd-tuigreet gnome-keyring libsecret
  zenity
  ufw nano btop flatpak kitty thunar thunar-archive-plugin file-roller gvfs-smb smbclient fastfetch firefox sof-firmware git gparted p7zip
  python python-markdown python-pip python-pipx
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono ttf-jetbrains-mono-nerd
  # Deepwood rice
  xfce4-docklike-plugin xfce4-weather-plugin xfce4-genmon-plugin xfce4-pulseaudio-plugin
  playerctl pipewire-pulse wireplumber network-manager-applet adw-gtk-theme picom
)

AUR_PACKAGES=()

FLATPAK_PACKAGES=()

SERVICES_ENABLE=( NetworkManager.service greetd.service ufw.service )
SERVICES_MASK=()

FIREWALL_RULES=()

# Xfce, not Plasma: skips KWallet PAM, the Kara pager build, and the konsave
# theme switcher (none of them have an Xfce equivalent), and boots into
# startxfce4 instead of startplasma-wayland.
DESKTOP_ENVIRONMENT="xfce"
GREETD_SESSION_CMD="/usr/bin/startxfce4"

# Deepwood rice: system-wide files (now-playing script, wallpaper + its
# autostart) and the YAMIS icon theme xsettings.xml expects.
ROOTFS_OVERLAY_REL="editions/ulw/rootfs"
ICON_THEME_REL="YAMIS.tar.gz"

# Makes kitty's background_opacity actually render through picom: on GLX
# stacks that advertise sRGB but expose no sRGB-capable framebuffer configs
# (software-rendered VMs like the VBoxVGA one this rice was captured on),
# kitty silently falls back to an alpha-less 24-bit visual. See
# kitty-translucency-fix/kitty-alpha.c for the full explanation. Untested
# on GPUs with real sRGB support — see install_kitty_translucency_fix.
KITTY_TRANSLUCENCY_FIX_REL="editions/ulw/kitty-translucency-fix"

FIRST_BOOT_DIALOG_TITLE="Welcome to Khione ULW"
