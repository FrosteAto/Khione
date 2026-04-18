#!/bin/bash
set -euo pipefail

# Run the real installer (interactive)
bash /root/installer/install.sh

# Disable and delete itself if successful
systemctl disable frostearch-firstboot.service || true
rm -f /etc/systemd/system/frostearch-firstboot.service
rm -f /usr/local/bin/frostearch-firstboot
systemctl daemon-reload || true