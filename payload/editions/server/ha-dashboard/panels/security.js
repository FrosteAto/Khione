// payload/editions/server/ha-dashboard/panels/security.js
// Khione Security custom panel. Full detail on every hardening subsystem
// (fail2ban, CrowdSec, AIDE, auditd, pending updates/CVEs), the action
// bridge's update/shutdown buttons, and the blocked-connection noise
// stream. See _tokens.js for shared tokens/theme-schedule, and home.js
// for the sibling panel this borrows its card/badge CSS language from
// (each panel duplicates its own CSS -- no shared stylesheet beyond
// _tokens.js, matching every other panel in this directory).
import { SHARED_TOKENS_CSS, ensureGoogleFontsLoaded, initTheme, toggleTheme, ensureMobileMenuButton, setMobileMenuButtonVisible } from "./_tokens.js";

const PAGE_CSS = `
:host{
  display:block;
  --khione-deep:#5f8a3f;
  --shadow-c:112,77,44;
  --ink-rgb:40,54,24;
  --font-display:"Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-body:'IBM Plex Mono', 'Courier New', monospace;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
}
:host([data-theme="dark"]){ --khione-deep:#a3cf7d; --shadow-c:0,0,0; --ink-rgb:206,226,180; }
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"])){ --khione-deep:#a3cf7d; --shadow-c:0,0,0; --ink-rgb:206,226,180; }
}

*{ box-sizing:border-box; }
h1,h2,h3{ font-family: var(--font-display); font-weight: 800; margin:0; text-wrap: balance; color: var(--ink); }
p{ margin:0; }
.icon{ width:1.2em; height:1.2em; stroke:currentColor; fill:none; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }
.tabular{ font-variant-numeric: tabular-nums; }

.wrap{ position:relative; padding: max(18px, env(safe-area-inset-top,0px)) max(18px, env(safe-area-inset-right,0px)) 2rem max(18px, env(safe-area-inset-left,0px)); max-width: 1400px; margin: 0 auto; }

.page-head{ display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.2rem; }
.theme-toggle{
  position:relative; width:38px; height:38px; flex:0 0 auto;
  border-radius:50%; border:1px solid rgba(var(--ink-rgb),.15);
  background: color-mix(in srgb, var(--accent-soft) 30%, var(--card-bg)); color: var(--accent);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.theme-toggle:hover{ background: color-mix(in srgb, var(--accent-soft) 45%, var(--card-bg)); }
.theme-toggle .icon{ width:18px; height:18px; }

/* Critical banner -- hidden by default, shown + animated only when
   computeCritical() below says something needs attention. */
.critical-banner{ display:none; align-items:center; gap:.8rem; background: var(--accent); color:#fff; border-radius:16px; padding:1rem 1.3rem; margin-bottom:1.2rem; font-weight:700; animation: badgePulse 2.4s ease-in-out infinite; }
.critical-banner.show{ display:flex; }
@media (prefers-reduced-motion: reduce){ .critical-banner{ animation:none; } }
@keyframes badgePulse{ 0%,100%{ box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); } 50%{ box-shadow: 0 0 0 8px transparent; } }

.grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.1rem; }
.card{
  background: var(--card-bg);
  border-radius: 20px;
  padding: 1.2rem 1.4rem;
  box-shadow: 0 3px 8px rgba(var(--shadow-c),.14), 0 22px 40px -18px rgba(var(--shadow-c),.22);
  border: 1px solid rgba(var(--ink-rgb),.06);
  min-width: 0;
}
.card h2{ font-size:1.05rem; display:flex; align-items:center; gap:.5rem; margin-bottom:.8rem; }
.card h2 .status-dot{ width:9px; height:9px; border-radius:50%; background: var(--khione-deep); flex:none; }
.card h2 .status-dot.off{ background: var(--accent); }

.detail-list{ display:flex; flex-direction:column; gap:.5rem; max-height: 220px; overflow:auto; font-size:.82rem; }
.detail-row{ display:flex; justify-content:space-between; gap:.6rem; border-bottom:1px dashed rgba(var(--ink-rgb),.12); padding-bottom:.4rem; }
.detail-row:last-child{ border-bottom:none; }
.detail-empty{ color:var(--muted); font-size:.82rem; }

.chip{ font-size:.68rem; font-weight:800; padding:.25rem .65rem; border-radius:999px; background: color-mix(in srgb, var(--khione-green) 20%, var(--card-bg)); color: var(--khione-deep); white-space:nowrap; }
.chip.warn{ background: var(--accent); color:#fff; }

.actions-row{ display:flex; gap:.7rem; flex-wrap:wrap; margin-top:.8rem; }
.action-btn{
  font-family: inherit; font-size:.82rem; font-weight:700; cursor:pointer;
  border:none; border-radius:999px; padding:.55rem 1.1rem;
  background: color-mix(in srgb, var(--khione-green) 24%, var(--card-bg)); color: var(--khione-deep);
}
.action-btn:hover{ background: color-mix(in srgb, var(--khione-green) 38%, var(--card-bg)); }
.action-btn.danger{ background: var(--accent); color:#fff; }
.action-btn:disabled{ opacity:.6; cursor:default; }
.action-status{ font-size:.78rem; color:var(--muted); margin-top:.5rem; min-height: 1.2em; }

.noise-list{ display:flex; flex-direction:column; gap:.35rem; max-height: 260px; overflow:auto; font-size:.78rem; }
.noise-row{ display:flex; gap:.6rem; align-items:baseline; }
.noise-row .t{ color:var(--muted); flex:none; width:4.2em; }
.noise-row .ip{ font-weight:700; flex:none; }
.noise-row .guess{ color:var(--muted); font-style:italic; }
`;

