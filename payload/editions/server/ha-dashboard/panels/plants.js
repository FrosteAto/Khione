// payload/editions/server/ha-dashboard/panels/plants.js
// Khione Plants custom panel. Ported from the approved mockup scratchpad
// mockups/plants-redesign-washi-ghibli-brand.html — this file is a
// data-wiring change onto that approved design, not a redesign. See
// _tokens.js for the shared brand tokens/theme toggle, and weather.js/
// home.js for the sibling panels this follows the same wrapper mechanics as.
//
// Unlike the mockup (which drove the grid off a hand-edited `plants` array
// with "+ Add sample plant" / "− Remove last plant" buttons to prove the
// layout scales), this panel re-derives its plant list from live
// `hass.states` on every render — those two buttons and their
// array-mutation JS (pickSampleName/usedNames/SAMPLE_NAMES/VARIANTS, the
// add/remove click handlers) are dropped entirely, and the `button.ctl`
// CSS that only styled them goes with them. The live "Showing N plants"
// counter stays (now computed from the real discovered count).
import { SHARED_TOKENS_CSS, GOOGLE_FONTS_LINK_HTML, initTheme, toggleTheme } from "./_tokens.js";

// ---------------------------------------------------------------------------
// PAGE_CSS — ported from the mockup's main <style> block, with the same
// kinds of adaptation as weather.js/home.js:
//
// 1. Shadow-DOM retargeting: `body{...}` becomes `:host{...}` (with
//    `display:block` added, since custom elements default to
//    `display:inline`) — a shadow root has no real <body> for that
//    selector to match.
// 2. The mockup's own `:root{...}` / dark-mode token blocks are NOT
//    duplicated here — `--bg`, `--card-bg`, `--ink`, `--muted`, `--accent`,
//    `--accent-soft`, `--khione-green`, `--khione-blue`, `--khione-purple`,
//    `--khione-yellow` already come from SHARED_TOKENS_CSS (prepended in
//    the same <style> tag) with the exact same light/dark hex values the
//    mockup used.
// 3. The mockup's `--header-footer-bg`/`--header-footer-accent` are the
//    exact same hex values (light AND dark) as SHARED_TOKENS_CSS's
//    `--band-bg`/`--band-ink` (the weather.js/home.js naming for the same
//    tokens) — every var() reference renamed accordingly. `--font-head`,
//    `--font-body`, `--font-script` have no shared equivalent, so they're
//    kept as page-local tokens (declared in :host below, same values the
//    mockup's :root block used — they don't change between themes, so no
//    dark-mode override is needed for them).
// 4. A `.theme-toggle` button + two new hand-drawn icons (i-sun/i-moon, see
//    PAGE_SHELL_HTML) are added — the mockup had no theme toggle markup at
//    all, same gap home.js's mockup had (see its own comment for this).
// ---------------------------------------------------------------------------
const PAGE_CSS = `
*{box-sizing:border-box;}
:host{
  display:block;
  margin:0;
  --font-head:"Helvetica Neue",Helvetica,Arial,sans-serif;
  --font-body:"IBM Plex Mono",ui-monospace,"SF Mono",Consolas,monospace;
  --font-script:"Satisfy","Segoe Script",cursive;
  font-family:var(--font-body);
  color:var(--ink);
  background-color:var(--bg);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  background-size:220px 220px;
  line-height:1.6;
}
h1,h2,h3{font-family:var(--font-head);margin:0;text-wrap:balance;}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;}

/* ---------- hero ---------- */
.hero{background:var(--band-bg);padding-block:2.75rem 2.25rem;animation:rise .6s ease-out both;}
.hero-inner{
  padding-left:max(16px, env(safe-area-inset-left,0px));
  padding-right:max(16px, env(safe-area-inset-right,0px));
  display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap;
}
.hero-icon-wrap{position:relative;width:76px;height:76px;flex:0 0 auto;}
.hero-icon-wrap .blob{position:absolute;inset:0;width:100%;height:100%;fill:color-mix(in srgb, var(--band-ink) 16%, transparent);}
.hero-icon-wrap .plant-icon{position:absolute;inset:0;width:62%;height:62%;margin:auto;color:var(--khione-green);}
.hero-text h1{font-size:2rem;font-weight:800;color:var(--band-ink);}
.hero-text p{margin:.35rem 0 0;color:var(--band-ink);opacity:.85;max-width:46ch;font-size:.92rem;}
.hero-note{display:block;font-family:var(--font-script);font-size:1.3rem;color:var(--band-ink);margin-top:.4rem;}
@keyframes rise{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
@media (prefers-reduced-motion: reduce){.hero{animation:none;}}

.theme-toggle{
  position:relative;margin-left:auto;
  width:40px;height:40px;flex:0 0 auto;
  border-radius:50%;border:1px solid color-mix(in srgb, var(--band-ink) 30%, transparent);
  background:color-mix(in srgb, var(--band-ink) 10%, transparent);
  color:var(--band-ink);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;
}
.theme-toggle:hover{background:color-mix(in srgb, var(--band-ink) 18%, transparent);}
.theme-toggle svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.theme-toggle:focus-visible{outline:2px solid var(--khione-blue);outline-offset:2px;}

/* ---------- controls ---------- */
.controls{margin:1.5rem 0 0;padding-left:max(16px, env(safe-area-inset-left,0px));padding-right:max(16px, env(safe-area-inset-right,0px));}
.controls-bar{
  background:var(--card-bg);border-radius:22px 30px 22px 30px;
  padding:.9rem 1.1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;
  box-shadow:0 10px 26px -14px color-mix(in srgb, var(--accent) 45%, transparent);
}
.count{font-size:.82rem;color:var(--muted);margin-left:auto;font-variant-numeric:tabular-nums;}

/* ---------- grid ---------- */
.grid-section{padding:1.75rem max(16px, env(safe-area-inset-left,0px)) 3rem max(16px, env(safe-area-inset-left,0px));}
.grid-section{padding-right:max(16px, env(safe-area-inset-right,0px));}
.plant-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(264px,1fr));gap:1.6rem;}

.empty-state{
  grid-column:1/-1;text-align:center;padding:3rem 1.5rem;color:var(--muted);
  border:2px dashed color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius:30px 42px 30px 42px;font-size:.95rem;
}
.empty-state strong{display:block;font-family:var(--font-head);font-size:1.15rem;color:var(--ink);margin-bottom:.3rem;}

.card{
  position:relative;background:var(--card-bg);padding:1.3rem 1.2rem 1.4rem;
  border-top:6px solid var(--accent);
  border-radius:26px 34px 28px 38px;
  box-shadow:0 16px 36px -16px color-mix(in srgb, var(--accent) 45%, transparent);
  transition:transform .18s ease, box-shadow .18s ease;
}
.plant-grid .card:nth-child(3n+2){border-radius:34px 24px 36px 26px;}
.plant-grid .card:nth-child(3n){border-radius:24px 36px 24px 40px;}
.card:hover{transform:translateY(-4px);}
@media (prefers-reduced-motion: reduce){.card{transition:none;}.card:hover{transform:none;}}

.card.tone-thirsty{border-top-color:var(--accent-soft);box-shadow:0 16px 36px -16px color-mix(in srgb, var(--accent-soft) 45%, transparent);}
.card.tone-healthy{border-top-color:var(--khione-green);box-shadow:0 16px 36px -16px color-mix(in srgb, var(--khione-green) 45%, transparent);}
/* "wellwatered" (60-84%) has no own rule in the mockup — it only ever drew
   this range with the same tone-healthy CSS as 25-59% (just a different
   message). The brief's _bandFor splits it into its own tone name without
   adding CSS for it, so this duplicates tone-healthy's rule under that name
   rather than leaving 60-84% cards with no accent color at all. */
.card.tone-wellwatered{border-top-color:var(--khione-green);box-shadow:0 16px 36px -16px color-mix(in srgb, var(--khione-green) 45%, transparent);}
.card.tone-verywet{border-top-color:var(--khione-blue);box-shadow:0 16px 36px -16px color-mix(in srgb, var(--khione-blue) 35%, transparent);}
.card.tone-toowet{border-top-color:var(--khione-blue);box-shadow:0 16px 36px -16px color-mix(in srgb, var(--khione-blue) 55%, transparent);}

.icon-wrap{position:relative;width:78px;height:78px;margin:0 auto .5rem;}
.icon-wrap .blob{position:absolute;inset:0;width:100%;height:100%;fill:color-mix(in srgb, var(--khione-green) 16%, var(--card-bg));}
.icon-wrap .plant-icon{position:absolute;inset:0;width:58%;height:58%;margin:auto;color:var(--khione-green);}
.leaves.wilt{color:var(--accent-soft);transform-box:fill-box;transform-origin:50% 90%;transform:rotate(16deg) translate(1px,3px);}

.plant-name{text-align:center;font-size:1.08rem;font-weight:700;color:var(--ink);}

.gauge-wrap{position:relative;width:104px;height:104px;margin:.6rem auto .2rem;}
.gauge{width:100%;height:100%;}
.gauge-track{fill:none;stroke:var(--muted);stroke-opacity:.22;stroke-width:9;}
.gauge-arc{fill:none;stroke-width:9;stroke-linecap:round;}
.gauge-pct{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:1.4rem;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;
}
.gauge-pct small{font-size:.85rem;font-weight:500;margin-left:1px;color:var(--muted);}

.status-msg{text-align:center;font-size:.86rem;font-weight:600;color:var(--ink);margin:.3rem 0 .15rem;}
.meta{text-align:center;font-size:.72rem;color:var(--muted);margin:0;}
.note{
  position:absolute;top:-10px;right:10px;font-family:var(--font-script);
  font-size:1.05rem;color:var(--accent);transform:rotate(-6deg);
  background:var(--card-bg);padding:0 .2rem;
}
`;

