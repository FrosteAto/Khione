# Welcome to FrosteArch Node

Setup has finished. This is the Node edition — a minimal FrosteArch install whose only job is to open Firefox and show your dashboard.

## About this edition

Node strips away everything that isn't needed to boot, log in, and browse: no gaming, creative, or audio tools, and no Plex / Samba / Home Assistant / Glance hosting. Point Firefox at whatever dashboard you host elsewhere (for example a FrosteArch Server's Glance instance) and it's ready to go.

## Quick start

- Press `Alt + Space` to open KRunner and launch Firefox (or find it on the panel).
- Set your dashboard page as the homepage, or pin it as a tab, so it's there every time you log in.
- Update packages with:

```bash
yay
```

## Recommended checks

- Review installation logs if needed:

```bash
ls -1 /var/log/frostearch/
cat /var/log/archinstall/install.log
```

You're good to go.
