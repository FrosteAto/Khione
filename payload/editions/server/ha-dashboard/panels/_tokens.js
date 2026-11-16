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

// Shadow DOM supports a plain <link rel="stylesheet"> element placed
// directly inside the shadow root in every evergreen browser — each page
// appends this once, in its one-time render branch, alongside its own
// <style>. Keeping it as one shared constant means the exact Google Fonts
// URL (and its two font families) only has to be right in one place.
export const GOOGLE_FONTS_LINK_HTML =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Satisfy&display=swap">';

// Reads/writes the same localStorage key every panel's theme toggle uses,
// so a choice made on one page is remembered on the others too (same
// origin inside the HA frontend, unlike the standalone mockup artifacts).
//
// hostEl must be the custom element itself (pass `this` from inside a
// panel class), NOT its shadow root (`this._root`) — a ShadowRoot is a
// DocumentFragment and has no setAttribute/getAttribute at all, and the
// CSS above keys off :host([data-theme=...]), which reads the attribute
// from the host element, not the shadow tree.
export function initTheme(hostEl) {
  try {
    const saved = localStorage.getItem("khione-dash-theme");
    if (saved === "light" || saved === "dark") {
      hostEl.setAttribute("data-theme", saved);
    }
  } catch (e) { /* localStorage unavailable, fall back to system preference */ }
}

export function toggleTheme(hostEl) {
  const current = hostEl.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  hostEl.setAttribute("data-theme", next);
  try { localStorage.setItem("khione-dash-theme", next); } catch (e) {}
  return next;
}
