# Desktop theming automation: Spicetify, BetterDiscord, AdwSteamGtk + konsave fixes

## Problem

Three third-party customisations were set up and verified by hand on the live
Desktop machine (see `/home/dob/post-install-customizations.md`, captured
2026-11-02):

1. **Spicetify** — Spotify theming/extension layer (Marketplace custom app +
   `startup-page` extension).
2. **BetterDiscord** — Discord mod.
3. **AdwSteamGtk** — Steam client skin.

All three are patched into a vendor app's own files on disk. All three get
**wiped by that vendor app's own update mechanism** unless something reapplies
the patch afterward. None of this is baked into the Khione installer yet — a
fresh Desktop install gets none of it, and existing installs have no drift
protection.

Separately: the user reported a broken Spotify taskbar shortcut (wrong/generic
icon) traced during this session to a real, separate bug in the icon theme
wiring, plus one confirmed-dead piece of config corruption in the shipped
konsave files.

## Decision: install-time automation, reusing the existing self-healing guard pattern

This repo already has a proven answer for "a vendor app's self-update wipes a
patch": a `systemd --user` `.path` + `.service` pair that watches a file the
vendor app's updater rewrites, and reapplies the patch when it changes. This
is documented in the post-install doc (section 5) and was originally built for
`discord-launcher-guard` (excluded from general install — machine-specific).
We reuse the same shape for BetterDiscord and AdwSteamGtk.

Spicetify is the odd one out: `/opt/spotify` only updates via pacman (the
`spotify` AUR package ships the full app, not a self-updating bootstrap), so a
**pacman hook** is simpler and more direct than a file-watcher there — same
reasoning the post-install doc already used.

Everything in this design runs inside `payload/install.sh`'s existing root,
pre-reboot provisioning pass (same place Kara, the theme switcher, and the
Home Assistant unit are installed) — nothing here requires a logged-in
graphical session, including the two `systemd --user` guards, since "enabling"
a user unit is just writing a `.wants` symlink, which doesn't need a running
user manager.

This is desktop-edition-only: it's the only edition with `spotify`, `discord`,
and `steam` in its package list today.

## Components

### 1. Spicetify (`configure_spicetify()` in `common.sh`)

