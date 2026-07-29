#!/bin/bash
set -euo pipefail

PROFILE_DIR="${FROSTEARCH_KNSV_DIR:-$HOME/.local/share/frostearch/konsave-profiles}"
CONFIG_FILE="${FROSTEARCH_THEME_CONFIG:-$HOME/.local/share/frostearch/theme-profiles.json}"
WALLPAPER_DIR="${FROSTEARCH_WALLPAPER_DIR:-$HOME/.local/share/frostearch/wallpapers}"
DOTFILES_DIR="${FROSTEARCH_DOTFILES_DIR:-$HOME/.local/share/frostearch/theme-dotfiles}"
METADATA_HELPER="${FROSTEARCH_THEME_METADATA_HELPER:-$HOME/.local/bin/frostearch-theme-metadata}"

ENTRY_SEP=$'\x1f'

read_theme_entries() {
  local config_file="$1"

  if [ ! -f "$config_file" ]; then
  echo "Theme config file not found: $config_file" >&2
  return 1
  fi

  local python_bin
  python_bin="$(command -v python3 || command -v python || true)"
  if [ -z "$python_bin" ]; then
  echo "python3 or python is required to parse theme metadata JSON." >&2
  return 1
  fi

  if [ ! -f "$METADATA_HELPER" ]; then
  echo "Theme metadata helper not found: $METADATA_HELPER" >&2
  return 1
  fi

  "$python_bin" "$METADATA_HELPER" switcher-rows "$config_file"
}

patch_wallpaper_config() {
  local wallpaper_path="$1"

  [ -f "$wallpaper_path" ] || return 1

  local python_bin
  python_bin="$(command -v python3 || command -v python || true)"
  [ -n "$python_bin" ] || return 1

  # Directly patch the on-disk appletsrc so that every containment's wallpaper
  # Image entry points to the new file before plasmashell restarts and reads it.
  # The qdbus writeConfig approach only updates the currently-running containment
  # IDs, but konsave may have written different IDs into the file.
  local appletsrc="$HOME/.config/plasma-org.kde.plasma.desktop-appletsrc"
  if [ ! -f "$appletsrc" ]; then
    echo "Plasma wallpaper config not found: $appletsrc" >&2
    return 1
  fi

  if ! "$python_bin" - "$appletsrc" "$wallpaper_path" <<'PY'
import sys, re
from pathlib import Path

cfg_file = Path(sys.argv[1])
new_url  = "file://" + sys.argv[2]

lines  = cfg_file.read_text().splitlines(keepends=True)
in_wp  = False
result = []
replaced = 0

for line in lines:
    stripped = line.strip()
    if stripped.startswith('['):
        in_wp = bool(re.search(
            r'\[Wallpaper\]\[org\.kde\.image\]\[General\]', stripped
        ))
        result.append(line)
    elif in_wp and re.match(r'^Image\s*=', stripped):
        eol = '\r\n' if line.endswith('\r\n') else '\n'
        result.append(f'Image={new_url}{eol}')
        replaced += 1
    else:
        result.append(line)

cfg_file.write_text(''.join(result))
if replaced == 0:
    raise SystemExit("No desktop wallpaper Image keys were patched in appletsrc")
PY
  then
    return 1
  fi

  # Also update the lock-screen background.
  if command -v kwriteconfig6 >/dev/null 2>&1; then
    kwriteconfig6 --file kscreenlockerrc --group Greeter --group Wallpaper \
      --group org.kde.image --group General --key Image "$wallpaper_path" || true
    kwriteconfig6 --file kscreenlockerrc --group Greeter --group Wallpaper \
      --group org.kde.image --group General --key PreviewImage "$wallpaper_path" || true
  fi
}

apply_wallpaper_qdbus() {
  # Use Plasma's live JavaScript scripting API via qdbus to set the wallpaper
  # on every desktop (all screens × all activities).  This is the only reliable
  # approach because it uses the ACTUAL runtime containment objects rather than
  # the on-disk IDs which may not match after konsave restores a profile from a
  # different machine.
  local wallpaper_path="$1"

  [ -f "$wallpaper_path" ] || return 1

  local qdbus_bin
  qdbus_bin="$(command -v qdbus6 || command -v qdbus || true)"
  [ -n "$qdbus_bin" ] || return 1

  local wallpaper_url="file://$wallpaper_path"

  local js_script
  js_script="$(cat <<JSEOF
var ds = desktops();
for (var i = 0; i < ds.length; i++) {
    var d = ds[i];
    d.wallpaperPlugin = "org.kde.image";
    d.currentConfigGroup = Array("Wallpaper", "org.kde.image", "General");
    d.writeConfig("Image", "$wallpaper_url");
}
JSEOF
)"

  "$qdbus_bin" org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "$js_script" 2>/dev/null
}

