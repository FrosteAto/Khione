// payload/editions/server/ha-dashboard/panels/_tokens.js
// Exact frosteato.com brand values — do not approximate these.
// shortcut: these rules use :host (and :host([data-theme=...])), never
// :root — :root only ever matches the real document's <html>, never a
// shadow tree, so a :root rule here would silently never apply and the
// whole page would render unstyled. :host targets the custom element
// itself (the shadow root's host), which IS reachable from inside its
// own shadow tree. Caught live while wiring the first real panel into a
// shadow root — Task 1 alone never exercised this since it never
// instantiated the module inside a shadow DOM.
export const SHARED_TOKENS_CSS = `
:host {
  /* shortcut: every panel sets display:block on :host but none set a
     height, so the page's background only ever extends as tall as its
     own content -- invisible on a tall page (Weather, Home) but exposed
     as a hard cutoff with HA's own background showing below on a short
     one (confirmed live on Plants). min-height:100vh makes every panel
     fill at least the viewport regardless of content length. */
  min-height: 100vh;
  --bg: #fefae0;
  --card-bg: #f5eed8;
  --ink: #283618;
  --muted: #606c38;
  --accent: #704d2c;
  --accent-soft: #d4a373;
  --khione-green: #8bb862;
  --khione-purple: #5d4799;
  --khione-blue: #40c4db;
  --khione-yellow: #c9a23d;
  --band-bg: #bfcb9a;
  --band-ink: #4d3014;
  color-scheme: light;
}
:host([data-theme="dark"]) {
  --bg: #0a1b15;
  --card-bg: #09221d;
  --ink: #fefae0;
  --muted: #d9c4a8;
  --accent: #ccd5ae;
  --accent-soft: #ccd5ae;
  --band-bg: #05130d;
  --band-ink: #ccd5ae;
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) {
    --bg: #0a1b15;
    --card-bg: #09221d;
    --ink: #fefae0;
    --muted: #d9c4a8;
    --accent: #ccd5ae;
    --accent-soft: #ccd5ae;
    --band-bg: #05130d;
    --band-ink: #ccd5ae;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
`;

// shortcut: a <link rel="stylesheet"> placed INSIDE a shadow root parses
// fine, but Chromium never registers the @font-face rules it pulls in
// against document.fonts -- so font-family inside that shadow tree
// silently falls back to the generic (verified live: a shadow-root-only
// link renders Satisfy text at the exact same width as plain CSS
// `cursive`, while the identical link in the real <head> renders at the
// correct, narrower Satisfy width). CSS font resolution is document-wide
// regardless of shadow boundaries, so the fix is to load the fonts once
// into the real document <head> instead of into each panel's shadow root.
export function ensureGoogleFontsLoaded() {
  if (document.head.querySelector("[data-khione-fonts]")) return;
  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://fonts.googleapis.com";
  preconnect.setAttribute("data-khione-fonts", "");
  document.head.appendChild(preconnect);
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Satisfy&display=swap";
  document.head.appendChild(sheet);
}

// Day/night schedule: light from 6am up to (not including) 5pm, dark the
// rest of the time. The schedule is authoritative -- it re-asserts itself
// every minute on every panel currently on screen, so a manual toggle
// (see toggleTheme below) only ever holds for under a minute. That's a
// deliberate choice for an unattended wall dashboard: no stale theme left
// over from a one-off manual flip days ago.
function scheduledTheme() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 17 ? "light" : "dark";
}

// One interval for the whole page, however many panels import this module
// -- ES modules are evaluated once per page load, so this state is shared
// across every panel instance rather than duplicated per panel.
const scheduledHosts = new Set();
let schedulerStarted = false;

function applyScheduleToHosts() {
  const theme = scheduledTheme();
  for (const hostEl of scheduledHosts) {
    if (hostEl.isConnected) hostEl.setAttribute("data-theme", theme);
    else scheduledHosts.delete(hostEl);
  }
}

// hostEl must be the custom element itself (pass `this` from inside a
// panel class), NOT its shadow root (`this._root`) — a ShadowRoot is a
// DocumentFragment and has no setAttribute/getAttribute at all, and the
// CSS above keys off :host([data-theme=...]), which reads the attribute
// from the host element, not the shadow tree.
export function initTheme(hostEl) {
  hostEl.setAttribute("data-theme", scheduledTheme());
  scheduledHosts.add(hostEl);
  if (!schedulerStarted) {
    schedulerStarted = true;
    setInterval(applyScheduleToHosts, 60000);
  }
}

export function toggleTheme(hostEl) {
  const current = hostEl.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  hostEl.setAttribute("data-theme", next);
  return next;
}

// panel_custom pages get none of HA's own toolbar, so on a narrow
// viewport (phone, the companion app) there is otherwise no way back to
// the sidebar once you're on one of these pages -- it's a hidden drawer
// with nothing left on-page to open it. Call ensureMobileMenuButton once
// per panel (its one-time render branch) and setMobileMenuButtonVisible
// from `set narrow` to show/hide it.
const MENU_BUTTON_ID = "khione-mobile-menu-btn";

export function ensureMobileMenuButton(hostEl) {
  const root = hostEl.shadowRoot;
  if (root.getElementById(MENU_BUTTON_ID)) return;
  const btn = document.createElement("button");
  btn.id = MENU_BUTTON_ID;
  btn.type = "button";
  btn.setAttribute("aria-label", "Open menu");
  btn.textContent = "☰";
  btn.style.cssText =
    "display:none;position:fixed;top:12px;left:12px;z-index:1000;" +
    "width:40px;height:40px;border-radius:50%;border:none;" +
    "background:var(--card-bg);color:var(--ink);font-size:20px;" +
    "line-height:40px;padding:0;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer;";
  btn.addEventListener("click", () => {
    hostEl.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
  });
  root.appendChild(btn);
}

export function setMobileMenuButtonVisible(hostEl, narrow) {
  const btn = hostEl.shadowRoot && hostEl.shadowRoot.getElementById(MENU_BUTTON_ID);
  if (btn) btn.style.display = narrow ? "block" : "none";
}
