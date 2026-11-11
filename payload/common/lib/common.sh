#!/bin/bash
set -euo pipefail

require_user() {
  local u="$1"
  if ! id "$u" &>/dev/null; then
    echo "User '$u' does not exist. Exiting."
    exit 1
  fi
}

init_paths() {
  local repo_root="$1"
  local arch_user="$2"

  # Every edition carries its dotfiles at editions/<mode>/dotfiles by
  # convention; MODE_NAME is set by the mode.sh sourced before this runs.
  DOTFILES_DIR="$repo_root/editions/$MODE_NAME/dotfiles"

  USER_HOME="/home/$arch_user"
  USER_CONFIG="$USER_HOME/.config"
  USER_LOCAL="$USER_HOME/.local"
  USER_ICONS="$USER_HOME/.icons"
}

system_update() {
  echo "Updating system..."
  sudo pacman -Syu --noconfirm
}

ensure_git() {
  echo "Installing git..."
  sudo pacman -S --needed --noconfirm git
}

enable_multilib() {
  if ! grep -q "^\[multilib\]" /etc/pacman.conf; then
    echo "Enabling [multilib]..."
    sudo sed -i '/#\[multilib\]/,/#Include = \/etc\/pacman.d\/mirrorlist/ s/^#//' /etc/pacman.conf
    sudo pacman -Syu --noconfirm
  fi
}

install_official_packages() {
  local -n pkgs="$1"
  echo "Installing official packages..."
  sudo pacman -S --needed --noconfirm "${pkgs[@]}"
}

install_yay() {
  local arch_user="$1"

  log "Installing yay..."

  if command -v yay &>/dev/null; then
    log "yay already installed. Skipping."
    return 0
  fi

  local -a pacman_cmd=(pacman)
  if [[ "$(id -u)" -ne 0 ]]; then
    pacman_cmd=(sudo pacman)
  fi

  "${pacman_cmd[@]}" -S --needed --noconfirm git base-devel fakeroot
  if "${pacman_cmd[@]}" -Si debugedit &>/dev/null; then
    "${pacman_cmd[@]}" -S --needed --noconfirm debugedit
  fi

  if ! command -v fakeroot &>/dev/null; then
    echo "ERROR: fakeroot is missing after dependency install."
    exit 1
  fi

  rm -rf /tmp/yay
  sudo -u "$arch_user" git clone https://aur.archlinux.org/yay.git /tmp/yay
  pushd /tmp/yay >/dev/null

  sudo -u "$arch_user" env HOME="/home/$arch_user" PATH="/usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin" makepkg -s --noconfirm

  local pkg_file
  pkg_file="$(find /tmp/yay -maxdepth 1 -type f -name 'yay-[0-9]*-*.pkg.tar.*' ! -name '*.sig' | sort | head -n 1)"
  if [[ -z "$pkg_file" ]]; then
    echo "ERROR: Built yay package not found in /tmp/yay"
    exit 1
  fi

  "${pacman_cmd[@]}" -U --noconfirm "$pkg_file"

  popd >/dev/null
  rm -rf /tmp/yay
}