apply_color_scheme() {
  local color_scheme="$1"
  local interactive_mode="$2"

  [ -n "$color_scheme" ] || return 0

  # In an active session, use Plasma's apply tool.  It both writes the value
  # to kdeglobals AND sends D-Bus notifications to every running Qt/KDE app
  # so they repaint immediately (Dolphin, Konsole, System Settings, etc.).
  # Clear the key first so the tool doesn't skip with "already applied" —
  # konsave -a may have already written the same scheme name.
  if [ "$interactive_mode" -eq 1 ] && command -v plasma-apply-colorscheme >/dev/null 2>&1 \
    && command -v kwriteconfig6 >/dev/null 2>&1; then
    kwriteconfig6 --file kdeglobals --group General --key ColorScheme --delete || true
    kwriteconfig6 --file kdeglobals --group General --key ColorSchemeHash --delete || true
    plasma-apply-colorscheme "$color_scheme" >/dev/null 2>&1 || true
  fi

  # Ensure the value is persisted even if the apply tool was unavailable.
  if command -v kwriteconfig6 >/dev/null 2>&1; then
    kwriteconfig6 --file kdeglobals --group General --key ColorScheme "$color_scheme" || true
  fi
}

refresh_running_kde_apps() {
  # Rebuild the system configuration cache so running apps pick up new
  # settings, icons, MIME types, etc.  This is safe and non-disruptive.
  if command -v kbuildsycoca6 >/dev/null 2>&1; then
    kbuildsycoca6 >/dev/null 2>&1 || true
  fi
}

