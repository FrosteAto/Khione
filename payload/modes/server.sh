#!/bin/bash
set -euo pipefail

MODE_NAME="server"

OFFICIAL_PACKAGES=(
  linux-lts linux-lts-headers linux-firmware
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  ufw nano btop flatpak kitty dolphin ark fastfetch firefox sof-firmware git partitionmanager p7zip
  python python-markdown python-pip python-pipx
  openssh
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  samba cockpit smartmontools
)

AUR_PACKAGES=(
  plex-media-server
  wsdd                # makes the server visible in Windows Explorer's Network browser
  cockpit-file-sharing  # Samba share management GUI inside Cockpit
  cockpit-storaged      # disk/partition/RAID management GUI inside Cockpit
)

SERVICES_ENABLE=(
  NetworkManager.service
  greetd.service
  plexmediaserver.service
  avahi-daemon.service
  ufw.service
  smb.service
  nmb.service
  cockpit.socket
  smartd.service
  wsdd.service
  sshd.service
)

SERVICES_MASK=( sleep.target suspend.target hibernate.target hybrid-sleep.target samba.service )

FIREWALL_RULES=(
  22/tcp 32400/tcp 1900/udp 5353/udp
  9090/tcp        # Cockpit web UI
  137/udp 138/udp # Samba NetBIOS
  139/tcp 445/tcp # Samba SMB
)

DOTFILES_SUBDIR="themes/server/dotfiles"

FIRST_BOOT_DIALOG_TITLE="Welcome to FrosteArch Server"
FIRST_BOOT_DIALOG_MARKDOWN_REL="shared/first-boot-server.md"
