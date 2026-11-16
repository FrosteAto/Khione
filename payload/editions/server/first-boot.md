# Welcome to Khione Server

Setup has finished and services are configured.

## Updates & Notices

- Added independent Kara package
- Added experimental theme switcher (Possibly defunct with KDE 6.7 theme update)
- Added KDE partition manager
- Added 7zip
- Added tools for NAS management: mdadm, samba, wsdd, cockpit, cockpit-file-sharing,smartmontools
- Added Home Assistant (containerised, port 8123) for smart-home control, now including the dashboard (weather, server stats, news) and the Meals rotation/weigh-in tracker

## Home Assistant

Home Assistant runs as a container. The very first start downloads its image, so give it a few minutes after boot, then open `http://<server-ip>:8123` and create your account (one time — it survives reinstalls if you keep `/var/lib/hass`).

- Zigbee: plug in the coordinator dongle, add its `--device` line to `/etc/systemd/system/home-assistant.service` (instructions inside), then enable the ZHA integration.
- To update HA: `sudo docker pull ghcr.io/home-assistant/home-assistant:stable && sudo systemctl restart home-assistant`

## Home Assistant dashboard

Five custom pages live in the sidebar: **Weather**, **Home** (clothing
suggestion, RSS, server stats, disk/temp readouts, Plex/Cockpit status),
**Plants**, **Meals**, and **Recipes**. These are plain custom panels, not
Lovelace dashboards — nothing to install or configure for them beyond what
the installer already did.

A handful of pieces can't be baked into the installer — they need one
human click each, same as HA's own account setup above:

1. **Weather** — Settings → Devices & Services → Add Integration → search
   "Met.no" → add it for your location. **Rename its weather entity to
   `weather.home`** (Settings → Entities → find it → the gear icon → rename
   the Entity ID) — the Weather panel and the clothing-recommendation
   sensor both expect that exact ID.
2. **System Monitor** — Add Integration → "System Monitor" (it doesn't ask
   which resources to track — it creates everything, mostly **disabled by
   default**). Go to Settings → Entities, search "processor" and "memory",
   and enable `sensor.system_monitor_processor_use` and
   `sensor.system_monitor_memory_usage` (gear icon → toggle "Enabled") —
   those exact entity IDs are what the Home panel expects.
3. **Speedtest.net** — Add Integration → "Speedtest.net" → accept the
   defaults.
4. **HACS** — always manual, not fetched by the installer. Install it by
   hand from https://get.hacs.xyz, then open Settings → Devices & Services
   and follow HACS's own one-time GitHub device-code authorization prompt.
5. **pyscript** (powers the Meals and Recipes panels) — once HACS is
   authorized (step 4), go to HACS → Integrations → search "pyscript" →
   Download, then restart Home Assistant once more. The Meals and Recipes
   panels will show "Entity not found" everywhere until this step is done.

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
