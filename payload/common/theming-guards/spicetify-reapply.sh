#!/bin/bash
set -e
# pacman resets /opt/spotify back to root-owned mode 755 on every spotify
# package upgrade, which is exactly why this hook exists -- chmod again
# before reapplying, same fix as the initial install-time setup.
chmod a+rw /opt/spotify
chmod -R a+rw /opt/spotify/Apps
runuser -u @@ARCH_USER@@ -- spicetify backup apply