// ---------------------------------------------------------------------------
// PAGE_SHELL_HTML — markup ported from the mockup. Every hand-drawn icon
// <symbol> from the mockup's <svg aria-hidden="true"> defs block is kept
// byte-for-byte (blob-shape, icon-pot, leaf-fern, leaf-succulent,
// leaf-monstera, leaf-generic); i-sun/i-moon are new, for the theme toggle
// (see PAGE_CSS note #4). The mockup's "+ Add sample plant" / "− Remove
// last plant" buttons are dropped (see file header comment); the live
// count span stays, and the plant grid's contents are filled entirely by
// _renderLiveData().
// ---------------------------------------------------------------------------
const PAGE_SHELL_HTML = `
<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
<defs>
  <symbol id="blob-shape" viewBox="0 0 96 96">
    <path d="M48 6C66 4 90 20 92 42C94 64 76 90 52 92C28 94 6 76 5 52C4 28 24 8 48 6Z"/>
  </symbol>
  <symbol id="icon-pot" viewBox="0 0 64 64">
    <path d="M18 44C18 43 46 43 46 44L41 59C41 60 23 60 23 59Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M15 44L49 44" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
  </symbol>
  <symbol id="leaf-fern" viewBox="0 0 64 64">
    <g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
      <path d="M32 44C31 34 32 24 33 14"/>
      <path d="M32 38C27 36 22 33 18 29"/>
      <path d="M32 38C37 36 42 33 46 29"/>
      <path d="M32 31C28 29 24 26 21 23"/>
      <path d="M32 31C36 29 40 26 43 23"/>
      <path d="M32 23C29 21 27 19 25 17"/>
      <path d="M32 23C35 21 37 19 39 17"/>
    </g>
  </symbol>
  <symbol id="leaf-succulent" viewBox="0 0 64 64">
    <g stroke="var(--accent)" stroke-width="2" fill="currentColor">
      <ellipse cx="32" cy="30" rx="6" ry="13" transform="rotate(0 32 38)"/>
      <ellipse cx="32" cy="30" rx="6" ry="13" transform="rotate(60 32 38)"/>
      <ellipse cx="32" cy="30" rx="6" ry="13" transform="rotate(120 32 38)"/>
      <ellipse cx="32" cy="30" rx="6" ry="13" transform="rotate(180 32 38)"/>
      <ellipse cx="32" cy="30" rx="6" ry="13" transform="rotate(240 32 38)"/>
      <ellipse cx="32" cy="30" rx="6" ry="13" transform="rotate(300 32 38)"/>
    </g>
  </symbol>
  <symbol id="leaf-monstera" viewBox="0 0 64 64">
    <path d="M32 44C20 42 14 30 18 20C21 12 29 8 36 10C46 13 50 24 46 33C43 40 38 44 32 44Z" fill="currentColor" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>
    <g fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round">
      <path d="M32 42C31 32 31 20 33 11"/>
      <path d="M31 30C27 28 23 27 20 26"/>
      <path d="M33 24C37 22 41 21 44 20"/>
    </g>
  </symbol>
  <symbol id="leaf-generic" viewBox="0 0 64 64">
    <path d="M32 44C24 40 20 30 25 22C28 17 33 16 32 24C31 16 36 17 39 22C44 30 40 40 32 44Z" fill="currentColor" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>
  </symbol>
  <symbol id="i-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.3"/>
    <path d="M12 3.3v2.1M12 18.6v2.1M4.4 12h2.1M17.5 12h2.1M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M6.3 17.7l1.5-1.5M16.2 7.8l1.5-1.5" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-moon" viewBox="0 0 24 24">
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke-linejoin="round"/>
  </symbol>
</defs>
</svg>

<header class="hero">
  <div class="hero-inner">
    <div class="hero-icon-wrap">
      <svg class="blob" viewBox="0 0 96 96" aria-hidden="true"><use href="#blob-shape"></use></svg>
      <svg class="plant-icon" viewBox="0 0 64 64" aria-hidden="true">
        <use href="#icon-pot"></use>
        <use href="#leaf-monstera"></use>
      </svg>
    </div>
    <div class="hero-text">
      <h1>My Plants</h1>
      <p>Live soil moisture from the Third Reality sensors tucked into every pot.</p>
      <span class="hero-note">every leaf, looked after</span>
    </div>
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
      <svg id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"></use></svg>
    </button>
  </div>
</header>

<div class="controls">
  <div class="controls-bar">
    <span class="count" id="plant-count" aria-live="polite"></span>
  </div>
</div>

<main class="grid-section">
  <div class="plant-grid" id="plant-grid" aria-live="polite"></div>
</main>
`;

