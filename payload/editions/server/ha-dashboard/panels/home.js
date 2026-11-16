// payload/editions/server/ha-dashboard/panels/home.js
// Khione Home custom panel. Rewritten from the original "Today" section +
// bento grid layout into a Hero+Rail layout (one big weather/clothing/news
// column + one dense status rail), ported from the approved mockup
// scratchpad dashboard-sim/concepts.html's Concept 3 after several rounds
// of visual iteration there. See _tokens.js for the shared brand
// tokens/theme toggle, and weather.js for the sibling panel this follows
// the same wrapper mechanics as.
import { SHARED_TOKENS_CSS, ensureGoogleFontsLoaded, initTheme, toggleTheme, ensureMobileMenuButton, setMobileMenuButtonVisible } from "./_tokens.js";

// ---------------------------------------------------------------------------
// PAGE_CSS — see _tokens.js for why `:host`/`:host([data-theme=...])` are
// used instead of `:root`/`body` (shadow DOM has no real <body>, and
// :root never matches inside a shadow tree). `--khione-deep`, `--shadow-c`,
// `--ink-rgb`, `--font-display`, `--font-body`, `--font-script` have no
// shared-token equivalent, so they're page-local, declared in :host below.
// ---------------------------------------------------------------------------
const PAGE_CSS = `
:host{
  /* Single, non-scrolling screen. SHARED_TOKENS_CSS's min-height:100vh
     keeps the background filled on a short page; this flex column lets
     main (flex:1) absorb extra height on a TALL one. Unlike the
     previous layout, main is now a single-row grid (hero col + rail),
     not multiple stacked sections -- there's nothing left to spread
     leftover height between as artificial gaps, which was the actual
     cause of the "dead space" this layout replaced. Any true leftover
     on an unusually tall screen just sits below the grid, before the
     footer, as one ordinary margin -- not three. */
  display:flex;
  flex-direction:column;
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
.icon-badge.xs{ width:34px; height:34px; }
.icon-badge.xs .icon{ width:17px; height:17px; }

/* Theme toggle -- lives in the weather card's top-right corner now
   (see .hero-corner), not a separate header band. The old band's only
   other content (a big clock + a condensed weather chip) is redundant
   once the full weather display sits right below it on the same card. */
.theme-toggle{
  position:relative; width:38px; height:38px; flex:0 0 auto;
  border-radius:50%; border:1px solid rgba(var(--ink-rgb),.15);
  background: color-mix(in srgb, var(--accent-soft) 30%, var(--card-bg)); color: var(--accent);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.theme-toggle:hover{ background: color-mix(in srgb, var(--accent-soft) 45%, var(--card-bg)); }
.theme-toggle .icon{ width:18px; height:18px; }

/* ---------- layout: hero column (left) + status rail (right) ---------- */
main{ flex:1 1 auto; display:grid; grid-template-columns: 1.65fr 1fr; gap: 1.4rem; min-height:0; padding-block: 1.2rem; }
.hero-col{ display:flex; flex-direction:column; gap: 1.2rem; min-height:0; }

.card{
  background: var(--card-bg);
  border-radius: 24px;
  padding: 1.1rem 1.3rem;
  box-shadow: 0 3px 8px rgba(var(--shadow-c),.14), 0 22px 40px -18px rgba(var(--shadow-c),.22);
  border: 1px solid rgba(var(--ink-rgb),.06);
  min-width: 0;
  min-height: 0;
  transition: transform .25s ease, box-shadow .25s ease;
}
.card.hoverable:hover{ transform: translateY(-3px); box-shadow: 0 6px 14px rgba(var(--shadow-c),.18), 0 30px 50px -18px rgba(var(--shadow-c),.28); }

/* ---------- hero weather+clothing card ---------- */
.hero-weather-card{ position:relative; overflow:hidden; flex: 1.4 1 0; display:flex; flex-direction:column; justify-content:center; padding: 2rem 2.4rem; }
.hero-corner{ position:absolute; top:1.5rem; right:2rem; display:flex; align-items:center; gap:.7rem; z-index:2; }
.hero-clock{ font-weight:700; font-size:1.15rem; color: var(--muted); }
.weather-main{ display:flex; align-items:center; gap:1.3rem; }
.weather-temp{ font-size: clamp(3rem, 2rem + 4vh, 4.6rem); font-weight:700; color: var(--ink); line-height:1; }
.weather-cond{ font-weight:800; font-family: var(--font-display); font-size:1.3rem; color: var(--khione-deep); margin-top:.2rem; }
.weather-loc{ font-size:.85rem; color: var(--muted); margin-top:.1rem; }
.hero-note{ font-family: var(--font-script); font-size: 1.6rem; color: var(--accent); margin-top:1.2rem; max-width: 34em; }
.weather-stats{ display:flex; gap:1.8rem; margin-top:1.3rem; flex-wrap:wrap; }
.weather-stats > div > b{ font-size:1.1rem; }
.weather-stats > div > span{ display:block; font-size:.7rem; color: var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-top:.15rem; }

.clothing-head{ display:flex; align-items:center; gap:1rem; margin-top:1.4rem; padding-top:1.3rem; border-top:1px dashed rgba(var(--ink-rgb),.18); flex-wrap:wrap; }
.clothing-head h3{ font-size:1.15rem; }
.clothing-sub{ color: var(--muted); font-size:.82rem; margin-top:.15rem; }
.clothing-chips{ display:flex; gap:.5rem; flex-wrap:wrap; margin-left:auto; }

.chip{ font-size:.68rem; font-weight:800; padding:.25rem .65rem; border-radius:999px; background: color-mix(in srgb, var(--khione-green) 20%, var(--card-bg)); color: var(--khione-deep); white-space:nowrap; }
.chip.soft{ background: color-mix(in srgb, var(--accent-soft) 40%, var(--card-bg)); color: var(--accent); }
.chip.blue{ background: color-mix(in srgb, var(--khione-blue) 20%, var(--card-bg)); color: var(--khione-blue); }
.chip.purple{ background: color-mix(in srgb, var(--khione-purple) 18%, var(--card-bg)); color: var(--khione-purple); }
.chip.yellow{ background: color-mix(in srgb, var(--khione-yellow) 22%, var(--card-bg)); color: var(--khione-yellow); }
.chip.urgent{ background: var(--accent); color:#fff; animation: badgePulse 2.4s ease-in-out infinite; }

/* ---------- news feed ---------- */
.news-card{ flex: 1 1 0; display:flex; flex-direction:column; min-height:0; }
.news-head{ display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-bottom:.9rem; }
.news-head .ttl{ display:flex; align-items:center; gap:.8rem; }
.feed{ display:flex; flex-direction:column; overflow:auto; }
.feed-item{
  display:flex; gap:.8rem; align-items:flex-start; padding-block:.55rem;
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

/* ---------- status rail (right column) ---------- */
.rail-card{ display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.rail-card > h2{ font-size:1.2rem; margin-bottom: 1.1rem; flex-shrink:0; }
.rail-groups{ flex:1; display:flex; flex-direction:column; justify-content:space-between; min-height:0; gap: .9rem; overflow:auto; }
.rail-group{ display:flex; gap:14px; align-items:flex-start; padding-left:16px; }
.rail-group-head{ font-size:.72rem; font-weight:800; letter-spacing:.04em; color: var(--muted); }
.rail-group-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:.6rem; gap:.5rem; }
.rail-group-body{ flex:1; min-width:0; }
.rail-group.services{ border-left:3px solid var(--khione-green); }
.rail-group.system{ border-left:3px solid var(--khione-yellow); }
.rail-group.security{ border-left:3px solid var(--khione-purple); }
.rail-group.patching{ border-left:3px solid var(--khione-yellow); }
.rail-group.disks{ border-left:3px solid var(--khione-deep); }
.rail-group.network{ border-left:3px solid var(--khione-blue); }

.mini-stats{ display:flex; justify-content:space-between; gap:.6rem .9rem; flex-wrap:wrap; margin-bottom:.5rem; }
.mini-stats:last-child{ margin-bottom:0; }
.mini-stat b{ font-size:1.05rem; font-variant-numeric: tabular-nums; display:block; }
.mini-stat span{ font-size:.66rem; color: var(--muted); }
.mini-stat.warn b{ color: var(--khione-yellow); }

.status-dot{ width:9px; height:9px; border-radius:50%; background: var(--khione-green); position:relative; flex-shrink:0; }
.status-dot::after{ content:""; position:absolute; inset:-4px; border-radius:50%; border:1.5px solid var(--khione-green); opacity:.6; animation: pulse 2.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce){ .status-dot::after{ animation:none; } }
.status-dot.off{ background: var(--muted); }
.status-dot.off::after{ display:none; }
.svc-mini{ display:flex; align-items:center; gap:.4rem; }
.svc-mini b{ font-size:.88rem; }
.svc-mini-status{ font-size:.68rem; color: var(--khione-deep); font-weight:800; margin-top:.2rem; }
.svc-mini-status.off{ color: var(--muted); }

.rail-bar-row{ display:flex; justify-content:space-between; font-size:.8rem; margin-bottom:.3rem; }
.rail-bar{ height:9px; border-radius:999px; background: rgba(var(--ink-rgb),.1); overflow:hidden; margin-bottom:.6rem; }
.rail-bar > span{ display:block; height:100%; border-radius:999px; background: linear-gradient(90deg, var(--khione-green) 0%, var(--khione-deep) 100%); transition: width .4s ease; }
.rail-bar.warm > span{ background: linear-gradient(90deg, var(--khione-yellow) 0%, var(--accent) 100%); }

.rail-history{ font-size:.72rem; color: var(--muted); border-top:1px dashed rgba(var(--ink-rgb),.15); padding-top:.5rem; margin-top:.5rem; }
.rail-history b{ color: var(--khione-deep); }

.smart-pill{ font-size:.6rem; font-weight:800; color: var(--khione-deep); background: color-mix(in srgb, var(--khione-green) 20%, var(--card-bg)); padding:.1rem .4rem; border-radius:999px; white-space:nowrap; }
.smart-pill.warn{ color: var(--khione-yellow); background: color-mix(in srgb, var(--khione-yellow) 22%, var(--card-bg)); }
.smart-pill.fail{ color:#fff; background: var(--accent); }

.disk-rail-row{ margin-bottom:.55rem; }
.disk-rail-row:last-child{ margin-bottom:0; }
.disk-rail-top{ display:flex; justify-content:space-between; align-items:baseline; font-size:.8rem; margin-bottom:.25rem; gap:.5rem; flex-wrap:wrap; }
.disk-rail-top .path{ font-weight:700; flex-shrink:0; }
.disk-rail-top .nums{ display:flex; align-items:center; gap:7px; color: var(--muted); font-variant-numeric: tabular-nums; }

/* Dynamic count (lm-sensors/drivetemp can report any number of named
   sensors), so this wraps rather than assuming a fixed set of columns. */
.temp-mini-wrap{ display:flex; flex-wrap:wrap; gap: .5rem 1.3rem; }

footer{ flex-shrink:0; background: linear-gradient(170deg, var(--band-bg) 0%, color-mix(in srgb, var(--band-bg) 78%, var(--band-ink)) 100%); padding-block: .6rem; text-align:center; color: var(--band-ink); font-size:.8rem; font-weight:600; }
footer .wrap{ opacity:.85; }

.sys-badge{ display:inline-flex; align-items:center; gap:.4rem; background: color-mix(in srgb, var(--khione-yellow) 24%, var(--card-bg)); color: var(--khione-yellow); font-weight:800; font-size:.76rem; padding:.3rem .7rem; border-radius:999px; }
.sys-badge.urgent{ background: var(--accent); color: #fff; animation: badgePulse 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce){ .sys-badge.urgent{ animation:none; } }
@keyframes badgePulse{ 0%,100%{ box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); } 50%{ box-shadow: 0 0 0 6px transparent; } }
.sys-security-detail{ font-size:.72rem; color: var(--accent); font-weight:700; margin-top:.35rem; }

@keyframes pulse{ 0%{ transform:scale(.8); opacity:.7;} 100%{ transform:scale(1.8); opacity:0;} }
@media (prefers-reduced-motion: no-preference){
  .reveal{ animation: riseIn .6s ease both; }
  @keyframes riseIn{ from{ opacity:0; transform: translateY(10px); } to{ opacity:1; transform:none; } }
}

@media (max-width: 1100px){
  main{ grid-template-columns: 1fr; }
}
@media (max-width: 500px){
  .hero-weather-card{ padding: 1.4rem 1.5rem; }
  .hero-corner{ top:1rem; right:1.2rem; }
}
`;

