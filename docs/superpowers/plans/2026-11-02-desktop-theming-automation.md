# Desktop Theming Automation + Konsave Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-apply Spicetify (Spotify theming/extensions), BetterDiscord, and AdwSteamGtk as part of the Khione Desktop install, self-healing after each app's own updates wipe the patch — plus fix a missing icon-theme wiring bug and clean up dead config corruption in the shipped konsave profiles.

**Architecture:** Reuse this repo's existing "self-healing guard" pattern (`systemd --user` `.path`+`.service` pairs watching a file the vendor app's own updater rewrites) for BetterDiscord and AdwSteamGtk, and a pacman hook for Spicetify (since `spotify` only updates via pacman). Everything runs inside `payload/install.sh`'s existing root, pre-reboot provisioning pass — no logged-in session required, including "enabling" the `--user` units (done by writing the `.wants` symlink directly, since there's no running user manager to invoke `systemctl --user enable` against yet).

**Tech Stack:** Bash (installer scripts), systemd unit files (`.path`/`.service`), pacman hooks, Python 3 (one-off konsave text edit), zip/unzip.

## Global Constraints

- No test framework exists in this repo (it's installer shell scripts, not an application). "Testing" means: `bash -n` syntax-checks every changed/new `.sh` file, and manual inspection/grep verification of generated output. There is no way to run a real install in this environment — call that out rather than claim it's been end-to-end verified.
- Every `set -euo pipefail` script (all of `common.sh`, `install.sh`) aborts on any unguarded non-zero exit — network-dependent steps (GitHub downloads) must be explicitly guarded (`|| true` / `if` checks) so a network hiccup doesn't abort the whole multi-stage install.
- Never hardcode the target username — template it via `$arch_user`/`$ARCH_USER`, matching the rest of `common.sh`.
- Do not set Spicetify's `current_theme` — that's a personal pick, not a distro default.
- Commits: make them as work lands (explicitly requested by the user). **Do not add a `Co-Authored-By` trailer to any commit message** (explicitly requested by the user — this overrides the default attribution convention). Do not push.

---

## File Structure

New:
- `payload/common/theming-guards/betterdiscord-guard.sh`
- `payload/common/theming-guards/betterdiscord-guard.path`
- `payload/common/theming-guards/betterdiscord-guard.service`
- `payload/common/theming-guards/adwsteamgtk-guard.sh`
- `payload/common/theming-guards/adwsteamgtk-guard.path`
- `payload/common/theming-guards/adwsteamgtk-guard.service`
- `payload/common/theming-guards/spicetify-reapply.sh` (ships with an `@@ARCH_USER@@` placeholder, templated at install time — same convention as `@@GLANCE_HOST@@` in `glance.yml`)
- `payload/common/theming-guards/spicetify-reapply.hook`

Modified:
- `payload/common/lib/common.sh` — add `install_user_systemd_guard()`, `configure_betterdiscord_guard()`, `configure_adwsteamgtk_guard()`, `configure_spicetify()`
- `payload/install.sh` — new `THEMING_GUARDS_DIR` default + gated section calling the three new `configure_*` functions
- `payload/editions/desktop/mode.sh` — add `betterdiscordctl` (AUR), `curl unzip` (official), `SETUP_THEMING_GUARDS=true`, `ICON_THEME_REL="YAMIS.tar.gz"`
- `payload/editions/node/mode.sh` — add `ICON_THEME_REL="YAMIS.tar.gz"`
- `payload/editions/server/mode.sh` — add `ICON_THEME_REL="YAMIS.tar.gz"`
- `payload/editions/desktop/first-boot.md` — document the two unavoidable first-use manual steps (Spicetify startup page, AdwSteamGtk first run) + changelog bullet
- `payload/editions/desktop/desktopSetup.knsv`, `payload/editions/node/nodeSetup.knsv`, `payload/editions/server/serverSetup.knsv` — remove the confirmed-dead corrupted `[Containments61Appletsts][126]...` config block

---

### Task 1: BetterDiscord + AdwSteamGtk guard source files

**Files:**
- Create: `payload/common/theming-guards/betterdiscord-guard.sh`
- Create: `payload/common/theming-guards/betterdiscord-guard.path`
- Create: `payload/common/theming-guards/betterdiscord-guard.service`
- Create: `payload/common/theming-guards/adwsteamgtk-guard.sh`
- Create: `payload/common/theming-guards/adwsteamgtk-guard.path`
- Create: `payload/common/theming-guards/adwsteamgtk-guard.service`

**Interfaces:**
- Produces: four static unit files + two guard scripts, consumed as-is (verbatim `cp`, no templating needed — `%h` is a systemd specifier resolved by the user's own `systemd --user` instance, not something the installer substitutes) by `install_user_systemd_guard()` in Task 3.

- [ ] **Step 1: Create the BetterDiscord guard script**

```bash
#!/bin/bash
set -euo pipefail
log() { echo "[betterdiscord-guard] $*"; }

ACTIVE_APP="$(readlink -f "$HOME/.config/discord/Discord" 2>/dev/null || true)"

if [ -z "$ACTIVE_APP" ]; then
    log "Discord doesn't appear to be installed yet (no ~/.config/discord/Discord symlink) -- nothing to do"
    exit 0
fi

APP_DIR="$(dirname "$ACTIVE_APP")"
ASAR="$APP_DIR/resources/betterdiscord.app.asar"

if [ ! -f "$ASAR" ]; then
    log "BetterDiscord missing from $APP_DIR (likely a Discord self-update) -- reinstalling"
    betterdiscordctl install
    log "BetterDiscord reinstalled"
else
    log "BetterDiscord still present in $APP_DIR, nothing to do"
fi
```

Save to `payload/common/theming-guards/betterdiscord-guard.sh`.

- [ ] **Step 2: Create the BetterDiscord `.path` unit**

```ini
[Unit]
Description=Watch Discord's active-app symlink for self-updates dropping BetterDiscord

[Path]
PathChanged=%h/.config/discord/Discord

[Install]
WantedBy=default.target
```

Save to `payload/common/theming-guards/betterdiscord-guard.path`.

- [ ] **Step 3: Create the BetterDiscord `.service` unit**

```ini
[Unit]
Description=Reinstall BetterDiscord if a Discord self-update dropped it
After=graphical-session.target

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 2
ExecStart=%h/.local/bin/betterdiscord-guard.sh

[Install]
WantedBy=default.target
```

Save to `payload/common/theming-guards/betterdiscord-guard.service`.

- [ ] **Step 4: Create the AdwSteamGtk guard script**

```bash
#!/bin/bash
set -euo pipefail
log() { echo "[adwsteamgtk-guard] $*"; }

CSS="$HOME/.local/share/Steam/steamui/css/library.css"
MARKER="Adwaita-for-Steam"

if [ ! -f "$CSS" ] || ! grep -q -- "$MARKER" "$CSS"; then
    log "$CSS missing or lost the $MARKER marker (likely a Steam self-update) -- reapplying"
    adwaita-steam-gtk --install
    log "AdwSteamGtk reapplied"
else
    log "AdwSteamGtk skin still applied, nothing to do"
fi
```

Save to `payload/common/theming-guards/adwsteamgtk-guard.sh`.

- [ ] **Step 5: Create the AdwSteamGtk `.path` unit**

```ini
[Unit]
Description=Watch AdwSteamGtk's patched library.css for Steam self-updates overwriting it

[Path]
PathChanged=%h/.local/share/Steam/steamui/css/library.css

[Install]
WantedBy=default.target
```

Save to `payload/common/theming-guards/adwsteamgtk-guard.path`.

- [ ] **Step 6: Create the AdwSteamGtk `.service` unit**

```ini
[Unit]
Description=Reapply AdwSteamGtk's skin if a Steam self-update dropped it
After=graphical-session.target

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 2
ExecStart=%h/.local/bin/adwsteamgtk-guard.sh

[Install]
WantedBy=default.target
```

Save to `payload/common/theming-guards/adwsteamgtk-guard.service`.

- [ ] **Step 7: Syntax-check both scripts**

Run:
```bash
bash -n payload/common/theming-guards/betterdiscord-guard.sh
bash -n payload/common/theming-guards/adwsteamgtk-guard.sh
```
Expected: no output, exit 0 for both.

- [ ] **Step 8: Commit**

```bash
git add payload/common/theming-guards/betterdiscord-guard.sh \
        payload/common/theming-guards/betterdiscord-guard.path \
        payload/common/theming-guards/betterdiscord-guard.service \
        payload/common/theming-guards/adwsteamgtk-guard.sh \
        payload/common/theming-guards/adwsteamgtk-guard.path \
        payload/common/theming-guards/adwsteamgtk-guard.service
git commit -m "Add BetterDiscord and AdwSteamGtk self-healing guard units"
```

---

### Task 2: Spicetify reapply script + pacman hook source files

**Files:**
- Create: `payload/common/theming-guards/spicetify-reapply.sh`
- Create: `payload/common/theming-guards/spicetify-reapply.hook`

**Interfaces:**
- Produces: `spicetify-reapply.sh` contains the literal placeholder text `@@ARCH_USER@@`, which `configure_spicetify()` (Task 3) must substitute via `sed` before installing it to `/usr/local/bin/`.

- [ ] **Step 1: Create the templated reapply script**

```bash
#!/bin/bash
set -e
runuser -u @@ARCH_USER@@ -- spicetify restore backup apply
```

Save to `payload/common/theming-guards/spicetify-reapply.sh`.

- [ ] **Step 2: Create the pacman hook**

```ini
[Trigger]
Operation = Upgrade
Operation = Install
Type = Package
Target = spotify

[Action]
Description = Reapplying Spicetify patches after Spotify update...
When = PostTransaction
Exec = /usr/local/bin/spicetify-reapply.sh
```

Save to `payload/common/theming-guards/spicetify-reapply.hook`.

- [ ] **Step 3: Verify the placeholder is present and will substitute cleanly**

Run:
```bash
grep -c '@@ARCH_USER@@' payload/common/theming-guards/spicetify-reapply.sh
sed 's/@@ARCH_USER@@/testuser/g' payload/common/theming-guards/spicetify-reapply.sh
```
Expected: `1`, then the script printed with `testuser` in place of the placeholder and nothing else changed.

- [ ] **Step 4: Commit**

```bash
git add payload/common/theming-guards/spicetify-reapply.sh \
        payload/common/theming-guards/spicetify-reapply.hook
git commit -m "Add Spicetify pacman-hook reapply script and hook definition"
```

---

### Task 3: `common.sh` functions + `install.sh`/`desktop/mode.sh` wiring

**Files:**
- Modify: `payload/common/lib/common.sh` (append new functions at end of file, after `install_wallpaper_autostart`)
- Modify: `payload/install.sh:152-169` (default var block), `payload/install.sh:221-225` (new gated section)
- Modify: `payload/editions/desktop/mode.sh`

**Interfaces:**
- Consumes: `sudo -u "$arch_user"` pattern and `set -euo pipefail` already active from `common.sh`'s own shebang; `init_paths`'s `USER_HOME`/etc. are NOT used here (these functions build their own `user_home` locally, matching `install_kara_pager_from_source`'s existing style).
- Produces:
  - `install_user_systemd_guard(arch_user, script_source, path_unit_source, service_unit_source)` — no return value; files land under `~/.local/bin/` and `~/.config/systemd/user/`, enabled via `.wants` symlink.
  - `configure_betterdiscord_guard(arch_user, guard_dir)` / `configure_adwsteamgtk_guard(arch_user, guard_dir)` — thin wrappers calling the above with fixed filenames inside `guard_dir`.
  - `configure_spicetify(arch_user, guard_dir)` — no return value; installs the pacman hook/script and best-effort Marketplace/extension setup.

- [ ] **Step 1: Append the shared guard-install helper to `common.sh`**

Open `payload/common/lib/common.sh` and add this at the end of the file (after the closing `}` of `install_wallpaper_autostart`):

```bash

install_user_systemd_guard() {
  local arch_user="$1"
  local script_source="$2"
  local path_unit_source="$3"
  local service_unit_source="$4"

  local user_home="/home/$arch_user"
  local user_bin="$user_home/.local/bin"
  local user_systemd_dir="$user_home/.config/systemd/user"
  local wants_dir="$user_systemd_dir/default.target.wants"
  local script_name path_name service_name

  script_name="$(basename "$script_source")"
  path_name="$(basename "$path_unit_source")"
  service_name="$(basename "$service_unit_source")"

  sudo -u "$arch_user" mkdir -p "$user_bin" "$wants_dir"
  sudo -u "$arch_user" cp "$script_source" "$user_bin/$script_name"
  sudo -u "$arch_user" chmod +x "$user_bin/$script_name"
  sudo -u "$arch_user" cp "$path_unit_source" "$user_systemd_dir/$path_name"
  sudo -u "$arch_user" cp "$service_unit_source" "$user_systemd_dir/$service_name"

  # No systemd --user instance is running yet to "systemctl --user enable"
  # against at install time -- this is the same .wants symlink that command
  # would create. The user's real --user manager picks it up normally at
  # first login.
  sudo -u "$arch_user" ln -sf "../$path_name" "$wants_dir/$path_name"
  sudo -u "$arch_user" ln -sf "../$service_name" "$wants_dir/$service_name"
}

configure_betterdiscord_guard() {
  local arch_user="$1"
  local guard_dir="$2"

  if [[ -z "$guard_dir" ]]; then
    echo "No BetterDiscord guard source for this mode, skipping."
    return 0
  fi

  echo "Installing BetterDiscord self-healing guard..."
  install_user_systemd_guard "$arch_user" \
    "$guard_dir/betterdiscord-guard.sh" \
    "$guard_dir/betterdiscord-guard.path" \
    "$guard_dir/betterdiscord-guard.service"
}

configure_adwsteamgtk_guard() {
  local arch_user="$1"
  local guard_dir="$2"

  if [[ -z "$guard_dir" ]]; then
    echo "No AdwSteamGtk guard source for this mode, skipping."
    return 0
  fi

  echo "Installing AdwSteamGtk self-healing guard..."
  install_user_systemd_guard "$arch_user" \
    "$guard_dir/adwsteamgtk-guard.sh" \
    "$guard_dir/adwsteamgtk-guard.path" \
    "$guard_dir/adwsteamgtk-guard.service"
}

configure_spicetify() {
  local arch_user="$1"
  local guard_dir="$2"

  if [[ -z "$guard_dir" ]]; then
    echo "No Spicetify config for this mode, skipping."
    return 0
  fi

  echo "Configuring Spicetify..."

  local user_home="/home/$arch_user"
  local marketplace_dir="$user_home/.config/spicetify/CustomApps/marketplace"
  local extensions_dir="$user_home/.config/spicetify/Extensions"
  local tmp_zip="/tmp/khione-spicetify-marketplace.zip"

  # Pacman hook: always installed, no network needed. Templates the username
  # (never hardcoded) into the reapply script before it goes to /usr/local/bin.
  sed "s/@@ARCH_USER@@/$arch_user/g" "$guard_dir/spicetify-reapply.sh" \
    | sudo tee /usr/local/bin/spicetify-reapply.sh >/dev/null
  sudo chmod 755 /usr/local/bin/spicetify-reapply.sh
  sudo chown root:root /usr/local/bin/spicetify-reapply.sh
  sudo install -Dm644 "$guard_dir/spicetify-reapply.hook" /etc/pacman.d/hooks/spicetify-reapply.hook

  # Marketplace (custom app) + startup-page (extension): best-effort, network
  # dependent. A GitHub hiccup here must not abort the whole install.
  sudo -u "$arch_user" mkdir -p "$marketplace_dir" "$extensions_dir"

  local marketplace_tag
  marketplace_tag="$(curl -fsSL https://api.github.com/repos/spicetify/marketplace/releases/latest \
    | grep -oP '"tag_name":\s*"\K[^"]+' | head -n1 || true)"

  if [ -n "$marketplace_tag" ]; then
    if sudo -u "$arch_user" curl -fsSL -o "$tmp_zip" \
        "https://github.com/spicetify/marketplace/releases/download/$marketplace_tag/marketplace.zip"; then
      sudo -u "$arch_user" unzip -q -o "$tmp_zip" -d "$marketplace_dir"
      if [ -d "$marketplace_dir/marketplace-dist" ]; then
        sudo -u "$arch_user" find "$marketplace_dir/marketplace-dist" -maxdepth 1 -mindepth 1 -exec mv -t "$marketplace_dir" {} +
        sudo -u "$arch_user" rmdir "$marketplace_dir/marketplace-dist"
      fi
    else
      echo "Warning: Spicetify Marketplace download failed, skipping (network issue?)."
    fi
    rm -f "$tmp_zip"
  else
    echo "Warning: could not determine latest Spicetify Marketplace release tag, skipping Marketplace install."
  fi

  if ! sudo -u "$arch_user" curl -fsSL -o "$extensions_dir/startup-page.js" \
      "https://raw.githubusercontent.com/Resxt/startup-page/main/startup-page/dist/startup-page.js"; then
    echo "Warning: startup-page extension download failed, skipping (network issue?)."
  fi

  # NOT setting current_theme here -- that's a personal pick, not a distro
  # default. Marketplace is itself the UI for choosing a theme afterward.
  if [ -f "$marketplace_dir/manifest.json" ]; then
    sudo -u "$arch_user" env HOME="$user_home" spicetify config custom_apps marketplace || true
  fi
  if [ -s "$extensions_dir/startup-page.js" ]; then
    sudo -u "$arch_user" env HOME="$user_home" spicetify config extensions startup-page.js || true
  fi
  sudo -u "$arch_user" env HOME="$user_home" spicetify backup apply || true
}
```

- [ ] **Step 2: Syntax-check `common.sh`**

Run: `bash -n payload/common/lib/common.sh`
Expected: no output, exit 0.

- [ ] **Step 3: Add the new default vars to `install.sh`**

In `payload/install.sh`, find this block (around line 160-163):

```bash
KITTY_TRANSLUCENCY_FIX_REL="${KITTY_TRANSLUCENCY_FIX_REL:-}"
KARA_GIT_URL="${KARA_GIT_URL:-https://github.com/dhruv8sh/kara.git}"
KARA_GIT_REF="${KARA_GIT_REF:-v1.0.0}"
SETUP_AUDIO_PRODUCTION="${SETUP_AUDIO_PRODUCTION:-false}"
```

Replace it with:

```bash
KITTY_TRANSLUCENCY_FIX_REL="${KITTY_TRANSLUCENCY_FIX_REL:-}"
KARA_GIT_URL="${KARA_GIT_URL:-https://github.com/dhruv8sh/kara.git}"
KARA_GIT_REF="${KARA_GIT_REF:-v1.0.0}"
SETUP_AUDIO_PRODUCTION="${SETUP_AUDIO_PRODUCTION:-false}"
SETUP_THEMING_GUARDS="${SETUP_THEMING_GUARDS:-false}"
THEMING_GUARDS_DIR="${THEMING_GUARDS_DIR:-$REPO_ROOT/common/theming-guards}"
```

- [ ] **Step 4: Add the new gated section to `install.sh`**

Find this block (the audio production section, right before the Plasma-only `if` block):

```bash
if [[ "${SETUP_AUDIO_PRODUCTION:-false}" == "true" ]]; then
  section "Setting up audio production environment"
  install_audio_base "$ARCH_USER" "$REPO_ROOT"
fi

if [[ "$DESKTOP_ENVIRONMENT" == "plasma" ]]; then
```

Replace it with:

```bash
if [[ "${SETUP_AUDIO_PRODUCTION:-false}" == "true" ]]; then
  section "Setting up audio production environment"
  install_audio_base "$ARCH_USER" "$REPO_ROOT"
fi

if [[ "${SETUP_THEMING_GUARDS:-false}" == "true" ]]; then
  section "Configuring self-healing theming guards"
  configure_spicetify "$ARCH_USER" "$THEMING_GUARDS_DIR"
  configure_betterdiscord_guard "$ARCH_USER" "$THEMING_GUARDS_DIR"
  configure_adwsteamgtk_guard "$ARCH_USER" "$THEMING_GUARDS_DIR"
fi

if [[ "$DESKTOP_ENVIRONMENT" == "plasma" ]]; then
```

- [ ] **Step 5: Syntax-check `install.sh`**

Run: `bash -n payload/install.sh`
Expected: no output, exit 0.

- [ ] **Step 6: Update `payload/editions/desktop/mode.sh`**

Find the `OFFICIAL_PACKAGES` array's first line (`xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret`) and the line `kdialog` right after it:

```bash
OFFICIAL_PACKAGES=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
```

Replace with:

```bash
OFFICIAL_PACKAGES=(
  xorg plasma plasma-workspace greetd greetd-tuigreet kwallet kwallet-pam libsecret
  kdialog
  curl unzip
```

Find the `AUR_PACKAGES` array's first line:

```bash
AUR_PACKAGES=(
  discord betterdiscord-installer-bin spotify visual-studio-code-bin
```

Replace with:

```bash
AUR_PACKAGES=(
  discord betterdiscord-installer-bin betterdiscordctl spotify visual-studio-code-bin
```

Find the end of the file:

```bash
FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Desktop"

SETUP_AUDIO_PRODUCTION=true
```

Replace with:

```bash
FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Desktop"

SETUP_AUDIO_PRODUCTION=true
SETUP_THEMING_GUARDS=true
ICON_THEME_REL="YAMIS.tar.gz"
```

- [ ] **Step 7: Syntax-check `desktop/mode.sh`**

Run: `bash -n payload/editions/desktop/mode.sh`
Expected: no output, exit 0.

- [ ] **Step 8: Verify the wiring with grep**

Run:
```bash
grep -n "betterdiscordctl\|curl unzip\|SETUP_THEMING_GUARDS\|ICON_THEME_REL" payload/editions/desktop/mode.sh
grep -n "SETUP_THEMING_GUARDS\|THEMING_GUARDS_DIR\|configure_spicetify\|configure_betterdiscord_guard\|configure_adwsteamgtk_guard" payload/install.sh
```
Expected: each name appears exactly where the steps above placed it (one `SETUP_THEMING_GUARDS` default-assignment line in install.sh plus one `if` check; one `SETUP_THEMING_GUARDS=true` line in desktop/mode.sh; all three `configure_*` calls present in install.sh).

- [ ] **Step 9: Commit**

```bash
git add payload/common/lib/common.sh payload/install.sh payload/editions/desktop/mode.sh
git commit -m "Wire Spicetify, BetterDiscord, and AdwSteamGtk guards into the Desktop install"
```

---

### Task 4: Document the two manual first-use steps in `desktop/first-boot.md`

**Files:**
- Modify: `payload/editions/desktop/first-boot.md`

**Interfaces:**
- Consumes: nothing (static markdown).
- Produces: nothing consumed by other tasks — this is a leaf doc change.

- [ ] **Step 1: Add a changelog bullet and a new "Finish theming setup" section**

In `payload/editions/desktop/first-boot.md`, find:

```markdown
## Updates & Notices

- Plex Desktop has been temporarily removed from the installation due to issues in the AUR
- Tone3000 plugin has been temporarily removed from the installation due to its AUR build being extremely slow and resource-heavy, which can look like a hung installer
- Added independent Kara package
- Added fastfetch
- Added experimental theme switcher (Possibly defunct with KDE 6.7 theme update)
- Added KDE partition manager
- Added 7zip
- Added musical workflow installation script
```

Replace with:

```markdown
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
```

Then find:

```markdown
## Quick start

You may want to complete the following steps:
```

Replace with:

```markdown
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
```

- [ ] **Step 2: Verify the file is still valid markdown structurally**

Run: `grep -c "^## " payload/editions/desktop/first-boot.md`
Expected: `3` (Updates & Notices, Music Workflow, Quick start — unchanged, since this edit only adds a `###` subsection under the existing "Quick start" `##` heading, not a new `##` heading. A different count means a heading marker got mangled.)

Run: `grep -n "^### " payload/editions/desktop/first-boot.md`
Expected: both `### Finish theming setup` and `### Update your packages` listed, in that order.

- [ ] **Step 3: Commit**

```bash
git add payload/editions/desktop/first-boot.md
git commit -m "Document the two manual theming setup steps in Desktop first-boot notes"
```

---

### Task 5: Fix missing YAMIS icon theme wiring (Desktop, Node, Server)

**Files:**
- Modify: `payload/editions/desktop/mode.sh` (already added `ICON_THEME_REL="YAMIS.tar.gz"` in Task 3, Step 6 — nothing further needed here for Desktop)
- Modify: `payload/editions/node/mode.sh`
- Modify: `payload/editions/server/mode.sh`

**Interfaces:**
- Consumes: `install_icon_theme()` (already exists in `common.sh`, unchanged) — reads `ICON_THEME_REL` via `install.sh`'s existing `install_icon_theme "${ICON_THEME_REL:+$REPO_ROOT/$ICON_THEME_REL}"` call, already wired, no `install.sh` change needed.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Wire `node/mode.sh`**

Find the end of `payload/editions/node/mode.sh`:

```bash
FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Node"
```

Replace with:

```bash
FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Node"

ICON_THEME_REL="YAMIS.tar.gz"
```

- [ ] **Step 2: Wire `server/mode.sh`**

Find the end of `payload/editions/server/mode.sh`:

```bash
FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Server"
```

Replace with:

```bash
FIRST_BOOT_DIALOG_TITLE="Welcome to Khione Server"

ICON_THEME_REL="YAMIS.tar.gz"
```

- [ ] **Step 3: Syntax-check both files**

Run:
```bash
bash -n payload/editions/node/mode.sh
bash -n payload/editions/server/mode.sh
```
Expected: no output, exit 0 for both.

- [ ] **Step 4: Verify with grep**

Run: `grep -rn "ICON_THEME_REL" payload/editions/*/mode.sh`
Expected: four matches total — `desktop/mode.sh`, `node/mode.sh`, `server/mode.sh` (each `ICON_THEME_REL="YAMIS.tar.gz"`), and `ulw/mode.sh` (pre-existing, unchanged).

- [ ] **Step 5: Commit**

```bash
git add payload/editions/node/mode.sh payload/editions/server/mode.sh
git commit -m "Fix missing YAMIS icon theme install on Desktop/Node/Server"
```

Note: Desktop's `ICON_THEME_REL` line was already added and committed as part of Task 3 — this task's commit only needs Node and Server.

---

### Task 6: Remove the dead corrupted config block from all three `.knsv` files

**Files:**
- Modify: `payload/editions/desktop/desktopSetup.knsv`
- Modify: `payload/editions/node/nodeSetup.knsv`
- Modify: `payload/editions/server/serverSetup.knsv`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by other tasks. These are standalone binary (zip) file edits.

This is the same fix applied three times, once per `.knsv` file. The corrupted
block is byte-identical across all three
(`[Containments61Appletsts][126][Configuration][General]` followed by its
`launchers=` line), confirmed dead/orphaned (never read by Plasma — verified
via `kreadconfig6` against the live machine's own identical corruption, which
reads from the separate, correctly-nested `[Containments][61][Applets][126]...`
group instead).

- [ ] **Step 1: Write the fix script**

Create a scratch file (not part of the repo) to do the edit — save this to
`/tmp/claude-1000/-home-dob-Documents-Repos-Arch-Linux-Setups/494fb30f-3c66-400d-be46-cefdfd5cf3b6/scratchpad/fix-knsv-corruption.py`:

```python
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

CORRUPTED_HEADER = "[Containments61Appletsts][126][Configuration][General]"

def fix_knsv(knsv_path: Path) -> None:
    work_dir = Path(tempfile.mkdtemp(prefix="knsv-fix-"))
    extract_dir = work_dir / "extracted"
    with zipfile.ZipFile(knsv_path) as zf:
        namelist = zf.namelist()
        zf.extractall(extract_dir)

    appletsrc = extract_dir / "save" / "configs" / "plasma-org.kde.plasma.desktop-appletsrc"
    if not appletsrc.is_file():
        raise SystemExit(f"{knsv_path}: no appletsrc found, aborting")

    lines = appletsrc.read_text().splitlines(keepends=True)
    header_idx = None
    for i, line in enumerate(lines):
        if line.strip() == CORRUPTED_HEADER:
            header_idx = i
            break

    if header_idx is None:
        raise SystemExit(f"{knsv_path}: corrupted header not found, aborting")

    # Remove the header line and the launchers= line right after it.
    if not lines[header_idx + 1].strip().startswith("launchers="):
        raise SystemExit(f"{knsv_path}: unexpected line after corrupted header, aborting")

    del lines[header_idx:header_idx + 2]

    # Collapse the now-doubled blank line directly above into a single blank.
    if header_idx >= 1 and lines[header_idx - 1].strip() == "" and \
       header_idx < len(lines) and lines[header_idx].strip() == "":
        del lines[header_idx]

    appletsrc.write_text("".join(lines))

    # Re-zip with the exact same member list/order, replacing the original.
    fixed_zip = work_dir / "fixed.knsv"
    with zipfile.ZipFile(fixed_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in namelist:
            src = extract_dir / name
            if src.is_dir():
                zi = zipfile.ZipInfo(name + ("" if name.endswith("/") else "/"))
                zf.writestr(zi, b"")
            else:
                zf.write(src, arcname=name)

    shutil.copyfile(fixed_zip, knsv_path)
    shutil.rmtree(work_dir)
    print(f"Fixed {knsv_path}")

for p in sys.argv[1:]:
    fix_knsv(Path(p))
```

- [ ] **Step 2: Run it against all three `.knsv` files**

Run:
```bash
python3 -I /tmp/claude-1000/-home-dob-Documents-Repos-Arch-Linux-Setups/494fb30f-3c66-400d-be46-cefdfd5cf3b6/scratchpad/fix-knsv-corruption.py \
  payload/editions/desktop/desktopSetup.knsv \
  payload/editions/node/nodeSetup.knsv \
  payload/editions/server/serverSetup.knsv
```
Expected: three `Fixed ...` lines, one per file, no errors.

- [ ] **Step 3: Verify the corruption is gone and the real group is untouched, in all three files**

Run:
```bash
for f in payload/editions/desktop/desktopSetup.knsv payload/editions/node/nodeSetup.knsv payload/editions/server/serverSetup.knsv; do
  echo "=== $f ==="
  unzip -p "$f" save/configs/plasma-org.kde.plasma.desktop-appletsrc | grep -n "Appletsts" || echo "  (no corrupted header -- good)"
  unzip -p "$f" save/configs/plasma-org.kde.plasma.desktop-appletsrc | grep -n "^\[Containments\]\[61\]\[Applets\]\[126\]" 
  unzip -t "$f" | tail -1
done
```
Expected: for each file, "(no corrupted header -- good)", one matching `[Containments][61][Applets][126]...` line still present, and `unzip -t` reports "No errors detected in compressed data".

- [ ] **Step 4: Confirm the member list is unchanged (same files, same count)**

Run:
```bash
git diff --stat payload/editions/desktop/desktopSetup.knsv payload/editions/node/nodeSetup.knsv payload/editions/server/serverSetup.knsv
```
Expected: all three show as modified binary files (git reports binary diffs, no textual diff) — this just confirms the files changed and git recognizes them as the same tracked binaries, not new/renamed files.

- [ ] **Step 5: Commit**

```bash
git add payload/editions/desktop/desktopSetup.knsv payload/editions/node/nodeSetup.knsv payload/editions/server/serverSetup.knsv
git commit -m "Remove dead corrupted config block from shipped konsave profiles"
```

---

### Task 7: Final full-repo verification pass

**Files:** none (verification only).

- [ ] **Step 1: Syntax-check every shell script touched or added this plan**

Run:
```bash
bash -n payload/common/lib/common.sh
bash -n payload/install.sh
bash -n payload/editions/desktop/mode.sh
bash -n payload/editions/node/mode.sh
bash -n payload/editions/server/mode.sh
bash -n payload/common/theming-guards/betterdiscord-guard.sh
bash -n payload/common/theming-guards/adwsteamgtk-guard.sh
```
Expected: no output, exit 0 for every line.

- [ ] **Step 2: Confirm git history and clean working tree**

Run:
```bash
git log --oneline -8
git status
```
Expected: the 6 commits from Tasks 1-6 at the top of the log (in order), and a clean working tree (nothing uncommitted) — or, if the working tree isn't clean, review what's left before reporting done.

- [ ] **Step 3: Report to the user**

No code change here — summarize for the user: what shipped, that no live install/reboot could be tested in this environment, and that full confidence in the guard units activating and the icon fix resolving visually requires an actual ISO build + install.
