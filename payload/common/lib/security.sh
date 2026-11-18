#!/bin/bash
set -euo pipefail

# Security hardening pass added 2026-11-16 after a Plex Media Server RCE
# chain ("Plex2Shell", CVE-2026-96652/96654/96655/96656, plus a related
# token-leaking path traversal CVE-2026-96651) let two independent,
# self-healing cryptomining campaigns run undetected for ~3 weeks on the
# server edition. Every function here maps to a specific gap that incident
# exposed, researched against current (2026) practice rather than guessed.
# Package installation stays in mode.sh's OFFICIAL_PACKAGES/AUR_PACKAGES --
# these functions only configure/enable, assuming install_official_packages/
# install_aur_packages already ran (matching install.sh's existing phase
# order: install everything, then configure_*).

# ---------------------------------------------------------------------
# SSH hardening
# ---------------------------------------------------------------------
configure_ssh_hardening() {
  local user="$1"
  if ! command -v sshd &>/dev/null; then
    echo "sshd not installed, skipping SSH hardening."
    return 0
  fi

  echo "Hardening SSH..."
  local authorized_keys="/home/$user/.ssh/authorized_keys"
  local disable_passwords="no"
  if [[ -s "$authorized_keys" ]]; then
    disable_passwords="yes"
  else
    echo "WARNING: $authorized_keys is empty -- leaving password auth"
    echo "enabled so you don't lock yourself out. Add a public key, then"
    echo "set PasswordAuthentication no by hand in"
    echo "/etc/ssh/sshd_config.d/99-khione-hardening.conf and reload sshd."
  fi

  {
    echo "# Managed by this repo's installer -- see payload/common/lib/security.sh"
    echo "PermitRootLogin no"
    echo "MaxAuthTries 3"
    echo "X11Forwarding no"
    if [[ "$disable_passwords" == "yes" ]]; then
      echo "PasswordAuthentication no"
      echo "KbdInteractiveAuthentication no"
    fi
  } | sudo tee /etc/ssh/sshd_config.d/99-khione-hardening.conf >/dev/null

  if sudo sshd -t; then
    sudo systemctl reload sshd 2>/dev/null || sudo systemctl restart sshd
  else
    echo "WARNING: sshd -t rejected the new config -- reverting, nothing changed."
    sudo rm -f /etc/ssh/sshd_config.d/99-khione-hardening.conf
  fi
}

# ---------------------------------------------------------------------
# Local account lockout (pam_faillock) -- CIS-standard, covers console/
# physical logins, which key-only SSH doesn't touch at all.
# ---------------------------------------------------------------------
configure_pam_faillock() {
  echo "Configuring local account lockout (pam_faillock)..."
  if ! grep -q "^deny" /etc/security/faillock.conf 2>/dev/null; then
    sudo tee -a /etc/security/faillock.conf >/dev/null <<'EOF'

# khione: lock out local/console logins after repeated failures -- SSH is
# already key-only + fail2ban/CrowdSec, but physical/console auth had no
# equivalent brute-force throttle at all before this.
deny = 5
unlock_time = 900
even_deny_root
EOF
  fi
  # Arch's system-auth/password-auth setup varies by whether pambase is in
  # use; faillock.conf alone is inert unless pam_faillock is actually
  # wired into the auth stack. pambase (Arch's default) includes it via
  # /etc/pam.d/system-auth as of pambase 20230328 -- confirm it's present
  # rather than silently configuring a file nothing reads.
  if ! grep -rq "pam_faillock.so" /etc/pam.d/system-auth 2>/dev/null; then
    echo "WARNING: pam_faillock.so not found in /etc/pam.d/system-auth --"
    echo "faillock.conf's settings won't take effect. This usually means"
    echo "pambase needs updating (pacman -S pambase) or was customized;"
    echo "not editing PAM stacks directly here, that's too risky to automate."
  fi
}