// ---------------------------------------------------------------------------
// PAGE_SHELL_HTML — icon <symbol> defs kept byte-for-byte from the previous
// layout (including i-play/i-toggle, now unused by any element here but
// harmless to keep). Dynamic content (news, disks, temps, rail mini-stats)
// gets an empty container filled by _renderLiveData().
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
  <symbol id="i-umbrella" viewBox="0 0 24 24">
    <path d="M4 11c0-4.4 3.6-8 8-8s8 3.6 8 8H4z"/>
    <path d="M12 11v7.5c0 1-.8 1.8-1.8 1.8-.7 0-1.3-.4-1.6-1" stroke-linecap="round"/>
    <path d="M12 3v1.3" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-coat-rack" viewBox="0 0 24 24">
    <path d="M12 3v16" stroke-linecap="round"/>
    <path d="M7 6.3h10M6 9.3h12" stroke-linecap="round"/>
    <path d="M9 9.3 7.5 16.5h9L15 9.3"/>
    <circle cx="12" cy="19.5" r="1"/>
  </symbol>
  <symbol id="i-tshirt" viewBox="0 0 24 24">
    <path d="M8.5 4.5 4 7l1.8 3L8 9v9.5c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V9l2.2 1L20 7l-4.5-2.5c-.6 1-1.7 1.7-3 1.7s-2.4-.7-3-1.7z"/>
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
  <symbol id="i-shield" viewBox="0 0 24 24">
    <path d="M12 3.8 18.4 6.2v5.6c0 4.4-2.9 7.7-6.4 9-3.5-1.3-6.4-4.6-6.4-9V6.2z" stroke-linejoin="round"/>
    <path d="M9.3 12.1l1.9 1.9 3.5-3.9" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
