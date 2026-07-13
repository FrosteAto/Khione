# Welcome to FrosteArch Server

Setup has finished and services are configured.

## Updates & Notices

- Added independent Kara package
- Added experimental theme switcher (Possibly defunct with KDE 6.7 theme update)
- Added KDE partition manager
- Added 7zip
- Added tools for NAS management: mdadm, samba, wsdd, cockpit, cockpit-file-sharing,smartmontools
- Added Glance dashboard on port 8080 (news, weather, budget, meal plan, server stats)

## Dashboard setup

The Glance dashboard is already running — open `http://<this-server>.local:8080` from any device on the network.

To link your **bank account** (Monthly Spending widget), open a terminal and run:

```bash
sudo glance-bank-setup
```

It walks you through it and can be re-run any time (bank consent needs renewing every ~90-180 days).

## Recommended checks

- Verify key services:

```bash
systemctl status plexmediaserver
systemctl status ufw
```

- Review installation logs if needed:

```bash
ls -1 /var/log/frostearch/
cat /var/log/archinstall/install.log
```

You're good to go.
