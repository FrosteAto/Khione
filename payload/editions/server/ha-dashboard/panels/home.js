// payload/editions/server/ha-dashboard/panels/home.js
// Khione Home custom panel. Ported from the approved mockup scratchpad
// mockups/home-redesign-washi-ghibli-brand.html — this file is a data-wiring
// change onto that approved design, not a redesign. See _tokens.js for the
// shared brand tokens/theme toggle, and weather.js for the sibling panel
// this follows the same wrapper mechanics as.
import { SHARED_TOKENS_CSS, GOOGLE_FONTS_LINK_HTML, initTheme, toggleTheme } from "./_tokens.js";

// ---------------------------------------------------------------------------
// PAGE_CSS — ported from the mockup's main <style> block. Three kinds of
// adaptation on top of the mockup text, each isolated below:
//
// 1. Shadow-DOM retargeting (same reasoning as weather.js): `body{...}` /
//    `body::before{...}` become `:host{...}` / `:host::after{...}` — a
//    shadow root has no real <body>, so those selectors would otherwise
//    match nothing. `display:block` is added because custom elements
//    default to `display:inline`.
// 2. The mockup's own `:root{...}` / dark-mode token block is NOT
//    duplicated here — `--bg`, `--card-bg`, `--ink`, `--muted`, `--accent`,
//    `--accent-soft`, `--band-bg`, `--band-ink` already come from
//    SHARED_TOKENS_CSS (prepended in the same <style> tag), with the exact
//    same light/dark values.
// 3. The mockup used its OWN names for three brand colors that
//    SHARED_TOKENS_CSS already exports under different names with the
//    identical hex values: `--khione` -> `--khione-green` (#8bb862),
//    `--purple` -> `--khione-purple` (#5d4799), `--blue` -> `--khione-blue`
//    (#40c4db), `--yellow` -> `--khione-yellow` (#c9a23d). Every var(...)
//    reference to those three was renamed accordingly so this page actually
//    reads the shared tokens instead of silently resolving to nothing.
//    `--khione-deep`, `--shadow-c`, `--ink-rgb`, `--font-display`,
//    `--font-body`, `--font-script` have no shared equivalent, so they're
//    kept as page-local tokens (declared in :host below, with the same
//    light/dark values the mockup's :root block used).
// ---------------------------------------------------------------------------
const PAGE_CSS = `
:host{
  display:block;
  --khione-deep:#5f8a3f;
  --shadow-c:112,77,44;
  --ink-rgb:40,54,24;
  --font-display:"Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-body:'IBM Plex Mono', 'Courier New', monospace;
  --font-script:'Satisfy', cursive;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
  position: relative;
  isolation: isolate;
}
:host([data-theme="dark"]){
  --khione-deep:#a3cf7d;
  --shadow-c: 0,0,0;
  --ink-rgb: 206,226,180;
}
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"])){
    --khione-deep:#a3cf7d;
    --shadow-c: 0,0,0;
    --ink-rgb: 206,226,180;
  }
}

*{ box-sizing:border-box; }
:host::after{
  content:"";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.157  0 0 0 0 0.212  0 0 0 0 0.094  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 0;
}
h1,h2,h3{ font-family: var(--font-display); font-weight: 800; margin:0; text-wrap: balance; color: var(--ink); }
p{ margin:0; }
ul{ margin:0; padding:0; list-style:none; }
button{ font-family: inherit; }
:focus-visible{ outline: 2.5px solid var(--khione-deep); outline-offset: 2px; border-radius: 4px; }
.sr-only{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
.icon{ width:1.2em; height:1.2em; stroke:currentColor; fill:none; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }
.tabular{ font-variant-numeric: tabular-nums; }

.wrap{
  position: relative;
  z-index: 1;
  padding-left: max(18px, env(safe-area-inset-left, 0px));
  padding-right: max(18px, env(safe-area-inset-right, 0px));
}

/* ---------- blobs & icon badges ---------- */
.blob{ position:absolute; z-index:0; background: var(--accent-soft); }
.blob-a{ border-radius: 42% 58% 53% 47% / 46% 42% 58% 54%; }
.blob-b{ border-radius: 58% 42% 46% 54% / 54% 58% 42% 46%; }
.blob-c{ border-radius: 38% 62% 60% 40% / 55% 48% 52% 45%; }
.blob-d{ border-radius: 62% 38% 44% 56% / 40% 60% 42% 58%; }

.icon-badge{ position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.icon-badge .blob{ position:absolute; inset:0; background: color-mix(in srgb, var(--khione-green) 24%, var(--card-bg)); box-shadow: 0 6px 14px rgba(var(--shadow-c),.16), 0 20px 34px -14px rgba(var(--shadow-c),.2); }
.icon-badge .icon{ position:relative; width:26px; height:26px; color: var(--khione-deep); stroke-width:1.8; }
.icon-badge.soft .blob{ background: color-mix(in srgb, var(--accent-soft) 45%, var(--card-bg)); }
.icon-badge.soft .icon{ color: var(--accent); }
.icon-badge.blue .blob{ background: color-mix(in srgb, var(--khione-blue) 24%, var(--card-bg)); }
.icon-badge.blue .icon{ color: var(--khione-blue); }
.icon-badge.purple .blob{ background: color-mix(in srgb, var(--khione-purple) 20%, var(--card-bg)); }
.icon-badge.purple .icon{ color: var(--khione-purple); }
.icon-badge.yellow .blob{ background: color-mix(in srgb, var(--khione-yellow) 26%, var(--card-bg)); }
.icon-badge.yellow .icon{ color: var(--khione-yellow); }
.icon-badge.sm{ width:40px; height:40px; }
.icon-badge.sm .icon{ width:20px; height:20px; }

/* ---------- header band ---------- */
.hero{ position: relative; overflow:hidden; background: linear-gradient(170deg, var(--band-bg) 0%, color-mix(in srgb, var(--band-bg) 78%, var(--band-ink)) 100%); padding-block: 2.4rem 2rem; }
.hero .blob{ opacity:.14; background:#fff; }
.hero .blob.hb1{ width:260px; height:260px; top:-90px; right:8%; }
.hero .blob.hb2{ width:160px; height:160px; bottom:-60px; left:14%; }
.hero-inner{ position:relative; z-index:1; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1.4rem; }
.hero-left{ display:flex; flex-direction:column; gap:.2rem; }
.hero-clock{ font-family: var(--font-body); font-weight:700; font-size: clamp(2.6rem, 2rem + 3vw, 4.2rem); color: var(--band-ink); letter-spacing:.01em; line-height:1; }
.hero-date{ color: var(--band-ink); opacity:.78; font-size:.92rem; font-weight:600; }
.hero-note{ font-family: var(--font-script); font-size: 1.4rem; color: var(--band-ink); margin-top:.3rem; }
.hero-right{ display:flex; align-items:center; gap:1rem; background: rgba(255,255,255,.16); border-radius: 999px; padding:.6rem 1.2rem .6rem .6rem; }
.hero-right .icon-badge .blob{ background: rgba(255,255,255,.3); box-shadow:none; }
.hero-right .icon-badge .icon{ color: var(--band-ink); }
.hero-right-text b{ display:block; font-size:1.15rem; color: var(--band-ink); font-weight:800; }
.hero-right-text span{ font-size:.78rem; color: var(--band-ink); opacity:.8; }

/* Theme toggle — not in the mockup (it had no toggle button at all), added
   per brief Step 3, styled to match the existing hero-right pill since this
   page has no separate top band the way weather.js's mockup did. */
.hero-right-group{ display:flex; align-items:center; gap:.7rem; }
.theme-toggle{
  position:relative; width:40px; height:40px; flex:0 0 auto;
  border-radius:50%; border:1px solid rgba(255,255,255,.3);
  background: rgba(255,255,255,.16); color: var(--band-ink);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.theme-toggle:hover{ background: rgba(255,255,255,.26); }
.theme-toggle .icon{ width:20px; height:20px; }

/* ---------- sections ---------- */
main{ display:block; }
section{ padding-block: 2rem; position:relative; }
.section-head{ display:flex; align-items:center; gap:.85rem; margin-bottom: 1.1rem; }
.section-head h2{ font-size: 1.3rem; }
.section-head .count{ color: var(--muted); font-size:.8rem; font-weight:600; margin-left:.2rem; }

.card{
  background: var(--card-bg);
  border-radius: 24px;
  padding: 1.3rem 1.4rem;
  box-shadow: 0 3px 8px rgba(var(--shadow-c),.14), 0 22px 40px -18px rgba(var(--shadow-c),.22);
  border: 1px solid rgba(var(--ink-rgb),.06);
  min-width: 0;
  transition: transform .25s ease, box-shadow .25s ease;
}
.card.hoverable:hover{ transform: translateY(-3px); box-shadow: 0 6px 14px rgba(var(--shadow-c),.18), 0 30px 50px -18px rgba(var(--shadow-c),.28); }

/* ---------- weather + clothing row ---------- */
.weather-row{ display:grid; grid-template-columns: 1.7fr 1fr; gap:1.2rem; }
.weather-card{ position:relative; overflow:hidden; }
.weather-top{ display:flex; align-items:flex-start; gap:1rem; justify-content:space-between; flex-wrap:wrap; }
.weather-main{ display:flex; align-items:center; gap:1rem; }
.weather-temp{ font-size: clamp(2.6rem, 2rem + 2vw, 3.6rem); font-weight:700; color: var(--ink); line-height:1; }
.weather-cond{ font-weight:800; font-family: var(--font-display); font-size:1.15rem; color: var(--khione-deep); margin-top:.15rem; }
.weather-loc{ font-size:.8rem; color: var(--muted); margin-top:.1rem; }
.weather-stats{ display:flex; gap:.7rem; flex-wrap:wrap; margin-top:1.1rem; }
.wstat{ display:flex; align-items:center; gap:.5rem; background: color-mix(in srgb, var(--khione-green) 12%, var(--card-bg)); border-radius: 999px; padding:.45rem .9rem .45rem .5rem; }
.wstat .icon-badge{ width:30px; height:30px; }
.wstat .icon-badge .icon{ width:16px; height:16px; }
.wstat b{ font-size:.92rem; }
.wstat span{ display:block; font-size:.68rem; color: var(--muted); text-transform:uppercase; letter-spacing:.04em; }
.weather-note{ font-family: var(--font-script); font-size:1.25rem; color: var(--accent); margin-top:1.1rem; max-width: 34em; }

.clothing-card{ display:flex; flex-direction:column; justify-content:center; text-align:left; }
.clothing-head{ display:flex; align-items:center; gap:.8rem; margin-bottom:.7rem; }
.clothing-card h3{ font-size:1.15rem; }
.clothing-sub{ color: var(--muted); font-size:.85rem; margin-top:.2rem; }
.clothing-chips{ display:flex; gap:.4rem; flex-wrap:wrap; margin-top:1rem; }

.chip{ font-size:.68rem; font-weight:800; padding:.25rem .65rem; border-radius:999px; background: color-mix(in srgb, var(--khione-green) 20%, var(--card-bg)); color: var(--khione-deep); }
.chip.soft{ background: color-mix(in srgb, var(--accent-soft) 40%, var(--card-bg)); color: var(--accent); }
.chip.blue{ background: color-mix(in srgb, var(--khione-blue) 20%, var(--card-bg)); color: var(--khione-blue); }
.chip.purple{ background: color-mix(in srgb, var(--khione-purple) 18%, var(--card-bg)); color: var(--khione-purple); }
.chip.yellow{ background: color-mix(in srgb, var(--khione-yellow) 22%, var(--card-bg)); color: var(--khione-yellow); }

/* ---------- news feed ---------- */
.news-row{ display:grid; grid-template-columns: 1fr 1fr; gap:1.2rem; }
.news-head{ display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-bottom:1rem; }
.news-head .ttl{ display:flex; align-items:center; gap:.8rem; }
.feed{ display:flex; flex-direction:column; }
.feed-item{
  display:flex; gap:.8rem; align-items:flex-start; padding-block:.75rem;
  border-top: 1px dashed rgba(var(--ink-rgb),.18);
  transition: padding-left .2s ease, background .2s ease;
  border-radius: 10px;
}
.feed-item:first-child{ border-top:none; }
.feed-item:hover{ padding-left:.4rem; background: color-mix(in srgb, var(--khione-green) 8%, transparent); }
.feed-dot{ width:8px; height:8px; margin-top:.5rem; flex-shrink:0; background: var(--khione-green); border-radius: 60% 40% 55% 45% / 45% 55% 40% 60%; }
.feed-item.purple .feed-dot{ background: var(--khione-purple); }
.feed-body{ flex:1; min-width:0; }
.feed-headline{ font-size:.92rem; font-weight:600; color: var(--ink); }
.feed-meta{ display:flex; gap:.5rem; align-items:center; margin-top:.3rem; flex-wrap:wrap; }
.feed-meta time{ font-size:.72rem; color: var(--muted); }

/* ---------- bento system grid ---------- */
.bento{ display:grid; grid-template-columns: repeat(12, 1fr); gap:1.2rem; }
.tile{ grid-column: span 4; display:flex; flex-direction:column; gap:1rem; }
.tile.wide{ grid-column: span 6; }
.tile.narrow{ grid-column: span 3; }
.tile-head{ display:flex; align-items:center; gap:.7rem; }
.tile-head h3{ font-size:1rem; }

/* services */
.svc-row{ display:flex; align-items:center; justify-content:space-between; gap:.8rem; padding:.7rem .85rem; border-radius:16px; background: color-mix(in srgb, var(--khione-green) 7%, transparent); transition: background .2s ease, transform .2s ease; }
.svc-row:hover{ background: color-mix(in srgb, var(--khione-green) 15%, transparent); transform: translateX(2px); }
.svc-id{ display:flex; align-items:center; gap:.6rem; font-weight:700; font-size:.9rem; }
.svc-status{ display:flex; align-items:center; gap:.45rem; font-size:.74rem; font-weight:800; color: var(--khione-deep); text-transform:uppercase; letter-spacing:.03em; }
.status-dot{ width:9px; height:9px; border-radius:50%; background: var(--khione-green); position:relative; }
.status-dot::after{ content:""; position:absolute; inset:-4px; border-radius:50%; border:1.5px solid var(--khione-green); opacity:.6; animation: pulse 2.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce){ .status-dot::after{ animation:none; } }

/* services: offline/unknown state — not in the mockup (every example row was
   "Online"), added so a real down service doesn't still show a green
   pulsing "Online" dot. */
.svc-status.off{ color: var(--muted); }
.svc-status.off .status-dot{ background: var(--muted); }
.svc-status.off .status-dot::after{ display:none; }

/* stat rows + gradient bars */
.stat-row{ display:flex; justify-content:space-between; align-items:baseline; font-size:.85rem; margin-bottom:.35rem; }
.stat-row b{ font-variant-numeric: tabular-nums; }
.bar{ height:11px; border-radius:999px; background: rgba(var(--ink-rgb),.1); overflow:hidden; margin-bottom:.1rem; }
.bar > span{ display:block; height:100%; border-radius:999px; background: linear-gradient(90deg, var(--khione-green) 0%, var(--khione-deep) 100%); transition: width .4s ease; }
.bar.warm > span{ background: linear-gradient(90deg, var(--accent-soft) 0%, var(--accent) 100%); }
.stat-block{ margin-bottom:.6rem; }
.stat-block:last-child{ margin-bottom:0; }

/* disks */
.disk-row{ margin-bottom:.85rem; }
.disk-row:last-child{ margin-bottom:0; }
.disk-top{ display:flex; justify-content:space-between; font-size:.84rem; margin-bottom:.35rem; }
.disk-top .path{ font-weight:700; }
.disk-top .nums{ color: var(--muted); font-variant-numeric: tabular-nums; }

/* speed */
.speed-grid{ display:flex; flex-direction:column; gap:.7rem; }
.speed-cell{ display:flex; align-items:baseline; justify-content:space-between; border-bottom:1px dashed rgba(var(--ink-rgb),.15); padding-bottom:.6rem; }
.speed-cell:last-child{ border-bottom:none; padding-bottom:0; }
.speed-cell .val{ font-size:1.3rem; font-weight:700; font-variant-numeric: tabular-nums; color: var(--khione-deep); }
.speed-cell .unit{ font-size:.72rem; color: var(--muted); margin-left:.3rem; font-weight:600; }
.speed-cell .lbl{ font-size:.78rem; color: var(--muted); font-weight:600; }

/* temps */
.temp-row{ display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding-block:.5rem; border-top:1px dashed rgba(var(--ink-rgb),.15); }
.temp-row:first-of-type{ border-top:none; }
.temp-id{ display:flex; align-items:center; gap:.55rem; font-size:.86rem; font-weight:600; }
.temp-val{ font-weight:700; font-variant-numeric: tabular-nums; color: var(--khione-deep); }
.temp-row.hot .temp-val{ color: var(--accent); }
.temp-row.hot .temp-id::after{ content:"\\26A0"; font-size:.7rem; color: var(--accent); margin-left:.2rem; }

/* system */
.sys-badge{ display:inline-flex; align-items:center; gap:.4rem; background: color-mix(in srgb, var(--khione-yellow) 24%, var(--card-bg)); color: var(--khione-yellow); font-weight:800; font-size:.76rem; padding:.3rem .7rem; border-radius:999px; margin-bottom:.4rem; }
.sys-line{ display:flex; align-items:center; gap:.55rem; font-size:.84rem; padding-block:.4rem; border-top:1px dashed rgba(var(--ink-rgb),.15); }
.sys-line:first-of-type{ border-top:none; }
.sys-line b{ font-variant-numeric: tabular-nums; }

footer{ background: linear-gradient(170deg, var(--band-bg) 0%, color-mix(in srgb, var(--band-bg) 78%, var(--band-ink)) 100%); padding-block: 1.6rem; text-align:center; color: var(--band-ink); font-size:.8rem; font-weight:600; margin-top: 1rem; }
footer .wrap{ opacity:.85; }

@keyframes pulse{ 0%{ transform:scale(.8); opacity:.7;} 100%{ transform:scale(1.8); opacity:0;} }
@media (prefers-reduced-motion: no-preference){
  .reveal{ animation: riseIn .6s ease both; }
  @keyframes riseIn{ from{ opacity:0; transform: translateY(10px); } to{ opacity:1; transform:none; } }
}

@media (max-width: 900px){
  .weather-row{ grid-template-columns: 1fr; }
  .news-row{ grid-template-columns: 1fr; }
  .tile, .tile.wide, .tile.narrow{ grid-column: span 12; }
}
@media (max-width: 500px){
  .hero-right{ width:100%; }
}
`;

