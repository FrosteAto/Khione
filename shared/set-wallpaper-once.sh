#!/bin/bash
set -euo pipefail

WALLPAPER="$HOME/.local/share/wallpapers/Ina1/wallpaper.jpg"
[ -f "$WALLPAPER" ] || exit 0

qdbus org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "
var allDesktops = desktops();
for (i=0;i<allDesktops.length;i++) {
  d = allDesktops[i];
  d.wallpaperPlugin = 'org.kde.image';
  d.currentConfigGroup = Array('Wallpaper', 'org.kde.image', 'General');
  d.writeConfig('Image', 'file://$WALLPAPER');
}
"

rm -f "$HOME/.config/autostart/set-wallpaper-once.desktop"
rm -f "$0"
