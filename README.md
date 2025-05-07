# Arch-Linux-Setup - WIP
My archive for a base arch linux install with all the bits and bobs working

Base programs to install:

- Desktop Environemnt: [Hyprland](https://hyprland.org/)
- Terminal Emulator: [Kitty](https://sw.kovidgoyal.net/kitty/)
- Notification Daemon: [Dunst](https://dunst-project.org/)
- A/V Management: [Pipewire](https://pipewire.org/) & [WirePlumber](https://pipewire.pages.freedesktop.org/wireplumber/)
- Desktop Portal: [xdg-desktop-portal-hyprland](https://github.com/hyprwm/xdg-desktop-portal-hyprland) & [xdg-desktop-portal-gtk](https://github.com/flatpak/xdg-desktop-portal-gtk)
- Authentication Toolkit: [polkit](https://wiki.archlinux.org/title/Polkit) & [hyprpolkitagent](https://archlinux.org/packages/?name=hyprpolkitagent)
- Display / Login Management: [sddm](https://wiki.archlinux.org/title/SDDM), [sddm-kcm](https://archlinux.org/packages/?name=sddm-kcm), & [qt5-declarative](https://archlinux.org/packages/?name=qt5-declarative)
- Theme Helpers: [nwg-look](https://github.com/nwg-piotr/nwg-look)

```
sudo pacman -S hyprland kitty dunst pipewire wireplumber xdg-desktop-portal-hyprland xdg-desktop-portal-gtk polkit hyprpolkitagent sddm sddm-kcm qt5-declarative nwg-look
```
Any dependencies should deal with themselves :)