</svg>

<link rel="preconnect" href="https://fonts.gstatic.com">

<main class="wrap">

  <div class="hero-col">
    <div class="card hero-weather-card hoverable reveal">
      <div class="hero-corner">
        <span class="hero-clock tabular" id="clock">&nbsp;</span>
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
          <svg class="icon" id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"></use></svg>
        </button>
      </div>
      <div class="weather-main">
        <div class="icon-badge" style="width:80px;height:80px;"><div class="blob blob-a"></div><svg class="icon" style="width:42px;height:42px"><use href="#i-cloud-sun"></use></svg></div>
        <div>
          <div class="weather-temp tabular" id="weather-temp">&mdash;</div>
          <div class="weather-cond" id="weather-cond">&nbsp;</div>
          <div class="weather-loc" id="weather-loc">&nbsp;</div>
        </div>
      </div>
      <p class="hero-note" id="hero-note">&nbsp;</p>
      <div class="weather-stats">
        <div><b class="tabular" id="wstat-feels">&mdash;</b><span>Feels like</span></div>
        <div><b class="tabular" id="wstat-wind">&mdash;</b><span>Wind</span></div>
        <div><b class="tabular" id="wstat-humidity">&mdash;</b><span>Humidity</span></div>
      </div>

      <div class="clothing-head">
        <div class="icon-badge soft sm"><div class="blob blob-c"></div><svg class="icon"><use id="clothing-icon-use" href="#i-jacket"></use></svg></div>
        <div>
          <h3 id="clothing-headline">&nbsp;</h3>
          <p class="clothing-sub" id="clothing-sub">&nbsp;</p>
        </div>
        <div class="clothing-chips" id="clothing-chips"></div>
      </div>
    </div>

    <div class="card news-card reveal">
      <div class="news-head">
        <div class="ttl"><div class="icon-badge sm yellow"><div class="blob blob-d"></div><svg class="icon"><use href="#i-feed"></use></svg></div><h3>News</h3></div>
        <span class="count">Updates hourly</span>
      </div>
      <div class="feed" id="feed-news"></div>
    </div>
  </div>

  <div class="card rail-card reveal">
    <h2>Server &amp; system status</h2>
    <div class="rail-groups">

      <div class="rail-group services">
        <div class="icon-badge xs"><div class="blob blob-a"></div><svg class="icon"><use href="#i-server"></use></svg></div>
        <div class="rail-group-body">
          <div class="rail-group-head">SERVICES</div>
          <div class="mini-stats">
            <div class="svc-mini">
              <span class="status-dot" id="svc-plex-dot"></span>
              <div><b>Plex</b><div class="svc-mini-status" id="svc-plex-status">&mdash;</div></div>
            </div>
            <div class="svc-mini">
              <span class="status-dot" id="svc-cockpit-dot"></span>
              <div><b>Cockpit</b><div class="svc-mini-status" id="svc-cockpit-status">&mdash;</div></div>
            </div>
            <!-- Home Assistant: no sensor needed -- this page only renders
                 at all because HA is up and serving it, so hardcoding
                 "online" here is accurate by construction, not a guess. -->
            <div class="svc-mini">
              <span class="status-dot"></span>
              <div><b>Home Assistant</b><div class="svc-mini-status">ONLINE</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="rail-group system">
        <div class="icon-badge xs yellow"><div class="blob blob-d"></div><svg class="icon"><use href="#i-refresh"></use></svg></div>
        <div class="rail-group-body">
          <div class="rail-group-head">SYSTEM</div>
          <div class="rail-bar-row"><span>CPU</span><b class="tabular" id="cpu-pct">&mdash;</b></div>
          <div class="rail-bar"><span id="cpu-bar" style="width:0%"></span></div>
          <div class="rail-bar-row"><span>Memory</span><b class="tabular" id="mem-pct">&mdash;</b></div>
          <div class="rail-bar warm"><span id="mem-bar" style="width:0%"></span></div>
          <div class="mini-stats">
            <div class="mini-stat"><b class="tabular" id="sys-load">&mdash;</b><span id="sys-load-caption">load avg</span></div>
            <div class="mini-stat"><b class="tabular" id="sys-swap">&mdash;</b><span id="sys-swap-caption">swap</span></div>
          </div>
          <div class="rail-group-top" style="margin-bottom:0;">
            <span style="font-size:.78rem;color:var(--muted);" id="sys-uptime-kernel">&mdash;</span>
            <span class="sys-badge" id="sys-badge"><svg class="icon" style="width:.9em;height:.9em"><use href="#i-refresh"></use></svg><span id="sys-updates">&nbsp;</span></span>
          </div>
        </div>
      </div>

      <div class="rail-group security">
        <div class="icon-badge xs purple"><div class="blob blob-c"></div><svg class="icon"><use href="#i-shield"></use></svg></div>
        <div class="rail-group-body">
          <div class="rail-group-top">
            <div class="rail-group-head">SECURITY</div>
            <span class="sys-badge" id="sec-badge"><span id="sec-headline">&nbsp;</span></span>
          </div>
          <div class="mini-stats">
            <div class="mini-stat"><b class="tabular" id="sec-fail2ban">&mdash;</b><span>fail2ban bans</span></div>
            <div class="mini-stat"><b class="tabular" id="sec-crowdsec">&mdash;</b><span>CrowdSec blocks</span></div>
            <div class="mini-stat"><b class="tabular" id="sec-ufw">&mdash;</b><span>ufw rules active</span></div>
          </div>
          <div class="mini-stats">
            <div class="mini-stat" id="sec-auditd-stat"><b class="tabular" id="sec-auditd">&mdash;</b><span>auditd ruleset</span></div>
            <div class="mini-stat" id="sec-outbound-stat"><b class="tabular" id="sec-outbound">&mdash;</b><span>outbound</span></div>
            <div class="mini-stat" id="sec-aide-stat"><b class="tabular" id="sec-aide-next">&mdash;</b><span>AIDE next run</span></div>
          </div>
          <div class="mini-stats">
            <div class="mini-stat" id="sec-quad9-stat"><b class="tabular" id="sec-quad9">&mdash;</b><span>DNS filtering</span></div>
            <div class="mini-stat" id="sec-grub-stat"><b class="tabular" id="sec-grub">&mdash;</b><span>GRUB password</span></div>
            <div class="mini-stat"><b class="tabular" id="sec-sessions">&mdash;</b><span>active sessions</span></div>
          </div>
          <p class="rail-history" id="sec-history">&nbsp;</p>
        </div>
      </div>

      <div class="rail-group patching">
        <div class="icon-badge xs yellow"><div class="blob blob-b"></div><svg class="icon"><use href="#i-refresh"></use></svg></div>
        <div class="rail-group-body">
          <div class="rail-group-head">PATCHING</div>
          <div class="mini-stats">
            <div class="mini-stat"><b class="tabular" id="pat-official">&mdash;</b><span>official updates</span></div>
            <div class="mini-stat" id="pat-advisories-stat"><b class="tabular" id="pat-advisories">&mdash;</b><span>security advisories</span></div>
            <div class="mini-stat" id="pat-aur-stat"><b class="tabular" id="pat-aur">&mdash;</b><span>Plex (AUR)</span></div>
            <div class="mini-stat" id="pat-news-stat"><b class="tabular" id="pat-news">&mdash;</b><span>Arch News gate</span></div>
          </div>
          <p class="sys-security-detail" id="pat-detail" hidden></p>
          <p class="rail-history" id="pat-history">&nbsp;</p>
        </div>
      </div>

      <div class="rail-group disks">
        <div class="icon-badge xs soft"><div class="blob blob-a"></div><svg class="icon"><use href="#i-disk"></use></svg></div>
        <div class="rail-group-body">
          <div class="rail-group-head">DISKS</div>
          <div id="disk-rail-rows"></div>
        </div>
      </div>

      <div class="rail-group network">
        <div class="icon-badge xs blue"><div class="blob blob-c"></div><svg class="icon"><use href="#i-chip"></use></svg></div>
        <div class="rail-group-body">
          <div class="rail-group-head">NETWORK &amp; TEMPS</div>
          <div class="mini-stats">
            <div class="mini-stat"><b class="tabular" id="net-download">&mdash;</b><span>Mbps down</span></div>
            <div class="mini-stat"><b class="tabular" id="net-upload">&mdash;</b><span>Mbps up</span></div>
            <div class="mini-stat"><b class="tabular" id="net-ping">&mdash;</b><span>ms ping</span></div>
          </div>
          <div class="temp-mini-wrap" id="temp-mini-rows"></div>
        </div>
      </div>

    </div>
  </div>

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

