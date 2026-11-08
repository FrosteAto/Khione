#!/bin/bash
# discord-launcher-guard: keeps Discord's launcher forcing --ozone-platform=x11.
#
# WHY THIS EXISTS (2026-09-11): Discord boots via
# ~/.local/share/applications/discord.desktop, which overrides the vanilla
# /usr/share/applications/discord.desktop shipped by the pacman package to add
# --ozone-platform=x11 (native Wayland ozone renders Discord's window far too
# small on this rig's Electron build -- a separate, known-bad path, don't
# switch back without re-testing). ~/.local/bin/discord is a second, matching
# override for anyone launching `discord` from a terminal (shadows
# /usr/bin/discord in PATH).
#
# Electron apps -- Discord included -- sometimes call `xdg-desktop-menu
# install` on self-update to refresh their .desktop entry, which can silently
# overwrite our override with Discord's stock version and drop the x11 flag,
# quietly reintroducing the scaling bug on the next boot. This guard re-checks
# both files any time either changes (or once at login) and restores them if
# drifted, so a Discord self-update or package update can't undo the fix. It
# does NOT touch monitor/output scale -- that's a separate, rejected approach
# (0.75 on DP-2 is intentional and non-negotiable).
#
# UPDATED (2026-11-07): ~/.local/bin/discord is no longer a dumb 1-line x11
# wrapper -- it's now a supervising launcher that auto-recovers from a
# BetterDiscord patch breaking Discord's startup (see that file's own
# header). discord.desktop's Exec= now points there too instead of calling
# /usr/bin/discord directly, so both launch paths go through supervision.
# The checks below verify for THAT wrapper's presence/routing, not just the
# x11 flag by itself -- a bare x11-only wrapper is drift, same as a missing
# one, because it silently drops the crash supervision.

set -euo pipefail

log() { echo "[discord-launcher-guard] $*"; }

DESKTOP_FILE="$HOME/.local/share/applications/discord.desktop"
WRAPPER="$HOME/.local/bin/discord"
EXEC_LINE="Exec=$WRAPPER --url -- %u"
MARKER="discord-launch-guard"
changed=0

# --- .desktop launcher (what app menu / taskbar / pinned icons use) ---
write_desktop() {
    cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=Discord
StartupWMClass=discord
Comment=All-in-one voice and text chat for gamers that's free, secure, and works on both your desktop and phone.
GenericName=Internet Messenger
$EXEC_LINE
Icon=discord
Type=Application
Categories=Network;InstantMessaging;
MimeType=x-scheme-handler/discord;
Path=/usr/bin
EOF
}

if [ ! -f "$DESKTOP_FILE" ]; then
    log "$DESKTOP_FILE missing entirely -- recreating to route through the supervising wrapper"
    write_desktop
    changed=1
elif ! grep -qF -- "$EXEC_LINE" "$DESKTOP_FILE"; then
    log "$DESKTOP_FILE isn't routed through the supervising wrapper (likely a Discord self-update rewrote it) -- restoring"
    write_desktop
    changed=1
fi

