#!/bin/bash
set -euo pipefail

# Run the real installer (interactive)
bash /root/installer/install.sh

# Disable and delete itself if successful
systemctl disable khione-firstboot.service || true
rm -f /etc/systemd/system/khione-firstboot.service
rm -f /usr/local/bin/khione-firstboot
systemctl daemon-reload || true