# ---------------------------------------------------------------------
# Kernel hardening via sysctl. Deliberately does NOT touch unprivileged
# user namespaces -- Docker, Flatpak/bubblewrap, and every browser's own
# sandbox depend on them being available, and systemd's own PrivateUsers=
# sandboxing (already used elsewhere in this repo's hardening) needs them
# too. A kernel-wide disable would undercut hardening decided elsewhere
# on the same host, not just trade one risk for another.
# ---------------------------------------------------------------------
configure_sysctl_hardening() {
  echo "Applying kernel hardening sysctls..."
  sudo tee /etc/sysctl.d/99-khione-hardening.conf >/dev/null <<'EOF'
# khione: see payload/common/lib/security.sh for why each of these.
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
kernel.unprivileged_bpf_disabled = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.protected_fifos = 2
fs.protected_regular = 2
EOF
  sudo sysctl --system >/dev/null
}

# ---------------------------------------------------------------------
# fail2ban
# ---------------------------------------------------------------------
configure_fail2ban() {
  local -n jails="$1"
  if ! command -v fail2ban-client &>/dev/null; then
    echo "fail2ban not installed, skipping."
    return 0
  fi
  echo "Configuring fail2ban jails: ${jails[*]}..."

  # "cockpit" isn't a jail fail2ban ships a definition for at all (no
  # filter, no default backend/journalmatch) -- unlike sshd, which
  # inherits sensible defaults from fail2ban's own jail.conf. This
  # filter was built and verified against this server's real journal
  # (not guessed): cockpit auth goes through PAM, and both failure
  # shapes actually seen live are covered -- unknown user, and wrong
  # password for a real user (which adds a trailing " user=<name>").
  for j in "${jails[@]}"; do
    if [[ "$j" == "cockpit" ]]; then
      sudo tee /etc/fail2ban/filter.d/cockpit.conf >/dev/null <<'EOF'
[Definition]
failregex = ^.*cockpit-session\[\d+\]: pam_unix\(cockpit:auth\): authentication failure;.*rhost=<HOST>
ignoreregex =
EOF
    fi
  done

  {
    for j in "${jails[@]}"; do
      if [[ "$j" == "cockpit" ]]; then
        printf '[cockpit]\nenabled = true\nbackend = systemd\njournalmatch = _COMM=cockpit-session\nmaxretry = 4\nfindtime = 10m\nbantime = 1h\nbantime.increment = true\n\n'
      else
        printf '[%s]\nenabled = true\nmaxretry = 4\nfindtime = 10m\nbantime = 1h\nbantime.increment = true\n\n' "$j"
      fi
    done
  } | sudo tee /etc/fail2ban/jail.d/99-khione.conf >/dev/null
  sudo systemctl enable --now fail2ban.service
  sudo systemctl restart fail2ban.service
}

# ---------------------------------------------------------------------
# CrowdSec + the nftables firewall bouncer. Runs natively (not Docker) --
# the firewall bouncer needs direct iptables/nftables access, which a
# container doesn't have cleanly. Coexists with fail2ban rather than
# replacing it: CrowdSec has no Samba/Cockpit collection at all, so
# fail2ban stays the only thing covering those. `cscli capi register`
# only connects to CrowdSec's Central API to pull the free community
# blocklist -- confirmed (CrowdSec's own docs) this is separate from
# `cscli console enroll`, the hosted-dashboard step that defaults to
# *sharing* your own alerts, which is why only that one stays manual.
# ---------------------------------------------------------------------
configure_crowdsec() {
  if ! command -v cscli &>/dev/null; then
    echo "crowdsec not installed, skipping."
    return 0
  fi
  echo "Configuring CrowdSec..."
  sudo systemctl enable --now crowdsec.service

  local collection
  for collection in crowdsecurity/sshd crowdsecurity/linux crowdsecurity/linux-lpe; do
    sudo cscli collections install "$collection" 2>&1 | grep -v "already installed" || true
  done
  sudo systemctl reload crowdsec.service 2>/dev/null || true

  # The firewall bouncer's own package install script normally registers
  # itself with LAPI and writes its API key automatically; this is a
  # fallback for the case where LAPI wasn't up yet when it installed.
  if command -v cs-firewall-bouncer &>/dev/null; then
    local bouncer_cfg=/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml
    if [[ -f "$bouncer_cfg" ]] && grep -q "^api_key: *$" "$bouncer_cfg" 2>/dev/null; then
      local key
      key="$(sudo cscli bouncers add khione-firewall-bouncer -o raw)"
      sudo sed -i "s/^api_key: *$/api_key: $key/" "$bouncer_cfg"
    fi
    sudo systemctl enable --now crowdsec-firewall-bouncer.service
  fi

  # Community blocklist. shortcut: `cscli capi register` alone enables
  # signal SHARING by default too (confirmed live -- `cscli capi status`
  # showed "Sharing signals is enabled" right after registering, with
  # no console enroll involved at all; this contradicts what research
  # had concluded, which turned out to only be true for console.yaml's
  # per-category flags, not the top-level online_client.sharing switch).
  # Explicitly disabling both layers below is what actually gets
  # consume-only -- registering and stopping there does not.
  if [[ ! -f /etc/crowdsec/online_api_credentials.yaml ]]; then
    sudo cscli capi register
  fi
  if ! sudo grep -q "^ *sharing: false" /etc/crowdsec/config.yaml 2>/dev/null; then
    sudo sed -i "/credentials_path: \/etc\/crowdsec\/online_api_credentials.yaml/a\\      sharing: false" /etc/crowdsec/config.yaml
  fi
  sudo cscli console disable custom tainted 2>/dev/null || true
  sudo systemctl restart crowdsec.service

  echo "CrowdSec configured, community blocklist consumed, nothing shared"
  echo "(verify any time: sudo cscli capi status). To also use the hosted"
  echo "dashboard (optional, needs a one-time web-UI click AND re-enables"
  echo "some sharing by default): sudo cscli console enroll <id>"
}