# --- ~/.local/bin/discord (terminal-launch override, shadows /usr/bin) ---
write_wrapper() {
    cat > "$WRAPPER" <<'EOF'
#!/bin/bash
# Launches Discord with x11 ozone, then supervises its own log output for a
# silent hang before handing control back.
#
# WHY THIS EXISTS (2026-11-07): a Discord launch once froze on the splash
# screen for 25+ minutes with zero indication to the user -- the process
# stayed alive but stopped logging anything entirely. First guess was a
# BetterDiscord patch throwing "Uncaught TypeError: i.A is not a constructor"
# and breaking init. That guess was WRONG: a healthy Discord boot logs that
# exact same line too (confirmed by testing with BetterDiscord disabled --
# still logged it, booted fine regardless, reached renderer-full-interactive
# and ran normally). It's routine, non-fatal noise, not a crash signature.
#
# What actually distinguishes the real hang is total silence: a healthy
# client keeps emitting ambient log activity (RunningGameStore polling etc.)
# roughly every 5-10s indefinitely, hang or no "Uncaught". So detection here
# is: did logging go fully quiet for SILENCE_LIMIT seconds anywhere in the
# startup window. This also means it isn't tied to one specific error string
# -- it should catch a differently-worded future hang too.
#
# On detecting a hang, this script's first guess is still BetterDiscord
# (common pattern: injected mods breaking after an app update) -- it
# disables BD by renaming its core asar out of the way (BD's own shim at
# resources/app/index.js already falls through to stock Discord if that
# require() fails, so this is a safety net BD's installer built in, not
# something invented here) and relaunches once, clean. If the clean relaunch
# ALSO hangs, BetterDiscord wasn't the cause -- it gives up retrying rather
# than thrashing, and says so via notify-send.
#
# Lives in ~/.local/bin (ahead of /usr/bin in PATH) so it shadows the
# pacman-owned /usr/bin/discord bootstrap. discord.desktop's Exec= also
# points here (see discord-launcher-guard.sh's write_desktop()), so both the
# app-menu/taskbar launch and a terminal `discord` get the same supervision.

REAL=/usr/bin/discord
BD_ASAR="$HOME/.config/BetterDiscord/data/betterdiscord.asar"
BD_DISABLED="$BD_ASAR.disabled-by-guard"
STARTUP_WINDOW=30
SILENCE_LIMIT=18
TAG=discord-launch-guard

log() { echo "[$TAG] $*" >&2; }

launch_and_watch() {
    "$REAL" --ozone-platform=x11 "$@" 2>&1 | systemd-cat --identifier="$TAG" &
    local watch_pid=$!
    local since
    since="$(date '+%Y-%m-%d %H:%M:%S')"

    sleep "$STARTUP_WINDOW"

    if ! kill -0 "$watch_pid" 2>/dev/null; then
        # The pipeline already closed (Discord exited on its own) within the
        # window -- not our failure mode, which hangs rather than exits.
        return 0
    fi

    local out last_ts now_ts
    out="$(journalctl -t "$TAG" --no-pager -o short-unix --since "$since" 2>/dev/null)"

    if [ -z "$out" ]; then
        log "nothing logged at all in ${STARTUP_WINDOW}s -- treating as hung"
        return 1
    fi

    last_ts="$(printf '%s\n' "$out" | tail -1 | awk '{print $1}')"
    last_ts="${last_ts%.*}"
    now_ts="$(date +%s)"

    if [ -n "$last_ts" ] && [ $((now_ts - last_ts)) -ge "$SILENCE_LIMIT" ]; then
        log "logging went silent for $((now_ts - last_ts))s (limit ${SILENCE_LIMIT}s) -- treating as hung"
        return 1
    fi
    return 0
}

kill_discord() {
    pkill -f "$HOME/.config/discord/.*/Discord " 2>/dev/null
    sleep 1
}

if launch_and_watch "$@"; then
    exit 0
fi

log "Discord hung during startup (no activity for ${SILENCE_LIMIT}s+) -- client was frozen on the splash screen"

if [ -f "$BD_ASAR" ]; then
    log "first guess is BetterDiscord -- disabling it ($BD_ASAR -> $BD_DISABLED) and relaunching once"
    kill_discord
    mv -f "$BD_ASAR" "$BD_DISABLED"

    if launch_and_watch "$@"; then
        log "clean relaunch succeeded with BetterDiscord disabled"
        notify-send -u critical "Discord" "Discord hung on startup and BetterDiscord was auto-disabled to recover it. Discord is running without it. Re-enable later with: betterdiscordctl install, or mv back ${BD_DISABLED##*/}." 2>/dev/null
        exit 0
    fi

    log "relaunch without BetterDiscord ALSO hung -- not a BetterDiscord problem, giving up auto-recovery"
    notify-send -u critical "Discord" "Discord is hanging on startup even without BetterDiscord. Needs manual debugging." 2>/dev/null
    exit 1
else
    log "BetterDiscord already disabled and Discord still hung on startup -- not a BetterDiscord problem, giving up auto-recovery"
    notify-send -u critical "Discord" "Discord is hanging on startup (BetterDiscord already disabled). Needs manual debugging." 2>/dev/null
    exit 1
fi
EOF
    chmod +x "$WRAPPER"
}

if [ ! -f "$WRAPPER" ]; then
    log "$WRAPPER missing entirely -- recreating the supervising wrapper"
    write_wrapper
    changed=1
elif ! grep -qF -- "$MARKER" "$WRAPPER"; then
    log "$WRAPPER lost its crash supervision (looks like a plain x11-only wrapper) -- restoring"
    write_wrapper
    changed=1
fi

if [ "$changed" = "1" ]; then
    command -v update-desktop-database >/dev/null && update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    log "restored Discord's supervising launcher"
else
    log "Discord launcher still routed through the supervising wrapper, nothing to do"
fi
