#!/bin/bash
set -euo pipefail
log() { echo "[betterdiscord-guard] $*"; }

if ! command -v betterdiscordctl >/dev/null 2>&1; then
    log "betterdiscordctl not installed -- nothing to do"
    exit 0
fi

ACTIVE_APP="$(readlink -f "$HOME/.config/discord/Discord" 2>/dev/null || true)"

if [ -z "$ACTIVE_APP" ]; then
    log "Discord doesn't appear to be installed yet (no ~/.config/discord/Discord symlink) -- nothing to do"
    exit 0
fi

APP_DIR="$(dirname "$ACTIVE_APP")"

# Check betterdiscordctl's own injection marker in Discord's index.js, not
# just the sibling betterdiscord.app.asar file's existence: a self-update can
# revert the index.js injection while leaving a stale shim file behind (seen
# live -- shim present, "index.js" injected: no), which a file-existence
# check alone would read as "still installed" and skip reinstalling.
if betterdiscordctl status 2>/dev/null | grep -q '^Discord "index.js" injected: yes$'; then
    log "BetterDiscord still injected into $APP_DIR, nothing to do"
else
    log "BetterDiscord not injected into $APP_DIR (likely a Discord self-update) -- reinstalling"
    # betterdiscordctl tracks "installed" via a patch marker inside Discord's
    # own app.asar, not by the shim file's existence. If Discord's update
    # stripped the marker but left the shim file, "install" refuses with
    # "Already installed" while the injection stays missing -- "reinstall"
    # forces both the uninstall and reinstall, clearing that mismatch.
    if ! betterdiscordctl install; then
        log "betterdiscordctl install refused -- forcing reinstall"
        betterdiscordctl reinstall
    fi
    log "BetterDiscord reinstalled"

    # Discord loads BD's injected app.asar once at process start, so an
    # already-running Discord won't show the change until relaunched. Only
    # do that once per boot: /run is tmpfs and clears on every real reboot,
    # so this marker makes the FIRST reapply this boot (always safe -- a
    # fresh session, nothing mid-call yet) restart Discord, while any LATER
    # reapply the same boot (e.g. a second self-update while actually in
    # use) stays a silent patch only, same as before this change.
    RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
    RESTART_MARKER="$RUNTIME_DIR/khione-discord-restarted"
    if [ ! -f "$RESTART_MARKER" ] && pgrep -u "$(id -u)" -f -- "$ACTIVE_APP" >/dev/null 2>&1; then
        log "Restarting Discord to load BetterDiscord (first reapply this boot)"
        mkdir -p "$RUNTIME_DIR"
        touch "$RESTART_MARKER"
        pkill -u "$(id -u)" -f -- "$ACTIVE_APP" || true
        for _ in $(seq 1 20); do
            pgrep -u "$(id -u)" -f -- "$ACTIVE_APP" >/dev/null 2>&1 || break
            sleep 0.5
        done
        pkill -9 -u "$(id -u)" -f -- "$ACTIVE_APP" 2>/dev/null || true
        # systemd-run --scope puts Discord in its own transient scope, so it
        # survives this oneshot service exiting -- a bare `discord &` here
        # would get killed along with this service's cgroup moments later.
        systemd-run --user --scope --quiet -- discord >/dev/null 2>&1 &
        disown
        log "Discord relaunched"
    fi
fi