// ---------------------------------------------------------------------------
// Live-data helpers — module-local, pure functions (ported verbatim in
// logic from the mockup's script), kept outside the class since none of
// them touch `this`.
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Same "m ago"/"h ago"/"d ago" shape as home.js's timeAgo (duplicated
// locally, not imported — home.js isn't a shared module and isn't to be
// modified for this task).
function timeAgo(dateStr) {
  const t = Date.parse(dateStr);
  if (isNaN(t)) return "—";
  const diffMin = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return diffMin + "m ago";
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return diffH + "h ago";
  return Math.round(diffH / 24) + "d ago";
}

// Picks one of the mockup's 4 hand-drawn leaf icons from a keyword in the
// plant's derived name — same substring-match approach as home.js's
// tempIconId(). The mockup assigned iconVariant by hand per sample plant;
// real plants only give us a name, so "Chinese Fern" -> fern, "Monstera"
// -> monstera, and anything without a recognized keyword (e.g. "English
// Ivy", "Pothos") falls back to the mockup's generic leaf shape.
function iconVariantFor(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("fern")) return "fern";
  if (n.includes("monstera")) return "monstera";
  if (n.includes("succulent") || n.includes("cactus") || n.includes("jade") || n.includes("echeveria")) return "succulent";
  return "generic";
}