Runs as the target user (`sudo -u "$arch_user"`, mirroring
`install_kara_pager_from_source`'s pattern). Steps:

1. `spicetify config custom_apps marketplace` after installing the Marketplace
   custom app (fetched from the latest `spicetify/marketplace` GitHub release,
   flattening the nested zip dir exactly as the post-install doc describes).
2. `spicetify config extensions startup-page.js` after downloading the
   extension file from its upstream repo.
3. `spicetify backup apply` once, to apply both immediately.
4. **Does not touch `current_theme`.** That's a personal pick, not a distro
   default — Marketplace itself is the UI for picking a theme, so every user
   gets the infrastructure and chooses their own theme afterward.
5. Installs the pacman hook + reapply script (root-owned, under `/etc` and
   `/usr/local/bin`), with the username **templated to `$arch_user`** instead
   of hardcoded, so future `spotify` package upgrades reapply the patch.

Network calls (Marketplace/extension download) are best-effort: a GitHub
hiccup logs a warning and continues rather than aborting the whole install,
matching how `install_aur_packages`/`install_flatpak_packages` already
tolerate individual failures. The pacman hook/script install (no network
needed beyond the already-installed AUR package) always runs.

New dependencies: `curl` and `unzip` must be added to Desktop's
`OFFICIAL_PACKAGES` (neither is currently guaranteed present on a fresh
install's target system — `curl` today only exists in the *live ISO
builder* environment, not the installed target).

### 2. Shared guard helper (`install_user_systemd_guard()` in `common.sh`)

A small reusable function taking the target user, a guard script source, and
`.path`/`.service` unit sources. It:

- Copies the script to `~/.local/bin/`, `chmod +x`.
- Installs the two units to `~/.config/systemd/user/`.
- "Enables" them by creating the `default.target.wants/` symlinks directly
  (the offline equivalent of `systemctl --user enable`, since there is no
  running user session to invoke that command against during install). The
  real `systemd --user` instance picks these up normally at first login —
  this is just file placement, not live activation.

Both BetterDiscord's and AdwSteamGtk's guards are thin callers of this helper,
passing their own script + unit pair (ported near-verbatim from the
post-install doc, with the hardcoded `dob` username replaced by the
installer's `$arch_user`/`%h` as appropriate).

### 3. BetterDiscord guard (`configure_betterdiscord_guard()`)

Adds `betterdiscordctl` to Desktop's `AUR_PACKAGES` (headless CLI;
`betterdiscord-installer-bin` stays as-is for manual/interactive use). Installs
the guard via the shared helper. Requires **zero manual steps** — the guard is
purely reactive: the very first time the user ever launches Discord (which is
also the first time `~/.config/discord/Discord` symlink is created),
the `.path` unit fires and the guard script installs BD immediately. Every
later Discord self-update repeats the same reinjection automatically.

### 4. AdwSteamGtk guard (`configure_adwsteamgtk_guard()`)

Installs the guard via the shared helper, watching
`~/.local/share/Steam/steamui/css/library.css` for the `Adwaita-for-Steam`
marker (not `libraryroot.custom.css`, which is conditional on a GSettings
option most users won't have set — see the post-install doc's gotcha).

One manual step remains and **cannot be scripted**: the user must run the
`adwaita-steam-gtk` app once (already in KRunner via the existing
`adwsteamgtk` package) to choose preferences, which populates GSettings and
performs the first install. The guard only *maintains* an existing choice —
documented in `desktop/first-boot.md`.

### 5. Wiring

- `desktop/mode.sh`: add `betterdiscordctl`, `curl`, `unzip`; add
  `SETUP_THEMING_GUARDS=true`.
- `install.sh`: one new section, gated on `SETUP_THEMING_GUARDS`, calling
  `configure_spicetify`, `configure_betterdiscord_guard`,
  `configure_adwsteamgtk_guard` — placed after AUR packages are installed
  (needs `spotify`/`discord`/`steam`/`spicetify-cli`/`betterdiscordctl`/
  `adwsteamgtk` present) and after `init_paths`/sudoers setup, mirroring where
  `install_audio_base` already sits.
- `desktop/first-boot.md`: add the two documented first-use manual steps.

### 6. Konsave fixes (separate bug, same session)

Root cause of the broken Spotify taskbar icon, confirmed mechanistically and
cross-checked against the live machine's current (working) state:

- All three KDE editions' shipped `kdeglobals` (inside their `.knsv` files) set
  `[Icons] Theme=YAMIS`.
- Only `ulw/mode.sh` wires `ICON_THEME_REL="YAMIS.tar.gz"` — Desktop, Node, and
  Server never actually install the YAMIS icon theme archive on a fresh
  install, even though their konsave profile selects it.
- Most taskbar-pinned apps (Steam, Discord, Dolphin, Code) ship their own
  icon under `/usr/share/icons/hicolor/.../<name>.png` matching their own
  `Icon=` key, so they still resolve fine without YAMIS. Spotify's desktop
  file uses `Icon=spotify-client`, and the `spotify` AUR package's own hicolor
  icons are named `spotify.png` (no "-client") — the only place an icon
  literally named `spotify-client` exists is inside YAMIS. Missing theme + no
  name-matching fallback = generic icon, for Spotify specifically.
- This explains why Node/Server have never shown the symptom (same missing
  theme, but neither pins Spotify on its taskbar) and why the live dev
  machine looks fine right now (YAMIS was installed there manually, outside
  the installer flow, at some point in the past).
- Caveat stated plainly: the only way to be fully certain is to boot a literal
  fresh ISO and watch it happen; that wasn't done this session.

Fix: add `ICON_THEME_REL="YAMIS.tar.gz"` to `desktop/mode.sh`, `node/mode.sh`,
and `server/mode.sh`.

Separately (confirmed dead, unrelated to the symptom above, but real
corruption worth cleaning up): all three `.knsv` files' bundled
`plasma-org.kde.plasma.desktop-appletsrc` contain a malformed, orphaned config
group (`[Containments61Appletsts][126][Configuration][General]` instead of
properly-nested `[Containments][61][Applets][126]...`) holding a stale,
incomplete duplicate of the real pinned-launcher list. Verified via
`kreadconfig6` against the live machine's actual config that Plasma reads the
*other*, correctly-formed group for real — this stray block is provably never
read. Fix: delete the stray block (the one blank-line-prefixed header + its
single `launchers=` line) from each of the three `.knsv` archives, re-zipped
with the same internal layout.

## Testing / verification

- `bash -n` every edited/new shell script.
- Manually unzip each edited `.knsv`, confirm the stray block is gone and the
  real `[Containments][61][Applets][126]...` group is untouched, re-zip, spot
  check the zip still opens/matches original file listing (same paths).
- No live install run is possible in this environment — call out in the
  implementation summary that a real ISO build + install is the only way to
  fully confirm the guard units activate correctly at first login and that
  the icon fix resolves visually.