signal_running_apps_to_reload() {
  # Systemic config-reload signal for non-Qt apps (terminals, editors, etc.).
  #
  # After dotfiles are applied the configs of apps like kitty, btop,
  # alacritty, etc. have changed on disk.  Many modern applications honour
  # SIGUSR1 as a "re-read your config" signal.  Rather than maintaining a
  # hardcoded list, we:
  #   1. Derive candidate process names from the config directories we just
  #      wrote (e.g. config/kitty/... → "kitty").
  #   2. Find running processes that match each name via pgrep.
  #   3. Only send SIGUSR1 if the process handles the signal — either via a
  #      traditional handler (SigCgt) or via signalfd/sigwaitinfo (SigBlk
  #      without SigIgn).  This avoids accidentally terminating apps that
  #      use the default SIGUSR1 disposition (which is to terminate).
  local -a app_names=("$@")
  [ "${#app_names[@]}" -eq 0 ] && return 0
  command -v pgrep >/dev/null 2>&1 || return 0

  local name pid sig_caught sig_blocked sig_ignored
  for name in "${app_names[@]}"; do
    [ -n "$name" ] || continue
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      [ -r "/proc/$pid/status" ] || continue
      sig_caught="$(awk '/^SigCgt:/{print $2}' "/proc/$pid/status" 2>/dev/null)" || continue
      sig_blocked="$(awk '/^SigBlk:/{print $2}' "/proc/$pid/status" 2>/dev/null)" || continue
      sig_ignored="$(awk '/^SigIgn:/{print $2}' "/proc/$pid/status" 2>/dev/null)" || continue
      [ -n "$sig_caught" ] && [ -n "$sig_blocked" ] && [ -n "$sig_ignored" ] || continue
      # SIGUSR1 is signal 10 on Linux.  Bit (10-1) = 9 → mask 0x200.
      #
      # Traditional handler:  SigCgt has the bit → app uses signal()/sigaction().
      # signalfd / sigwaitinfo: SigBlk has the bit (signal blocked so it queues
      #   on the fd) and SigIgn does NOT (not discarded).  Modern event-loop apps
      #   like kitty use this pattern.
      local handles_usr1=0
      if (( 16#${sig_caught} & 16#200 )); then
        handles_usr1=1
      elif (( 16#${sig_blocked} & 16#200 )) && ! (( 16#${sig_ignored} & 16#200 )); then
        handles_usr1=1
      fi
      if [ "$handles_usr1" -eq 1 ]; then
        kill -USR1 "$pid" 2>/dev/null || true
      fi
    done < <(pgrep -x "$name" 2>/dev/null || true)
  done
}

refresh_plasma_theme() {
  local qdbus_bin
  qdbus_bin="$(command -v qdbus || command -v qdbus6 || true)"

  if [ -n "$qdbus_bin" ]; then
    "$qdbus_bin" org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true
  fi

  if command -v kquitapp6 >/dev/null 2>&1 && command -v plasmashell >/dev/null 2>&1; then
    kquitapp6 plasmashell >/dev/null 2>&1 || true
    sleep 2

    # Kara v1.0+ is a compiled C++ QML plugin. Its paths must be in the environment
    # when plasmashell starts — they are not inherited from the installed session
    # if we restart plasmashell manually. Export them in the current process so
    # the nohup child inherits them automatically.
    local kara_qml="$HOME/.local/lib/qml/org/dhruv8sh/kara"
    if [ -d "$kara_qml" ]; then
      local kara_env="$HOME/.config/plasma-workspace/env/kara.sh"
      if [ -f "$kara_env" ]; then
        # shellcheck source=/dev/null
        set +u
        source "$kara_env" || true
        set -u
      else
        export QML2_IMPORT_PATH="$HOME/.local/lib/qml${QML2_IMPORT_PATH:+:$QML2_IMPORT_PATH}"
        export QT_PLUGIN_PATH="$HOME/.local/lib/plugins${QT_PLUGIN_PATH:+:$QT_PLUGIN_PATH}"
        export XDG_DATA_DIRS="$HOME/.local/share${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"
      fi
    fi

    nohup plasmashell --replace >/dev/null 2>&1 &
  fi
}

apply_cursor_theme() {
  # Apply the cursor theme that konsave -a just wrote to kcminputrc.
  #
  # konsave writes the config key but doesn't notify the compositor.
  # plasma-apply-cursortheme both writes the config AND sends the
  # CursorChanged D-Bus notification that makes KWin actually switch.
  #
  # Catch: the tool compares the requested theme against kcminputrc and
  # short-circuits with "already set" if they match.  Since konsave already
  # wrote our desired theme, the tool would do nothing.  We clear the key
  # first so the tool sees a mismatch and performs the full apply.
  command -v plasma-apply-cursortheme >/dev/null 2>&1 || return 0
  command -v kwriteconfig6 >/dev/null 2>&1 || return 0

  local kcminputrc="$HOME/.config/kcminputrc"
  [ -f "$kcminputrc" ] || return 0

  local cursor_theme="" cursor_size=""
  local in_mouse=0
  while IFS= read -r line; do
    local stripped="${line%%[[:space:]]}"
    stripped="${stripped##[[:space:]]}"
    case "$stripped" in
      \[Mouse\]) in_mouse=1 ;;
      \[*) in_mouse=0 ;;
      cursorTheme=*) [ "$in_mouse" -eq 1 ] && cursor_theme="${stripped#cursorTheme=}" ;;
      cursorSize=*) [ "$in_mouse" -eq 1 ] && cursor_size="${stripped#cursorSize=}" ;;
    esac
  done < "$kcminputrc"

  [ -n "$cursor_theme" ] || return 0

  # Clear so plasma-apply-cursortheme doesn't skip with "already set".
  kwriteconfig6 --file kcminputrc --group Mouse --key cursorTheme --delete

  local -a cmd=(plasma-apply-cursortheme "$cursor_theme")
  [ -n "$cursor_size" ] && cmd+=(--size "$cursor_size")

  "${cmd[@]}" 2>&1 || true
}

restore_kara_plasmoid() {
  # konsave -a restores an older QML-only Kara snapshot from the .knsv export,
  # overwriting the compiled C++ plasmoid.  This function restores the backup
  # that was saved during install_kara_pager_from_source.
  local backup_dir="$HOME/.local/share/frostearch/kara-plasmoid-backup"
  local target_dir="$HOME/.local/share/plasma/plasmoids/org.dhruv8sh.kara"

  [ -d "$backup_dir" ] || return 0

  rm -rf "$target_dir"
  cp -a "$backup_dir" "$target_dir"
  echo "Restored Kara plasmoid from backup."
}

apply_theme_dotfiles() {
  local theme_dotfiles_key="${1:-}"
  local theme_id="${2:-}"

  local -a candidate_keys=()
  if [ -n "$theme_dotfiles_key" ]; then
    candidate_keys+=("$theme_dotfiles_key")
  fi
  if [ -n "$theme_id" ] && [ "$theme_id" != "$theme_dotfiles_key" ]; then
    candidate_keys+=("$theme_id")
  fi

  local source_root=""
  local candidate
  for candidate in "${candidate_keys[@]}"; do
    if [ -d "$DOTFILES_DIR/$candidate" ]; then
      source_root="$DOTFILES_DIR/$candidate"
      break
    fi
  done

  if [ -z "$source_root" ]; then
    echo "Theme dotfiles directory not found under: $DOTFILES_DIR (tried keys: ${candidate_keys[*]:-none})" >&2
    return 1
  fi

  local state_dir="$HOME/.local/share/frostearch"
  local state_file="$state_dir/active-theme-dotfiles.txt"
  mkdir -p "$state_dir" "$HOME/.config" "$HOME/.local"

  # Remove the previously managed theme files so we do not leave stale entries
  # behind when switching between themes with different app configs.
  # SAFETY: Only remove individual files — never rm -rf directories.
  if [ -f "$state_file" ]; then
    while IFS= read -r rel || [ -n "$rel" ]; do
      [ -n "$rel" ] || continue
      local target=""
      case "$rel" in
        config/*) target="$HOME/.config/${rel#config/}" ;;
        local/*)  target="$HOME/.local/${rel#local/}" ;;
      esac
      if [ -n "$target" ] && [ -f "$target" ]; then
        rm -f "$target"
      fi
    done < "$state_file"
  fi

  # Copy each individual file from the source tree, creating parent directories
  # as needed.  Track every file by its relative path so we can safely remove
  # only those exact files on the next theme switch.
  local -a managed_entries=()
  local prefix
  for prefix in config local; do
    [ -d "$source_root/$prefix" ] || continue
    local dest_base
    case "$prefix" in
      config) dest_base="$HOME/.config" ;;
      local)  dest_base="$HOME/.local" ;;
    esac
    while IFS= read -r -d '' src_file; do
      local rel_path="${src_file#"$source_root/$prefix/"}"
      mkdir -p "$dest_base/$(dirname "$rel_path")"
      cp -f "$src_file" "$dest_base/$rel_path"
      managed_entries+=("$prefix/$rel_path")
    done < <(find "$source_root/$prefix" -type f -print0)
  done

  if [ "${#managed_entries[@]}" -eq 0 ]; then
    echo "Theme dotfiles directory is empty: $source_root" >&2
    return 1
  fi

  printf '%s\n' "${managed_entries[@]}" > "$state_file"
}

find_konsave_bin() {
  if [ -x "$HOME/.local/bin/konsave" ]; then
    printf '%s\n' "$HOME/.local/bin/konsave"
    return 0
  fi
  if command -v konsave >/dev/null 2>&1; then
    command -v konsave
    return 0
  fi
  return 1
}

pick_profile_kdialog() {
  local -n _ids_ref=$1
  local -n _labels_ref=$2
  local -a args=()
  local first=1
  local i

  for ((i = 0; i < ${#_ids_ref[@]}; i++)); do
    local state="off"
    if [ "$first" -eq 1 ]; then
      state="on"
      first=0
    fi
    args+=("${_ids_ref[$i]}" "${_labels_ref[$i]}" "$state")
  done

  kdialog --title "FrosteArch Theme Switcher" \
    --radiolist "Select a theme profile:" "${args[@]}"
}

main() {
  local apply_id=""
  local no_reload=0

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --apply-id)
        if [ "$#" -lt 2 ]; then
          echo "--apply-id requires a value." >&2
          exit 1
        fi
        apply_id="$2"
        shift 2
        ;;
      --no-reload)
        no_reload=1
        shift
        ;;
      *)
        echo "Unknown argument: $1" >&2
        exit 1
        ;;
    esac
  done

  local interactive_mode=1
  if [ -n "$apply_id" ]; then
    interactive_mode=0
  fi

  if [ ! -d "$PROFILE_DIR" ]; then
    echo "Theme profile directory not found: $PROFILE_DIR" >&2
    exit 1
  fi

  if [ "$interactive_mode" -eq 1 ] && ! command -v kdialog >/dev/null 2>&1; then
    echo "kdialog is required for the FrosteArch Theme Switcher." >&2
    exit 1
  fi

  shopt -s nullglob
  local -a knsv_files=("$PROFILE_DIR"/*.knsv)
  shopt -u nullglob

  if [ "${#knsv_files[@]}" -eq 0 ]; then
    echo "No .knsv profiles found in: $PROFILE_DIR" >&2
    exit 1
  fi

  local konsave_bin
  if ! konsave_bin="$(find_konsave_bin)"; then
    echo "konsave was not found. Install it first (pipx install konsave)." >&2
    exit 1
  fi

  local -a entry_rows=()
  mapfile -t entry_rows < <(read_theme_entries "$CONFIG_FILE")
  if [ "${#entry_rows[@]}" -eq 0 ]; then
    echo "No valid profiles found in theme config: $CONFIG_FILE" >&2
    exit 1
  fi

  local -a entry_ids=()
  local -a entry_names=()
  local -a entry_desc=()
  local -a entry_knsv=()
  local -a entry_profile_names=()
  local -a entry_color_schemes=()
  local -a entry_wallpapers=()
  local -a entry_dotfiles=()
  local -a entry_labels=()

  local row
  for row in "${entry_rows[@]}"; do
    local id name desc knsv profile_name color_scheme wallpaper dotfiles
    IFS="$ENTRY_SEP" read -r id name desc knsv profile_name color_scheme wallpaper dotfiles <<<"$row"
    if [ -z "$dotfiles" ]; then
      dotfiles="$id"
    fi
    entry_ids+=("$id")
    entry_names+=("$name")
    entry_desc+=("$desc")
    entry_knsv+=("$knsv")
    entry_profile_names+=("$profile_name")
    entry_color_schemes+=("$color_scheme")
    entry_wallpapers+=("$wallpaper")
    entry_dotfiles+=("$dotfiles")
    if [ -n "$desc" ]; then
      entry_labels+=("$name - $desc")
    else
      entry_labels+=("$name")
    fi
  done

  local selected=""
  if [ "$interactive_mode" -eq 1 ]; then
    selected="$(pick_profile_kdialog entry_ids entry_labels || true)"
    if [ -z "$selected" ]; then
      exit 0
    fi
  else
    selected="$apply_id"
  fi

  local selected_idx=-1
  local i
  for ((i = 0; i < ${#entry_ids[@]}; i++)); do
    if [ "${entry_ids[$i]}" = "$selected" ]; then
      selected_idx=$i
      break
    fi
  done

  if [ "$selected_idx" -lt 0 ]; then
    echo "Invalid selection returned from UI: $selected" >&2
    exit 1
  fi

  local selected_name="${entry_names[$selected_idx]}"
  local selected_profile_name="${entry_profile_names[$selected_idx]}"
  local selected_knsv_rel="${entry_knsv[$selected_idx]}"
  local selected_color_scheme="${entry_color_schemes[$selected_idx]}"
  local selected_wallpaper_rel="${entry_wallpapers[$selected_idx]}"
  local selected_dotfiles_key="${entry_dotfiles[$selected_idx]}"
  local selected_file="$selected_knsv_rel"

  if [[ "$selected_file" != /* ]]; then
    selected_file="$PROFILE_DIR/$selected_file"
  fi

  if [ ! -f "$selected_file" ]; then
    echo "Selected profile file not found: $selected_file" >&2
    exit 1
  fi

  "$konsave_bin" -i "$selected_file" >/dev/null 2>&1
  "$konsave_bin" -a "$selected_profile_name"

  # konsave -a restores an old Kara QML snapshot from the .knsv profile.
  # Restore the compiled C++ version from the backup saved during install.
  restore_kara_plasmoid

  # Capture the PREVIOUS theme's managed dotfile entries BEFORE apply_theme_dotfiles
  # overwrites the state file.  We need these later to signal apps whose configs were
  # removed (e.g. switching server→desktop removes kitty.conf — kitty should still be
  # told to reload so it picks up the change).
  local _old_dotfiles_entries=""
  local _dotfiles_state_path="$HOME/.local/share/frostearch/active-theme-dotfiles.txt"
  if [ -f "$_dotfiles_state_path" ]; then
    _old_dotfiles_entries="$(cat "$_dotfiles_state_path")"
  fi

  if ! apply_theme_dotfiles "$selected_dotfiles_key" "$selected"; then
    if [ "$interactive_mode" -eq 1 ] && command -v kdialog >/dev/null 2>&1; then
      kdialog --title "FrosteArch Theme Switcher" --sorry "Could not apply dotfiles for theme: $selected_name\n\nThe main theme has been applied successfully."
    else
      echo "Warning: Could not apply dotfiles for theme: $selected_name" >&2
    fi
    # Continue — dotfiles failure should not prevent the rest of the theme from applying.
  fi

  local selected_wallpaper=""
  if [ -n "$selected_wallpaper_rel" ]; then
    selected_wallpaper="$selected_wallpaper_rel"
    if [[ "$selected_wallpaper" != /* ]]; then
      selected_wallpaper="$WALLPAPER_DIR/$selected_wallpaper"
    fi
    if ! patch_wallpaper_config "$selected_wallpaper"; then
      if [ "$interactive_mode" -eq 1 ] && command -v kdialog >/dev/null 2>&1; then
        kdialog --title "FrosteArch Theme Switcher" --error "Failed to apply wallpaper: $selected_wallpaper"
      else
        echo "Failed to apply wallpaper: $selected_wallpaper" >&2
      fi
      exit 1
    fi
  fi

  # Ensure the color scheme is written to kdeglobals regardless of reload mode.
  # konsave -a writes it too, but apply_color_scheme also handles the force-apply
  # trick in interactive mode (below) that notifies running Qt apps.
  if [ "$no_reload" -eq 1 ]; then
    # Non-interactive / no-reload: just persist.
    if [ -n "$selected_color_scheme" ] && command -v kwriteconfig6 >/dev/null 2>&1; then
      kwriteconfig6 --file kdeglobals --group General --key ColorScheme "$selected_color_scheme" || true
    fi
  fi

  if [ "$no_reload" -eq 0 ]; then
    refresh_plasma_theme
    refresh_running_kde_apps

    # Apply the color scheme AFTER plasmashell restarts.  plasma-apply-colorscheme
    # writes kdeglobals and sends a D-Bus notification to every running Qt/KDE
    # app (Dolphin, Konsole, System Settings, etc.) so they repaint immediately.
    # Doing this after the restart ensures the notification reaches the new
    # plasmashell too.
    apply_color_scheme "$selected_color_scheme" "$interactive_mode"

    # Apply cursor theme via the official Plasma tool AFTER plasmashell restarts.
    # konsave -a writes kcminputrc but the running compositor needs an explicit
    # CursorChanged notification to pick up the new theme.
    apply_cursor_theme

    # Signal non-Qt apps (kitty, btop, alacritty, etc.) to reload their configs.
    # We derive process names from the config directories that were just written
    # AND from the previous theme's entries (captured before apply_theme_dotfiles
    # overwrote the state file).  This ensures apps whose configs were removed
    # during a theme switch are also told to reload.
    local dotfiles_state="$HOME/.local/share/frostearch/active-theme-dotfiles.txt"
    local _combined_entries=""
    if [ -f "$dotfiles_state" ]; then
      _combined_entries="$(cat "$dotfiles_state")"
    fi
    if [ -n "$_old_dotfiles_entries" ]; then
      _combined_entries="${_combined_entries}${_combined_entries:+$'\n'}${_old_dotfiles_entries}"
    fi
    if [ -n "$_combined_entries" ]; then
      local -a reload_app_names=()
      local _entry _app
      while IFS= read -r _entry; do
        _app=""
        case "$_entry" in
          config/*/*)
            _app="${_entry#config/}"
            _app="${_app%%/*}"
            ;;
          local/share/*/*)
            _app="${_entry#local/share/}"
            _app="${_app%%/*}"
            ;;
        esac
        if [ -n "$_app" ] && [[ " ${reload_app_names[*]:-} " != *" $_app "* ]]; then
          reload_app_names+=("$_app")
        fi
      done <<< "$_combined_entries"
      signal_running_apps_to_reload "${reload_app_names[@]}"
    fi

    # Apply wallpaper via the live scripting API AFTER plasmashell restarts.
    # The on-disk appletsrc patch alone is unreliable because konsave-restored
    # containment/activity IDs may differ from the fresh Plasma session's.
    # Retry in a loop since the new plasmashell needs time to become responsive.
    if [ -n "$selected_wallpaper" ]; then
      local wp_retries=0
      while [ "$wp_retries" -lt 10 ]; do
        if apply_wallpaper_qdbus "$selected_wallpaper"; then
          break
        fi
        wp_retries=$((wp_retries + 1))
        sleep 2
      done
    fi
  fi

  if [ "$interactive_mode" -eq 1 ] && command -v kdialog >/dev/null 2>&1; then
    if [ "$no_reload" -eq 0 ]; then
      kdialog --title "FrosteArch Theme Switcher" --msgbox "Applied theme profile: $selected_name\n\nPlasma components were reloaded to apply changes immediately."
    else
      kdialog --title "FrosteArch Theme Switcher" --msgbox "Applied theme profile: $selected_name"
    fi
  fi
}

main "$@"
