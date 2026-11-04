#!/bin/bash
set -euo pipefail
log() { echo "[spicetify-guard] $*"; }

if ! command -v spicetify >/dev/null 2>&1; then
    log "spicetify not installed -- nothing to do"
    exit 0
fi

PREFS="$HOME/.config/spotify/prefs"
if [ ! -f "$PREFS" ]; then
    log "Spotify prefs file not found yet (Spotify hasn't been launched) -- nothing to do"
    exit 0
fi

log "Spotify prefs file present -- applying Spicetify"
spicetify backup apply
log "Spicetify applied"

# Spicetify patches Spotify's on-disk files, so an already-running Spotify
# (which is guaranteed here, since its prefs file only exists because it's
# been launched) won't show the theme until relaunched. Only do that once
# per boot: /run is tmpfs and clears on every real reboot, so this marker
# makes the FIRST apply this boot (always safe -- Spotify was just opened
# for the first time, nothing to lose) restart it, while any LATER apply
# the same boot (e.g. a pacman spotify package update) stays a silent
# patch only, same as before this change.
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
RESTART_MARKER="$RUNTIME_DIR/khione-spotify-restarted"
SPOTIFY_BIN="/opt/spotify/spotify"
if [ ! -f "$RESTART_MARKER" ] && pgrep -u "$(id -u)" -f -- "$SPOTIFY_BIN" >/dev/null 2>&1; then
    log "Restarting Spotify to load Spicetify (first apply this boot)"
    mkdir -p "$RUNTIME_DIR"
    touch "$RESTART_MARKER"
    pkill -u "$(id -u)" -f -- "$SPOTIFY_BIN" || true
    for _ in $(seq 1 20); do
        pgrep -u "$(id -u)" -f -- "$SPOTIFY_BIN" >/dev/null 2>&1 || break
        sleep 0.5
    done
    pkill -9 -u "$(id -u)" -f -- "$SPOTIFY_BIN" 2>/dev/null || true
    # systemd-run --scope puts Spotify in its own transient scope, so it
    # survives this oneshot service exiting -- a bare `spotify &` here
    # would get killed along with this service's cgroup moments later.
    systemd-run --user --scope --quiet -- spotify >/dev/null 2>&1 &
    disown
    log "Spotify relaunched"
fi
