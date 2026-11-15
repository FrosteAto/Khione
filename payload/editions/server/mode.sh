#!/bin/bash
set -euo pipefail

MODE_NAME="server"

OFFICIAL_PACKAGES=(
  linux-lts linux-lts-headers linux-firmware
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  ufw nano btop flatpak kitty dolphin ark fastfetch firefox sof-firmware git partitionmanager 7zip
  python python-markdown python-pip python-pipx
  openssh
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  samba cockpit smartmontools
  pacman-contrib
  docker              # runs the Home Assistant container
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
  ha-rss.timer ha-rss.service
  khione-system.timer khione-system.service
  khione-disks.timer khione-disks.service
  khione-temps.timer khione-temps.service
  docker.service
  home-assistant.service
)

SERVICES_MASK=( sleep.target suspend.target hibernate.target hybrid-sleep.target samba.service )

FIREWALL_RULES=(
  22/tcp 32400/tcp 1900/udp 5353/udp
  9090/tcp        # Cockpit web UI
  137/udp 138/udp # Samba NetBIOS
  139/tcp 445/tcp # Samba SMB
  8123/tcp        # Home Assistant web UI
)

HOME_ASSISTANT_UNIT_REL="editions/server/home-assistant.service"
HA_DASHBOARD_DIR_REL="editions/server/ha-dashboard"
HA_COLLECTORS_DIR_REL="editions/server/ha-dashboard/collectors"
HA_PANELS_DIR_REL="editions/server/ha-dashboard/panels"

FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Server"

ICON_THEME_REL="YAMIS.tar.gz"
