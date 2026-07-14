# Welcome to FrosteArch Server

Setup has finished and services are configured.

## Updates & Notices

- Added independent Kara package
- Added experimental theme switcher (Possibly defunct with KDE 6.7 theme update)
- Added KDE partition manager
- Added 7zip
- Added tools for NAS management: mdadm, samba, wsdd, cockpit, cockpit-file-sharing,smartmontools
- Added Glance dashboard on port 8080 (news, weather, budget, meal plan, server stats)
- Added Finances dashboard page (cash flow, top merchants, recent transactions, recurring payments)
- Added Home Assistant (containerised, port 8123) for smart-home control

## Dashboard setup

The Glance dashboard is already running — open `http://<server-ip>:8080` from any device on the network (`ip -4 addr` shows the IP; give it a DHCP reservation in the router so it doesn't change).

To link your **bank account** (Monthly Spending widget and the Finances page), open a terminal and run:

```bash
sudo glance-bank-setup
```

It walks you through it and can be re-run any time (bank consent needs renewing every ~90-180 days). The Finances page's month-vs-month and recurring-payment widgets build from transaction history, so they fill in over the first month or two.

## Home Assistant

Home Assistant runs as a container. The very first start downloads its image, so give it a few minutes after boot, then open `http://<server-ip>:8123` and create your account (one time — it survives reinstalls if you keep `/var/lib/hass`).

- Zigbee: plug in the coordinator dongle, add its `--device` line to `/etc/systemd/system/home-assistant.service` (instructions inside), then enable the ZHA integration.
- To update HA: `sudo docker pull ghcr.io/home-assistant/home-assistant:stable && sudo systemctl restart home-assistant`

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