# ---------------------------------------------------------------------
# AIDE file-integrity monitoring. scope="full" (server): monitors
# everything except genuinely high-churn, non-security paths. scope=
# "system-only" (desktop/ulw): also excludes /home, Steam, and Flatpak
# trees, which would otherwise flood the daily report with legitimate
# churn and train the user to ignore it -- that's a real effectiveness
# problem, not just friction, so the exclusion earns its place here.
# extra_watch_array (optional, server only): paths to make sure are
# NOT excluded even if they'd otherwise fall under a broad exclusion --
# e.g. Plex's Codecs/Plug-ins dirs, the literal planting ground for the
# incident that started this. Pass an empty array name if none.
# ---------------------------------------------------------------------
configure_file_integrity_monitoring() {
  local scope="$1"
  local -n extra_watch="$2"
  if ! command -v aide &>/dev/null; then
    echo "aide not installed, skipping."
    return 0
  fi
  echo "Setting up AIDE file-integrity monitoring (scope=$scope)..."

  if ! sudo grep -q "^# khione: additions" /etc/aide.conf 2>/dev/null; then
    {
      echo
      echo "# khione: additions"
      echo "!/var/log"
      echo "!/proc"
      echo "!/sys"
      echo "!/run"
      echo "!/tmp"
      if [[ "$scope" == "system-only" ]]; then
        echo "!/home"
        echo "!/var/lib/flatpak"
        echo "!/var/cache/pacman"
      fi
      local p
      for p in "${extra_watch[@]}"; do
        # aide.conf uses backslash as its escape char for literal spaces
        # in a path -- confirmed live: an unescaped space in "Plex Media
        # Server" broke the parser ("unexpected character: '/'").
        echo "${p// /\\ } NORMAL"
      done
    } | sudo tee -a /etc/aide.conf >/dev/null
  fi

  echo "Building the initial AIDE database (can take a few minutes)..."
  sudo aide --init
  sudo mv -f /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz

  # The AUR aide package ships its own aidecheck.service/.timer (daily
  # 05:00, logs to /var/log/aide.log + `journalctl -abu aidecheck`) --
  # reusing it instead of rolling a duplicate unit.
  sudo systemctl enable --now aidecheck.timer
}