// ---------------------------------------------------------------------------
// PAGE_SHELL_HTML — markup ported from the mockup. Every hand-drawn icon
// <symbol> from the mockup's <svg class="sr-only"> defs block is kept
// byte-for-byte, with two new symbols appended (i-sun/i-moon) for the theme
// toggle, which the mockup had no markup for at all (see brief Step 3).
// Sample content (clock, weather numbers, headlines, disks, temps, etc.) is
// replaced by ids that _renderLiveData()/_renderClock() fill in; dynamic
// lists (news feeds, disks, temperatures) get an empty container here and
// are built from live arrays, same approach as weather.js's hourly/week
// grids. The mockup's own inline <script> (clock tick + hot-threshold
// detection) is dropped entirely — the custom element's
// connectedCallback/_renderClock and the real `hot` flag from
// sensor.khione_temps replace it.
// ---------------------------------------------------------------------------
const PAGE_SHELL_HTML = `
<svg class="sr-only" aria-hidden="true" focusable="false">
  <symbol id="i-cloud-sun" viewBox="0 0 24 24">
    <path d="M16.4 8c.8-1 2.2-1.3 3.4-.7" stroke-linecap="round"/>
    <path d="M19.4 4.7v1.6M22.1 7.2h-1.6M21.5 5.1l-1.1 1.1" stroke-linecap="round"/>
    <path d="M5 15.3c-.2-2.3 1.4-3.8 3.6-3.9.7-2.1 2.6-3.4 4.8-3.2 2.3.2 4 2 4.1 4.2 1.8.3 3 1.8 2.8 3.5-.2 1.7-1.7 2.8-3.5 2.7H8.3c-1.8 0-3.5-1.1-3.3-3.3z"/>
  </symbol>
  <symbol id="i-wind" viewBox="0 0 24 24">
    <path d="M3 9.4h11c1.4.1 2.5-1 2.4-2.4-.1-1.3-1.3-2.1-2.6-1.9-1 .2-1.7.9-1.9 1.8" stroke-linecap="round"/>
    <path d="M3 14h14.3c1.5 0 2.7 1.2 2.6 2.6-.1 1.4-1.4 2.3-2.8 2-1-.2-1.7-1-1.8-1.9" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-droplet" viewBox="0 0 24 24">
    <path d="M12 3.6c2.9 3.6 5.6 7.1 5.5 10.4-.1 3.2-2.5 5.7-5.5 5.7s-5.5-2.5-5.5-5.7c-.1-3.3 2.6-6.8 5.5-10.4z"/>
  </symbol>
  <symbol id="i-thermo" viewBox="0 0 24 24">
    <path d="M10.6 14.6V5.8c0-1 .8-1.9 1.9-1.9s1.9.9 1.9 1.9v8.8c1 .6 1.7 1.8 1.7 3.1 0 2-1.6 3.6-3.6 3.6s-3.6-1.6-3.6-3.6c0-1.3.7-2.5 1.7-3.1z"/>
    <path d="M13.4 8.1h1.3M13.4 10.5h1.3M13.4 12.9h1.3" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-jacket" viewBox="0 0 24 24">
    <path d="M8.3 4.3 12 6.6l3.7-2.3 3.1 2.5-2.4 2.6.1 9.7c0 .9-.7 1.6-1.6 1.6H9.1c-.9 0-1.6-.7-1.6-1.6V9.4L5.2 6.8z"/>
    <path d="M12 6.6v12.6" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-feed" viewBox="0 0 24 24">
    <path d="M4.3 5.7c3.4-.6 6.9-.6 10.3 0 1.6.3 2.7 1.2 2.7 2.6v9.2c0 .9-.8 1.5-1.7 1.4-3.7-.5-7.6-.5-11.3 0-.9.1-1.7-.5-1.7-1.4V8.3c0-1.4 1.1-2.3 1.7-2.6z"/>
    <path d="M6.4 9.4h7M6.4 12h9.3M6.4 14.5h9.3" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-terminal" viewBox="0 0 24 24">
    <path d="M4.3 6.5c0-1 .8-1.8 1.9-1.9 3.9-.3 7.8-.3 11.7 0 1.1.1 1.9.9 1.9 1.9v9.8c0 1-.8 1.8-1.9 1.9-3.9.3-7.8.3-11.7 0-1.1-.1-1.9-.9-1.9-1.9z"/>
    <path d="M7.6 10.1 10 12l-2.4 2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M11.6 14.3h3.3" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-server" viewBox="0 0 24 24">
    <path d="M4.6 5.6c0-.7.6-1.2 1.4-1.3 4-.3 8-.3 12 0 .8.1 1.4.6 1.4 1.3v3.3c0 .7-.6 1.2-1.4 1.3-4 .3-8 .3-12 0-.8-.1-1.4-.6-1.4-1.3z"/>
    <path d="M4.6 13.1c0-.7.6-1.2 1.4-1.3 4-.3 8-.3 12 0 .8.1 1.4.6 1.4 1.3v3.3c0 .7-.6 1.2-1.4 1.3-4 .3-8 .3-12 0-.8-.1-1.4-.6-1.4-1.3z"/>
    <circle cx="7.3" cy="7.3" r=".55" fill="currentColor" stroke="none"/>
    <circle cx="7.3" cy="14.8" r=".55" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="i-chip" viewBox="0 0 24 24">
    <path d="M8.6 8.3c-.3 0-.3 0-.3.3v6.8c0 .3 0 .3.3.3h6.8c.3 0 .3 0 .3-.3V8.6c0-.3 0-.3-.3-.3z"/>
    <path d="M10 8.3V5.6M14 8.3V5.6M10 18.4v-2.7M14 18.4v-2.7M8.3 10H5.6M8.3 14H5.6M18.4 10h-2.7M18.4 14h-2.7" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-memory" viewBox="0 0 24 24">
    <path d="M5.6 6.7c0-.6.5-1.1 1.1-1.1h10.6c.6 0 1.1.5 1.1 1.1v9.6c0 .6-.5 1.1-1.1 1.1H6.7c-.6 0-1.1-.5-1.1-1.1z"/>
    <path d="M8 17.4v1.6M11 17.4v1.6M14 17.4v1.6M17 17.4v1.6" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-disk" viewBox="0 0 24 24">
    <path d="M4.3 12c0-4.3 3.4-7.7 7.7-7.7s7.7 3.4 7.7 7.7-3.4 7.7-7.7 7.7-7.7-3.4-7.7-7.7z"/>
    <path d="M12 10.2c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8-1.8-.8-1.8-1.8.8-1.8 1.8-1.8z"/>
    <path d="M12 4.3v4.3" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-gauge" viewBox="0 0 24 24">
    <path d="M4.6 15.8c-1.1-4.6 1.8-9.3 6.5-10.4 4.7-1.1 9.4 1.8 10.5 6.4.5 2 .3 4-.5 5.8" stroke-linecap="round"/>
    <path d="M12 15.3 15 10" stroke-linecap="round"/>
    <circle cx="12" cy="15.3" r=".9" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24">
    <path d="M5.8 12c0-3.4 2.8-6.2 6.2-6.2 2.3 0 4.3 1.2 5.4 3.1" stroke-linecap="round"/>
    <path d="M15.6 5.6l1.8 3.3-3.6.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18.2 12c0 3.4-2.8 6.2-6.2 6.2-2.3 0-4.3-1.2-5.4-3.1" stroke-linecap="round"/>
    <path d="M8.4 18.4l-1.8-3.3 3.6-.4" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="i-clock" viewBox="0 0 24 24">
    <path d="M4.3 12c0-4.3 3.4-7.7 7.7-7.7s7.7 3.4 7.7 7.7-3.4 7.7-7.7 7.7-7.7-3.4-7.7-7.7z"/>
    <path d="M12 7.6v4.6l3.3 2" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="i-play" viewBox="0 0 24 24">
    <path d="M7.6 5.8c0-.8.9-1.3 1.6-.9l9.4 5.6c.7.4.7 1.4 0 1.8l-9.4 5.6c-.7.4-1.6-.1-1.6-.9z"/>
  </symbol>
  <symbol id="i-toggle" viewBox="0 0 24 24">
    <path d="M6.8 8.6h10.4c1.9 0 3.5 1.5 3.5 3.4 0 1.9-1.6 3.4-3.5 3.4H6.8c-1.9 0-3.5-1.5-3.5-3.4 0-1.9 1.6-3.4 3.5-3.4z"/>
    <circle cx="17.2" cy="12" r="2.1" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="i-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.3"/>
    <path d="M12 3.3v2.1M12 18.6v2.1M4.4 12h2.1M17.5 12h2.1M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M6.3 17.7l1.5-1.5M16.2 7.8l1.5-1.5" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-moon" viewBox="0 0 24 24">
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke-linejoin="round"/>
  </symbol>
</svg>

<link rel="preconnect" href="https://fonts.gstatic.com">

<header class="hero">
  <div class="blob hb1"></div>
  <div class="blob hb2"></div>
  <div class="wrap hero-inner">
    <div class="hero-left">
      <div class="hero-clock tabular" id="clock">&nbsp;</div>
      <p class="hero-date" id="date-line">&nbsp;</p>
      <p class="hero-note" id="hero-note">&nbsp;</p>
    </div>
    <div class="hero-right-group">
      <div class="hero-right">
        <div class="icon-badge"><div class="blob blob-a"></div><svg class="icon"><use href="#i-cloud-sun"></use></svg></div>
        <div class="hero-right-text">
          <b id="hero-chip-cond">&nbsp;</b>
          <span id="hero-chip-feels-loc">&nbsp;</span>
        </div>
      </div>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
        <svg class="icon" id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"></use></svg>
      </button>
    </div>
  </div>
</header>

<main class="wrap">

  <section aria-labelledby="h-weather">
    <div class="section-head reveal">
      <div class="icon-badge"><div class="blob blob-b"></div><svg class="icon"><use href="#i-cloud-sun"></use></svg></div>
      <h2 id="h-weather">Weather &amp; what to wear</h2>
    </div>
    <div class="weather-row">
      <div class="card weather-card hoverable reveal">
        <div class="weather-top">
          <div class="weather-main">
            <div class="icon-badge" style="width:72px;height:72px;"><div class="blob blob-a"></div><svg class="icon" style="width:38px;height:38px"><use href="#i-cloud-sun"></use></svg></div>
            <div>
              <div class="weather-temp tabular" id="weather-temp">&mdash;</div>
              <div class="weather-cond" id="weather-cond">&nbsp;</div>
              <div class="weather-loc" id="weather-loc">&nbsp;</div>
            </div>
          </div>
        </div>
        <div class="weather-stats">
          <div class="wstat"><div class="icon-badge sm soft"><div class="blob blob-c"></div><svg class="icon"><use href="#i-thermo"></use></svg></div><div><b class="tabular" id="wstat-feels">&mdash;</b><span>Feels like</span></div></div>
          <div class="wstat"><div class="icon-badge sm blue"><div class="blob blob-d"></div><svg class="icon"><use href="#i-wind"></use></svg></div><div><b class="tabular" id="wstat-wind">&mdash;</b><span>Wind</span></div></div>
          <div class="wstat"><div class="icon-badge sm blue"><div class="blob blob-b"></div><svg class="icon"><use href="#i-droplet"></use></svg></div><div><b class="tabular" id="wstat-humidity">&mdash;</b><span>Humidity</span></div></div>
        </div>
        <p class="weather-note" id="weather-note">&nbsp;</p>
      </div>

      <div class="card clothing-card hoverable reveal">
        <div class="clothing-head">
          <div class="icon-badge soft"><div class="blob blob-c"></div><svg class="icon"><use href="#i-jacket"></use></svg></div>
          <div>
            <h3 id="clothing-headline">&nbsp;</h3>
            <p class="clothing-sub" id="clothing-sub">&nbsp;</p>
          </div>
        </div>
        <div class="clothing-chips" id="clothing-chips"></div>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-news">
    <div class="section-head reveal">
      <div class="icon-badge yellow"><div class="blob blob-d"></div><svg class="icon"><use href="#i-feed"></use></svg></div>
      <h2 id="h-news">News</h2>
      <span class="count">Updates hourly</span>
    </div>
    <div class="news-row">
      <div class="card reveal">
        <div class="news-head">
          <div class="ttl"><div class="icon-badge sm"><div class="blob blob-a"></div><svg class="icon"><use href="#i-feed"></use></svg></div><h3>BBC UK / Derbyshire Live</h3></div>
          <span class="chip blue">RSS</span>
        </div>
        <div class="feed" id="feed-bbc"></div>
      </div>

      <div class="card reveal">
        <div class="news-head">
          <div class="ttl"><div class="icon-badge sm purple"><div class="blob blob-b"></div><svg class="icon"><use href="#i-terminal"></use></svg></div><h3>Arch Linux News</h3></div>
          <span class="chip purple">RSS</span>
        </div>
        <div class="feed" id="feed-arch"></div>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-system">
    <div class="section-head reveal">
      <div class="icon-badge"><div class="blob blob-c"></div><svg class="icon"><use href="#i-server"></use></svg></div>
      <h2 id="h-system">Server &amp; system status</h2>
    </div>
    <div class="bento">

      <div class="card tile hoverable reveal">
        <div class="tile-head"><div class="icon-badge sm"><div class="blob blob-a"></div><svg class="icon"><use href="#i-server"></use></svg></div><h3>Services</h3></div>
        <div class="svc-row">
          <span class="svc-id"><svg class="icon" style="color:var(--khione-deep)"><use href="#i-play"></use></svg>Plex</span>
          <span class="svc-status" id="svc-plex-status"><span class="status-dot"></span>&nbsp;</span>
        </div>
        <div class="svc-row">
          <span class="svc-id"><svg class="icon" style="color:var(--khione-deep)"><use href="#i-toggle"></use></svg>Cockpit</span>
          <span class="svc-status" id="svc-cockpit-status"><span class="status-dot"></span>&nbsp;</span>
        </div>
      </div>

      <div class="card tile hoverable reveal">
        <div class="tile-head"><div class="icon-badge sm soft"><div class="blob blob-b"></div><svg class="icon"><use href="#i-chip"></use></svg></div><h3>CPU &amp; memory</h3></div>
        <div class="stat-block">
          <div class="stat-row"><span>CPU</span><b class="tabular" id="cpu-pct">&mdash;</b></div>
          <div class="bar"><span id="cpu-bar" style="width:0%"></span></div>
        </div>
        <div class="stat-block">
          <div class="stat-row"><span>Memory</span><b class="tabular" id="mem-pct">&mdash;</b></div>
          <div class="bar warm"><span id="mem-bar" style="width:0%"></span></div>
        </div>
      </div>

      <div class="card tile hoverable reveal">
        <div class="tile-head"><div class="icon-badge sm yellow"><div class="blob blob-d"></div><svg class="icon"><use href="#i-refresh"></use></svg></div><h3>System</h3></div>
        <span class="sys-badge"><svg class="icon" style="width:.9em;height:.9em"><use href="#i-refresh"></use></svg><span id="sys-updates">&nbsp;</span></span>
        <div class="sys-line"><svg class="icon" style="color:var(--khione-deep)"><use href="#i-clock"></use></svg>Uptime &middot; <b class="tabular" id="sys-uptime">&mdash;</b></div>
        <div class="sys-line"><svg class="icon" style="color:var(--khione-deep)"><use href="#i-terminal"></use></svg>Kernel &middot; <b class="tabular" id="sys-kernel">&mdash;</b></div>
      </div>

      <div class="card tile wide hoverable reveal">
        <div class="tile-head"><div class="icon-badge sm"><div class="blob blob-a"></div><svg class="icon"><use href="#i-disk"></use></svg></div><h3>Disks</h3></div>
        <div id="disks-rows"></div>
      </div>

      <div class="card tile narrow hoverable reveal">
        <div class="tile-head"><div class="icon-badge sm blue"><div class="blob blob-c"></div><svg class="icon"><use href="#i-gauge"></use></svg></div><h3>Internet speed</h3></div>
        <div class="speed-grid">
          <div class="speed-cell"><span class="lbl">Download</span><span><span class="val" id="speed-download">&mdash;</span><span class="unit">Mbps</span></span></div>
          <div class="speed-cell"><span class="lbl">Upload</span><span><span class="val" id="speed-upload">&mdash;</span><span class="unit">Mbps</span></span></div>
          <div class="speed-cell"><span class="lbl">Ping</span><span><span class="val" id="speed-ping">&mdash;</span><span class="unit">ms</span></span></div>
        </div>
      </div>

      <div class="card tile narrow hoverable reveal">
        <div class="tile-head"><div class="icon-badge sm soft"><div class="blob blob-d"></div><svg class="icon"><use href="#i-thermo"></use></svg></div><h3>Temperatures</h3></div>
        <div id="temps-rows"></div>
      </div>

    </div>
  </section>

</main>

<footer><div class="wrap">Khione &middot; home dashboard</div></footer>
`;

