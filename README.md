# Desktop Wayland KDE Arch Setup
My install list for a KDE Arch setup. Im lazy as shit nowadays so it assumes you used archinstall to get basic KDE running.

---

## Features

- Updates system and enables the **[multilib]** repository if not already enabled.
- Installs a set of official Arch packages (development tools, browsers, printing support, firewall, etc.).
- Installs **yay** (AUR helper) if not present.
- Installs popular applications and tools from the **AUR**.
- Configures and enables the **UFW firewall** with sensible defaults.
- Adds the current user to the **docker** group.
- Sets up the **Flathub** Flatpak remote.

---

## Packages Installed

### Official Packages
- **General Tools:**  
  `flatpak`, `git`, `firefox`, `steam`
- **Printing & Scanning:**  
  `cups`, `cups-pdf`, `print-manager`, `sane`, `skanlite`, `hplip`, `avahi`, `nss-mdns`
- **Development Tools:**  
  - Languages: `python`, `python-pip`, `python-virtualenv`, `php`, `composer`, `nodejs`, `npm`  
  - Build Tools: `make`, `cmake`  
  - Containers: `docker`, `docker-compose`
- **Security:**  
  `ufw`

### AUR Packages
- **Login Manager:**  
  `greetd`, `tuigreet`
- **Apps:**  
  `discord`, `spotify`, `code` (VS Code)
- **Gaming:**  
  `wine`, `winetricks`, `protontricks`, `lutris`, `gamescope`

---

## Services Enabled
- **UFW Firewall** (`ufw.service`)  
  - Default deny incoming  
  - Default allow outgoing  
  - Enabled on boot  

---

## Post-Installation
- The chosen user is added to the **docker group** (requires re-login).
- Flathub remote is added for Flatpak apps.
- Reboot is recommended to apply all changes.

---

## Usage

Run the script and follow the prompts:

```bash
chmod +x install.sh
./install.sh



