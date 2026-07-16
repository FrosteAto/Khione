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
  pacman-contrib
  docker              # runs the Home Assistant container
)

AUR_PACKAGES=(
  plex-media-server
  wsdd                # makes the server visible in Windows Explorer's Network browser
  cockpit-file-sharing  # Samba share management GUI inside Cockpit
  cockpit-storaged      # disk/partition/RAID management GUI inside Cockpit
  glance-bin            # self-hosted dashboard (feeds, weather, widgets)
  librespeed-cli-bin    # dashboard speed test (open-source, unlike speedtest-cli)
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
  glance.service
  glance-speedtest.timer
  glance-disks.timer glance-disks.service
  glance-bank.timer glance-bank.service glance-bank.path
  glance-hass.timer glance-hass.service
  glance-system.timer glance-system.service
  glance-meals.timer glance-meals.service
  glance-weight.service
  glance-temps.timer glance-temps.service
  docker.service
  home-assistant.service
)

SERVICES_MASK=( sleep.target suspend.target hibernate.target hybrid-sleep.target samba.service )

FIREWALL_RULES=(
  22/tcp 32400/tcp 1900/udp 5353/udp
  9090/tcp        # Cockpit web UI
  8081/tcp        # Glance weigh-in endpoint
  137/udp 138/udp # Samba NetBIOS
  139/tcp 445/tcp # Samba SMB
  8080/tcp        # Glance dashboard
  8123/tcp        # Home Assistant web UI
)

DOTFILES_SUBDIR="themes/server/dotfiles"
GLANCE_CONFIG_REL="shared/glance.yml"
GLANCE_HELPERS_REL="shared/glance-helpers"
HOME_ASSISTANT_UNIT_REL="shared/home-assistant.service"

FIRST_BOOT_DIALOG_TITLE="Welcome to FrosteArch Server"
FIRST_BOOT_DIALOG_MARKDOWN_REL="shared/first-boot-server.md"