# ---------------------------------------------------------------------
# auditd: watch exec() from world-writable temp dirs -- exactly the
# pattern both cryptominer campaigns in the incident used. extra_watch
# (optional): additional paths to watch writes to, e.g. Plex's Codecs
# dir, where the actual malicious payload got planted.
# ---------------------------------------------------------------------
configure_auditd() {
  local -n extra_watch="$1"
  if ! command -v auditctl &>/dev/null; then
    echo "audit not installed, skipping."
    return 0
  fi
  echo "Configuring auditd rules..."
  {
    echo "# khione: catch the pattern this project's Nov 2026 incident used --"
    echo "# payloads executed straight out of world-writable temp directories."
    echo "-w /tmp -p x -k khione_exec_from_tmp"
    echo "-w /var/tmp -p x -k khione_exec_from_tmp"
    echo "-w /dev/shm -p x -k khione_exec_from_tmp"
  } | sudo tee /etc/audit/rules.d/99-khione.rules >/dev/null

  sudo systemctl enable --now auditd.service
  # shortcut: auditd's own unit refuses manual restart by design (its
  # audit-trail philosophy discourages casual restarts), confirmed live
  # -- `systemctl restart auditd.service` errors with "may be requested
  # by dependency only". augenrules --load applies rule changes without
  # restarting the daemon, but it also errors on "Rule exists" if a rule
  # it's about to add is already live, so clear the live table first for
  # a clean, truly idempotent reload regardless of what ran before.
  sudo auditctl -D &>/dev/null || true
  sleep 1
  # shortcut: augenrules --load exits 1 ("Rule exists") on a visible but
  # inconsistent fraction of runs straight after -D -- confirmed live,
  # looks like the kernel hasn't finished processing the delete by the
  # time this fires (auditctl/augenrules are separate processes talking
  # over netlink, nothing here guarantees ordering). The sleep above
  # narrows the window; tolerating the exit code and checking real state
  # afterward closes it, since "already loaded" is the correct outcome
  # either way, not a failure to surface.
  sudo augenrules --load || true
  if ! sudo auditctl -l | grep -q "khione_exec_from_tmp"; then
    echo "WARNING: auditd rules did not load -- check with: sudo auditctl -l"
  fi

  # extra_watch paths go through a separate script + oneshot service,
  # not the rules.d file above: confirmed live that auditctl's rules-FILE
  # parser is plain whitespace-tokenized with no quoting support at all
  # (neither bare nor double-quoted survives it), so a path containing a
  # space -- e.g. Plex's own "Plex Media Server" directories -- silently
  # corrupts the whole rule load. Passing the same path as a real argv
  # argument to auditctl directly (shell-quoted, not file-parsed) works
  # correctly; this script+service just makes that persist across boots.
  if ((${#extra_watch[@]})); then
    sudo install -Dm755 /dev/stdin /usr/local/bin/khione-audit-extra-watch <<'EOF'
#!/bin/bash
set -euo pipefail
EOF
    local p
    for p in "${extra_watch[@]}"; do
      # "|| true": re-running this (e.g. a reconfigure) hits "Rule
      # exists" on anything already loaded -- harmless, not a real error.
      printf 'auditctl -w %q -p wa -k khione_watch_extra || true\n' "$p" | sudo tee -a /usr/local/bin/khione-audit-extra-watch >/dev/null
    done
    sudo tee /etc/systemd/system/khione-audit-extra-watch.service >/dev/null <<'EOF'
[Unit]
Description=Apply khione's space-path auditd watches (can't go through rules.d)
After=auditd.service
Requires=auditd.service
# Must finish arming these BEFORE audit-rules.service loads the "-e 2"
# immutable finalize rule below -- once that's live, a plain `auditctl
# -w` call like this one fails with "Operation not permitted" until the
# next reboot, same as any other live rule change.
Before=audit-rules.service

[Service]
Type=oneshot
RemainAfterExit=true
ExecStart=/usr/local/bin/khione-audit-extra-watch

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable khione-audit-extra-watch.service
    sudo /usr/local/bin/khione-audit-extra-watch
  fi

  # Immutable audit config -- "-e 2" as the LAST rule loaded makes the
  # running ruleset tamper-proof until the next reboot (confirmed live:
  # once active, even `auditctl -D` as root fails with "Operation not
  # permitted"). This is the standard CIS Benchmark recommendation
  # ("ensure the audit configuration is immutable"); confirmed live that
  # audit-rules.service genuinely runs augenrules --load automatically
  # on every boot (pulled in by auditd.service's Wants=, despite showing
  # "disabled" in `systemctl list-unit-files` -- that only reflects it
  # having no WantedBy symlink of its own), so this file alone is enough
  # for it to survive reboots with no extra enablement.
  # "999-" sorts after "99-khione.rules" alphabetically, so this loads
  # last, which is what makes it the final word for that boot.
  echo "-e 2" | sudo tee /etc/audit/rules.d/999-khione-finalize.rules >/dev/null
  # shortcut: once immutable, re-running this function (e.g. re-running
  # the installer later to tweak something unrelated) can no longer
  # reload rules live -- checked first so that case gets a clear message
  # instead of a confusing failure from the commands above.
  if sudo auditctl -s 2>/dev/null | grep -q "^enabled 2"; then
    echo "Audit ruleset is already immutable (that takes a reboot to"
    echo "change) -- rules.d files are current and will apply fresh on"
    echo "the next boot."
  else
    sudo augenrules --load || true
    if sudo auditctl -s 2>/dev/null | grep -q "^enabled 2"; then
      echo "Audit ruleset is now immutable until the next reboot."
    else
      echo "WARNING: expected the audit ruleset to be immutable now --"
      echo "check with: sudo auditctl -s"
    fi
  fi
}

# ---------------------------------------------------------------------
# Updates: daily official-repo pacman timer, gated by informant so a
# transaction aborts (rather than silently applying) when there's unread
# Arch News relevant to it -- Arch's own wiki names this exact combo.
# (arch-manwarn would narrow that gate to keyword-matched news instead of
# blocking on every post, which matters more for an unattended timer --
# dropped for now, its AUR build fails on this system: an openssl-sys/
# Rust-crate version mismatch upstream, confirmed live, not fixable from
# here.) AUR packages are never auto-applied here (unreviewed source,
# shouldn't update unattended) -- see configure_aur_update_check for
# their notify-only counterpart.
# ---------------------------------------------------------------------
configure_auto_updates() {
  echo "Setting up the daily news-gated auto-update timer..."
  if command -v informant &>/dev/null; then
    sudo install -d -m755 /etc/pacman.d/hooks
    sudo tee /etc/pacman.d/hooks/informant.hook >/dev/null <<'EOF'
[Trigger]
Operation = Upgrade
Type = Package
Target = *

[Action]
Description = Checking Arch Linux News for relevant updates...
When = PreTransaction
Exec = /usr/bin/informant check
Depends = informant
EOF
  fi

  sudo tee /etc/systemd/system/khione-auto-update.service >/dev/null <<'EOF'
[Unit]
Description=Automatic pacman -Syu (official repos only, news-gated)
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/pacman -Syu --noconfirm
EOF
  sudo tee /etc/systemd/system/khione-auto-update.timer >/dev/null <<'EOF'
[Unit]
Description=Daily automatic official-repo update

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

  # arch-audit: CVE-specific signal, distinct from "updates exist" --
  # names which currently-INSTALLED packages have a known vulnerability,
  # regardless of whether a fix has shipped yet (the main auto-update
  # timer above only ever sees the "fix shipped" case).
  if command -v arch-audit &>/dev/null; then
    sudo install -Dm755 /dev/stdin /usr/local/bin/khione-arch-audit-check <<'EOF'
#!/bin/bash
set -euo pipefail
out="$(arch-audit --upgradable 2>/dev/null || true)"
if [[ -n "$out" ]]; then
  echo "$out" | systemd-cat -t khione-arch-audit -p warning
fi
EOF
    sudo tee /etc/systemd/system/khione-arch-audit-check.service >/dev/null <<'EOF'
[Unit]
Description=Check installed packages against the Arch Security Tracker

[Service]
Type=oneshot
ExecStart=/usr/local/bin/khione-arch-audit-check
EOF
    sudo tee /etc/systemd/system/khione-arch-audit-check.timer >/dev/null <<'EOF'
[Unit]
Description=Daily arch-audit CVE check

[Timer]
OnCalendar=daily
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
EOF
    sudo systemctl enable --now khione-arch-audit-check.timer
  fi

  sudo systemctl daemon-reload
  sudo systemctl enable --now khione-auto-update.timer
}

# ---------------------------------------------------------------------
# Notify-only AUR update check -- generic, reusable per-package. The
# official-repo auto-update timer above never touches AUR packages
# (plex-media-server chief among them -- it was the literal entry point
# for this incident, and it's AUR-only), so without this, "stay current"
# silently stops applying to exactly the package that matters most.
# ---------------------------------------------------------------------
configure_aur_update_check() {
  local user="$1" package="$2" label="${3:-$2}"
  if ! command -v yay &>/dev/null; then
    echo "yay not installed, skipping AUR update check for $package."
    return 0
  fi
  echo "Setting up a notify-only AUR update check for $label..."
  local script="/usr/local/bin/khione-aur-check-$package"
  sudo install -Dm755 /dev/stdin "$script" <<EOF
#!/bin/bash
set -euo pipefail
update="\$(sudo -u $user yay -Qua 2>/dev/null | grep "^$package " || true)"
if [[ -n "\$update" ]]; then
  echo "$label AUR update available (never auto-applied): \$update" | systemd-cat -t khione-aur-check -p warning
fi
# Persisted for the dashboard (journal entries above aren't readable
# from there) -- written every run so "no update" also overwrites a
# stale "update available" from the last check.
out="/var/lib/hass/snapshots/aur-$package.json"
mkdir -p "\$(dirname "\$out")"
if [[ -n "\$update" ]]; then
  detail="\$(echo "\$update" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')"
  printf '{"package": "$package", "update_available": true, "detail": "%s"}' "\$detail" > "\$out.tmp"
else
  printf '{"package": "$package", "update_available": false, "detail": null}' > "\$out.tmp"
fi
mv "\$out.tmp" "\$out"
EOF
  local svc="khione-aur-check-$package"
  sudo tee "/etc/systemd/system/$svc.service" >/dev/null <<EOF
[Unit]
Description=Notify-only AUR update check for $label

[Service]
Type=oneshot
ExecStart=$script
EOF
  sudo tee "/etc/systemd/system/$svc.timer" >/dev/null <<EOF
[Unit]
Description=Daily AUR update check for $label

[Timer]
OnCalendar=daily
RandomizedDelaySec=20m
Persistent=true

[Install]
WantedBy=timers.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$svc.timer"
}

# ---------------------------------------------------------------------
# Action-bridge script for the Security dashboard's "Update AUR
# packages" button. Generated (not a static collectors/ file) for the
# same reason configure_aur_update_check's per-package script is:
# yay/makepkg refuse to run as root, and this script's own .service
# unit runs as root by default, so $user has to be baked in at install
# time via sudo -u, exactly mirroring that function's own pattern.
# ---------------------------------------------------------------------
configure_aur_update_action() {
  local user="$1"
  if ! command -v yay &>/dev/null; then
    echo "yay not installed, skipping the AUR-update action script."
    return 0
  fi
  echo "Granting $user permanent passwordless pacman access for the AUR-update action..."
  local sudoers_file=/etc/sudoers.d/90-khione-aur-pacman
  printf '%s\n' "$user ALL=(ALL) NOPASSWD: /usr/bin/pacman" | sudo tee "$sudoers_file" >/dev/null
  sudo chmod 440 "$sudoers_file"
  sudo visudo -cf "$sudoers_file"

  echo "Setting up the AUR-update action script..."
  sudo install -Dm755 /dev/stdin /usr/local/bin/khione-action-update-aur <<EOF
#!/bin/bash
set -uo pipefail

trigger=/var/lib/hass/triggers/update-aur.trigger
out=/var/lib/hass/snapshots/khione_actions.json

# A stale trigger (e.g. one written while this .path unit was disabled --
# see Fix 1) must never fire the action once the unit is finally enabled.
if [[ ! -f "\$trigger" ]] || [[ -z "\$(find "\$trigger" -mmin -2 2>/dev/null)" ]]; then
  rm -f "\$trigger"
  exit 0
fi
rm -f "\$trigger"

started="\$(date +%s)"
output="\$(sudo -u $user yay -Syu --aur --noconfirm 2>&1)"
rc=\$?
finished="\$(date +%s)"
if [[ \$rc -eq 0 ]]; then success=true; else success=false; fi

mkdir -p "\$(dirname "\$out")"
python3 - "update_aur" "\$started" "\$finished" "\$success" "\$output" <<'PYEOF' > "\$out.tmp"
import json, sys
action, started, finished, success, output = sys.argv[1:6]
print(json.dumps({
    "action": action,
    "started_at": int(started),
    "finished_at": int(finished),
    "success": success == "true",
    "output_tail": output[-2000:],
}))
PYEOF
mv "\$out.tmp" "\$out"
EOF
}

# ---------------------------------------------------------------------
# Plex-specific systemd sandboxing, beyond whatever generic hardening is
# already in place. Plex staff confirm it's meant to run unprivileged and
# never needs root. Uses a drop-in, never the shipped unit file directly,
# since package upgrades silently reset in-place edits to that.
#
# shortcut: RestrictAddressFamilies is deliberately NOT in this list.
# The full original set (this plus RestrictAddressFamilies=AF_INET
# AF_INET6 AF_UNIX) segfaulted Plex on every single start, confirmed
# live via journalctl -- a crash report + coredump, not a clean
# permission error, meaning Plex's binary genuinely needs some other
# address family at startup that directive blocks. Bisected by testing
# directives individually/in subsets against the real server (each
# round: apply, restart, check, revert immediately if it crashed) rather
# than guessing: ProtectHome alone was fine; RestrictAddressFamilies
# alone reproduced the exact same crash; the full set below, minus just
# that one directive, has run clean including repeated restarts.
# PrivateDevices has one known, accepted side effect: Plex's Tuner
# Service logs "Critical: libusb_init failed" (confirmed absent without
# PrivateDevices) because it can no longer probe USB TV-tuner hardware
# -- harmless if you don't use Plex's DVR/tuner feature; drop
# PrivateDevices here if you ever do.
harden_plexmediaserver_service() {
  if ! systemctl list-unit-files plexmediaserver.service &>/dev/null; then
    echo "plexmediaserver.service not installed, skipping its sandboxing."
    return 0
  fi
  echo "Sandboxing plexmediaserver.service..."
  sudo install -d -m755 /etc/systemd/system/plexmediaserver.service.d
  sudo tee /etc/systemd/system/plexmediaserver.service.d/99-khione-hardening.conf >/dev/null <<'EOF'
[Service]
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
ReadWritePaths=/var/lib/plex
EOF
  sudo systemctl daemon-reload
  sudo systemctl restart plexmediaserver.service
  echo "Sandboxed. Still worth a real playback/transcode check once --"
  echo "check with: systemd-analyze security plexmediaserver"
}

# ---------------------------------------------------------------------
# Docker daemon hardening, scoped to what's safe without hardware testing.
# Rootless Docker / userns-remap would add real containment for the
# Home Assistant container, but this host has a real Zigbee USB dongle
# passed through to it -- per research, that needs a dedicated hardware
# test window, not a blind change here, so it's deliberately left out.
# ---------------------------------------------------------------------
configure_docker_daemon_hardening() {
  if ! command -v docker &>/dev/null; then
    echo "docker not installed, skipping daemon hardening."
    return 0
  fi
  echo "Hardening the Docker daemon (no-new-privileges, ICC off, log limits)..."
  sudo install -d -m755 /etc/docker
  local conf=/etc/docker/daemon.json
  local existing="{}"
  [[ -f "$conf" ]] && existing="$(cat "$conf")"
  echo "$existing" | python3 -c '
import json, sys
d = json.load(sys.stdin)
d["no-new-privileges"] = True
d["icc"] = False
d.setdefault("log-driver", "json-file")
d.setdefault("log-opts", {})
d["log-opts"].setdefault("max-size", "10m")
d["log-opts"].setdefault("max-file", "3")
print(json.dumps(d, indent=2))
' | sudo tee "$conf" >/dev/null
  sudo systemctl restart docker.service
}

# ---------------------------------------------------------------------
# AppArmor. DISABLED -- confirmed live this breaks boot entirely on this
# host (plain GRUB + linux-lts, Secure Boot off). Research's documented
# risk pattern was specifically systemd-boot+UKI+Secure Boot, which this
# host doesn't use, so the kernel param was applied as "safe" -- it
# wasn't. The box dropped off the network after the next real reboot,
# reproducibly (a second reboot didn't fix it, since it's a config
# problem, not a transient one), and recovery needed physical/console
# access to edit the GRUB boot entry and strip apparmor=1
# security=apparmor for a one-time boot. The exact root cause on this
# kernel wasn't chased down -- aa-status showed the apparmor kernel
# module as loaded beforehand, so it's not simply "unsupported kernel",
# but whatever it is, it's real and reproducible on this exact setup.
# Not worth re-attempting without a non-production box to actually debug
# it on, same reasoning as the Plex sandboxing bisection, but with a
# much worse failure mode (whole-box network loss vs. one service
# crashing) -- so left off rather than re-bisected.
configure_apparmor() {
  echo "AppArmor is deliberately disabled -- see the comment above this"
  echo "function. Confirmed live: it broke boot entirely on this host."
  return 0
}

# ---------------------------------------------------------------------
# GRUB bootloader password. Gates editing boot entries (recovery mode,
# alternate kernel params) from the GRUB menu -- normal boots are
# completely unaffected, you never see this prompt just turning the
# machine on. The password is generated, not invented, and printed once
# so it can be saved somewhere safe; it's also never stored in plaintext
# (grub-mkpasswd-pbkdf2's hash goes in the config, not the password).
# ---------------------------------------------------------------------
configure_bootloader_password() {
  if ! command -v grub-mkpasswd-pbkdf2 &>/dev/null; then
    echo "grub-mkpasswd-pbkdf2 not available, skipping bootloader password."
    return 0
  fi
  if [[ -f /etc/grub.d/40_custom ]] && grep -q "^set superusers" /etc/grub.d/40_custom 2>/dev/null; then
    echo "GRUB password already configured, skipping."
    return 0
  fi
  echo "Setting a GRUB bootloader password..."
  local password hash
  password="$(openssl rand -base64 18)"
  hash="$(echo -e "$password\n$password" | grub-mkpasswd-pbkdf2 | grep -o 'grub\.pbkdf2\.sha512\..*')"
  sudo tee -a /etc/grub.d/40_custom >/dev/null <<EOF

set superusers="root"
password_pbkdf2 root $hash
EOF
  sudo grub-mkconfig -o /boot/grub/grub.cfg
  echo
  echo "=============================================================="
  echo "GRUB bootloader password set. SAVE THIS NOW, it is shown once:"
  echo "  $password"
  echo "You will NOT be asked for it on a normal boot -- only if you"
  echo "ever need to edit a boot entry or enter recovery/single-user"
  echo "mode from the GRUB menu."
  echo "=============================================================="
  echo
}

# ---------------------------------------------------------------------
# DNS threat blocking via Quad9 (9.9.9.9) -- a nonprofit, security-
# focused public resolver that blocks known-malicious domains using IBM
# X-Force threat intel, updated continuously on their end, nothing to
# sync or maintain here. This is the layer that would have actually
# caught the mining pools from this project's Nov 2026 incident
# (gulf.moneroocean.stream, pool.hashvault.pro) -- they're named
# domains, not bare IPs. Real limit: malware connecting straight to a
# raw IP skips DNS entirely and isn't touched by this.
#
# Overrides the active connection's DNS via NetworkManager (every
# edition in this repo enables NetworkManager.service, confirmed by
# grep across all mode.sh files) rather than editing /etc/resolv.conf
# directly, which NetworkManager would just overwrite on the next
# reconnect/reboot. Finds the real uplink connection by device type so
# it never touches loopback or Docker's bridge.
# ---------------------------------------------------------------------
configure_dns_threat_blocking() {
  if ! command -v nmcli &>/dev/null; then
    echo "NetworkManager not installed, skipping DNS threat blocking."
    return 0
  fi
  local conn
  conn="$(nmcli -t -f NAME,TYPE con show --active | awk -F: '$2=="802-3-ethernet" || $2=="802-11-wireless" {print $1; exit}')"
  if [[ -z "$conn" ]]; then
    echo "WARNING: no active wired/wireless connection found -- skipping DNS threat blocking."
    return 0
  fi
  echo "Pointing '$conn' at Quad9's filtered DNS (9.9.9.9)..."
  sudo nmcli con mod "$conn" ipv4.dns "9.9.9.9 149.112.112.112" ipv4.ignore-auto-dns yes
  sudo nmcli con mod "$conn" ipv6.dns "2620:fe::fe 2620:fe::9" ipv6.ignore-auto-dns yes
  sudo nmcli con up "$conn" >/dev/null
}
