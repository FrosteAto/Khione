# Desktop Wayland KDE Arch Setup
My install list for a fully working desktop setup with all the programs I need. Assumes AMD CPU & GPU.

Find as separate bash script.

### Base System Tools
- [`base-devel`](https://archlinux.org/packages/core/x86_64/base-devel/) — Essential build tools
- [`linux-headers`](https://archlinux.org/packages/core/x86_64/linux-headers/) — Kernel headers for building modules
- [`amd-ucode`](https://archlinux.org/packages/extra/any/amd-ucode/) — AMD CPU microcode
- [`sudo`](https://archlinux.org/packages/core/x86_64/sudo/) — Superuser privileges
- [`git`](https://archlinux.org/packages/extra/x86_64/git/) — Git version control
- [`wget`](https://archlinux.org/packages/core/x86_64/wget/) — File downloader
- [`curl`](https://archlinux.org/packages/core/x86_64/curl/) — Data transfer tool
- [`reflector`](https://archlinux.org/packages/community/any/reflector/) — Mirrorlist updater
- [`openssh`](https://archlinux.org/packages/core/x86_64/openssh/) — SSH server/client
- [`man-db`](https://archlinux.org/packages/core/x86_64/man-db/) — Manual pages
- [`man-pages`](https://archlinux.org/packages/core/any/man-pages/) — POSIX man pages
- [`texinfo`](https://archlinux.org/packages/core/x86_64/texinfo/) — Info documentation
- [`bash-completion`](https://archlinux.org/packages/extra/any/bash-completion/) — CLI auto-completion
- [`xdg-user-dirs`](https://archlinux.org/packages/extra/x86_64/xdg-user-dirs/) — Manage standard user directories

### Networking
- [`networkmanager`](https://archlinux.org/packages/extra/x86_64/networkmanager/) — Network manager
- [`plasma-nm`](https://archlinux.org/packages/extra/x86_64/plasma-nm/) — GUI tray for connections

### AMD GPU & Wayland Graphics
- [`mesa`](https://archlinux.org/packages/extra/x86_64/mesa/) — OpenGL drivers
- [`vulkan-radeon`](https://archlinux.org/packages/extra/x86_64/vulkan-radeon/) — Vulkan support for AMD
- [`lib32-mesa`](https://archlinux.org/packages/multilib/x86_64/lib32-mesa/) — 32-bit OpenGL
- [`lib32-vulkan-radeon`](https://archlinux.org/packages/multilib/x86_64/lib32-vulkan-radeon/) — 32-bit Vulkan
- [`libva-mesa-driver`](https://archlinux.org/packages/extra/x86_64/libva-mesa-driver/) — VA-API video accel
- [`lib32-libva-mesa-driver`](https://archlinux.org/packages/multilib/x86_64/lib32-libva-mesa-driver/) — 32-bit VA-API

### Development Libraries (Multilib)
- [`multilib-devel`](https://archlinux.org/packages/multilib/x86_64/multilib-devel/) — Development files for multilib 32-bit libraries

### KDE Plasma (Wayland)
- [`plasma-meta`](https://archlinux.org/packages/extra/x86_64/plasma-meta/) — KDE Plasma desktop (meta)
- [`kde-applications-meta`](https://archlinux.org/packages/extra/x86_64/kde-applications-meta/) — KDE apps suite
- [`qt5-wayland`](https://archlinux.org/packages/extra/x86_64/qt5-wayland/) — Qt5 Wayland support
- [`qt6-wayland`](https://archlinux.org/packages/extra/x86_64/qt6-wayland/) — Qt6 Wayland support
- [`xdg-desktop-portal-kde`](https://archlinux.org/packages/extra/x86_64/xdg-desktop-portal-kde/) — KDE portal backend
- [`kde-cli-tools`](https://archlinux.org/packages/extra/x86_64/kde-cli-tools/) — Command-line KDE tools
- [`kscreen`](https://archlinux.org/packages/extra/x86_64/kscreen/) — Display configuration GUI
- [`dolphin`](https://archlinux.org/packages/extra/x86_64/dolphin/) — KDE file manager
- [`qt5ct`](https://archlinux.org/packages/community/x86_64/qt5ct/) — Qt5 configuration tool
- [`qt6ct`](https://archlinux.org/packages/community/x86_64/qt6ct/) — Qt6 configuration tool

### Audio (PipeWire)
- [`pipewire`](https://archlinux.org/packages/extra/x86_64/pipewire/) — Audio/video server
- [`pipewire-audio`](https://archlinux.org/packages/extra/x86_64/pipewire-audio/) — PipeWire audio
- [`pipewire-alsa`](https://archlinux.org/packages/extra/x86_64/pipewire-alsa/) — ALSA compatibility
- [`pipewire-pulse`](https://archlinux.org/packages/extra/x86_64/pipewire-pulse/) — PulseAudio compatibility
- [`pipewire-jack`](https://archlinux.org/packages/extra/x86_64/pipewire-jack/) — JACK compatibility
- [`wireplumber`](https://archlinux.org/packages/extra/x86_64/wireplumber/) — Session manager for PipeWire

### Login Manager
- [`greetd`](https://aur.archlinux.org/packages/greetd) — Wayland login manager *(AUR)*
- [`tuigreet`](https://aur.archlinux.org/packages/tuigreet) — TUI greeter for greetd *(AUR)*

### Flatpak
- [`flatpak`](https://archlinux.org/packages/extra/x86_64/flatpak/) — Flatpak package system

### Printing & Scanning
- [`cups`](https://archlinux.org/packages/extra/x86_64/cups/) — Printing system
- [`cups-pdf`](https://archlinux.org/packages/community/x86_64/cups-pdf/) — Print to PDF
- [`print-manager`](https://archlinux.org/packages/extra/x86_64/print-manager/) — GTK printer configuration
- [`sane`](https://archlinux.org/packages/extra/x86_64/sane/) — Scanner libraries
- [`skanlite`](https://archlinux.org/packages/extra/x86_64/skanlite/) — Scanner frontend
- [`hplip`](https://archlinux.org/packages/extra/x86_64/hplip/) — HP printer/scanner support
- [`avahi`](https://archlinux.org/packages/extra/x86_64/avahi/) — mDNS/DNS-SD
- [`nss-mdns`](https://archlinux.org/packages/extra/x86_64/nss-mdns/) — Hostname resolution

### Multi-Monitor 
- [`wlr-randr`](https://archlinux.org/packages/community/x86_64/wlr-randr/) — Wayland randr CLI

### My Daily Use Stuff
- [`firefox`](https://archlinux.org/packages/extra/x86_64/firefox/) — Its literally firefox
- [`discord`](https://aur.archlinux.org/packages/discord) — Chat and voice communication app *(AUR)*
- [`steam`](https://archlinux.org/packages/extra/x86_64/steam/) — Gaming platform and launcher
- [`spotify`](https://aur.archlinux.org/packages/spotify) — Music streaming client *(AUR)*

### Wine & Proton
- [`wine`](https://archlinux.org/packages/extra/x86_64/wine/) — Windows compatibility layer
- [`winetricks`](https://archlinux.org/packages/community/x86_64/winetricks/) — Helper scripts for Wine
- [`protontricks`](https://aur.archlinux.org/packages/protontricks) — Helper for Proton Steam (AUR)

### Laptop Stuff
- [`acpid`](https://archlinux.org/packages/core/x86_64/acpid/) — ACPI event daemon
- [`tlp`](https://archlinux.org/packages/community/x86_64/tlp/) — Power saving tools
- [`tlp-rdw`](https://archlinux.org/packages/community/x86_64/tlp-rdw/) — Radio device wizard
- [`powertop`](https://archlinux.org/packages/community/x86_64/powertop/) — Power usage analyzer

### Firewall
- [`ufw`](https://archlinux.org/packages/community/x86_64/ufw/) — Uncomplicated firewall

### Programming
- [`code`](https://aur.archlinux.org/packages/visual-studio-code-bin) — Visual Studio Code *(AUR)*
- [`python`](https://archlinux.org/packages/extra/x86_64/python/) — Python 3
- [`python-pip`](https://archlinux.org/packages/extra/x86_64/python-pip/) — Python package manager
- [`python-virtualenv`](https://archlinux.org/packages/community/any/python-virtualenv/) — Virtual environments
- [`php`](https://archlinux.org/packages/extra/x86_64/php/) — PHP interpreter
- [`composer`](https://archlinux.org/packages/community/any/composer/) — PHP dependency manager
- [`nodejs`](https://archlinux.org/packages/community/x86_64/nodejs/) — JavaScript runtime
- [`npm`](https://archlinux.org/packages/community/x86_64/npm/) — Node.js package manager
- [`docker`](https://archlinux.org/packages/community/x86_64/docker/) — Container engine
- [`docker-compose`](https://archlinux.org/packages/community/x86_64/docker-compose/) — Multi-container orchestration
- [`make`](https://archlinux.org/packages/core/x86_64/make/) — Build automation
- [`cmake`](https://archlinux.org/packages/extra/x86_64/cmake/) — Cross-platform build system

# Laptop Hyprland Arch Setup WIP
My archive for a base arch linux & wayland install with all the bits and bobs working

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
