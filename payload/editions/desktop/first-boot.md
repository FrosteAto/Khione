# Welcome to Khione Desktop

Setup has finished successfully.

## Updates & Notices

- Spotify (Spicetify Marketplace + startup-page), Discord (BetterDiscord), and Steam (AdwSteamGtk) now auto-apply the Catppuccin Mocha theme by default, and reapply themselves after each app's own updates
- Spotify and Discord now restart themselves automatically the first time a theme applies, so it shows up without you needing to reopen either app
- Fixed a build failure in the Kara pager and several stale package names that could block installation

## Music Workflow

You can now easily produce music on Khione! Simply download the relevant windows installlers, place them in the correct folder, and watch as it automatically creates a new wine prefix with perfect compatibility for `FL Studio`, `Piapro Studio` and `Hatsune Miku V4X`!

Messing around has never been easier.

## Quick start

You may want to complete the following steps:

### Finish theming setup

Spotify and Discord are fully automatic — Catppuccin Mocha applies itself
and both apps restart on their own the first time. One small manual step
remains for Steam (can't be scripted — it lives in the app's own UI, not a
config file):

- **Steam:** press `Alt + Space`, search for **AdwSteamGtk**, and run it
  once. Catppuccin Mocha is already set as the color, so this just applies
  it — no picking required. After this one run, the skin automatically
  reapplies itself even after Steam updates.

Spicetify Marketplace is already installed too — open it from Spotify's
menu any time to browse more themes/extensions if Catppuccin Mocha isn't
your thing. If you'd also like Spotify to open to a specific view (e.g.
Library) on launch, click your profile picture in Spotify and choose
**"Set startup page"**.

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