// Continuous dry -> wet gauge color, ported verbatim from the mockup
// (independent of the discrete tone/band above).
const GAUGE_STOPS = [[0, "#704d2c"], [10, "#d4a373"], [30, "#8bb862"], [75, "#8bb862"], [100, "#40c4db"]];
function hexToRgb(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(c) {
  return "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
function gaugeColor(pct) {
  pct = Math.max(0, Math.min(100, pct));
  for (let i = 0; i < GAUGE_STOPS.length - 1; i++) {
    const p0 = GAUGE_STOPS[i][0], p1 = GAUGE_STOPS[i + 1][0];
    if (pct >= p0 && pct <= p1) {
      const t = p1 === p0 ? 0 : (pct - p0) / (p1 - p0);
      const a = hexToRgb(GAUGE_STOPS[i][1]), b = hexToRgb(GAUGE_STOPS[i + 1][1]);
      return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return GAUGE_STOPS[GAUGE_STOPS.length - 1][1];
}

function gaugeSVG(pct, color) {
  const r = 42, c = 2 * Math.PI * r, offset = c * (1 - pct / 100);
  return '<svg class="gauge" viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle class="gauge-track" cx="50" cy="50" r="' + r + '"></circle>' +
    '<circle class="gauge-arc" cx="50" cy="50" r="' + r + '" stroke="' + color + '" ' +
    'stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '" transform="rotate(-90 50 50)"></circle>' +
    '</svg>';
}

class KhionePlantsPanel extends HTMLElement {
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
  }
  set route(route) {
    this._route = route;
  }
  set panel(panel) {
    this._panel = panel;
  }

  _render() {
    if (!this._hass) return;
    if (!this._rendered) {
      this._root.innerHTML = `${GOOGLE_FONTS_LINK_HTML}<style>${SHARED_TOKENS_CSS}${PAGE_CSS}</style>${PAGE_SHELL_HTML}`;
      initTheme(this);
      this._bindStaticHandlers();
      this._rendered = true;
    }
    this._renderLiveData();
  }

  // Click handler + initial icon paint for the theme toggle — same
  // mechanics as weather.js/home.js: initTheme(this)/toggleTheme(this), the
  // custom element itself, never the shadow root.
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

  // Discovers every ThirdReality soil-moisture sensor from live hass.states.
  // The `_soil_moisture` suffix (not just `_moisture`) is what excludes each
  // plant's sibling ambient-humidity "Moisture" entity — only entity_ids
  // ending in `_soil_moisture` match.
  _discoverPlants() {
    const plants = [];
    for (const [entityId, stateObj] of Object.entries(this._hass.states)) {
      if (!entityId.startsWith("sensor.") || !entityId.endsWith("_soil_moisture")) continue;
      const pct = Number(stateObj.state);
      if (Number.isNaN(pct)) continue; // "unavailable"/"unknown" — skip, don't crash
      let name = stateObj.attributes.friendly_name || entityId;
      name = name.replace(/\s*Soil moisture$/i, "").replace(/^ThirdReality\s+/i, "").trim();
      plants.push({ entityId, name, pct, lastChanged: stateObj.last_changed });
    }
    plants.sort((a, b) => a.name.localeCompare(b.name));
    return plants;
  }

  _bandFor(pct) {
    if (pct <= 9) return { label: "Needs watering now!", tone: "urgent" };
    if (pct <= 24) return { label: "Getting thirsty — water soon", tone: "thirsty" };
    if (pct <= 59) return { label: "Happy and hydrated", tone: "healthy" };
    if (pct <= 84) return { label: "Well watered", tone: "wellwatered" };
    if (pct <= 99) return { label: "Very moist — ease off watering", tone: "verywet" };
    return { label: "Too wet — let it dry out", tone: "toowet" };
  }

  // Ported from the mockup's cardHTML(), substituting real discovered data
  // for the mockup's hand-edited sample fields (name/moisturePercent/
  // iconVariant/lastReading -> name/pct/iconVariantFor(name)/lastChanged).
  _cardHTML(plant) {
    const pct = Math.max(0, Math.min(100, Math.round(plant.pct)));
    const band = this._bandFor(pct);
    const color = gaugeColor(pct);
    const urgent = band.tone === "urgent";
    const name = escapeHtml(plant.name);
    const iconVariant = iconVariantFor(plant.name);
    return (
      '<article class="card tone-' + band.tone + '">' +
        (urgent ? '<span class="note">don’t forget me!</span>' : '') +
        '<div class="icon-wrap">' +
          '<svg class="blob" viewBox="0 0 96 96" aria-hidden="true"><use href="#blob-shape"></use></svg>' +
          '<svg class="plant-icon" viewBox="0 0 64 64" aria-hidden="true">' +
            '<use href="#icon-pot"></use>' +
            '<g class="leaves' + (urgent ? ' wilt' : '') + '"><use href="#leaf-' + iconVariant + '"></use></g>' +
          '</svg>' +
        '</div>' +
        '<h3 class="plant-name">' + name + '</h3>' +
        '<div class="gauge-wrap">' + gaugeSVG(pct, color) +
          '<span class="gauge-pct">' + pct + '<small>%</small></span>' +
        '</div>' +
        '<p class="status-msg">' + escapeHtml(band.label) + '</p>' +
        '<p class="meta">' + escapeHtml(timeAgo(plant.lastChanged)) + '</p>' +
        '<span class="sr-only">' + name + ': ' + pct + ' percent soil moisture. ' + escapeHtml(band.label) + '</span>' +
      '</article>'
    );
  }

  _renderLiveData() {
    const hass = this._hass;
    if (!hass) return;
    const root = this._root;

    const plants = this._discoverPlants();
    const grid = root.getElementById("plant-grid");
    const countEl = root.getElementById("plant-count");

    grid.innerHTML = plants.length
      ? plants.map((p) => this._cardHTML(p)).join("")
      : '<div class="empty-state"><strong>No plants yet</strong>Add one to start tracking soil moisture.</div>';

    if (countEl) {
      countEl.textContent = "Showing " + plants.length + " plant" + (plants.length === 1 ? "" : "s");
    }
  }
}

customElements.define("khione-plants-panel", KhionePlantsPanel);
