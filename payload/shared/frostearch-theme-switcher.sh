#!/bin/bash
set -euo pipefail

PROFILE_DIR="${FROSTEARCH_KNSV_DIR:-$HOME/.local/share/frostearch/konsave-profiles}"
CONFIG_FILE="${FROSTEARCH_THEME_CONFIG:-$HOME/.local/share/frostearch/theme-profiles.json}"
WALLPAPER_DIR="${FROSTEARCH_WALLPAPER_DIR:-$HOME/.local/share/frostearch/wallpapers}"

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

  "$python_bin" - "$config_file" <<'PY'
import json
import sys
from pathlib import Path

sep = "\x1f"
config_path = Path(sys.argv[1])

try:
  data = json.loads(config_path.read_text(encoding="utf-8"))
except Exception as exc:
  print(f"Failed to parse theme config JSON: {exc}", file=sys.stderr)
  sys.exit(1)

profiles = data.get("profiles")
if not isinstance(profiles, list) or not profiles:
  print("Theme config must contain a non-empty 'profiles' array.", file=sys.stderr)
  sys.exit(1)

for idx, p in enumerate(profiles, start=1):
  if not isinstance(p, dict):
    print(f"profiles[{idx}] is not an object.", file=sys.stderr)
    sys.exit(1)

  pid = str(p.get("id", "")).strip()
  name = str(p.get("name", "")).strip()
  knsv = str(p.get("knsv", "")).strip()

  if not pid:
    print(f"profiles[{idx}] missing required field: id", file=sys.stderr)
    sys.exit(1)
  if not name:
    print(f"profiles[{idx}] missing required field: name", file=sys.stderr)
    sys.exit(1)
  if not knsv:
    print(f"profiles[{idx}] missing required field: knsv", file=sys.stderr)
    sys.exit(1)

  desc = str(p.get("description", "")).strip().replace("\n", " ")
  profile_name = str(p.get("profileName", "")).strip() or Path(knsv).stem
  color_scheme = str(p.get("colorScheme", "")).strip()

  wallpaper = str(p.get("wallpaper", "")).strip()

  row = sep.join([pid, name, desc, knsv, profile_name, color_scheme, wallpaper])
  print(row)
PY
}

apply_wallpaper() {
  local wallpaper_path="$1"

  [ -f "$wallpaper_path" ] || return 1

  local qdbus_bin
  qdbus_bin="$(command -v qdbus || command -v qdbus6 || true)"
  [ -n "$qdbus_bin" ] || return 1

  local js_path
  js_path="${wallpaper_path//\\/\\\\}"
  js_path="${js_path//\"/\\\"}"

  "$qdbus_bin" org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.evaluateScript "
var allDesktops = desktops();
for (var i = 0; i < allDesktops.length; i++) {
  var d = allDesktops[i];
  d.wallpaperPlugin = 'org.kde.image';
  d.currentConfigGroup = ['Wallpaper', 'org.kde.image', 'General'];
  d.writeConfig("Image", "file://$js_path");
}
" >/dev/null 2>&1 || return 1

  if command -v kwriteconfig6 >/dev/null 2>&1; then
    kwriteconfig6 --file kscreenlockerrc --group Greeter --group Wallpaper --group org.kde.image --group General --key Image "$wallpaper_path" || true
    kwriteconfig6 --file kscreenlockerrc --group Greeter --group Wallpaper --group org.kde.image --group General --key PreviewImage "$wallpaper_path" || true
  fi

  return 0
}

refresh_plasma_theme() {
  local qdbus_bin
  qdbus_bin="$(command -v qdbus || command -v qdbus6 || true)"

  if [ -n "$qdbus_bin" ]; then
    "$qdbus_bin" org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true
    "$qdbus_bin" org.kde.plasmashell /PlasmaShell org.kde.PlasmaShell.reloadConfig >/dev/null 2>&1 || true
  fi

  if command -v kquitapp6 >/dev/null 2>&1 && command -v plasmashell >/dev/null 2>&1; then
    kquitapp6 plasmashell >/dev/null 2>&1 || true
    nohup plasmashell >/dev/null 2>&1 &
  fi
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
  if [ ! -d "$PROFILE_DIR" ]; then
    echo "Theme profile directory not found: $PROFILE_DIR" >&2
    exit 1
  fi

  if ! command -v kdialog >/dev/null 2>&1; then
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
  local -a entry_labels=()

  local row
  for row in "${entry_rows[@]}"; do
    local id name desc knsv profile_name color_scheme wallpaper
    IFS="$ENTRY_SEP" read -r id name desc knsv profile_name color_scheme wallpaper <<<"$row"
    entry_ids+=("$id")
    entry_names+=("$name")
    entry_desc+=("$desc")
    entry_knsv+=("$knsv")
    entry_profile_names+=("$profile_name")
    entry_color_schemes+=("$color_scheme")
    entry_wallpapers+=("$wallpaper")
    if [ -n "$desc" ]; then
      entry_labels+=("$name - $desc")
    else
      entry_labels+=("$name")
    fi
  done

  local selected=""
  selected="$(pick_profile_kdialog entry_ids entry_labels || true)"

  if [ -z "$selected" ]; then
    exit 0
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
  local selected_file="$selected_knsv_rel"

  if [[ "$selected_file" != /* ]]; then
    selected_file="$PROFILE_DIR/$selected_file"
  fi

  if [ ! -f "$selected_file" ]; then
    echo "Selected profile file not found: $selected_file" >&2
    exit 1
  fi

  "$konsave_bin" -i "$selected_file" >/dev/null 2>&1 || true
  "$konsave_bin" -a "$selected_profile_name"

  if [ -n "$selected_color_scheme" ] && command -v kwriteconfig6 >/dev/null 2>&1; then
    kwriteconfig6 --file kdeglobals --group General --key ColorScheme "$selected_color_scheme" || true
    kwriteconfig6 --file kdeglobals --group General --key ColorSchemeHash --delete || true
  fi

  if [ -n "$selected_wallpaper_rel" ]; then
    local selected_wallpaper="$selected_wallpaper_rel"
    if [[ "$selected_wallpaper" != /* ]]; then
      selected_wallpaper="$WALLPAPER_DIR/$selected_wallpaper"
    fi
    apply_wallpaper "$selected_wallpaper" || true
  fi

  refresh_plasma_theme

  kdialog --title "FrosteArch Theme Switcher" --msgbox "Applied theme profile: $selected_name\n\nPlasma components were reloaded to apply changes immediately."
}

main "$@"
