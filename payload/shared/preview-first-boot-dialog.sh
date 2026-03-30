#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

TARGET="${1:-server}"
TITLE_OVERRIDE="${2:-}"

case "$TARGET" in
  desktop)
    MESSAGE_FILE="$SCRIPT_DIR/first-boot-desktop.md"
    TITLE="Welcome to FrosteArch Desktop"
    ;;
  server)
    MESSAGE_FILE="$SCRIPT_DIR/first-boot-server.md"
    TITLE="Welcome to FrosteArch Server"
    ;;
  generic|default)
    MESSAGE_FILE="$SCRIPT_DIR/first-boot-message.md"
    TITLE="FrosteArch"
    ;;
  *)
    if [[ -f "$TARGET" ]]; then
      MESSAGE_FILE="$TARGET"
      TITLE="FrosteArch"
    else
      echo "Usage: $0 [desktop|server|generic|/path/to/message.md] [optional-title]"
      exit 1
    fi
    ;;
esac

if [[ -n "$TITLE_OVERRIDE" ]]; then
  TITLE="$TITLE_OVERRIDE"
fi

if [[ ! -f "$MESSAGE_FILE" ]]; then
  echo "Missing message file: $MESSAGE_FILE"
  exit 1
fi

HTML_FILE="$(mktemp -t frostearch-firstboot-preview-XXXXXX.html)"
RENDERER_SCRIPT="$SCRIPT_DIR/render-first-boot-dialog.py"
cleanup() {
  rm -f "$HTML_FILE"
}
trap cleanup EXIT INT TERM

if [[ ! -f "$RENDERER_SCRIPT" ]]; then
  echo "Missing renderer helper: $RENDERER_SCRIPT"
  exit 1
fi

calc_dialog_size() {
  local screen size sw sh
  DIALOG_WIDTH=960
  DIALOG_HEIGHT=680

  if command -v xrandr >/dev/null 2>&1; then
    size="$(xrandr 2>/dev/null | awk '/\*/{print $1; exit}')"
    if [[ "$size" =~ ^([0-9]+)x([0-9]+)$ ]]; then
      sw="${BASH_REMATCH[1]}"
      sh="${BASH_REMATCH[2]}"

      DIALOG_WIDTH=$((sw * 72 / 100))
      DIALOG_HEIGHT=$((sh * 76 / 100))

      (( DIALOG_WIDTH < 760 )) && DIALOG_WIDTH=760
      (( DIALOG_WIDTH > 1320 )) && DIALOG_WIDTH=1320
      (( DIALOG_HEIGHT < 520 )) && DIALOG_HEIGHT=520
      (( DIALOG_HEIGHT > 920 )) && DIALOG_HEIGHT=920
    fi
  fi
}

PYTHON_BIN="$(command -v python3 || command -v python || true)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "Python is required for markdown rendering preview."
  exit 1
fi

if ! "$PYTHON_BIN" "$RENDERER_SCRIPT" "$MESSAGE_FILE" "$HTML_FILE"; then
  echo "Markdown renderer failed; falling back to plain text view."
  : >"$HTML_FILE"
fi

if ! command -v kdialog >/dev/null 2>&1; then
  echo "kdialog is required for accurate KDE-themed preview."
  echo "Install kdialog, then rerun this preview script."
  exit 1
fi

calc_dialog_size

if [[ -s "$HTML_FILE" ]]; then
  HTML_CONTENT="$(cat "$HTML_FILE")"
  kdialog --title "$TITLE" --msgbox "$HTML_CONTENT" || kdialog --title "$TITLE" --textbox "$MESSAGE_FILE" "$DIALOG_WIDTH" "$DIALOG_HEIGHT" || true
else
  kdialog --title "$TITLE" --textbox "$MESSAGE_FILE" "$DIALOG_WIDTH" "$DIALOG_HEIGHT" || true
fi
