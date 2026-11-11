# Welcome to Khione Server

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

## Home Assistant dashboard

The new HA-native "Home" dashboard (sidebar → Home) replaces Glance's old
Home page — weather, clothing suggestion, RSS, server stats, disk/temp
readouts, and Plex/Cockpit status all live there now. Glance itself still
runs for Meals only (`http://<server-ip>:8080`).

A handful of pieces can't be baked into the installer — they need one
human click each, same as HA's own account setup above:

1. **Weather** — Settings → Devices & Services → Add Integration → search
   "Met.no" → add it for your location. **Rename its weather entity to
   `weather.home`** (Settings → Entities → find it → the gear icon → rename
   the Entity ID) — the dashboard and the clothing-recommendation sensor
   both expect that exact ID.
2. **System Monitor** — Add Integration → "System Monitor" (it doesn't ask
   which resources to track — it creates everything, mostly **disabled by
   default**). Go to Settings → Entities, search "processor" and "memory",
   and enable `sensor.system_monitor_processor_use` and
   `sensor.system_monitor_memory_usage` (gear icon → toggle "Enabled") —
   those exact entity IDs are what the dashboard expects.
3. **Speedtest.net** — Add Integration → "Speedtest.net" → accept the
   defaults.
4. **HACS** — if its files were fetched successfully at install time,
   open Settings → Devices & Services and follow HACS's own one-time
   GitHub device-code authorization prompt. If HACS *isn't* there, the
   install-time fetch failed (check for a `WARNING: HACS bootstrap failed`
   line in the install log) — rerun its install script from
   https://get.hacs.xyz by hand.

If the dashboard looks broken (missing cards, a grey box instead of a
tile) after all four steps: open the dashboard in a browser, check
DevTools → Console for a 404 on `/local/community/...` — that means one of
card-mod/Mushroom/rss-news-card didn't download at install time; re-run the
corresponding `curl` line from `configure_home_assistant_dashboard()` in
`common.sh` by hand.

## Recommended checks

- Verify key services:

```bash
systemctl status plexmediaserver
systemctl status ufw
```

- Review installation logs if needed:

```bash
ls -1 /var/log/khione/
cat /var/log/archinstall/install.log
```

You're good to go.