// Collector-supplied timestamps are Unix epoch SECONDS, not an
// ISO/RFC date string -- they come from systemd's own timestamp text
// ("Tue 2026-11-17 00:38:34 GMT") converted with `date -d ... +%s` on
// the collector side, because confirmed live that Date.parse can't
// read systemd's format directly. null/undefined means "never happened
// yet", not "unknown" -- every caller here treats them differently.
function fmtAgo(epochSeconds) {
  if (epochSeconds == null) return null;
  const diffMin = Math.max(0, Math.round((Date.now() - epochSeconds * 1000) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return diffMin + "m ago";
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return diffH + "h ago";
  return Math.round(diffH / 24) + "d ago";
}

function fmtUntil(epochSeconds) {
  if (epochSeconds == null) return null;
  const diffMin = Math.max(0, Math.round((epochSeconds * 1000 - Date.now()) / 60000));
  if (diffMin < 1) return "due now";
  if (diffMin < 60) return "in " + diffMin + "m";
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return "in " + diffH + "h";
  return "in " + Math.round(diffH / 24) + "d";
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

// name-keyword heuristic onto the 3 hand-drawn icons already available
// (CPU/NVMe/Motherboard) -- no new icons needed since sensor.khione_temps
// gives only {name, c, hot}, not an icon.
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

// shortcut: caps the merged feed at this many items so the card doesn't
// grow unbounded if a source sensor returns a long article list.
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
    setMobileMenuButtonVisible(this, narrow);
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
      ensureGoogleFontsLoaded();
      this._root.innerHTML = `<style>${SHARED_TOKENS_CSS}${PAGE_CSS}</style>${PAGE_SHELL_HTML}`;
      initTheme(this);
      ensureMobileMenuButton(this);
      setMobileMenuButtonVisible(this, this._narrow);
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
      String(now.getMinutes()).padStart(2, "0");
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
    // HA fixes an entity_id at first registration and never re-slugs it
    // from a later config edit -- an install from before
    // configuration-snippet.yaml's one-word "ArchLinux" naming fix is
    // stuck on the old two-word slug forever unless manually renamed.
    // Confirmed live: this server's real entity is still
    // sensor.khione_rss_arch_linux. Try both so this works whether the
    // install predates that fix or not.
    const rssArch = hass.states["sensor.khione_rss_archlinux"] || hass.states["sensor.khione_rss_arch_linux"];
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
    const security = hass.states["sensor.khione_security"];
    const netwatch = hass.states["sensor.khione_netwatch"];
    const patching = hass.states["sensor.khione_patching"];

    // ---- hero: weather & clothing ----
    const wAttrs = (weather && weather.attributes) || {};
    const condition = weather ? weather.state : null;
    const temp = wAttrs.temperature ?? null;
    const placeName = (zone && zone.attributes && zone.attributes.friendly_name) ?? "—";
    const clothingState = (clothing && clothing.state) || null;

    const haveWeather = condition != null && temp != null;
    root.getElementById("hero-note").textContent = haveWeather
      ? greetingPrefix(new Date()) + " — " + conditionLabel(condition) + ", " + fmtTemp(temp) + "."
      : greetingPrefix(new Date()) + " — weather data unavailable.";

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

    const clothingIconUse = root.getElementById("clothing-icon-use");
    if (clothingIconUse) {
      const mdiIcon = (clothing && clothing.attributes && clothing.attributes.icon) || "";
      const iconMap = { "mdi:umbrella": "i-umbrella", "mdi:coat-rack": "i-coat-rack", "mdi:jacket": "i-jacket", "mdi:tshirt-crew": "i-tshirt" };
      clothingIconUse.setAttribute("href", "#" + (iconMap[mdiIcon] || "i-jacket"));
    }
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
    const archArticles = ((rssArch && rssArch.attributes && rssArch.attributes.articles) || []).map((a) => ({
      title: a && a.title, pubDate: a && a.pubDate, chipText: "Arch", chipCls: "purple", tag: "purple",
    }));
    const newsFeed = sortByPubDateDesc(bbcArticles.concat(derbyArticles, archArticles)).slice(0, NEWS_LIMIT);
    root.getElementById("feed-news").innerHTML = buildFeedHtml(newsFeed);

    // ---- services ----
    const renderServiceStatus = (dotEl, textEl, state) => {
      if (!dotEl || !textEl) return;
      if (state == null) {
        dotEl.className = "status-dot off";
        textEl.className = "svc-mini-status off";
        textEl.textContent = "UNKNOWN";
      } else if (state === "on") {
        dotEl.className = "status-dot";
        textEl.className = "svc-mini-status";
        textEl.textContent = "ONLINE";
      } else {
        dotEl.className = "status-dot off";
        textEl.className = "svc-mini-status off";
        textEl.textContent = "OFFLINE";
      }
    };
    renderServiceStatus(root.getElementById("svc-plex-dot"), root.getElementById("svc-plex-status"), plex ? plex.state : null);
    renderServiceStatus(root.getElementById("svc-cockpit-dot"), root.getElementById("svc-cockpit-status"), cockpit ? cockpit.state : null);

    // ---- system ----
    const cpuNum = cpu && cpu.state != null ? parseFloat(cpu.state) : NaN;
    const memNum = mem && mem.state != null ? parseFloat(mem.state) : NaN;
    root.getElementById("cpu-pct").textContent = isNaN(cpuNum) ? "—" : Math.round(clampPct(cpuNum)) + "%";
    root.getElementById("cpu-bar").style.width = clampPct(cpuNum) + "%";
    root.getElementById("mem-pct").textContent = isNaN(memNum) ? "—" : Math.round(clampPct(memNum)) + "%";
    root.getElementById("mem-bar").style.width = clampPct(memNum) + "%";

    const sysAttrs = (system && system.attributes) || {};
    root.getElementById("sys-load").textContent = sysAttrs.load1 != null ? sysAttrs.load1.toFixed(2) : "—";
    root.getElementById("sys-load-caption").textContent =
      sysAttrs.load5 != null && sysAttrs.load15 != null
        ? "load 1m · " + sysAttrs.load5.toFixed(2) + "/" + sysAttrs.load15.toFixed(2) + " (5/15m)"
        : "load avg";
    const swapTotal = Number(sysAttrs.swap_total_gb) || 0;
    const swapUsed = Number(sysAttrs.swap_used_gb) || 0;
    root.getElementById("sys-swap").textContent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) + "%" : "—";
    root.getElementById("sys-swap-caption").textContent =
      swapTotal > 0 ? "swap · " + fmtGB(swapUsed, false) + " / " + fmtGB(swapTotal, false) : "no swap";

    const securityCount = Number(sysAttrs.security_updates) || 0;
    const securityDetail = Array.isArray(sysAttrs.security_detail) ? sysAttrs.security_detail : [];
    root.getElementById("sys-uptime-kernel").textContent = (sysAttrs.uptime ?? "—") + " · " + (sysAttrs.kernel ?? "—");
    root.getElementById("sys-updates").textContent = (system && system.state != null ? system.state : "—") + " updates";

    // ---- security ----
    const secAttrs = (security && security.attributes) || {};
    const netAttrs = (netwatch && netwatch.attributes) || {};
    const bannedIps = Number(secAttrs.banned_ips) || 0;
    const csDecisions = Number(secAttrs.crowdsec_decisions) || 0;
    const aideStatus = secAttrs.aide_status || "unknown";
    const auditdActive = secAttrs.auditd_active === true;
    const auditdImmutable = secAttrs.auditd_immutable === true;
    const unusualOutbound = Number(netAttrs.unusual_outbound) || 0;
    const unusualDetail = Array.isArray(netAttrs.unusual_detail) ? netAttrs.unusual_detail : [];

    const secBadge = root.getElementById("sec-badge");
    // "Urgent" here means something fail2ban/CrowdSec's own network-layer
    // view can't catch on its own: unexpected outbound traffic, unexpected
    // file changes, or the file/process watchers themselves being down.
    // Active bans/decisions mean the defenses are doing their job, not
    // that something got through -- that's reported but not urgent.
    const secUrgent = aideStatus === "changes_detected" || !auditdActive || unusualOutbound > 0;
    if (secUrgent) {
      secBadge.classList.add("urgent");
      const reasons = [];
      if (unusualOutbound > 0) reasons.push(unusualOutbound + " unusual outbound");
      if (aideStatus === "changes_detected") reasons.push("file changes");
      if (!auditdActive) reasons.push("auditd down");
      root.getElementById("sec-headline").textContent = reasons.join(", ");
    } else {
      secBadge.classList.remove("urgent");
      const totalBlocked = bannedIps + csDecisions;
      root.getElementById("sec-headline").textContent = totalBlocked > 0
        ? totalBlocked + " threat" + (totalBlocked === 1 ? "" : "s") + " blocked"
        : "All clear";
    }
    root.getElementById("sec-fail2ban").textContent = bannedIps;
    root.getElementById("sec-crowdsec").textContent = csDecisions;
    root.getElementById("sec-ufw").textContent = secAttrs.ufw_rules ?? "—";
    root.getElementById("sec-auditd").textContent = auditdActive ? (auditdImmutable ? "locked" : "active") : "down";
    root.getElementById("sec-auditd-stat").className = "mini-stat" + (auditdActive ? "" : " warn");
    root.getElementById("sec-outbound").textContent = unusualOutbound > 0 ? unusualOutbound + " unusual" : "normal";
    root.getElementById("sec-outbound-stat").className = "mini-stat" + (unusualOutbound > 0 ? " warn" : "");
    const aideNextText = aideStatus === "changes_detected" ? "review" : (fmtUntil(secAttrs.aide_next_run) || "—");
    root.getElementById("sec-aide-next").textContent = aideNextText;
    root.getElementById("sec-aide-stat").className = "mini-stat" + (aideStatus === "changes_detected" ? " warn" : "");
    root.getElementById("sec-quad9").textContent = secAttrs.quad9_active === true ? "Quad9" : "off";
    root.getElementById("sec-quad9-stat").className = "mini-stat" + (secAttrs.quad9_active === true ? "" : " warn");
    root.getElementById("sec-grub").textContent = secAttrs.grub_locked === true ? "set" : "unset";
    root.getElementById("sec-grub-stat").className = "mini-stat" + (secAttrs.grub_locked === true ? "" : " warn");
    root.getElementById("sec-sessions").textContent = secAttrs.active_sessions ?? "—";

    const secHistoryEl = root.getElementById("sec-history");
    if (secAttrs.last_ban_jail && secAttrs.last_ban_time != null) {
      secHistoryEl.innerHTML = "Last ban: <b>" + escapeHtml(secAttrs.last_ban_jail) + " jail</b>, " + fmtAgo(secAttrs.last_ban_time);
    } else if (unusualDetail[0]) {
      const first = unusualDetail[0];
      secHistoryEl.textContent = "Unusual: " + first.process + " → " + first.remote_ip + ":" + first.remote_port;
    } else {
      secHistoryEl.textContent = "No bans recorded yet.";
    }

    // ---- patching ----
    const patAttrs = (patching && patching.attributes) || {};
    root.getElementById("pat-official").textContent = sysAttrs.updates ?? "—";
    root.getElementById("pat-advisories").textContent = securityCount;
    const patAdvisoriesStat = root.getElementById("pat-advisories-stat");
    const patDetailEl = root.getElementById("pat-detail");
    if (securityCount > 0) {
      patAdvisoriesStat.className = "mini-stat warn";
      const first = securityDetail[0];
      patDetailEl.hidden = false;
      patDetailEl.textContent = first
        ? first.package + ": " + (first.severity || "High") + " risk" + (first.cve ? " (" + first.cve + ")" : "") +
          (securityCount > 1 ? " — +" + (securityCount - 1) + " more" : "")
        : "Run pacman to apply a known security fix.";
    } else {
      patAdvisoriesStat.className = "mini-stat";
      patDetailEl.hidden = true;
    }
    const aurUpdate = patAttrs.aur_update_available === true;
    root.getElementById("pat-aur").textContent = aurUpdate ? "update" : "current";
    root.getElementById("pat-aur-stat").className = "mini-stat" + (aurUpdate ? " warn" : "");
    const newsUnread = Number(patAttrs.news_unread) || 0;
    root.getElementById("pat-news").textContent = newsUnread > 0 ? newsUnread + " unread" : "read";
    root.getElementById("pat-news-stat").className = "mini-stat" + (newsUnread > 0 ? " warn" : "");

    const patHistoryEl = root.getElementById("pat-history");
    const lastSyncText = fmtAgo(patAttrs.last_sync);
    const nextRunText = fmtUntil(patAttrs.next_run);
    patHistoryEl.innerHTML =
      "Last sync: <b>" + (lastSyncText || "never") + "</b>" + (nextRunText ? " · next " + nextRunText : "");

    // ---- disks ----
    const diskRows = (disks && disks.attributes && disks.attributes.disks) || [];
    root.getElementById("disk-rail-rows").innerHTML = diskRows.length
      ? diskRows
          .map((d) => {
            const pct = clampPct(d && d.percent);
            const useTb = (d && d.total_gb) >= 1000;
            const pctText = d && d.percent != null ? Math.round(d.percent) : "—";
            const smart = d && d.smart;
            let smartHtml = "";
            if (smart && smart.healthy === true) {
              smartHtml = '<span class="smart-pill">SMART OK</span>';
            } else if (smart && smart.healthy === false) {
              smartHtml = '<span class="smart-pill fail">' + smart.healthy_count + "/" + smart.disk_count + ' SMART OK</span>';
            }
            const warm = pct >= 90 ? " warm" : "";
            return (
              '<div class="disk-rail-row">' +
              '<div class="disk-rail-top"><span class="path">' + escapeHtml((d && d.path) || "—") + "</span>" +
              '<span class="nums">' + fmtGB(d && d.used_gb, useTb) + " / " + fmtGB(d && d.total_gb, useTb) + " · " + pctText + "%" + smartHtml + "</span></div>" +
              '<div class="rail-bar' + warm + '"><span style="width:' + pct + '%"></span></div>' +
              "</div>"
            );
          })
          .join("")
      : '<p style="color:var(--muted);font-size:.85rem;">No disk data available.</p>';

    // ---- internet speed ----
    root.getElementById("net-download").textContent = (dlSpeed && dlSpeed.state) ?? "—";
    root.getElementById("net-upload").textContent = (ulSpeed && ulSpeed.state) ?? "—";
    root.getElementById("net-ping").textContent = (ping && ping.state) ?? "—";

    // ---- temperatures ----
    const tempRows = (temps && temps.attributes && temps.attributes.temps) || [];
    root.getElementById("temp-mini-rows").innerHTML = tempRows.length
      ? tempRows
          .map((t) => {
            const iconId = tempIconId(t && t.name);
            const cText = t && t.c != null ? Math.round(t.c) + "°C" : "—";
            const hot = t && t.hot;
            return (
              '<div class="mini-stat' + (hot ? " warn" : "") + '">' +
              '<b class="tabular"><svg class="icon" style="width:.8em;height:.8em;vertical-align:-1px"><use href="#' + iconId + '"></use></svg> ' + cText + "</b>" +
              "<span>" + escapeHtml((t && t.name) || "—") + "</span>" +
              "</div>"
            );
          })
          .join("")
      : '<p style="color:var(--muted);font-size:.85rem;">No sensor data available.</p>';
  }
}

customElements.define("khione-home-panel", KhioneHomePanel);