const PAGE_SHELL_HTML = `
<svg class="sr-only" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden;">
  <symbol id="i-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.3"/>
    <path d="M12 3.3v2.1M12 18.6v2.1M4.4 12h2.1M17.5 12h2.1M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M6.3 17.7l1.5-1.5M16.2 7.8l1.5-1.5" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-moon" viewBox="0 0 24 24">
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke-linejoin="round"/>
  </symbol>
</svg>

<link rel="preconnect" href="https://fonts.gstatic.com">

<main class="wrap">
  <div class="page-head">
    <h1>Security</h1>
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
      <svg class="icon" id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"></use></svg>
    </button>
  </div>

  <div class="critical-banner" id="critical-banner">
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>
    <span id="critical-text">—</span>
  </div>

  <div class="grid">
    <div class="card">
      <h2><span class="status-dot" id="dot-fail2ban"></span>fail2ban</h2>
      <p id="f2b-summary" class="tabular">—</p>
      <div class="detail-list" id="f2b-detail"></div>
    </div>

    <div class="card">
      <h2><span class="status-dot" id="dot-crowdsec"></span>CrowdSec</h2>
      <p id="cs-summary" class="tabular">—</p>
      <div class="detail-list" id="cs-detail"></div>
    </div>

    <div class="card">
      <h2><span class="status-dot" id="dot-aide"></span>AIDE</h2>
      <p id="aide-summary">—</p>
      <div class="detail-list" id="aide-detail"></div>
    </div>

    <div class="card">
      <h2><span class="status-dot" id="dot-auditd"></span>auditd</h2>
      <p id="auditd-summary">—</p>
      <div class="detail-list" id="auditd-detail"></div>
    </div>

    <div class="card">
      <h2>Updates</h2>
      <p id="updates-summary">—</p>
      <div class="detail-list" id="updates-detail"></div>
      <div class="actions-row">
        <button class="action-btn" id="btn-update-official" type="button">Apply official updates</button>
        <button class="action-btn" id="btn-update-aur" type="button">Apply AUR updates</button>
      </div>
      <p class="action-status" id="update-action-status"></p>
    </div>

    <div class="card">
      <h2>Server control</h2>
      <p style="color:var(--muted);font-size:.82rem;">Available on this network only.</p>
      <div class="actions-row">
        <button class="action-btn danger" id="btn-shutdown" type="button">Emergency shutdown</button>
      </div>
      <p class="action-status" id="shutdown-action-status"></p>
    </div>

    <div class="card" style="grid-column: 1 / -1;">
      <h2>Recent blocked connections</h2>
      <p style="color:var(--muted);font-size:.78rem;margin-bottom:.6rem;">Real data from ufw + CrowdSec. The "guess" column is always a guess, never a fact — marked low-confidence unless CrowdSec itself made the classification.</p>
      <div class="noise-list" id="noise-list"></div>
    </div>
  </div>
</main>
`;

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtAgo(epochSeconds) {
  if (epochSeconds == null) return null;
  const diffMin = Math.max(0, Math.round((Date.now() - epochSeconds * 1000) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return diffMin + "m ago";
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return diffH + "h ago";
  return Math.round(diffH / 24) + "d ago";
}

// Shared with home.js's security-badge logic -- this exact function body
// must stay identical in both files (no shared JS module beyond
// _tokens.js in this codebase's convention). "Critical" here means
// something that needs a human to act, not "the defenses did their job"
// (an active ban/decision is the system working, not a problem).
function computeCritical(secAttrs, sysAttrs, patAttrs, netAttrs) {
  const reasons = [];
  if (secAttrs.aide_status === "changes_detected") reasons.push("AIDE detected file changes");
  if (secAttrs.auditd_active === false) reasons.push("auditd is down");
  if (secAttrs.fail2ban_active === false) reasons.push("fail2ban is down");
  if (secAttrs.crowdsec_active === false) reasons.push("CrowdSec is down");
  const unusualOutbound = Number(netAttrs.unusual_outbound) || 0;
  if (unusualOutbound > 0) reasons.push(unusualOutbound + " unusual outbound connection" + (unusualOutbound === 1 ? "" : "s"));
  const secUpdates = Number(sysAttrs.security_updates) || 0;
  if (secUpdates > 0) reasons.push(secUpdates + " known CVE" + (secUpdates === 1 ? "" : "s") + " on installed packages");
  const newsUnread = Number(patAttrs.news_unread) || 0;
  if (newsUnread > 0) reasons.push(newsUnread + " unread Arch News item" + (newsUnread === 1 ? "" : "s") + " blocking auto-updates");
  return { critical: reasons.length > 0, reason: reasons.join("; ") };
}

class KhioneSecurityPanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._rendered = false;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }
  set narrow(narrow) {
    this._narrow = narrow;
    setMobileMenuButtonVisible(this, narrow);
  }
  set route(r) {}
  set panel(p) {}

  _render() {
    if (!this._hass) return;
    if (!this._rendered) {
      ensureGoogleFontsLoaded();
      this._root.innerHTML = `<style>${SHARED_TOKENS_CSS}${PAGE_CSS}</style>${PAGE_SHELL_HTML}`;
      initTheme(this);
      ensureMobileMenuButton(this);
      setMobileMenuButtonVisible(this, this._narrow);
      this._bindStaticHandlers();
      this._bindActionButtons();
      this._rendered = true;
    }
    this._renderLiveData();
  }

  _bindStaticHandlers() {
    const btn = this._root.getElementById("theme-toggle");
    const icon = this._root.getElementById("theme-toggle-icon");
    const paintIcon = (theme) => {
      if (!icon) return;
      icon.innerHTML = theme === "dark" ? '<use href="#i-sun"></use>' : '<use href="#i-moon"></use>';
    };
    paintIcon(this.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    if (btn) {
      btn.addEventListener("click", () => {
        const next = toggleTheme(this);
        paintIcon(next);
      });
    }
  }

  _bindActionButtons() {
    const root = this._root;
    const fire = (btn, statusEl, serviceName, confirmText, expectedAction) => {
      btn.addEventListener("click", () => {
        if (!window.confirm(confirmText)) return;
        btn.disabled = true;
        statusEl.textContent = "Running…";
        // Baseline: a result from an earlier run must not count as this run's.
        const before = ((this._hass.states["sensor.khione_actions"] || {}).attributes || {}).started_at;
        this._hass.callService("shell_command", serviceName);
        if (!expectedAction) return; // shutdown: no result file will ever come back
        let attempts = 0;
        const poll = () => {
          attempts += 1;
          const actions = this._hass.states["sensor.khione_actions"];
          const attrs = (actions && actions.attributes) || {};
          if (attrs.action === expectedAction && attrs.started_at && attrs.started_at !== before) {
            statusEl.textContent = attrs.success ? "Done." : "Failed: " + (attrs.output_tail || "").slice(-200);
            btn.disabled = false;
            return;
          }
          if (attempts > 24) { // ~2 minutes at 5s apart
            statusEl.textContent = "Still running, or no result yet — check the dashboard again shortly.";
            btn.disabled = false;
            return;
          }
          setTimeout(poll, 5000);
        };
        setTimeout(poll, 5000);
      });
    };

    fire(
      root.getElementById("btn-update-official"),
      root.getElementById("update-action-status"),
      "khione_update_official",
      "Apply pending official updates now?",
      "update_official",
    );
    fire(
      root.getElementById("btn-update-aur"),
      root.getElementById("update-action-status"),
      "khione_update_aur",
      "Apply pending AUR updates now? AUR packages are unreviewed source — this is a real step up in trust from the notify-only check.",
      "update_aur",
    );
    fire(
      root.getElementById("btn-shutdown"),
      root.getElementById("shutdown-action-status"),
      "khione_shutdown",
      "Shut down the server now? This cannot be undone remotely.",
      null,
    );
  }

  _renderLiveData() {
    const hass = this._hass;
    if (!hass) return;
    const root = this._root;

    const security = hass.states["sensor.khione_security"];
    const system = hass.states["sensor.khione_system"];
    const patching = hass.states["sensor.khione_patching"];
    const netwatch = hass.states["sensor.khione_netwatch"];

    const secAttrs = (security && security.attributes) || {};
    const sysAttrs = (system && system.attributes) || {};
    const patAttrs = (patching && patching.attributes) || {};
    const netAttrs = (netwatch && netwatch.attributes) || {};

    const { critical, reason } = computeCritical(secAttrs, sysAttrs, patAttrs, netAttrs);
    const banner = root.getElementById("critical-banner");
    banner.classList.toggle("show", critical);
    root.getElementById("critical-text").textContent = reason || "—";

    // ---- fail2ban ----
    root.getElementById("dot-fail2ban").className = "status-dot" + (secAttrs.fail2ban_active === false ? " off" : "");
    const bannedIps = Number(secAttrs.banned_ips) || 0;
    root.getElementById("f2b-summary").textContent = secAttrs.fail2ban_active === false
      ? "Service is down"
      : bannedIps + " currently banned";
    const banList = Array.isArray(secAttrs.ban_list) ? secAttrs.ban_list : [];
    root.getElementById("f2b-detail").innerHTML = banList.length
      ? banList.map((b) => '<div class="detail-row"><span>' + escapeHtml(b.ip) + '</span><span class="chip">' + escapeHtml(b.jail) + "</span></div>").join("")
      : '<p class="detail-empty">No active bans.</p>';

    // ---- CrowdSec ----
    root.getElementById("dot-crowdsec").className = "status-dot" + (secAttrs.crowdsec_active === false ? " off" : "");
    const csDecisions = Number(secAttrs.crowdsec_decisions) || 0;
    root.getElementById("cs-summary").textContent = secAttrs.crowdsec_active === false
      ? "Service is down"
      : csDecisions + " active decision" + (csDecisions === 1 ? "" : "s");
    const csLog = Array.isArray(secAttrs.crowdsec_decision_log) ? secAttrs.crowdsec_decision_log : [];
    root.getElementById("cs-detail").innerHTML = csLog.length
      ? csLog.map((d) => '<div class="detail-row"><span>' + escapeHtml(d.ip) + '</span><span class="chip">' + escapeHtml(d.scenario || "—") + "</span></div>").join("")
      : '<p class="detail-empty">No active decisions.</p>';

    // ---- AIDE ----
    const aideStatus = secAttrs.aide_status || "unknown";
    root.getElementById("dot-aide").className = "status-dot" + (aideStatus === "changes_detected" ? " off" : "");
    root.getElementById("aide-summary").textContent =
      aideStatus === "clean" ? "Clean, last checked " + (fmtAgo(toEpoch(secAttrs.aide_last_run)) || "—")
      : aideStatus === "changes_detected" ? "Changes detected"
      : aideStatus === "not_yet_run" ? "Not yet run"
      : "Unknown";
    const aideDiff = Array.isArray(secAttrs.aide_diff) ? secAttrs.aide_diff : [];
    root.getElementById("aide-detail").innerHTML = aideDiff.length
      ? aideDiff.map((line) => '<div class="detail-row"><span>' + escapeHtml(line) + "</span></div>").join("")
      : '<p class="detail-empty">No changes to show.</p>';

    // ---- auditd ----
    const auditdActive = secAttrs.auditd_active === true;
    root.getElementById("dot-auditd").className = "status-dot" + (auditdActive ? "" : " off");
    root.getElementById("auditd-summary").textContent = auditdActive
      ? (secAttrs.auditd_immutable ? "Active, ruleset locked" : "Active, ruleset mutable")
      : "Down";
    const auditdRecent = Array.isArray(secAttrs.auditd_recent) ? secAttrs.auditd_recent : [];
    root.getElementById("auditd-detail").innerHTML = auditdRecent.length
      ? auditdRecent.map((line) => '<div class="detail-row"><span>' + escapeHtml(line) + "</span></div>").join("")
      : '<p class="detail-empty">No recent events on the watched paths.</p>';

    // ---- updates ----
    const officialUpdates = Number(sysAttrs.updates) || 0;
    const secUpdates = Number(sysAttrs.security_updates) || 0;
    const newsUnread = Number(patAttrs.news_unread) || 0;
    const aurAvailable = patAttrs.aur_update_available === true;
    root.getElementById("updates-summary").textContent =
      officialUpdates + " official update" + (officialUpdates === 1 ? "" : "s") + " pending" +
      (newsUnread > 0 ? " — blocked by " + newsUnread + " unread Arch News item" + (newsUnread === 1 ? "" : "s") : "");
    const securityDetail = Array.isArray(sysAttrs.security_detail) ? sysAttrs.security_detail : [];
    const updateRows = [];
    if (secUpdates > 0) {
      securityDetail.forEach((d) => {
        updateRows.push('<div class="detail-row"><span>' + escapeHtml(d.package) + '</span><span class="chip warn">' + escapeHtml(d.severity || "High") + (d.cve ? " · " + escapeHtml(d.cve) : "") + "</span></div>");
      });
    }
    if (aurAvailable) {
      updateRows.push('<div class="detail-row"><span>Plex (AUR)</span><span class="chip">update available</span></div>');
    }
    root.getElementById("updates-detail").innerHTML = updateRows.length
      ? updateRows.join("")
      : '<p class="detail-empty">Nothing outstanding.</p>';

    // ---- action buttons (wired in Task 5) ----
    root.getElementById("btn-update-official").disabled = false;
    root.getElementById("btn-update-aur").disabled = false;
    root.getElementById("btn-shutdown").disabled = false;

    // ---- noise stream ----
    const netnoise = hass.states["sensor.khione_netnoise"];
    const noiseEvents = (netnoise && netnoise.attributes && netnoise.attributes.events) || [];
    const noiseListEl = root.getElementById("noise-list");
    noiseListEl.innerHTML = noiseEvents.length
      ? noiseEvents
          .slice(0, 50)
          .map((e) => {
            const t = e.time ? new Date(e.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
            const portText = e.dst_port != null ? ":" + e.dst_port : "";
            return (
              '<div class="noise-row">' +
              '<span class="t tabular">' + t + "</span>" +
              '<span class="ip tabular">' + escapeHtml((e.src_ip || "—") + portText) + "</span>" +
              '<span class="guess">' + escapeHtml(e.guess) + (e.guess_confidence === "crowdsec" ? "" : " (guess)") + "</span>" +
              "</div>"
            );
          })
          .join("")
      : '<p class="detail-empty">No recent activity.</p>';
  }
}

function toEpoch(value) {
  // aide_last_run arrives as systemd's own timestamp text
  // ("Tue 2026-11-17 00:38:34 GMT"), not epoch seconds like the other
  // *_run fields -- confirmed against khione-security's own source,
  // which deliberately leaves this one field as text (see its header
  // comment) while converting every other timestamp to epoch seconds.
  if (!value) return null;
  const t = Date.parse(value);
  return isNaN(t) ? null : Math.floor(t / 1000);
}

customElements.define("khione-security-panel", KhioneSecurityPanel);