// ---------------------------------------------------------------------------
// Live-data helpers — small, bounded, pure functions so _renderLiveData()
// stays a straight-line list of assignments. Every one returns a safe
// display fallback ("—") rather than throwing on missing/malformed input.
// ---------------------------------------------------------------------------

// Same condition vocabulary as weather.js (duplicated locally, not imported
// — weather.js isn't a shared module and isn't to be modified for this task).
const CONDITION_LABEL = {
  "clear-night": "Clear",
  cloudy: "Cloudy",
  exceptional: "Exceptional",
  fog: "Fog",
  hail: "Hail",
  lightning: "Lightning",
  "lightning-rainy": "Lightning, rain",
  partlycloudy: "Partly cloudy",
  pouring: "Heavy rain",
  rainy: "Rain",
  snowy: "Snow",
  "snowy-rainy": "Sleet",
  sunny: "Sunny",
  windy: "Windy",
  "windy-variant": "Windy",
};

function conditionLabel(condition) {
  if (!condition) return "—";
  return CONDITION_LABEL[condition] || condition.charAt(0).toUpperCase() + condition.slice(1);
}

function fmtTemp(value) {
  return value == null || isNaN(value) ? "—" : Math.round(value) + "°C";
}

function greetingPrefix(date) {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function clampPct(n) {
  n = Number(n);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// shortcut: only handles GB/TB (matches the real disks.json shape); no
// MB-scale rounding since every disk here is already GB+.
function fmtGB(gb, useTb) {
  if (gb == null || isNaN(gb)) return "—";
  return useTb ? (gb / 1000).toFixed(1) + " TB" : Math.round(gb) + " GB";
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

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

// Extracts the short headline portion of a clothing-recommendation sentence
// — the template sensor's possible phrases (see configuration-snippet.yaml)
// always put the qualifying detail after "(" or "—", e.g.
// "Light jacket or jumper (10°C) — windy, add a layer" -> "Light jacket or jumper".
function clothingHeadline(state) {
  if (!state) return "—";
  return state.split(/[(—]/)[0].trim() || state;
}

// Derives 1-2 short chips from the same known vocabulary, mirroring the
// mockup's "Jumper / Light jacket / No brolly needed" style tags without
// inventing a backend attribute that doesn't exist.
function clothingChips(state) {
  if (!state) return [];
  const s = state.toLowerCase();
  const chips = [];
  if (s.includes("umbrella")) chips.push({ text: "Umbrella", cls: "blue" });
  else chips.push({ text: "No brolly needed", cls: "blue" });
  if (s.includes("scarf") || s.includes("heavy coat")) chips.push({ text: "Heavy coat", cls: "soft" });
  else if (s.includes("coat")) chips.push({ text: "Coat", cls: "soft" });
  else if (s.includes("jumper")) chips.push({ text: "Jumper", cls: "" });
  else if (s.includes("long sleeves")) chips.push({ text: "Long sleeves", cls: "" });
  else if (s.includes("t-shirt")) chips.push({ text: "T-shirt weather", cls: "" });
  if (s.includes("windy")) chips.push({ text: "Windy — extra layer", cls: "yellow" });
  return chips;
}

// name-keyword heuristic onto the 3 hand-drawn icons the mockup already
// used for its example temp rows (CPU/NVMe/Motherboard) — no new icons
// needed since sensor.khione_temps gives only {name, c, hot}, not an icon.
function tempIconId(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("cpu")) return "i-chip";
  if (n.includes("nvme") || n.includes("disk") || n.includes("ssd") || n.includes("hdd")) return "i-disk";
  return "i-server";
}

function buildFeedHtml(articles) {
  if (!articles.length) {
    return '<div class="feed-item"><div class="feed-body"><p class="feed-headline">No headlines available.</p></div></div>';
  }
  return articles
    .map((a) => {
      const purple = a.tag === "purple" ? " purple" : "";
      const chip = a.chipText ? '<span class="chip ' + a.chipCls + '">' + escapeHtml(a.chipText) + "</span>" : "";
      return (
        '<div class="feed-item' + purple + '">' +
        '<span class="feed-dot"></span>' +
        '<div class="feed-body">' +
        '<p class="feed-headline">' + escapeHtml(a.title || "Untitled") + "</p>" +
        '<div class="feed-meta">' + chip + "<time>" + timeAgo(a.pubDate) + "</time></div>" +
        "</div></div>"
      );
    })
    .join("");
}

// shortcut: caps each rendered feed at this many items so the card doesn't
// grow unbounded if a source sensor returns a long article list; raise if
// the layout can take it.
const NEWS_LIMIT = 6;

function sortByPubDateDesc(articles) {
  return articles.slice().sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
}

class KhioneHomePanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._rendered = false;
    this._clockInterval = null;
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

  connectedCallback() {
    this._renderClock();
    this._clockInterval = setInterval(() => this._renderClock(), 1000);
  }

  disconnectedCallback() {
    if (this._clockInterval) {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
    }
  }

  _render() {
    if (!this._hass) return;
    if (!this._rendered) {
      this._root.innerHTML = `${GOOGLE_FONTS_LINK_HTML}<style>${SHARED_TOKENS_CSS}${PAGE_CSS}</style>${PAGE_SHELL_HTML}`;
      initTheme(this);
      this._bindStaticHandlers();
      this._rendered = true;
    }
    this._renderClock();
    this._renderLiveData();
  }

  // Click handler + initial icon paint for the theme toggle — same
  // mechanics as weather.js Step 4: initTheme(this)/toggleTheme(this), the
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

  // The `hass` setter alone won't tick a clock (it only fires on entity
  // state changes), so this is driven by connectedCallback's setInterval
  // instead. Independent of hass entirely — safe to call before the shell
  // has even been painted (guarded by the element lookups below).
  _renderClock() {
    const root = this._root;
    const clockEl = root && root.getElementById("clock");
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0") +
      ":" +
      String(now.getSeconds()).padStart(2, "0");
    const dateEl = root.getElementById("date-line");
    if (dateEl) {
      try {
        dateEl.textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      } catch (e) {
        dateEl.textContent = "—";
      }
    }
  }

  // Maps every live hass value onto the shell painted above. Every
  // attribute read is defended with `??`/guards so a missing entity never
  // throws and blanks the page.
  _renderLiveData() {
    const hass = this._hass;
    if (!hass) return;
    const root = this._root;

    const weather = hass.states["weather.home"];
    const zone = hass.states["zone.home"];
    const clothing = hass.states["sensor.khione_clothing_recommendation"];
    const rssBbc = hass.states["sensor.khione_rss_bbc"];
    const rssDerbyshire = hass.states["sensor.khione_rss_derbyshire"];
    const rssArch = hass.states["sensor.khione_rss_archlinux"];
    const plex = hass.states["binary_sensor.khione_plex"];
    const cockpit = hass.states["binary_sensor.khione_cockpit"];
    const cpu = hass.states["sensor.system_monitor_processor_use"];
    const mem = hass.states["sensor.system_monitor_memory_usage"];
    const disks = hass.states["sensor.khione_disks"];
    const dlSpeed = hass.states["sensor.speedtest_download"];
    const ulSpeed = hass.states["sensor.speedtest_upload"];
    const ping = hass.states["sensor.speedtest_ping"];
    const temps = hass.states["sensor.khione_temps"];
    const system = hass.states["sensor.khione_system"];

    // ---- hero + weather & clothing ----
    const wAttrs = (weather && weather.attributes) || {};
    const condition = weather ? weather.state : null;
    const temp = wAttrs.temperature ?? null;
    const placeName = (zone && zone.attributes && zone.attributes.friendly_name) ?? "—";
    const clothingState = (clothing && clothing.state) || null;

    const haveWeather = condition != null && temp != null;
    root.getElementById("hero-note").textContent = haveWeather
      ? greetingPrefix(new Date()) + " — " + conditionLabel(condition) + ", " + fmtTemp(temp) + "."
      : greetingPrefix(new Date()) + " — weather data unavailable.";

    root.getElementById("hero-chip-cond").textContent = fmtTemp(temp) + " · " + conditionLabel(condition);
    root.getElementById("hero-chip-feels-loc").textContent = "Feels like " + fmtTemp(temp) + " · " + placeName;

    root.getElementById("weather-temp").textContent = fmtTemp(temp);
    root.getElementById("weather-cond").textContent = conditionLabel(condition);
    root.getElementById("weather-loc").textContent = placeName + (wAttrs.attribution ? " · " + wAttrs.attribution : "");
    // feels-like: no separate attribute available on this HA instance's
    // weather entity (same precedent as weather.js Task 2 — it also reuses
    // `temperature` for "feels like").
    root.getElementById("wstat-feels").textContent = fmtTemp(temp);
    const windUnit = wAttrs.wind_speed_unit || "km/h";
    root.getElementById("wstat-wind").textContent = wAttrs.wind_speed != null ? Math.round(wAttrs.wind_speed) + " " + windUnit : "—";
    root.getElementById("wstat-humidity").textContent = wAttrs.humidity != null ? Math.round(wAttrs.humidity) + "%" : "—";
    root.getElementById("weather-note").textContent = clothingState ?? "—";

    root.getElementById("clothing-headline").textContent = clothingHeadline(clothingState);
    root.getElementById("clothing-sub").textContent =
      temp != null ? "Based on " + fmtTemp(temp) + ", " + conditionLabel(condition).toLowerCase() : "—";
    const chips = clothingChips(clothingState);
    root.getElementById("clothing-chips").innerHTML = chips.length
      ? chips.map((c) => '<span class="chip' + (c.cls ? " " + c.cls : "") + '">' + escapeHtml(c.text) + "</span>").join("")
      : '<span class="chip">—</span>';

    // ---- news ----
    const bbcArticles = ((rssBbc && rssBbc.attributes && rssBbc.attributes.articles) || []).map((a) => ({
      title: a && a.title, pubDate: a && a.pubDate, chipText: "National", chipCls: "soft",
    }));
    const derbyArticles = ((rssDerbyshire && rssDerbyshire.attributes && rssDerbyshire.attributes.articles) || []).map((a) => ({
      title: a && a.title, pubDate: a && a.pubDate, chipText: "Local", chipCls: "soft",
    }));
    const localFeed = sortByPubDateDesc(bbcArticles.concat(derbyArticles)).slice(0, NEWS_LIMIT);
    root.getElementById("feed-bbc").innerHTML = buildFeedHtml(localFeed);

    const archArticles = ((rssArch && rssArch.attributes && rssArch.attributes.articles) || []).map((a) => ({
      title: a && a.title, pubDate: a && a.pubDate, tag: "purple",
    }));
    const archFeed = sortByPubDateDesc(archArticles).slice(0, NEWS_LIMIT);
    root.getElementById("feed-arch").innerHTML = buildFeedHtml(archFeed);

    // ---- services ----
    const renderServiceStatus = (el, state) => {
      if (!el) return;
      if (state == null) {
        el.className = "svc-status off";
        el.innerHTML = '<span class="status-dot"></span>Unknown';
      } else if (state === "on") {
        el.className = "svc-status";
        el.innerHTML = '<span class="status-dot"></span>Online';
      } else {
        el.className = "svc-status off";
        el.innerHTML = '<span class="status-dot"></span>Offline';
      }
    };
    renderServiceStatus(root.getElementById("svc-plex-status"), plex ? plex.state : null);
    renderServiceStatus(root.getElementById("svc-cockpit-status"), cockpit ? cockpit.state : null);

    // ---- CPU & memory ----
    const cpuNum = cpu && cpu.state != null ? parseFloat(cpu.state) : NaN;
    const memNum = mem && mem.state != null ? parseFloat(mem.state) : NaN;
    root.getElementById("cpu-pct").textContent = isNaN(cpuNum) ? "—" : Math.round(clampPct(cpuNum)) + "%";
    root.getElementById("cpu-bar").style.width = clampPct(cpuNum) + "%";
    root.getElementById("mem-pct").textContent = isNaN(memNum) ? "—" : Math.round(clampPct(memNum)) + "%";
    root.getElementById("mem-bar").style.width = clampPct(memNum) + "%";

    // ---- system ----
    const sysAttrs = (system && system.attributes) || {};
    root.getElementById("sys-updates").textContent = (system && system.state != null ? system.state : "—") + " updates pending";
    root.getElementById("sys-uptime").textContent = sysAttrs.uptime ?? "—";
    root.getElementById("sys-kernel").textContent = sysAttrs.kernel ?? "—";

    // ---- disks ----
    const diskRows = (disks && disks.attributes && disks.attributes.disks) || [];
    root.getElementById("disks-rows").innerHTML = diskRows.length
      ? diskRows
          .map((d) => {
            const pct = clampPct(d && d.percent);
            const useTb = (d && d.total_gb) >= 1000;
            const pctText = d && d.percent != null ? Math.round(d.percent) : "—";
            return (
              '<div class="disk-row">' +
              '<div class="disk-top"><span class="path">' + escapeHtml((d && d.path) || "—") + "</span>" +
              '<span class="nums">' + fmtGB(d && d.used_gb, useTb) + " / " + fmtGB(d && d.total_gb, useTb) + " · " + pctText + "%</span></div>" +
              '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
              "</div>"
            );
          })
          .join("")
      : '<p style="color:var(--muted);font-size:.85rem;">No disk data available.</p>';

    // ---- internet speed ----
    root.getElementById("speed-download").textContent = (dlSpeed && dlSpeed.state) ?? "—";
    root.getElementById("speed-upload").textContent = (ulSpeed && ulSpeed.state) ?? "—";
    root.getElementById("speed-ping").textContent = (ping && ping.state) ?? "—";

    // ---- temperatures ----
    const tempRows = (temps && temps.attributes && temps.attributes.temps) || [];
    root.getElementById("temps-rows").innerHTML = tempRows.length
      ? tempRows
          .map((t) => {
            const hotClass = t && t.hot ? " hot" : "";
            const iconId = tempIconId(t && t.name);
            const cText = t && t.c != null ? Math.round(t.c) + "°C" : "—";
            return (
              '<div class="temp-row' + hotClass + '">' +
              '<span class="temp-id"><svg class="icon" style="width:1em;height:1em;color:var(--khione-deep)"><use href="#' + iconId + '"></use></svg>' +
              escapeHtml((t && t.name) || "—") + "</span>" +
              '<span class="temp-val tabular">' + cText + "</span>" +
              "</div>"
            );
          })
          .join("")
      : '<p style="color:var(--muted);font-size:.85rem;">No sensor data available.</p>';
  }
}

customElements.define("khione-home-panel", KhioneHomePanel);
