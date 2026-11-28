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

Seven custom pages live in the sidebar: **Weather**, **Home** (clothing
suggestion, RSS, server stats, disk/temp readouts, Plex/Cockpit status),
**Plants**, **Meals**, **Recipes**, **Security** (bans, AIDE/auditd status,
blocked-connection noise, update buttons), and **TODO** (post-it-style
cards). These are plain custom panels, not Lovelace dashboards — nothing
to install or configure for them beyond what the installer already did.

A handful of pieces can't be baked into the installer, but two KRunner
shortcuts (Alt+Space, then type the name below) cut most of the remaining
clicking down to one run each:

1. **Run "Finish Home Assistant integrations" from KRunner.** It'll ask you
   to paste a long-lived access token — in HA, click your profile
   (bottom-left) → Security → Long-Lived Access Tokens → Create Token,
   paste it in. It then adds the Met.no, System Monitor, and Speedtest.net
   integrations for you. Two small things it can't reach (both under
   Settings → Entities, HA's entity-rename/enable is only a websocket
   call, not plain REST):
   - **Rename the new weather entity's Entity ID to `weather.home`** — the
     Weather panel and the clothing-recommendation sensor both expect that
     exact ID.
   - **Enable `sensor.system_monitor_processor_use` and
     `sensor.system_monitor_memory_usage`** (they're created disabled by
     default — gear icon → toggle "Enabled") — those exact entity IDs are
     what the Home panel expects.
2. **pyscript** (powers the Meals, Recipes, and TODO panels) — Settings →
   Marketplace → Discover → search "pyscript" → Install, then restart Home
   Assistant once more. Those panels will show "Entity not found"
   everywhere until this step is done.

   HA 2026.11 folded HACS into core as this built-in Marketplace — there's
   no separate HACS install or GitHub authorization step anymore. If
   you're on an older HA version, install [HACS](https://get.hacs.xyz)
   by hand first and get pyscript through that instead.

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
