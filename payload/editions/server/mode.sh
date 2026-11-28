#!/bin/bash
set -euo pipefail

MODE_NAME="server"

OFFICIAL_PACKAGES=(
  linux-lts linux-lts-headers linux-firmware
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  ufw nano btop flatpak kitty dolphin ark fastfetch firefox sof-firmware git partitionmanager 7zip wget unzip
  python python-markdown python-pip python-pipx
  openssh
  avahi nss-mdns
  noto-fonts noto-fonts-cjk noto-fonts-emoji ttf-dejavu ttf-jetbrains-mono
  samba cockpit smartmontools
  pacman-contrib
  arch-audit          # feeds khione-system's security_updates/security_detail attributes AND the daily CVE-check timer
  docker              # runs the Home Assistant container
  fail2ban audit informant
  sqlite              # sqlite3 CLI -- khione-security reads fail2ban's own ban-history db with it
)

AUR_PACKAGES=(
  plex-media-server
  wsdd                # makes the server visible in Windows Explorer's Network browser
  cockpit-file-sharing  # Samba share management GUI inside Cockpit
  cockpit-storaged      # disk/partition/RAID management GUI inside Cockpit
  aide crowdsec crowdsec-firewall-bouncer-nftables
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
  khione-security.timer khione-security.service
  khione-netwatch.timer khione-netwatch.service
  khione-patching.timer khione-patching.service
  khione-netnoise.timer khione-netnoise.service
  khione-action-update-official.path
  khione-action-update-aur.path
  khione-action-aide-accept.path
  khione-action-shutdown.path
  docker.service
  home-assistant.service
)

SERVICES_MASK=( sleep.target suspend.target hibernate.target hybrid-sleep.target samba.service )

# SSH is rate-limited (not just allowed) by configure_firewall; discovery
# protocols (SSDP/mDNS) are link-local broadcast and not meaningfully
# scopeable by source subnet, so they stay here too.
FIREWALL_RULES=( 22/tcp 1900/udp 5353/udp )

# Scoped to the LAN subnet instead of the whole internet -- Plex was
# reachable from anywhere when this project's Nov 2026 incident happened,
# and Cockpit/HA/Samba have no legitimate reason to be internet-facing
# either. Plex's Remote Access is meant to come back on deliberately once
# upstream ships a fix for the vulnerability that caused the incident --
# this rule is what makes that safe to do: it holds regardless of Plex's
# own Remote Access setting, so re-enabling it there doesn't reopen the
# server to the internet the way it did before.
FIREWALL_RULES_LAN=(
  32400/tcp       # Plex
  9090/tcp        # Cockpit web UI
  137/udp 138/udp # Samba NetBIOS
  139/tcp 445/tcp # Samba SMB
  8123/tcp        # Home Assistant web UI
)

SETUP_SECURITY_HARDENING="true"
# "cockpit" has no fail2ban filter shipped for it anywhere -- the one
# configure_fail2ban writes for it was built and verified against this
# server's own real journal (triggered real failed logins, checked the
# actual PAM log lines, validated the regex with fail2ban-regex), not
# guessed.
FAIL2BAN_JAILS=( sshd cockpit )
# Where the Plex2Shell incident's payload actually landed -- watched by
# both AIDE (daily diff) and auditd (write/attribute-change alerts),
# never excluded by configure_file_integrity_monitoring's noise filters.
FIM_EXTRA_WATCH=( "/var/lib/plex/Plex Media Server/Codecs" "/var/lib/plex/Plex Media Server/Plug-in Support" )
AUDITD_EXTRA_WATCH=( "/var/lib/plex/Plex Media Server/Codecs" "/var/lib/plex/Plex Media Server/Plug-in Support" )
# plex-media-server is AUR-only, so the official-repo-only auto-update
# timer above never sees it -- it was the literal entry point for the
# incident this hardening pass responds to, so it gets its own notify.
AUR_UPDATE_CHECKS=( plex-media-server )

HOME_ASSISTANT_UNIT_REL="editions/server/home-assistant.service"
HA_DASHBOARD_DIR_REL="editions/server/ha-dashboard"
HA_COLLECTORS_DIR_REL="editions/server/ha-dashboard/collectors"
HA_PANELS_DIR_REL="editions/server/ha-dashboard/panels"

FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Server"

ICON_THEME_REL="YAMIS.tar.gz"