install_aur_packages() {
  local arch_user="$1"
  local -n pkgs="$2"

  echo "Installing AUR packages..."
  local failed=()
  for pkg in "${pkgs[@]}"; do
    echo "→ $pkg"
    if sudo -u "$arch_user" yay -S --needed --noconfirm "$pkg"; then
      :
    else
      failed+=("$pkg")
    fi
  done

  if [ ${#failed[@]} -ne 0 ]; then
    echo "AUR failures:"
    printf ' - %s\n' "${failed[@]}"
  fi
}

install_flatpak_packages() {
  local -n pkgs="$1"

  [ ${#pkgs[@]} -eq 0 ] && return 0
  command -v flatpak >/dev/null 2>&1 || return 0

  echo "Installing Flatpak packages..."
  local app
  for app in "${pkgs[@]}"; do
    echo "-> $app"
    flatpak install --system --noninteractive -y flathub "$app" || true
  done
}

enable_services() {
  local -n svcs="$1"
  [ ${#svcs[@]} -eq 0 ] && return 0
  echo "Enabling services..."
  for s in "${svcs[@]}"; do
    sudo systemctl enable "$s"
  done
}

mask_services() {
  local -n svcs="$1"
  [ ${#svcs[@]} -eq 0 ] && return 0
  echo "Masking services..."
  sudo systemctl mask "${svcs[@]}"
}

configure_firewall() {
  local -n rules="$1"
  local kernel_release
  local in_chroot=0

  echo "Configuring firewall..."
  sudo pacman -S --needed --noconfirm ufw
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  for r in "${rules[@]}"; do
    sudo ufw allow "$r"
  done

  if command -v systemd-detect-virt &>/dev/null && systemd-detect-virt --chroot --quiet; then
    in_chroot=1
  fi

  if [[ "$in_chroot" -eq 1 ]]; then
    echo "Skipping immediate UFW activation inside chroot."
    echo "UFW rules are configured and ufw.service will activate firewall on first boot."
    return 0
  fi

  kernel_release="$(uname -r)"
  if [[ ! -d "/lib/modules/$kernel_release" ]]; then
    echo "Skipping immediate UFW activation (running kernel modules '$kernel_release' not present in target root)."
    echo "UFW rules are configured and ufw.service will activate firewall on first boot."
    return 0
  fi

  if ! sudo ufw --force enable; then
    echo "Warning: UFW could not be enabled during install."
    echo "ufw.service is enabled and will retry activation on first boot."
  fi
}

configure_samba() {
  local conf="/etc/samba/smb.conf"
  if [[ -f "$conf" ]]; then
    echo "smb.conf already exists, skipping."
    return 0
  fi
  echo "Writing minimal smb.conf..."
  sudo mkdir -p /etc/samba
  sudo tee "$conf" >/dev/null <<'EOF'
[global]
    workgroup = WORKGROUP
    server string = Samba Server
    server role = standalone server
    security = user
    passdb backend = tdbsam
    log file = /var/log/samba/%m.log
    max log size = 50
    include = registry
EOF
}

configure_glance() {
  local config_source="$1"
  if [[ -z "$config_source" ]]; then
    echo "No Glance config for this mode, skipping."
    return 0
  fi
  if [[ ! -f "$config_source" ]]; then
    echo "ERROR: Glance config not found: $config_source"
    return 1
  fi
  # Overwrites the default config shipped by the glance-bin package.
  echo "Installing Glance config..."
  sudo install -Dm644 "$config_source" /etc/glance.yml

  # LAN-facing links in the config use @@GLANCE_HOST@@. Substitute the
  # machine's LAN IP: .local mDNS names don't resolve on all clients
  # (notably Android browsers). Falls back to <hostname>.local if the
  # IP can't be detected. Give the server a DHCP reservation so the
  # baked-in IP stays valid.
  local host
  host="$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || true)"
  if [[ -z "$host" ]]; then
    host="$(cat /etc/hostname 2>/dev/null || true)"
    host="${host:+${host}.local}"
    host="${host:-localhost}"
  fi
  sudo sed -i "s/@@GLANCE_HOST@@/${host}/g" /etc/glance.yml
}

configure_glance_helpers() {
  local src_dir="$1"
  if [[ -z "$src_dir" ]]; then
    echo "No Glance helpers for this mode, skipping."
    return 0
  fi
  if [[ ! -d "$src_dir" ]]; then
    echo "ERROR: Glance helpers dir not found: $src_dir"
    return 1
  fi
  echo "Installing Glance helper scripts and systemd units..."
  # SATA drive temperatures (glance-temps) come from the drivetemp module.
  echo drivetemp | sudo tee /etc/modules-load.d/drivetemp.conf >/dev/null
  # API-key env files are editable from the dashboard's Admin page (the
  # :8081 helper runs as glance), so they must exist and belong to glance.
  local envf
  for envf in /etc/glance-hass.env /etc/glance-bank.env; do
    sudo touch "$envf"
    sudo chown glance:glance "$envf"
    sudo chmod 600 "$envf"
  done
  local f name
  for f in "$src_dir"/*; do
    [[ -f "$f" ]] || continue
    name="$(basename "$f")"
    case "$name" in
      *.service|*.timer|*.path)
        sudo install -Dm644 "$f" "/etc/systemd/system/$name"
        ;;
      *.hook)
        sudo install -Dm644 "$f" "/etc/pacman.d/hooks/$name"
        ;;
      *.html|*.css)
        # Static assets served by Glance at /assets/ (dir must stay
        # writable by the glance user for the helper scripts).
        sudo install -d -o glance -g glance /var/lib/glance/assets
        sudo install -m644 "$f" "/var/lib/glance/assets/$name"
        ;;
      *)
        sudo install -Dm755 "$f" "/usr/local/bin/$name"
        ;;
    esac
  done
  sudo systemctl daemon-reload
}

configure_home_assistant() {
  local unit_source="$1"
  if [[ -z "$unit_source" ]]; then
    echo "No Home Assistant unit for this mode, skipping."
    return 0
  fi
  if [[ ! -f "$unit_source" ]]; then
    echo "ERROR: Home Assistant unit not found: $unit_source"
    return 1
  fi
  echo "Installing Home Assistant container unit..."
  # All HA state (account, devices, automations, history DB) lives here;
  # the container itself is disposable.
  sudo install -d -m755 /var/lib/hass
  sudo install -Dm644 "$unit_source" /etc/systemd/system/home-assistant.service
  # Stable /dev/zigbee symlink for the ZHA dongle passthrough (see the
  # unit's ExecStart); trigger so an already-plugged dongle gets the link.
  sudo install -Dm644 "$(dirname "$unit_source")/hass-zigbee.rules" \
    /etc/udev/rules.d/99-hass-zigbee.rules
  sudo udevadm control --reload-rules
  sudo udevadm trigger --subsystem-match=tty
  sudo systemctl daemon-reload
}

merge_ha_configuration_snippet() {
  local snippet_file="$1"
  local target_file="$2"
  local marker_begin="# --- khione-ha-dashboard:begin (managed by the Khione installer, do not edit between markers) ---"
  local marker_end="# --- khione-ha-dashboard:end ---"

  if [[ ! -f "$target_file" ]]; then
    echo "No existing HA configuration.yaml — seeding a fresh one."
    printf 'default_config:\n' | sudo tee "$target_file" >/dev/null
  fi

  # Always strip-then-reapply rather than skip-if-present: this function
  # gets called again whenever configuration-snippet.yaml's content
  # changes (not just on first install), so it must be safe to re-run
  # with different content, not just idempotent against identical
  # content. Handles stripping MULTIPLE existing blocks defensively, in
  # case an earlier version of this function (or a manual patch) ever
  # left more than one behind.
  local stripped
  stripped="$(sudo awk -v b="$marker_begin" -v e="$marker_end" '
    $0 == b { skip=1; next }
    $0 == e { skip=0; next }
    !skip { print }
  ' "$target_file")"

  {
    printf '%s\n' "$stripped"
    echo ""
    echo "$marker_begin"
    cat "$snippet_file"
    echo "$marker_end"
  } | sudo tee "$target_file" >/dev/null
}

configure_home_assistant_dashboard() {
  local dashboard_dir="$1"
  if [[ -z "$dashboard_dir" ]]; then
    echo "No HA dashboard assets for this mode, skipping."
    return 0
  fi
  if [[ ! -d "$dashboard_dir" ]]; then
    echo "ERROR: HA dashboard assets dir not found: $dashboard_dir"
    return 1
  fi
  if [[ ! -f "$dashboard_dir/configuration-snippet.yaml" ]]; then
    echo "ERROR: HA dashboard configuration snippet not found: $dashboard_dir/configuration-snippet.yaml"
    return 1
  fi
  echo "Installing Home Assistant dashboard assets..."

  # Collector scripts (glance-system/-disks/-temps) run as the glance user
  # and dual-write here; the HA container only ever reads this directory.
  sudo install -d -o glance -g glance -m755 /var/lib/hass/snapshots
  sudo install -d -m755 /var/lib/hass/themes
  sudo install -d -m755 /var/lib/hass/dashboards

  sudo install -Dm644 "$dashboard_dir/khione-theme.yaml" /var/lib/hass/themes/khione.yaml
  sudo install -Dm644 "$dashboard_dir/home-view.yaml" /var/lib/hass/dashboards/home-view.yaml

  merge_ha_configuration_snippet "$dashboard_dir/configuration-snippet.yaml" /var/lib/hass/configuration.yaml

  echo "Fetching HACS + card-mod + Mushroom + rss-news-card (best-effort)..."
  sudo install -d -m755 /var/lib/hass/custom_components
  sudo install -d -m755 /var/lib/hass/www/community

  if ! sudo test -d /var/lib/hass/custom_components/hacs; then
    # get.hacs.xyz auto-detects the HA config dir by looking for marker
    # files (e.g. .HA_VERSION) in its OWN cwd — it must be run FROM
    # /var/lib/hass, not wherever this installer script happens to be
    # running from (confirmed live: running it with the wrong cwd fails
    # with "Could not find the directory for Home Assistant").
    if curl -fsSL https://get.hacs.xyz -o /tmp/hacs-install.sh 2>/dev/null; then
      sudo bash -c 'cd /var/lib/hass && HACS_container=True bash /tmp/hacs-install.sh' || \
        echo "WARNING: HACS bootstrap failed — install it manually later via its own install script."
      rm -f /tmp/hacs-install.sh
    else
      echo "WARNING: HACS bootstrap failed (network?) — install it manually later via its own install script."
    fi
  fi

  _fetch_ha_frontend_asset() {
    # These single-file Lovelace plugins ship their built JS two different
    # ways depending on the project: attached as a GitHub release asset
    # (card-mod, rss-news-card do NOT do this; mushroom does), or committed
    # directly at the repo root (card-mod, rss-news-card do this; mushroom
    # does not) — confirmed live for all three. Try the release-asset URL
    # first, fall back to the raw repo file at the resolved latest tag.
    local name="$1" repo="$2" file="$3" dest="/var/lib/hass/www/community/$1"
    sudo install -d -m755 "$dest"
    local tag
    tag="$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" 2>/dev/null \
      | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
    if ! curl -fsSL "https://github.com/$repo/releases/latest/download/$file" -o "/tmp/$name.js" 2>/dev/null &&
       ! curl -fsSL "https://raw.githubusercontent.com/$repo/${tag:-master}/$file" -o "/tmp/$name.js"; then
      echo "WARNING: failed to download $name — card won't load until it's fetched manually."
      return 0
    fi
    sudo install -Dm644 "/tmp/$name.js" "$dest/$name.js"
    rm -f "/tmp/$name.js"
  }

  _fetch_ha_frontend_asset card-mod thomasloven/lovelace-card-mod card-mod.js
  _fetch_ha_frontend_asset mushroom piitaya/lovelace-mushroom mushroom.js
  _fetch_ha_frontend_asset rss-news-card suxlala/rss-news-card rss-news-card.js
}

configure_greetd() {
  local session_cmd="${1:-/usr/bin/startplasma-wayland}"
  echo "Configuring greetd..."
  sudo tee /etc/greetd/config.toml >/dev/null <<EOF
[terminal]
vt = 1

[default_session]
command = "tuigreet --remember --remember-session --time --time-format '%Y-%m-%d %H:%M:%S' --width 80 --container-padding 2 --greeting 'Please enter your password.' --cmd $session_cmd"
EOF
}

configure_pam_kwallet() {
  echo "Configuring PAM..."
  sudo tee /etc/pam.d/greetd >/dev/null <<'EOF'
#%PAM-1.0
auth       required     pam_securetty.so
auth       requisite    pam_nologin.so
auth       include      system-local-login
auth       optional     pam_kwallet5.so
account    include      system-local-login
session    include      system-local-login
session    optional     pam_kwallet5.so auto_start force_run
EOF

  sudo tee /etc/pam.d/login >/dev/null <<'EOF'
auth            optional        pam_kwallet5.so
session         optional        pam_kwallet5.so auto_start force_run
EOF
}

configure_pam() {
  echo "Configuring PAM..."
  sudo tee /etc/pam.d/greetd >/dev/null <<'EOF'
#%PAM-1.0
auth       required     pam_securetty.so
auth       requisite    pam_nologin.so
auth       include      system-local-login
auth       optional     pam_gnome_keyring.so
account    include      system-local-login
session    include      system-local-login
session    optional     pam_gnome_keyring.so auto_start
EOF

  sudo tee /etc/pam.d/login >/dev/null <<'EOF'
auth            optional        pam_gnome_keyring.so
session         optional        pam_gnome_keyring.so auto_start
EOF
}

set_wallet_enabled() {
  local arch_user="$1"
  sudo -u "$arch_user" kwriteconfig6 --file kdeglobals --group KDE --key WalletEnabled true
}

install_cursor_theme() {
  local arch_user="$1"
  local archive="$2"
  local archive_type="$3" # "gz" or "xz"

  echo "Installing cursor theme..."
  if [ ! -f "$archive" ]; then
    echo "Missing: $archive"
    exit 1
  fi
  sudo -u "$arch_user" mkdir -p "$USER_ICONS"

  case "$archive_type" in
    gz) sudo -u "$arch_user" tar -xzf "$archive" -C "$USER_ICONS" ;;
    xz) sudo -u "$arch_user" tar -xJf "$archive" -C "$USER_ICONS" ;;
    *)
      echo "Unknown cursor archive type: $archive_type"
      exit 1
      ;;
  esac
}

apply_dotfiles() {
  local arch_user="$1"
  local src="$2"

  echo "Applying dotfiles..."
  if [ ! -d "$src" ]; then
    echo "Missing dotfiles dir: $src"
    exit 1
  fi

  sudo -u "$arch_user" mkdir -p "$USER_CONFIG" "$USER_LOCAL"

  if [ -d "$src/config" ]; then
    # Copy every app dir under config/ as-is, so adding a new one to the
    # dotfiles tree is enough to ship it — no code change needed here.
    shopt -s nullglob dotglob
    local -a config_entries=("$src/config/"*)
    shopt -u nullglob dotglob
    if [ "${#config_entries[@]}" -gt 0 ]; then
      sudo -u "$arch_user" cp -r "${config_entries[@]}" "$USER_CONFIG/"
    fi
  fi

  if [ -d "$src/local" ]; then
    # Avoid failing when local/ exists but is empty.
    shopt -s nullglob dotglob
    local -a local_entries=("$src/local/"*)
    shopt -u nullglob dotglob
    if [ "${#local_entries[@]}" -gt 0 ]; then
      sudo -u "$arch_user" cp -r "${local_entries[@]}" "$USER_LOCAL/"
    fi
  fi

  if [ -d "$src/themes" ]; then
    # ~/.themes: GTK/window-manager themes (e.g. xfwm4 borders) that don't
    # live under .config or .local.
    shopt -s nullglob dotglob
    local -a theme_entries=("$src/themes/"*)
    shopt -u nullglob dotglob
    if [ "${#theme_entries[@]}" -gt 0 ]; then
      sudo -u "$arch_user" mkdir -p "$USER_HOME/.themes"
      sudo -u "$arch_user" cp -r "${theme_entries[@]}" "$USER_HOME/.themes/"
    fi
  fi
}

install_rootfs_files() {
  local src_dir="$1"
  if [[ -z "$src_dir" ]]; then
    echo "No rootfs overlay for this mode, skipping."
    return 0
  fi
  if [[ ! -d "$src_dir" ]]; then
    echo "ERROR: rootfs overlay dir not found: $src_dir"
    return 1
  fi
  echo "Installing system files from rootfs overlay..."
  # cp without -a, so the files end up owned by root regardless of how
  # they're checked out of git.
  sudo cp -r "$src_dir/." /
}

install_icon_theme() {
  local archive="$1"
  if [[ -z "$archive" ]]; then
    echo "No icon theme for this mode, skipping."
    return 0
  fi
  if [[ ! -f "$archive" ]]; then
    echo "ERROR: icon theme archive not found: $archive"
    return 1
  fi
  echo "Installing icon theme..."
  sudo mkdir -p /usr/share/icons
  sudo tar -xzf "$archive" -C /usr/share/icons/
}

configure_cursor_theme() {
  local theme_name="$1"
  local size="$2"
  if [[ -z "$theme_name" ]]; then
    echo "No cursor theme for this mode, skipping."
    return 0
  fi

  echo "Configuring system-wide cursor theme..."

  # The "default" icon theme is what libXcursor falls back to for any app
  # with no per-user override -- GTK, Qt, and plain Xlib clients (kitty
  # included) alike. Setting Gtk/CursorThemeName in xsettings only reaches
  # GTK apps that subscribe to XSETTINGS; kitty doesn't.
  sudo mkdir -p /usr/share/icons/default
  sudo tee /usr/share/icons/default/index.theme >/dev/null <<EOF
[Icon Theme]
Inherits=$theme_name
EOF

  # /etc/environment is read by pam_env for every login session (greetd
  # included), so XCURSOR_THEME/XCURSOR_SIZE reach every app via libXcursor
  # itself, system-wide for every user, without relying on the desktop
  # environment or a per-user .Xresources to set them.
  sudo touch /etc/environment
  sudo sed -i '/^XCURSOR_THEME=/d; /^XCURSOR_SIZE=/d' /etc/environment
  printf 'XCURSOR_THEME=%s\nXCURSOR_SIZE=%s\n' "$theme_name" "$size" | sudo tee -a /etc/environment >/dev/null
}

install_kitty_translucency_fix() {
  local arch_user="$1"
  local src_dir="$2"
  if [[ -z "$src_dir" ]]; then
    echo "No kitty translucency fix for this mode, skipping."
    return 0
  fi
  if [[ ! -d "$src_dir" ]]; then
    echo "ERROR: kitty translucency fix dir not found: $src_dir"
    return 1
  fi

  local f
  for f in /usr/bin/kitty \
           /usr/share/applications/kitty.desktop \
           /usr/share/applications/kitty-open.desktop \
           /usr/share/xfce4/helpers/kitty.desktop; do
    if [[ ! -e "$f" ]]; then
      echo "Kitty translucency fix skipped: missing $f"
      return 0
    fi
  done

  # kitty asks GLX for a framebuffer config that is transparent AND
  # sRGB-capable. On GPUs/VMs whose GLX advertises the sRGB extensions but
  # has zero sRGB-capable configs (e.g. software-rendered llvmpipe, no
  # glamor — the VBoxVGA adapter this rice was captured on), nothing
  # matches and kitty silently falls back to a 24-bit, alpha-less visual,
  # so background_opacity has nothing for picom to blend. This LD_PRELOAD
  # shim hides those two extension names from kitty only, so it picks a
  # 32-bit ARGB config instead. See kitty-alpha.c for the full story.
  echo "Installing kitty translucency fix..."

  local user_home="/home/$arch_user"
  local lib="$user_home/.local/lib/kitty-alpha"
  local apps="$user_home/.local/share/applications"
  local helpers="$user_home/.local/share/xfce4/helpers"

  sudo -u "$arch_user" mkdir -p "$lib" "$apps" "$helpers"
  sudo -u "$arch_user" cp "$src_dir/kitty-alpha.c" "$lib/kitty-alpha.c"
  sudo -u "$arch_user" cp "$src_dir/kitty" "$lib/kitty"
  sudo -u "$arch_user" chmod 644 "$lib/kitty-alpha.c"
  sudo -u "$arch_user" chmod 755 "$lib/kitty"

  if command -v gcc >/dev/null 2>&1; then
    # Prints one harmless -Wnonnull-compare warning.
    sudo -u "$arch_user" gcc -shared -fPIC -O2 -Wall \
      -o "$lib/kitty-alpha.so" "$lib/kitty-alpha.c" -ldl
  else
    echo "gcc not found, using the prebuilt kitty-alpha.so (x86_64, glibc >= 2.34)"
    sudo -u "$arch_user" cp "$src_dir/kitty-alpha.so" "$lib/kitty-alpha.so"
    sudo -u "$arch_user" chmod 755 "$lib/kitty-alpha.so"
  fi

  # .desktop files can't expand ~ or $HOME, so the absolute path to the
  # wrapper has to be baked in here rather than shipped as a static file.
  sed "s|^Exec=kitty|Exec=$lib/kitty|; s|^TryExec=kitty|TryExec=$lib/kitty|" \
    /usr/share/applications/kitty.desktop | sudo -u "$arch_user" tee "$apps/kitty.desktop" >/dev/null
  sed "s|^Exec=kitty|Exec=$lib/kitty|; s|^TryExec=kitty|TryExec=$lib/kitty|" \
    /usr/share/applications/kitty-open.desktop | sudo -u "$arch_user" tee "$apps/kitty-open.desktop" >/dev/null
  sed "s|^X-XFCE-Binaries=kitty;|X-XFCE-Binaries=$lib/kitty;|" \
    /usr/share/xfce4/helpers/kitty.desktop | sudo -u "$arch_user" tee "$helpers/kitty.desktop" >/dev/null

  sudo -u "$arch_user" update-desktop-database "$apps" 2>/dev/null || true

  for f in "$apps/kitty.desktop" "$apps/kitty-open.desktop" "$helpers/kitty.desktop"; do
    grep -q "$lib/kitty" "$f" || echo "WARNING: $f does not point at $lib/kitty; check its Exec/X-XFCE-Binaries lines"
  done
}

install_kara_pager_from_source() {
  local arch_user="$1"
  local kara_git_url="${2:-https://github.com/dhruv8sh/kara.git}"
  local kara_git_ref="${3:-v1.0.0}"
  local source_dir="/home/$arch_user/.local/src/kara"
  local plasmoid_dir="/home/$arch_user/.local/share/plasma/plasmoids/org.dhruv8sh.kara"

  echo "Installing Kara pager from source..."

  sudo pacman -S --needed --noconfirm \
    base-devel cmake extra-cmake-modules git \
    qt6-base qt6-declarative kwin libplasma plasma-activities plasma-workspace \
    vulkan-headers vulkan-icd-loader

  sudo -u "$arch_user" mkdir -p "/home/$arch_user/.local/src"
  if [ -d "$source_dir/.git" ]; then
    sudo -u "$arch_user" git -C "$source_dir" fetch --tags --prune
  else
    sudo -u "$arch_user" git clone "$kara_git_url" "$source_dir"
  fi

  sudo -u "$arch_user" git -C "$source_dir" checkout --force "$kara_git_ref"

  # Konsave can restore an older Kara plasmoid snapshot. Clear it before reinstall.
  sudo -u "$arch_user" rm -rf "$plasmoid_dir"

  # Run upstream installer flow because Kara currently expects this path setup.
  sudo -u "$arch_user" env HOME="/home/$arch_user" bash -lc "
set -euo pipefail
cd '$source_dir'
bash ./install.sh
"

  # Refresh KDE cache so the new plugin paths/modules are discovered.
  sudo -u "$arch_user" env HOME="/home/$arch_user" bash -lc "
set -euo pipefail
if command -v kbuildsycoca6 >/dev/null 2>&1; then
  kbuildsycoca6 || true
fi
"

  # Back up the freshly compiled plasmoid so the theme switcher can restore it
  # after konsave -a clobbers it with a stale QML-only snapshot from the .knsv.
  local kara_backup_dir="/home/$arch_user/.local/share/khione/kara-plasmoid-backup"
  if [ -d "$plasmoid_dir" ]; then
    sudo -u "$arch_user" rm -rf "$kara_backup_dir"
    sudo -u "$arch_user" mkdir -p "$(dirname "$kara_backup_dir")"
    sudo -u "$arch_user" cp -a "$plasmoid_dir" "$kara_backup_dir"
    echo "Kara plasmoid backed up to $kara_backup_dir"
  fi
}

disable_kde_welcome_popup() {
  local arch_user="$1"
  local autostart_dir="/home/$arch_user/.config/autostart"
  local override_file="$autostart_dir/org.kde.plasma-welcome.desktop"

  echo "Disabling KDE welcome popup..."

  sudo -u "$arch_user" mkdir -p "$autostart_dir"
  sudo -u "$arch_user" tee "$override_file" >/dev/null <<'EOF'
[Desktop Entry]
Hidden=true
EOF

  # Plasma Welcome's KDED module reads these values from ~/.config/plasma-welcomerc.
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key LastSeenVersion "999.0.0" || true
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key ShowUpdatePage false || true
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key LiveEnvironment false || true

  # Keep this for older/alternate implementations.
  sudo -u "$arch_user" kwriteconfig6 --file plasma-welcomerc --group General --key FirstRun false || true

  # Belt-and-suspenders: disable the KDED launcher module if present.
  sudo -u "$arch_user" kwriteconfig6 --file kded6rc --group Module-plasma-welcome --key autoload false || true
  sudo -u "$arch_user" kwriteconfig6 --file kded5rc --group Module-plasma-welcome --key autoload false || true
}

install_first_boot_dialog_autostart_required() {
  local arch_user="$1"
  local markdown_file="$2"
  local dialog_title="${3:-Khione}"
  local renderer_source="${4:-$(dirname "$markdown_file")/render-first-boot-dialog.py}"

  if [ ! -f "$markdown_file" ]; then
    echo "Missing required first-boot dialog markdown: $markdown_file"
    exit 1
  fi

  if [ ! -f "$renderer_source" ]; then
    echo "Missing required first-boot renderer helper: $renderer_source"
    exit 1
  fi

  echo "Installing first-boot dialog one-shot autostart..."

  local state_dir="/home/$arch_user/.config/khione"
  local message_file="$state_dir/first-boot-dialog.md"
  local title_file="$state_dir/first-boot-dialog-title.txt"
  local renderer_script="/home/$arch_user/.local/bin/khione-render-first-boot-dialog.py"
  local user_script="/home/$arch_user/.local/bin/khione-first-boot-dialog-once.sh"
  local autostart_dir="/home/$arch_user/.config/autostart"
  local desktop_file="$autostart_dir/khione-first-boot-dialog.desktop"

  sudo -u "$arch_user" mkdir -p "/home/$arch_user/.local/bin" "$autostart_dir" "$state_dir"
  sudo -u "$arch_user" cp "$markdown_file" "$message_file"
  sudo -u "$arch_user" cp "$renderer_source" "$renderer_script"
  sudo -u "$arch_user" chmod +x "$renderer_script"
  printf '%s\n' "$dialog_title" | sudo -u "$arch_user" tee "$title_file" >/dev/null

  sudo -u "$arch_user" tee "$user_script" >/dev/null <<'EOF'
#!/bin/bash
set -euo pipefail

AUTOSTART_FILE="$HOME/.config/autostart/khione-first-boot-dialog.desktop"
STATE_DIR="$HOME/.config/khione"
STATE_FILE="$STATE_DIR/first-boot-dialog-shown"
MESSAGE_FILE="$STATE_DIR/first-boot-dialog.md"
TITLE_FILE="$STATE_DIR/first-boot-dialog-title.txt"
HTML_FILE="$STATE_DIR/first-boot-dialog.html"
RENDERER_SCRIPT="$HOME/.local/bin/khione-render-first-boot-dialog.py"

mkdir -p "$STATE_DIR"

if [ -f "$STATE_FILE" ]; then
  rm -f "$AUTOSTART_FILE" "$0"
  exit 0
fi

TITLE="Khione"
if [ -f "$TITLE_FILE" ]; then
  TITLE="$(cat "$TITLE_FILE")"
fi

if [ ! -f "$MESSAGE_FILE" ]; then
  printf '%s\n' "Welcome to Khione." >"$MESSAGE_FILE"
fi

calc_dialog_size() {
  local size sw sh
  DIALOG_WIDTH=960
  DIALOG_HEIGHT=680

  if command -v xrandr >/dev/null 2>&1; then
    size="$(xrandr 2>/dev/null | awk '/\*/{print $1; exit}')" || true
    if [[ "$size" =~ ^([0-9]+)x([0-9]+)$ ]]; then
      sw="${BASH_REMATCH[1]}"
      sh="${BASH_REMATCH[2]}"

      DIALOG_WIDTH=$((sw * 72 / 100))
      DIALOG_HEIGHT=$((sh * 76 / 100))

      # Each of these is a bare `(( cond )) && assign` used as a statement,
      # not a condition. Under set -e, whichever of these runs LAST becomes
      # calc_dialog_size()'s own exit status; if its cond is false (common --
      # e.g. 1080p scales to height 820, under the 920 cap, so no clamping
      # needed), that status is non-zero, and since the function is called
      # unguarded below, set -e aborts the whole script right there. This is
      # exactly why the dialog never showed on a real screen. `|| true` on
      # all four makes this robust even if they get reordered later.
      (( DIALOG_WIDTH < 760 )) && DIALOG_WIDTH=760 || true
      (( DIALOG_WIDTH > 1320 )) && DIALOG_WIDTH=1320 || true
      (( DIALOG_HEIGHT < 520 )) && DIALOG_HEIGHT=520 || true
      (( DIALOG_HEIGHT > 920 )) && DIALOG_HEIGHT=920 || true
    fi
  fi
}

calc_dialog_size

if command -v kdialog >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3 || command -v python || true)"

  if [ -n "$PYTHON_BIN" ] && [ -f "$RENDERER_SCRIPT" ] && "$PYTHON_BIN" "$RENDERER_SCRIPT" "$MESSAGE_FILE" "$HTML_FILE"; then
    HTML_CONTENT="$(cat "$HTML_FILE")"
    kdialog --title "$TITLE" --msgbox "$HTML_CONTENT" || kdialog --title "$TITLE" --textbox "$MESSAGE_FILE" "$DIALOG_WIDTH" "$DIALOG_HEIGHT" || true
  else
    kdialog --title "$TITLE" --textbox "$MESSAGE_FILE" "$DIALOG_WIDTH" "$DIALOG_HEIGHT" || true
  fi
elif command -v zenity >/dev/null 2>&1; then
  zenity --text-info --title="$TITLE" --filename="$MESSAGE_FILE" --width="$DIALOG_WIDTH" --height="$DIALOG_HEIGHT" || true
elif command -v notify-send >/dev/null 2>&1; then
  notify-send "$TITLE" "$(head -n 6 "$MESSAGE_FILE" | tr '\n' ' ')" || true
fi

touch "$STATE_FILE"
rm -f "$AUTOSTART_FILE" "$HTML_FILE" "$0"
EOF

  sudo -u "$arch_user" chmod +x "$user_script"

  sudo -u "$arch_user" tee "$desktop_file" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Khione First Boot Message
Exec=$user_script
X-KDE-autostart-after=plasma-desktop
OnlyShowIn=KDE;XFCE;
EOF
}

install_theme_switcher_required() {
  local arch_user="$1"
  local profiles_source_dir="$2"
  local metadata_source_file="$3"
  local switcher_source="$4"
  local wallpapers_source_dir="$5"
  local metadata_helper_source="$6"
  local entry_sep=$'\x1f'

  if [ ! -d "$profiles_source_dir" ]; then
    echo "Missing required theme profile directory: $profiles_source_dir"
    exit 1
  fi

  if [ ! -f "$switcher_source" ]; then
    echo "Missing required theme switcher helper: $switcher_source"
    exit 1
  fi

  if [ ! -f "$metadata_source_file" ]; then
    echo "Missing required theme metadata file: $metadata_source_file"
    exit 1
  fi

  if [ ! -d "$wallpapers_source_dir" ]; then
    echo "Missing required wallpaper source directory: $wallpapers_source_dir"
    exit 1
  fi

  if [ ! -f "$metadata_helper_source" ]; then
    echo "Missing required theme metadata helper: $metadata_helper_source"
    exit 1
  fi

  local python_bin
  python_bin="$(command -v python3 || command -v python || true)"
  if [ -z "$python_bin" ]; then
    echo "python3 or python is required to validate theme metadata."
    exit 1
  fi

  local -a metadata_rows=()
  mapfile -t metadata_rows < <("$python_bin" "$metadata_helper_source" installer-rows "$metadata_source_file")

  if [ "${#metadata_rows[@]}" -eq 0 ]; then
    echo "No valid profiles found in theme metadata: $metadata_source_file"
    exit 1
  fi

  local -a required_knsv_files=()
  local -a required_wallpapers=()
  local -a required_dotfiles=()
  local row id knsv wallpaper dotfiles

  for row in "${metadata_rows[@]}"; do
    IFS="$entry_sep" read -r id knsv wallpaper dotfiles <<<"$row"
    required_knsv_files+=("$knsv")
    required_dotfiles+=("$dotfiles")

    if [ -n "$wallpaper" ]; then
      required_wallpapers+=("$wallpaper")
    fi
  done

  echo "Installing theme switcher..."

  local user_home="/home/$arch_user"
  local user_bin="$user_home/.local/bin"
  local user_data_dir="$user_home/.local/share/khione"
  local user_profiles_dir="$user_data_dir/konsave-profiles"
  local user_metadata_file="$user_data_dir/theme-profiles.json"
  local user_wallpapers_dir="$user_data_dir/wallpapers"
  local user_dotfiles_dir="$user_data_dir/theme-dotfiles"
  local switcher_script="$user_bin/khione-theme-switcher"
  local metadata_helper_script="$user_bin/khione-theme-metadata"
  local app_dir="$user_home/.local/share/applications"
  local desktop_file="$app_dir/khione-theme-switcher.desktop"
  sudo -u "$arch_user" mkdir -p "$user_bin" "$user_profiles_dir" "$user_wallpapers_dir" "$user_dotfiles_dir" "$app_dir"

  # konsave is the core dependency of the theme switcher — install it now via pipx
  # so the switcher can call it at install time and at runtime.
  echo "Installing konsave via pipx..."
  sudo pacman -S --needed --noconfirm python-pipx
  sudo -u "$arch_user" env HOME="$user_home" pipx install --force konsave

  sudo -u "$arch_user" cp "$switcher_source" "$switcher_script"
  sudo -u "$arch_user" cp "$metadata_helper_source" "$metadata_helper_script"
  sudo -u "$arch_user" chmod +x "$switcher_script"
  sudo -u "$arch_user" chmod +x "$metadata_helper_script"

  sudo -u "$arch_user" find "$user_profiles_dir" -maxdepth 1 -type f -name '*.knsv' -delete

  local src_file
  local -a matches=()
  for knsv in "${required_knsv_files[@]}"; do
    mapfile -t matches < <(find "$profiles_source_dir" -maxdepth 2 -type f -name "$knsv")
    if [ "${#matches[@]}" -eq 0 ]; then
      echo "Missing .knsv referenced by metadata: $knsv"
      exit 1
    fi
    if [ "${#matches[@]}" -gt 1 ]; then
      echo "Ambiguous .knsv filename (found multiple matches): $knsv"
      printf ' - %s\n' "${matches[@]}"
      exit 1
    fi
    src_file="${matches[0]}"
    sudo -u "$arch_user" cp -f "$src_file" "$user_profiles_dir/"

    # Install the cursor theme archive if one sits alongside this .knsv.
    # konsave saves cursor settings by name (in kdeglobals/kcminputrc) but does
    # not bundle the cursor files themselves — we must install them separately.
    local knsv_dir
    knsv_dir="$(dirname "$src_file")"
    if [ -f "$knsv_dir/cursor.tar.gz" ]; then
      echo "Installing cursor theme for profile $knsv..."
      install_cursor_theme "$arch_user" "$knsv_dir/cursor.tar.gz" "gz"
    elif [ -f "$knsv_dir/cursor.tar.xz" ]; then
      echo "Installing cursor theme for profile $knsv..."
      install_cursor_theme "$arch_user" "$knsv_dir/cursor.tar.xz" "xz"
    fi
  done

  sudo -u "$arch_user" cp "$metadata_source_file" "$user_metadata_file"

  # Keep wallpaper assets in a stable location for the theme switcher.
  sudo -u "$arch_user" find "$user_wallpapers_dir" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) -delete

  for wallpaper in "${required_wallpapers[@]}"; do
    mapfile -t matches < <(find "$wallpapers_source_dir" -maxdepth 2 -type f -name "$wallpaper")
    if [ "${#matches[@]}" -eq 0 ]; then
      echo "Missing wallpaper referenced by metadata: $wallpaper"
      exit 1
    fi
    if [ "${#matches[@]}" -gt 1 ]; then
      echo "Ambiguous wallpaper filename (found multiple matches): $wallpaper"
      printf ' - %s\n' "${matches[@]}"
      exit 1
    fi
    src_file="${matches[0]}"
    sudo -u "$arch_user" cp -f "$src_file" "$user_wallpapers_dir/"
  done

  # Keep per-theme dotfiles in a stable location for theme switches.
  sudo -u "$arch_user" find "$user_dotfiles_dir" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

  local -A copied_dotfiles=()
  local dotfiles_key dotfiles_source dotfiles_dest
  for dotfiles_key in "${required_dotfiles[@]}"; do
    if [ -n "${copied_dotfiles[$dotfiles_key]:-}" ]; then
      continue
    fi
    copied_dotfiles[$dotfiles_key]=1

    dotfiles_source="$profiles_source_dir/$dotfiles_key/dotfiles"
    if [ ! -d "$dotfiles_source" ]; then
      echo "Missing dotfiles directory referenced by metadata: $dotfiles_source"
      exit 1
    fi

    dotfiles_dest="$user_dotfiles_dir/$dotfiles_key"
    sudo -u "$arch_user" mkdir -p "$dotfiles_dest"

    if [ -d "$dotfiles_source/config" ]; then
      sudo -u "$arch_user" cp -a "$dotfiles_source/config" "$dotfiles_dest/"
    fi
    if [ -d "$dotfiles_source/local" ]; then
      sudo -u "$arch_user" cp -a "$dotfiles_source/local" "$dotfiles_dest/"
    fi
    if [ ! -d "$dotfiles_dest/config" ] && [ ! -d "$dotfiles_dest/local" ]; then
      echo "Dotfiles directory has no config/ or local/ payload: $dotfiles_source"
      exit 1
    fi
  done

  sudo -u "$arch_user" tee "$desktop_file" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Khione Theme Switcher
Comment=Apply a saved KDE/Konsave profile
Exec=$switcher_script
Icon=preferences-desktop-theme
Terminal=false
Categories=Settings;DesktopSettings;
EOF
}

apply_theme_via_switcher_required() {
  local arch_user="$1"
  local theme_id="$2"

  local user_home="/home/$arch_user"
  local switcher_script="$user_home/.local/bin/khione-theme-switcher"
  local metadata_helper_script="$user_home/.local/bin/khione-theme-metadata"
  local user_data_dir="$user_home/.local/share/khione"
  local user_profiles_dir="$user_data_dir/konsave-profiles"
  local user_metadata_file="$user_data_dir/theme-profiles.json"
  local user_wallpapers_dir="$user_data_dir/wallpapers"
  local user_dotfiles_dir="$user_data_dir/theme-dotfiles"

  if [ ! -x "$switcher_script" ]; then
    echo "Theme switcher script not found: $switcher_script"
    exit 1
  fi

  if [ ! -f "$metadata_helper_script" ]; then
    echo "Theme metadata helper script not found: $metadata_helper_script"
    exit 1
  fi

  echo "Applying default theme via theme switcher logic..."

  sudo -u "$arch_user" env \
    HOME="$user_home" \
    KHIONE_KNSV_DIR="$user_profiles_dir" \
    KHIONE_THEME_CONFIG="$user_metadata_file" \
    KHIONE_WALLPAPER_DIR="$user_wallpapers_dir" \
    KHIONE_DOTFILES_DIR="$user_dotfiles_dir" \
    KHIONE_THEME_METADATA_HELPER="$metadata_helper_script" \
    "$switcher_script" --apply-id "$theme_id" --no-reload

  # Resolve the absolute wallpaper path for this theme so we can install a
  # first-login autostart that applies it via Plasma's live scripting API.
  local python_bin wallpaper_rel wallpaper_abs
  python_bin="$(command -v python3 || command -v python || true)"
  if [ -n "$python_bin" ] && [ -f "$user_metadata_file" ] && [ -f "$metadata_helper_script" ]; then
    wallpaper_rel="$("$python_bin" "$metadata_helper_script" installer-rows "$user_metadata_file" \
                      | awk -F$'\x1f' -v tid="$theme_id" '$1==tid{print $3}')"
    if [ -n "$wallpaper_rel" ]; then
      wallpaper_abs="$user_wallpapers_dir/$wallpaper_rel"
      if [ -f "$wallpaper_abs" ]; then
        install_wallpaper_autostart "$arch_user" "$wallpaper_abs"
      fi
    fi
  fi
}

install_audio_base() {
  local arch_user="$1"
  local repo_root="$2"
  local setup_script_source="$repo_root/editions/desktop/fl-miku-setup.sh"

  echo "Setting up audio production environment..."

  if [[ ! -f "$setup_script_source" ]]; then
    echo "Missing fl-miku-setup.sh: $setup_script_source"
    exit 1
  fi

  # Add the user to the realtime group so PipeWire/audio processes can request
  # real-time scheduling priority (created by the realtime-privileges package).
  if getent group realtime >/dev/null 2>&1; then
    echo "Adding $arch_user to realtime group..."
    sudo usermod -aG realtime "$arch_user"
  else
    echo "Warning: realtime group not found. Ensure realtime-privileges is installed."
  fi

  local user_home="/home/$arch_user"
  local user_bin="$user_home/.local/bin"
  local app_dir="$user_home/.local/share/applications"
  local prefix_root="$user_home/.local/share/wineprefixes"
  local setup_script="$user_bin/fl-miku-setup"

  sudo -u "$arch_user" mkdir -p \
    "$user_bin" \
    "$app_dir" \
    "$prefix_root" \
    "$user_home/Installers/Audio/MikuV4X"

  sudo -u "$arch_user" cp "$setup_script_source" "$setup_script"
  sudo -u "$arch_user" chmod +x "$setup_script"

  # Desktop entry so the setup wizard appears in KRunner immediately after install.
  sudo -u "$arch_user" tee "$app_dir/fl-miku-setup.desktop" >/dev/null <<EOF
[Desktop Entry]
Name=Set Up FL Studio + Miku
Comment=Initialise the fl-miku Wine prefix and install FL Studio
Exec=$setup_script
Icon=audio-x-generic
Terminal=true
Type=Application
Categories=Audio;
Keywords=fl;studio;miku;wine;setup;
EOF

  echo "Audio production environment ready."
  echo "Run 'Set Up FL Studio + Miku' from KRunner after first login to complete setup."
}

install_wallpaper_autostart() {
  local arch_user="$1"
  local wallpaper_abs="$2"

  local user_home="/home/$arch_user"
  local state_dir="$user_home/.config/khione"
  local wallpaper_state="$state_dir/pending-wallpaper.txt"
  local user_script="$user_home/.local/bin/khione-set-wallpaper-once.sh"
  local autostart_dir="$user_home/.config/autostart"
  local desktop_file="$autostart_dir/khione-set-wallpaper.desktop"

  echo "Installing first-login wallpaper autostart..."

  sudo -u "$arch_user" mkdir -p "$autostart_dir" "$state_dir" "$(dirname "$user_script")"

  # Write the wallpaper path to a state file so the autostart script knows
  # which image to apply.
  printf '%s\n' "$wallpaper_abs" | sudo -u "$arch_user" tee "$wallpaper_state" >/dev/null

  sudo -u "$arch_user" tee "$user_script" >/dev/null <<'SCRIPT'
#!/bin/bash
set -euo pipefail

# First-login one-shot: apply wallpaper via Plasma's live scripting API.
# Removes itself after a successful run.

STATE_DIR="$HOME/.config/khione"
WALLPAPER_STATE="$STATE_DIR/pending-wallpaper.txt"
AUTOSTART_FILE="$HOME/.config/autostart/khione-set-wallpaper.desktop"
SELF="$0"

if [ ! -f "$WALLPAPER_STATE" ]; then
  # Nothing to do — clean up and exit.
  rm -f "$AUTOSTART_FILE" "$SELF"
  exit 0
fi

WALLPAPER_PATH="$(cat "$WALLPAPER_STATE")"
if [ ! -f "$WALLPAPER_PATH" ]; then
  echo "Khione wallpaper autostart: wallpaper file missing: $WALLPAPER_PATH" >&2
  rm -f "$WALLPAPER_STATE" "$AUTOSTART_FILE" "$SELF"
  exit 0
fi

# Locate qdbus (Plasma 6 ships qdbus6; some systems alias it as qdbus).
QDBUS=""
for candidate in qdbus6 qdbus; do
  if command -v "$candidate" >/dev/null 2>&1; then
    QDBUS="$candidate"
    break
  fi
done
if [ -z "$QDBUS" ]; then
  echo "Khione wallpaper autostart: qdbus/qdbus6 not found" >&2
  exit 0
fi

WALLPAPER_URL="file://$WALLPAPER_PATH"

# The lock screen wallpaper isn't covered by desktops() below, and konsave's
# restored kscreenlockerrc still points at whichever machine captured the
# theme snapshot. Fix it directly — this is a plain config write, no need to
# wait for plasmashell.
if command -v kwriteconfig6 >/dev/null 2>&1; then
  kwriteconfig6 --file kscreenlockerrc \
    --group Greeter --group Wallpaper --group org.kde.image --group General \
    --key Image "$WALLPAPER_URL"
  kwriteconfig6 --file kscreenlockerrc \
    --group Greeter --group Wallpaper --group org.kde.image --group General \
    --key PreviewImage "$WALLPAPER_URL"
fi

# Use Plasma's JavaScript scripting API to set the wallpaper on every desktop.
# desktops() returns one Desktop object per screen × activity, so this covers
# all monitors and all activities.
JS_SCRIPT="$(cat <<EOF
var ds = desktops();
for (var i = 0; i < ds.length; i++) {
    var d = ds[i];
    d.wallpaperPlugin = "org.kde.image";
    d.currentConfigGroup = Array("Wallpaper", "org.kde.image", "General");
    d.writeConfig("Image", "$WALLPAPER_URL");
}
EOF
)"

# Plasma may not be fully ready immediately on first login.  Retry a few times
# with a short delay.
MAX_RETRIES=10
DELAY=3
for attempt in $(seq 1 "$MAX_RETRIES"); do
  if "$QDBUS" org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "$JS_SCRIPT" 2>/dev/null; then
    echo "Khione: wallpaper applied successfully."
    rm -f "$WALLPAPER_STATE" "$AUTOSTART_FILE" "$SELF"
    exit 0
  fi
  sleep "$DELAY"
done

echo "Khione wallpaper autostart: all retries exhausted" >&2
# Leave the autostart in place so it retries on next login.
SCRIPT

  sudo -u "$arch_user" chmod +x "$user_script"

  sudo -u "$arch_user" tee "$desktop_file" >/dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Khione Wallpaper Setup
Exec=$user_script
X-KDE-autostart-after=plasma-desktop
OnlyShowIn=KDE;
EOF
}

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

configure_betterdiscord() {
  local arch_user="$1"
  local guard_dir="$2"

  if [[ -z "$guard_dir" ]]; then
    echo "No BetterDiscord config for this mode, skipping."
    return 0
  fi

  echo "Configuring BetterDiscord..."

  local user_home="/home/$arch_user"
  local themes_dir="$user_home/.config/BetterDiscord/themes"
  # BD's data path for the stable channel -- matches this distro's discord
  # package always being pinned to CHANNEL=stable (see betterdiscordctl's
  # own table entry above).
  local channel_dir="$user_home/.config/BetterDiscord/data/stable"
  local theme_url="https://raw.githubusercontent.com/catppuccin/discord/main/themes/mocha.theme.css"

  # Catppuccin Mocha theme (the distro default): best-effort, network
  # dependent, same as Spicetify's downloads. Drops the file into BD's
  # Themes folder so it's visible/toggleable in BD's Themes list (BD lists
  # it by its @name header), AND separately into BD's Custom CSS slot with
  # that builtin force-enabled in settings.json, so it actually applies
  # without the user needing to find and flip it on themselves.
  #
  # The Custom CSS path reaches into BD's internal settings.json schema
  # (verified against BD's current `development` branch source --
  # stores/json.ts for the file path/format, builtins/customcss.ts for the
  # ("settings", "customcss", "customcss") key BD checks to auto-enable it
  # on startup) rather than its documented UI. BD's own loader merges
  # unknown/missing keys from its real defaults, so a partial file here is
  # safe; if a future BD version changes this schema, this just silently
  # stops auto-enabling rather than breaking anything.
  sudo -u "$arch_user" mkdir -p "$themes_dir" "$channel_dir"
  if sudo -u "$arch_user" curl -fsSL -o "$themes_dir/mocha.theme.css" "$theme_url"; then
    sudo -u "$arch_user" cp "$themes_dir/mocha.theme.css" "$channel_dir/custom.css"
    if ! sudo -u "$arch_user" python3 -I -c "
import json
path = '$channel_dir/settings.json'
try:
    with open(path) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = {}
data.setdefault('customcss', {})['customcss'] = True
with open(path, 'w') as f:
    json.dump(data, f, indent=4)
"; then
      echo "Warning: could not enable BetterDiscord's Custom CSS setting, skipping."
    fi
  else
    echo "Warning: Catppuccin Mocha BetterDiscord theme download failed, skipping (network issue?)."
  fi
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

configure_discord_launcher_guard() {
  local arch_user="$1"
  local guard_dir="$2"

  if [[ -z "$guard_dir" ]]; then
    echo "No Discord launcher guard source for this mode, skipping."
    return 0
  fi

  echo "Installing Discord launcher self-healing guard..."
  install_user_systemd_guard "$arch_user" \
    "$guard_dir/discord-launcher-guard.sh" \
    "$guard_dir/discord-launcher-guard.path" \
    "$guard_dir/discord-launcher-guard.service"
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

configure_spicetify_guard() {
  local arch_user="$1"
  local guard_dir="$2"

  if [[ -z "$guard_dir" ]]; then
    echo "No Spicetify guard source for this mode, skipping."
    return 0
  fi

  echo "Installing Spicetify first-apply guard..."
  install_user_systemd_guard "$arch_user" \
    "$guard_dir/spicetify-guard.sh" \
    "$guard_dir/spicetify-guard.path" \
    "$guard_dir/spicetify-guard.service"
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
  local themes_dir="$user_home/.config/spicetify/Themes"
  local catppuccin_dir="$themes_dir/catppuccin"
  local tmp_zip="/tmp/khione-spicetify-marketplace.zip"
  local tmp_catppuccin_tar="/tmp/khione-spicetify-catppuccin.tar.gz"
  local tmp_catppuccin_extract="/tmp/khione-spicetify-catppuccin-extract"

  # Pacman hook: always installed, no network needed. Templates the username
  # (never hardcoded) into the reapply script before it goes to /usr/local/bin.
  sed "s/@@ARCH_USER@@/$arch_user/g" "$guard_dir/spicetify-reapply.sh" \
    | sudo tee /usr/local/bin/spicetify-reapply.sh >/dev/null
  sudo chmod 755 /usr/local/bin/spicetify-reapply.sh
  sudo chown root:root /usr/local/bin/spicetify-reapply.sh
  sudo install -Dm644 "$guard_dir/spicetify-reapply.hook" /etc/pacman.d/hooks/spicetify-reapply.hook

  # /opt/spotify ships root-owned, mode 755, from the spotify AUR package --
  # Spicetify needs to write into it to patch the UI. This is Spicetify's
  # own documented fix for this exact Arch packaging situation.
  sudo chmod a+rw /opt/spotify
  sudo chmod -R a+rw /opt/spotify/Apps

  # Marketplace (custom app) + startup-page (extension): best-effort, network
  # dependent. A GitHub hiccup here must not abort the whole install.
  sudo -u "$arch_user" mkdir -p "$marketplace_dir" "$extensions_dir"

  local marketplace_tag
  marketplace_tag="$(curl -fsSL https://api.github.com/repos/spicetify/marketplace/releases/latest \
    | grep -oP '"tag_name":\s*"\K[^"]+' | head -n1 || true)"

  if [ -n "$marketplace_tag" ]; then
    if sudo -u "$arch_user" curl -fsSL -o "$tmp_zip" \
        "https://github.com/spicetify/marketplace/releases/download/$marketplace_tag/marketplace.zip"; then
      if sudo -u "$arch_user" unzip -q -o "$tmp_zip" -d "$marketplace_dir"; then
        if [ -d "$marketplace_dir/marketplace-dist" ]; then
          sudo -u "$arch_user" find "$marketplace_dir/marketplace-dist" -maxdepth 1 -mindepth 1 -exec mv -t "$marketplace_dir" {} + || true
          sudo -u "$arch_user" rmdir "$marketplace_dir/marketplace-dist" 2>/dev/null || true
        fi
      else
        echo "Warning: Spicetify Marketplace zip failed to extract, skipping."
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

  # Catppuccin Mocha theme (the distro default): best-effort, network
  # dependent, same as Marketplace/startup-page above. Official theme repo
  # has no release assets, so grab the main branch tarball directly.
  sudo -u "$arch_user" mkdir -p "$themes_dir"
  rm -rf "$tmp_catppuccin_extract"
  if sudo -u "$arch_user" curl -fsSL -o "$tmp_catppuccin_tar" \
      "https://github.com/catppuccin/spicetify/archive/refs/heads/main.tar.gz"; then
    sudo -u "$arch_user" mkdir -p "$tmp_catppuccin_extract"
    if sudo -u "$arch_user" tar -xzf "$tmp_catppuccin_tar" -C "$tmp_catppuccin_extract"; then
      local extracted_theme_dir
      extracted_theme_dir="$(find "$tmp_catppuccin_extract" -maxdepth 2 -type d -name catppuccin | head -n1)"
      if [ -n "$extracted_theme_dir" ]; then
        rm -rf "$catppuccin_dir"
        sudo -u "$arch_user" cp -r "$extracted_theme_dir" "$catppuccin_dir"
      else
        echo "Warning: Catppuccin theme tarball didn't contain a catppuccin/ folder, skipping."
      fi
    else
      echo "Warning: Catppuccin theme tarball failed to extract, skipping."
    fi
  else
    echo "Warning: Catppuccin theme download failed, skipping (network issue?)."
  fi
  rm -rf "$tmp_catppuccin_tar" "$tmp_catppuccin_extract"

  if [ -f "$marketplace_dir/manifest.json" ]; then
    sudo -u "$arch_user" env HOME="$user_home" spicetify config custom_apps marketplace || true
  fi
  if [ -s "$extensions_dir/startup-page.js" ]; then
    sudo -u "$arch_user" env HOME="$user_home" spicetify config extensions startup-page.js || true
  fi
  # Catppuccin Mocha is the distro default theme (matches color.ini's
  # supported schemes: frappe, latte, macchiato, mocha). Only set it if the
  # theme folder actually landed -- pointing current_theme at a theme that
  # isn't on disk would just make apply fail the same way the prefs_path
  # issue above did.
  if [ -f "$catppuccin_dir/color.ini" ]; then
    sudo -u "$arch_user" env HOME="$user_home" spicetify config current_theme catppuccin || true
    sudo -u "$arch_user" env HOME="$user_home" spicetify config color_scheme mocha || true
    sudo -u "$arch_user" env HOME="$user_home" spicetify config overwrite_assets 1 || true
  fi
  # This apply is expected to fail on a fresh install: Spotify has never been
  # launched yet at this point, so ~/.config/spotify/prefs doesn't exist, and
  # spicetify can't patch without it. configure_spicetify_guard's path unit
  # picks this up and applies for real once that file appears.
  sudo -u "$arch_user" env HOME="$user_home" spicetify backup apply || true
}

