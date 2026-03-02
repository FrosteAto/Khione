#!/bin/bash
set -euo pipefail

# Run the real installer (interactive)
bash /root/installer/install.sh

# Disable and delete itself if successful
systemctl disable arch-linux-setups-firstboot.service || true
rm -f /etc/systemd/system/arch-linux-setups-firstboot.service
rm -f /usr/local/bin/arch-linux-setups-firstboot
systemctl daemon-reload || true