# Welcome to Khione Desktop 2.2

Setup has finished successfully.

## Updates & Notices

- Plex Desktop has been temporarily removed from the installation due to issues in the AUR
- Tone3000 plugin has been temporarily removed from the installation due to its AUR build being extremely slow and resource-heavy, which can look like a hung installer
- Added independent Kara package
- Added fastfetch
- Added experimental theme switcher (Possibly defunct with KDE 6.7 theme update)
- Added KDE partition manager
- Added 7zip
- Added musical workflow installation script
- Spotify (Spicetify Marketplace + startup-page), Discord (BetterDiscord), and Steam (AdwSteamGtk) now get automatic theming that reapplies itself after each app's own updates

## Music Workflow

You can now easily produce music on Khione! Simply download the relevant windows installlers, place them in the correct folder, and watch as it automatically creates a new wine prefix with perfect compatibility for `FL Studio`, `Piapro Studio` and `Hatsune Miku V4X`!

Messing around has never been easier.

## Quick start

You may want to complete the following steps:

### Finish theming setup

Two one-time manual steps (can't be scripted — they live in each app's own
UI, not a config file):

- **Spotify:** open Spotify, click your profile picture, and choose **"Set
  startup page"** to pick which view it opens to (e.g. Library). Spicetify
  Marketplace is already installed — open it from Spotify's menu to browse
  and install themes.
- **Steam:** press `Alt + Space`, search for **AdwSteamGtk**, and run it once
  to pick your preferred color theme. After this one run, the skin
  automatically reapplies itself even after Steam updates.

BetterDiscord needs no manual step — it installs itself automatically the
first time you open Discord.

### Update your packages

- Press `Ctrl + Alt + T` to open the terminal.
- Run updates with:

```bash
yay
```

- Review installation logs if needed:

```bash
ls -1 /var/log/khione/
cat /var/log/archinstall/install.log
```

Enjoy!
