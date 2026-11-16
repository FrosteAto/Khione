// payload/editions/server/ha-dashboard/panels/weather.js
// Khione Weather custom panel. Ported verbatim (CSS/SVG/markup) from the
// approved mockup scratchpad/mockups/weather-redesign-washi-ghibli-brand.html
// — this file is a data-wiring change onto that approved design, not a
// redesign. See _tokens.js for the shared brand tokens/theme toggle.
import { SHARED_TOKENS_CSS, GOOGLE_FONTS_LINK_HTML, initTheme, toggleTheme } from "./_tokens.js";

// ---------------------------------------------------------------------------
// PAGE_CSS — verbatim from the mockup's main <style> block, with two
// necessary shadow-DOM adaptations: the mockup's `body{...}` and
// `body::after{...}` rules are retargeted to `:host`/`:host::after`, since
// there is no real <body> element inside a shadow root for those selectors
// to match (shadow DOM has no head/body — `:host` is the shadow-DOM
// equivalent "root" selector). `display:block` is added to :host because
// custom elements default to display:inline, which would collapse this
// panel's layout. Every declaration's VALUES are otherwise byte-for-byte.
// ---------------------------------------------------------------------------
const PAGE_CSS = `
*{box-sizing:border-box;}
:host{
  display:block;
  margin:0;
  background:var(--bg);
  color:var(--ink);
  font-family:var(--font-body);
  font-size:16px;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
  position:relative;
  isolation:isolate;
}
/* washi paper fibre texture, ~5% opacity, fixed over the whole viewport */
:host::after{
  content:"";
  position:fixed;
  inset:0;
  z-index:0;
  pointer-events:none;
  opacity:.055;
  mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.page{position:relative;z-index:1;}

h1,h2,h3{font-family:var(--font-head);font-weight:800;margin:0;text-wrap:balance;}
.mono-num{font-variant-numeric:tabular-nums;}

/* ---------- icon defs ---------- */
.icon-defs{position:absolute;width:0;height:0;overflow:hidden;}

.wicon{display:block;overflow:visible;}
.sun-body{fill:var(--accent-soft);}
.sun-ray{stroke:var(--khione-yellow);fill:none;}
.cloud-fill{fill:var(--band-bg);}
.cloud-line{stroke:var(--accent);fill:none;}
.moon-body{fill:var(--band-ink);}
.moon-cut{fill:var(--card-bg);}
.star-dot{fill:var(--khione-purple);}
.drop-fill{fill:var(--khione-blue);}
.flake-line{stroke:var(--khione-blue);fill:none;}
.wind-line{stroke:var(--accent);fill:none;}

/* ---------- blob accents behind icons/headers ---------- */
.blob{position:absolute;z-index:-1;border-radius:40% 60% 55% 45% / 50% 45% 60% 40%;}
.blob-green{background:color-mix(in srgb, var(--khione-green) 32%, transparent);}
.blob-sage{background:color-mix(in srgb, var(--band-bg) 55%, transparent);}
.blob-soft{background:color-mix(in srgb, var(--accent-soft) 35%, transparent);}

/* ---------- top band ---------- */
.topband{
  background:var(--band-bg);
  color:var(--band-ink);
  padding-block:.85rem;
  padding-left:max(20px, env(safe-area-inset-left,0px));
  padding-right:max(20px, env(safe-area-inset-right,0px));
}
.topband-inner{
  display:flex;align-items:baseline;justify-content:space-between;gap:1rem;flex-wrap:wrap;
}
.topband-title{font-family:var(--font-head);font-weight:800;font-size:1.3rem;letter-spacing:.01em;}
.topband-meta{font-size:.82rem;opacity:.85;}
.topband-right{display:flex;align-items:center;gap:.8rem;}
.theme-toggle{
  position:relative;
  width:36px;height:36px;flex:0 0 auto;
  border-radius:50%;border:1px solid color-mix(in srgb, var(--band-ink) 30%, transparent);
  background:color-mix(in srgb, var(--band-ink) 10%, transparent);
  color:var(--band-ink);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;
}
.theme-toggle:hover{background:color-mix(in srgb, var(--band-ink) 18%, transparent);}
.theme-toggle svg{width:19px;height:19px;}

main{
  padding:clamp(1.2rem,3vw,2.4rem) max(20px, env(safe-area-inset-left,0px)) 3rem max(20px, env(safe-area-inset-right,0px));
  display:flex;flex-direction:column;gap:clamp(1.1rem,2.4vw,1.8rem);
}

.room{position:relative;}

/* ---------- hero: deliberately a single, fixed warm-dusk palette so its sky
   art stays internally consistent regardless of the viewer's light/dark theme
   (it depicts one real moment, like a photo would) ---------- */
.hero{
  border-radius:38px 46px 30px 50px;
  padding:clamp(1.6rem,4vw,3rem);
  background:linear-gradient(165deg,#bfcb9a 0%,#d4a373 52%,#a9693a 100%);
  color:#2a1c10;
  box-shadow:var(--shadow-soft);
  overflow:hidden;
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:clamp(1.5rem,4vw,3rem);
}
.hero-clouds{position:absolute;inset:0;pointer-events:none;}
.hero-clouds svg{position:absolute;opacity:.4;}
.hero-clouds .c1{top:8%;left:4%;width:120px;animation:drift 70s linear infinite;}
.hero-clouds .c2{top:18%;left:68%;width:90px;animation:drift 95s linear infinite reverse;}
@keyframes drift{from{transform:translateX(0);}to{transform:translateX(40px);}}
@media (prefers-reduced-motion:reduce){.hero-clouds svg{animation:none;}}

.hero-icon-wrap{position:relative;flex:0 0 auto;width:clamp(120px,16vw,170px);height:clamp(120px,16vw,170px);}
.hero-icon-wrap .blob{inset:6%;}
.hero-icon-wrap svg{width:100%;height:100%;}

.hero-main{flex:1 1 320px;min-width:0;}
.hero-place{font-size:.92rem;font-weight:600;opacity:.85;}
.hero-date{font-size:.8rem;opacity:.7;margin-top:.1rem;}
.hero-temp-row{display:flex;align-items:flex-end;gap:.9rem;margin:.3rem 0 .2rem;flex-wrap:wrap;}
.hero-temp{font-family:var(--font-head);font-weight:800;font-size:clamp(4.2rem,11vw,7.6rem);line-height:.9;letter-spacing:-.02em;}
.hero-cond{display:flex;flex-direction:column;gap:.15rem;padding-bottom:.6rem;}
.hero-cond-text{font-size:1.3rem;font-weight:700;font-family:var(--font-head);}
.hero-feels{font-size:.9rem;opacity:.85;}
.hero-hilo{font-size:.9rem;opacity:.85;display:flex;gap:.9rem;margin-top:.15rem;}
.hero-note{
  font-family:var(--font-script);
  font-size:1.5rem;
  margin-top:.6rem;
  opacity:.9;
}

/* ---------- card shell shared by non-hero rooms ---------- */
.card{
  background:var(--card-bg);
  border-radius:30px 22px 34px 24px;
  box-shadow:var(--shadow-tight);
  border:1px solid var(--hairline);
  padding:clamp(1.2rem,2.6vw,1.8rem);
}
.card-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:1.1rem;flex-wrap:wrap;}
.card-title{font-size:1.15rem;}
.card-sub{font-size:.8rem;color:var(--muted);}

/* ---------- sun arc ---------- */
.top-row{display:grid;grid-template-columns:1.3fr 1fr;gap:clamp(1.1rem,2.4vw,1.8rem);align-items:stretch;}
.top-row .hero,.top-row .card{margin:0;height:100%;}
@media (max-width:900px){.top-row{grid-template-columns:1fr;}}

.arc-wrap{position:relative;width:100%;}
.arc-wrap svg{width:100%;height:auto;display:block;}
.arc-endlabel{font-size:.78rem;color:var(--muted);}
.arc-foot{display:flex;justify-content:space-between;margin-top:.3rem;font-size:.8rem;color:var(--muted);}
.arc-now-label{font-size:.72rem;font-weight:600;fill:var(--ink);}

/* ---------- live radar ---------- */
.radar-wrap{position:relative;border-radius:26px 18px 26px 18px;overflow:hidden;border:1px solid var(--hairline);box-shadow:var(--shadow-tight);}
.radar-map{width:100%;height:600px;background:var(--band-bg);}
.radar-map .leaflet-tile-pane{filter:sepia(.28) saturate(1.35) hue-rotate(-6deg) brightness(1.03) contrast(1.02);}
.radar-map .leaflet-control-attribution{font-family:var(--font-body);font-size:.68rem;background:color-mix(in srgb, var(--card-bg) 80%, transparent);color:var(--muted);}
.radar-map .leaflet-control-zoom a{font-family:var(--font-head);}
.radar-overlay-ui{position:absolute;left:14px;top:14px;right:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem;pointer-events:none;z-index:650;}
.radar-badge{
  pointer-events:auto;
  background:color-mix(in srgb, var(--card-bg) 88%, transparent);
  border:1px solid var(--hairline);
  border-radius:16px 10px 16px 10px;
  padding:.4rem .7rem;
  display:flex;align-items:center;gap:.5rem;
  font-size:.78rem;
  box-shadow:var(--shadow-tight);
}
.radar-live-dot{width:8px;height:8px;border-radius:50%;background:var(--khione-green);box-shadow:0 0 0 0 color-mix(in srgb, var(--khione-green) 60%, transparent);animation:radar-pulse 2.2s ease-out infinite;}
@keyframes radar-pulse{
  0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--khione-green) 55%, transparent);}
  70%{box-shadow:0 0 0 9px color-mix(in srgb, var(--khione-green) 0%, transparent);}
  100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--khione-green) 0%, transparent);}
}
@media (prefers-reduced-motion:reduce){.radar-live-dot{animation:none;}}
.radar-play{
  pointer-events:auto;
  font-family:var(--font-body);font-size:.78rem;font-weight:600;
  background:var(--khione-green);color:#1c2912;border:none;
  border-radius:16px 10px 16px 10px;padding:.45rem .85rem;
  cursor:pointer;display:flex;align-items:center;gap:.4rem;
  box-shadow:var(--shadow-tight);
}
.radar-play:hover{filter:brightness(1.06);}
.radar-legend{
  position:absolute;right:14px;bottom:14px;z-index:650;
  background:color-mix(in srgb, var(--card-bg) 88%, transparent);
  border:1px solid var(--hairline);border-radius:16px 10px 16px 10px;
  padding:.5rem .7rem;font-size:.7rem;color:var(--muted);
  display:flex;flex-direction:column;gap:.25rem;
}
.radar-legend-row{display:flex;align-items:center;gap:.4rem;}
.radar-legend-swatch{width:14px;height:8px;border-radius:3px;flex:0 0 auto;}
.radar-foot{display:flex;justify-content:space-between;align-items:center;margin-top:.6rem;font-size:.78rem;color:var(--muted);flex-wrap:wrap;gap:.4rem;}
.radar-scrub{flex:1 1 220px;accent-color:var(--khione-green);}
.radar-note{font-size:.72rem;color:var(--muted);margin-top:.3rem;}

/* ---------- metrics ---------- */
.metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:.9rem;}
.metric{
  position:relative;
  background:color-mix(in srgb, var(--band-bg) 18%, var(--card-bg));
  border-radius:26px 18px 26px 18px;
  padding:1rem 1.1rem;
  display:flex;align-items:center;gap:.8rem;
  border:1px solid var(--hairline);
}
.metric .blob{width:52px;height:52px;left:-6px;top:-4px;}
.metric-icon{position:relative;width:44px;height:44px;flex:0 0 auto;}
.metric-icon svg{width:100%;height:100%;}
.metric-val{font-size:1.3rem;font-weight:700;font-family:var(--font-head);}
.metric-label{font-size:.76rem;color:var(--muted);margin-top:.1rem;}

/* ---------- hourly strip ---------- */
.hourly-scroll{overflow-x:auto;padding-bottom:.4rem;margin:0 -0.2rem;}
.hourly-inner{min-width:760px;position:relative;padding:0 .2rem;}
.hourly-chart{width:100%;height:60px;display:block;}
.hourly-row{display:grid;grid-template-columns:repeat(12,1fr);text-align:center;margin-top:-6px;}
.hour-chip{display:flex;flex-direction:column;align-items:center;gap:.25rem;padding:.3rem 0;}
.hour-chip.now{position:relative;}
.hour-chip.now::before{
  content:"";position:absolute;inset:-6px -2px;z-index:-1;
  background:color-mix(in srgb, var(--khione-green) 16%, transparent);
  border-radius:16px 22px 14px 20px;
}
.hour-time{font-size:.72rem;color:var(--muted);}
.hour-icon{width:34px;height:34px;}
.hour-temp{font-size:.88rem;font-weight:700;}

/* ---------- 7-day ---------- */
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.7rem;}
.day{
  background:color-mix(in srgb, var(--band-bg) 14%, var(--card-bg));
  border-radius:24px 16px 24px 16px;
  padding:.9rem .6rem 1rem;
  text-align:center;
  border:1px solid var(--hairline);
  display:flex;flex-direction:column;align-items:center;gap:.35rem;
}
.day.today{border-color:var(--khione-green);box-shadow:0 0 0 2px color-mix(in srgb, var(--khione-green) 55%, transparent) inset;}
.day-name{font-size:.82rem;font-weight:700;}
.day-icon{width:38px;height:38px;margin:.1rem 0;}
.day-range{width:100%;position:relative;height:16px;margin-top:.15rem;}
.day-range .track{position:absolute;left:0;right:0;top:7px;height:3px;border-radius:3px;background:var(--hairline);}
.day-range .seg{position:absolute;top:5px;height:7px;border-radius:5px;}
.day-range .now-dot{position:absolute;top:2px;width:10px;height:10px;border-radius:50%;background:var(--khione-green);border:2px solid var(--card-bg);transform:translateX(-50%);}
.day-hi{font-size:.84rem;font-weight:700;}
.day-lo{font-size:.78rem;color:var(--muted);}

/* ---------- responsive ---------- */
@media (max-width:760px){
  .hero{flex-direction:column;align-items:flex-start;text-align:left;}
  .week-grid{grid-template-columns:repeat(auto-fit,minmax(78px,1fr));}
  .radar-map{height:420px;}
}
@media (max-width:420px){
  .hero-temp{font-size:4rem;}
}

/* ---------- focus ---------- */
a:focus-visible,button:focus-visible{outline:2px solid var(--khione-green);outline-offset:2px;}
`;

// ---------------------------------------------------------------------------
// LEAFLET_CSS — verbatim from the mockup's inline <style id="leaflet-css">
// block. Kept inlined (not a <link>) per the task brief: that copy is
// already proven working and there is no reason to add a second request.
// ---------------------------------------------------------------------------
const LEAFLET_CSS = `
/* required styles */

.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas,
.leaflet-zoom-box,
.leaflet-image-layer,
.leaflet-layer {
	position: absolute;
	left: 0;
	top: 0;
	}
.leaflet-container {
	overflow: hidden;
	}
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
	-webkit-user-select: none;
	   -moz-user-select: none;
	        user-select: none;
	  -webkit-user-drag: none;
	}
/* Prevents IE11 from highlighting tiles in blue */
.leaflet-tile::selection {
	background: transparent;
}
/* Safari renders non-retina tile on retina better with this, but Chrome is worse */
.leaflet-safari .leaflet-tile {
	image-rendering: -webkit-optimize-contrast;
	}
/* hack that prevents hw layers "stretching" when loading new tiles */
.leaflet-safari .leaflet-tile-container {
	width: 1600px;
	height: 1600px;
	-webkit-transform-origin: 0 0;
	}
.leaflet-marker-icon,
.leaflet-marker-shadow {
	display: block;
	}
/* .leaflet-container svg: reset svg max-width decleration shipped in Joomla! (joomla.org) 3.x */
/* .leaflet-container img: map is broken in FF if you have max-width: 100% on tiles */
.leaflet-container .leaflet-overlay-pane svg {
	max-width: none !important;
	max-height: none !important;
	}
.leaflet-container .leaflet-marker-pane img,
.leaflet-container .leaflet-shadow-pane img,
.leaflet-container .leaflet-tile-pane img,
.leaflet-container img.leaflet-image-layer,
.leaflet-container .leaflet-tile {
	max-width: none !important;
	max-height: none !important;
	width: auto;
	padding: 0;
	}

.leaflet-container img.leaflet-tile {
	/* See: https://bugs.chromium.org/p/chromium/issues/detail?id=600120 */
	mix-blend-mode: plus-lighter;
}

.leaflet-container.leaflet-touch-zoom {
	-ms-touch-action: pan-x pan-y;
	touch-action: pan-x pan-y;
	}
.leaflet-container.leaflet-touch-drag {
	-ms-touch-action: pinch-zoom;
	/* Fallback for FF which doesn't support pinch-zoom */
	touch-action: none;
	touch-action: pinch-zoom;
}
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {
	-ms-touch-action: none;
	touch-action: none;
}
.leaflet-container {
	-webkit-tap-highlight-color: transparent;
}
.leaflet-container a {
	-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);
}
.leaflet-tile {
	filter: inherit;
	visibility: hidden;
	}
.leaflet-tile-loaded {
	visibility: inherit;
	}
.leaflet-zoom-box {
	width: 0;
	height: 0;
	-moz-box-sizing: border-box;
	     box-sizing: border-box;
	z-index: 800;
	}
/* workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=888319 */
.leaflet-overlay-pane svg {
	-moz-user-select: none;
	}

.leaflet-pane         { z-index: 400; }

.leaflet-tile-pane    { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane  { z-index: 500; }
.leaflet-marker-pane  { z-index: 600; }
.leaflet-tooltip-pane   { z-index: 650; }
.leaflet-popup-pane   { z-index: 700; }

.leaflet-map-pane canvas { z-index: 100; }
.leaflet-map-pane svg    { z-index: 200; }

.leaflet-vml-shape {
	width: 1px;
	height: 1px;
	}
.lvml {
	behavior: url(#default#VML);
	display: inline-block;
	position: absolute;
	}


/* control positioning */

.leaflet-control {
	position: relative;
	z-index: 800;
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */
	pointer-events: auto;
	}
.leaflet-top,
.leaflet-bottom {
	position: absolute;
	z-index: 1000;
	pointer-events: none;
	}
.leaflet-top {
	top: 0;
	}
.leaflet-right {
	right: 0;
	}
.leaflet-bottom {
	bottom: 0;
	}
.leaflet-left {
	left: 0;
	}
.leaflet-control {
	float: left;
	clear: both;
	}
.leaflet-right .leaflet-control {
	float: right;
	}
.leaflet-top .leaflet-control {
	margin-top: 10px;
	}
.leaflet-bottom .leaflet-control {
	margin-bottom: 10px;
	}
.leaflet-left .leaflet-control {
	margin-left: 10px;
	}
.leaflet-right .leaflet-control {
	margin-right: 10px;
	}


/* zoom and fade animations */

.leaflet-fade-anim .leaflet-popup {
	opacity: 0;
	-webkit-transition: opacity 0.2s linear;
	   -moz-transition: opacity 0.2s linear;
	        transition: opacity 0.2s linear;
	}
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup {
	opacity: 1;
	}
.leaflet-zoom-animated {
	-webkit-transform-origin: 0 0;
	    -ms-transform-origin: 0 0;
	        transform-origin: 0 0;
	}
svg.leaflet-zoom-animated {
	will-change: transform;
}

.leaflet-zoom-anim .leaflet-zoom-animated {
	-webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);
	   -moz-transition:    -moz-transform 0.25s cubic-bezier(0,0,0.25,1);
	        transition:         transform 0.25s cubic-bezier(0,0,0.25,1);
	}
.leaflet-zoom-anim .leaflet-tile,
.leaflet-pan-anim .leaflet-tile {
	-webkit-transition: none;
	   -moz-transition: none;
	        transition: none;
	}

.leaflet-zoom-anim .leaflet-zoom-hide {
	visibility: hidden;
	}


/* cursors */

.leaflet-interactive {
	cursor: pointer;
	}
.leaflet-grab {
	cursor: -webkit-grab;
	cursor:    -moz-grab;
	cursor:         grab;
	}
.leaflet-crosshair,
.leaflet-crosshair .leaflet-interactive {
	cursor: crosshair;
	}
.leaflet-popup-pane,
.leaflet-control {
	cursor: auto;
	}
.leaflet-dragging .leaflet-grab,
.leaflet-dragging .leaflet-grab .leaflet-interactive,
.leaflet-dragging .leaflet-marker-draggable {
	cursor: move;
	cursor: -webkit-grabbing;
	cursor:    -moz-grabbing;
	cursor:         grabbing;
	}

/* marker & overlays interactivity */
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-image-layer,
.leaflet-pane > svg path,
.leaflet-tile-container {
	pointer-events: none;
	}

.leaflet-marker-icon.leaflet-interactive,
.leaflet-image-layer.leaflet-interactive,
.leaflet-pane > svg path.leaflet-interactive,
svg.leaflet-image-layer.leaflet-interactive path {
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */
	pointer-events: auto;
	}

/* visual tweaks */

.leaflet-container {
	background: #ddd;
	outline-offset: 1px;
	}
.leaflet-container a {
	color: #0078A8;
	}
.leaflet-zoom-box {
	border: 2px dotted #38f;
	background: rgba(255,255,255,0.5);
	}


/* general typography */
.leaflet-container {
	font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
	font-size: 12px;
	font-size: 0.75rem;
	line-height: 1.5;
	}


/* general toolbar styles */

.leaflet-bar {
	box-shadow: 0 1px 5px rgba(0,0,0,0.65);
	border-radius: 4px;
	}
.leaflet-bar a {
	background-color: #fff;
	border-bottom: 1px solid #ccc;
	width: 26px;
	height: 26px;
	line-height: 26px;
	display: block;
	text-align: center;
	text-decoration: none;
	color: black;
	}
.leaflet-bar a,
.leaflet-control-layers-toggle {
	background-position: 50% 50%;
	background-repeat: no-repeat;
	display: block;
	}
.leaflet-bar a:hover,
.leaflet-bar a:focus {
	background-color: #f4f4f4;
	}
.leaflet-bar a:first-child {
	border-top-left-radius: 4px;
	border-top-right-radius: 4px;
	}
.leaflet-bar a:last-child {
	border-bottom-left-radius: 4px;
	border-bottom-right-radius: 4px;
	border-bottom: none;
	}
.leaflet-bar a.leaflet-disabled {
	cursor: default;
	background-color: #f4f4f4;
	color: #bbb;
	}

.leaflet-touch .leaflet-bar a {
	width: 30px;
	height: 30px;
	line-height: 30px;
	}
.leaflet-touch .leaflet-bar a:first-child {
	border-top-left-radius: 2px;
	border-top-right-radius: 2px;
	}
.leaflet-touch .leaflet-bar a:last-child {
	border-bottom-left-radius: 2px;
	border-bottom-right-radius: 2px;
	}

/* zoom control */

.leaflet-control-zoom-in,
.leaflet-control-zoom-out {
	font: bold 18px 'Lucida Console', Monaco, monospace;
	text-indent: 1px;
	}

.leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out  {
	font-size: 22px;
	}


/* layers control */

.leaflet-control-layers {
	box-shadow: 0 1px 5px rgba(0,0,0,0.4);
	background: #fff;
	border-radius: 5px;
	}
.leaflet-control-layers-toggle {
	background-image: url(images/layers.png);
	width: 36px;
	height: 36px;
	}
.leaflet-retina .leaflet-control-layers-toggle {
	background-image: url(images/layers-2x.png);
	background-size: 26px 26px;
	}
.leaflet-touch .leaflet-control-layers-toggle {
	width: 44px;
	height: 44px;
	}
.leaflet-control-layers .leaflet-control-layers-list,
.leaflet-control-layers-expanded .leaflet-control-layers-toggle {
	display: none;
	}
.leaflet-control-layers-expanded .leaflet-control-layers-list {
	display: block;
	position: relative;
	}
.leaflet-control-layers-expanded {
	padding: 6px 10px 6px 6px;
	color: #333;
	background: #fff;
	}
.leaflet-control-layers-scrollbar {
	overflow-y: scroll;
	overflow-x: hidden;
	padding-right: 5px;
	}
.leaflet-control-layers-selector {
	margin-top: 2px;
	position: relative;
	top: 1px;
	}
.leaflet-control-layers label {
	display: block;
	font-size: 13px;
	font-size: 1.08333em;
	}
.leaflet-control-layers-separator {
	height: 0;
	border-top: 1px solid #ddd;
	margin: 5px -10px 5px -6px;
	}

/* Default icon URLs */
.leaflet-default-icon-path { /* used only in path-guessing heuristic, see L.Icon.Default */
	background-image: url(images/marker-icon.png);
	}


/* attribution and scale controls */

.leaflet-container .leaflet-control-attribution {
	background: #fff;
	background: rgba(255, 255, 255, 0.8);
	margin: 0;
	}
.leaflet-control-attribution,
.leaflet-control-scale-line {
	padding: 0 5px;
	color: #333;
	line-height: 1.4;
	}
.leaflet-control-attribution a {
	text-decoration: none;
	}
.leaflet-control-attribution a:hover,
.leaflet-control-attribution a:focus {
	text-decoration: underline;
	}
.leaflet-attribution-flag {
	display: inline !important;
	vertical-align: baseline !important;
	width: 1em;
	height: 0.6669em;
	}
.leaflet-left .leaflet-control-scale {
	margin-left: 5px;
	}
.leaflet-bottom .leaflet-control-scale {
	margin-bottom: 5px;
	}
.leaflet-control-scale-line {
	border: 2px solid #777;
	border-top: none;
	line-height: 1.1;
	padding: 2px 5px 1px;
	white-space: nowrap;
	-moz-box-sizing: border-box;
	     box-sizing: border-box;
	background: rgba(255, 255, 255, 0.8);
	text-shadow: 1px 1px #fff;
	}
.leaflet-control-scale-line:not(:first-child) {
	border-top: 2px solid #777;
	border-bottom: none;
	margin-top: -2px;
	}
.leaflet-control-scale-line:not(:first-child):not(:last-child) {
	border-bottom: 2px solid #777;
	}

.leaflet-touch .leaflet-control-attribution,
.leaflet-touch .leaflet-control-layers,
.leaflet-touch .leaflet-bar {
	box-shadow: none;
	}
.leaflet-touch .leaflet-control-layers,
.leaflet-touch .leaflet-bar {
	border: 2px solid rgba(0,0,0,0.2);
	background-clip: padding-box;
	}


/* popup */

.leaflet-popup {
	position: absolute;
	text-align: center;
	margin-bottom: 20px;
	}
.leaflet-popup-content-wrapper {
	padding: 1px;
	text-align: left;
	border-radius: 12px;
	}
.leaflet-popup-content {
	margin: 13px 24px 13px 20px;
	line-height: 1.3;
	font-size: 13px;
	font-size: 1.08333em;
	min-height: 1px;
	}
.leaflet-popup-content p {
	margin: 17px 0;
	margin: 1.3em 0;
	}
.leaflet-popup-tip-container {
	width: 40px;
	height: 20px;
	position: absolute;
	left: 50%;
	margin-top: -1px;
	margin-left: -20px;
	overflow: hidden;
	pointer-events: none;
	}
.leaflet-popup-tip {
	width: 17px;
	height: 17px;
	padding: 1px;

	margin: -10px auto 0;
	pointer-events: auto;

	-webkit-transform: rotate(45deg);
	   -moz-transform: rotate(45deg);
	    -ms-transform: rotate(45deg);
	        transform: rotate(45deg);
	}
.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
	background: white;
	color: #333;
	box-shadow: 0 3px 14px rgba(0,0,0,0.4);
	}
.leaflet-container a.leaflet-popup-close-button {
	position: absolute;
	top: 0;
	right: 0;
	border: none;
	text-align: center;
	width: 24px;
	height: 24px;
	font: 16px/24px Tahoma, Verdana, sans-serif;
	color: #757575;
	text-decoration: none;
	background: transparent;
	}
.leaflet-container a.leaflet-popup-close-button:hover,
.leaflet-container a.leaflet-popup-close-button:focus {
	color: #585858;
	}
.leaflet-popup-scrolled {
	overflow: auto;
	}

.leaflet-oldie .leaflet-popup-content-wrapper {
	-ms-zoom: 1;
	}
.leaflet-oldie .leaflet-popup-tip {
	width: 24px;
	margin: 0 auto;

	-ms-filter: "progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)";
	filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);
	}

.leaflet-oldie .leaflet-control-zoom,
.leaflet-oldie .leaflet-control-layers,
.leaflet-oldie .leaflet-popup-content-wrapper,
.leaflet-oldie .leaflet-popup-tip {
	border: 1px solid #999;
	}


/* div icon */

.leaflet-div-icon {
	background: #fff;
	border: 1px solid #666;
	}


/* Tooltip */
/* Base styles for the element that has a tooltip */
.leaflet-tooltip {
	position: absolute;
	padding: 6px;
	background-color: #fff;
	border: 1px solid #fff;
	border-radius: 3px;
	color: #222;
	white-space: nowrap;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
	pointer-events: none;
	box-shadow: 0 1px 3px rgba(0,0,0,0.4);
	}
.leaflet-tooltip.leaflet-interactive {
	cursor: pointer;
	pointer-events: auto;
	}
.leaflet-tooltip-top:before,
.leaflet-tooltip-bottom:before,
.leaflet-tooltip-left:before,
.leaflet-tooltip-right:before {
	position: absolute;
	pointer-events: none;
	border: 6px solid transparent;
	background: transparent;
	content: "";
	}

/* Directions */

.leaflet-tooltip-bottom {
	margin-top: 6px;
}
.leaflet-tooltip-top {
	margin-top: -6px;
}
.leaflet-tooltip-bottom:before,
.leaflet-tooltip-top:before {
	left: 50%;
	margin-left: -6px;
	}
.leaflet-tooltip-top:before {
	bottom: 0;
	margin-bottom: -12px;
	border-top-color: #fff;
	}
.leaflet-tooltip-bottom:before {
	top: 0;
	margin-top: -12px;
	margin-left: -6px;
	border-bottom-color: #fff;
	}
.leaflet-tooltip-left {
	margin-left: -6px;
}
.leaflet-tooltip-right {
	margin-left: 6px;
}
.leaflet-tooltip-left:before,
.leaflet-tooltip-right:before {
	top: 50%;
	margin-top: -6px;
	}
.leaflet-tooltip-left:before {
	right: 0;
	margin-right: -12px;
	border-left-color: #fff;
	}
.leaflet-tooltip-right:before {
	left: 0;
	margin-left: -12px;
	border-right-color: #fff;
	}

/* Printing */

@media print {
	/* Prevent printers from removing background-images of controls. */
	.leaflet-control {
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
		}
	}
`;

// ---------------------------------------------------------------------------
// PAGE_SHELL_HTML — verbatim markup from the mockup: the icon-defs <svg>
// (every hand-drawn icon <path> kept byte-for-byte) plus everything inside
// <div class="page">. Sample/placeholder text content (hero temp, dates,
// metric values, hourly/week grids) is overwritten by _renderLiveData() —
// it is left here exactly as in the mockup only so the shell has real
// layout to paint before the first live render.
// ---------------------------------------------------------------------------
const PAGE_SHELL_HTML = `
<svg class="icon-defs" aria-hidden="true">
<defs>
  <path id="i-sun-core" d="M24,14.5 C19.5,14.2 16,17.8 15.6,22.3 C15.2,26.8 18.4,30.8 22.9,31.4 C27.6,32 32,28.4 32.4,23.7 C32.8,19.3 29.3,15.4 24.8,14.6 C24.5,14.5 24.2,14.5 24,14.5 Z"/>
  <g id="i-rays" stroke-width="2.6" stroke-linecap="round">
    <path d="M24,9 L24,3.4"/>
    <path d="M30.3,10.9 L33.7,6.1"/>
    <path d="M35.4,16.9 L40.7,14.3"/>
    <path d="M36.7,24.4 L42.2,25.2"/>
    <path d="M34,31 L38.2,35"/>
    <path d="M24,33.9 L24.7,39.7"/>
    <path d="M16.4,31.7 L12.6,36.2"/>
    <path d="M13.2,22.6 L7.1,21.9"/>
  </g>
  <path id="i-cloud" d="M10,33.5 C4.3,33.5 1.4,28.6 5.3,25.1 C3.4,19.8 8.3,14.9 14.1,16.3 C16.3,11.2 24,9.7 28.6,14.1 C34.4,12.1 40.7,16.8 38.8,22.6 C43.9,23.2 44.9,29.6 39.7,32.4 C38.6,33.4 37.4,33.5 36.2,33.5 Z"/>
  <path id="i-moon-body" d="M24,8.5 C17.4,8.3 12.1,13.9 12.4,20.4 C12.7,26.9 18.3,32.1 24.8,31.8 C30.5,31.5 35.2,27.2 35.6,21.6 C36.1,15.4 30.9,8.8 24,8.5 Z"/>
  <path id="i-moon-cut" d="M29.2,11.2 C24.6,11 20.7,14.5 20.9,19 C21.1,23.5 25.2,27 29.7,26.6 C33.9,26.3 37.1,22.6 36.7,18.3 C36.3,13.7 32.6,11.4 29.2,11.2 Z"/>
  <path id="i-drop" viewBox="0 0 12 18" d="M6,0 C9,5 11,9.2 9,13 C7.7,15.5 4.3,15.5 3,13 C1,9.2 3,5 6,0 Z"/>
  <g id="i-flake" stroke-width="1.7" stroke-linecap="round">
    <path d="M7,1.3 L7,12.4"/>
    <path d="M1.8,4 L12.2,10"/>
    <path d="M12.2,4 L1.8,10"/>
  </g>
  <path id="i-pin" d="M12,0 C5.4,0 0,5.3 0,11.8 C0,20.6 12,34 12,34 C12,34 24,20.6 24,11.8 C24,5.3 18.6,0 12,0 Z M12,17 C8.7,17 6,14.3 6,11 C6,7.7 8.7,5 12,5 C15.3,5 18,7.7 18,11 C18,14.3 15.3,17 12,17 Z"/>
</defs>
</svg>

<div class="page">

<header class="topband">
  <div class="topband-inner">
    <div class="topband-title">Weather</div>
    <div class="topband-right">
      <div class="topband-meta mono-num" id="topband-meta">&nbsp;</div>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
        <svg id="theme-toggle-icon" viewBox="0 0 48 48" aria-hidden="true"></svg>
      </button>
    </div>
  </div>
</header>

<main>

  <div class="room top-row">
  <!-- HERO -->
  <section class="hero" aria-label="Current conditions">
    <div class="hero-clouds" aria-hidden="true">
      <svg class="c1" viewBox="0 0 48 48"><use href="#i-cloud" fill="#fefae0" opacity=".6"/></svg>
      <svg class="c2" viewBox="0 0 48 48"><use href="#i-cloud" fill="#fefae0" opacity=".5"/></svg>
    </div>
    <div class="hero-icon-wrap">
      <div class="blob" style="background:rgba(254,250,224,.35);"></div>
      <svg viewBox="0 0 48 48" id="hero-icon-svg">
        <g transform="translate(5,-5) scale(0.82)">
          <use href="#i-rays" stroke="#c9a23d"/>
          <use href="#i-sun-core" fill="#a9693a"/>
        </g>
        <g transform="translate(1,7) scale(1.02)">
          <use href="#i-cloud" fill="#fefae0" stroke="#4d3014" stroke-width="1.6"/>
        </g>
      </svg>
    </div>
    <div class="hero-main">
      <div class="hero-place" id="hero-place">&nbsp;</div>
      <div class="hero-date mono-num" id="hero-date">&nbsp;</div>
      <div class="hero-temp-row">
        <div class="hero-temp mono-num" id="hero-temp">&mdash;</div>
        <div class="hero-cond">
          <div class="hero-cond-text" id="hero-cond-text">&nbsp;</div>
          <div class="hero-feels mono-num" id="hero-feels">&nbsp;</div>
          <div class="hero-hilo mono-num"><span id="hero-hi">H: &mdash;</span><span id="hero-lo">L: &mdash;</span></div>
        </div>
      </div>
      <div class="hero-note" id="hero-note">&nbsp;</div>
    </div>
  </section>

  <!-- SUN ARC -->
  <section class="card" aria-label="Sunrise to sunset">
    <div class="card-head">
      <h2 class="card-title">Sun &amp; sky</h2>
      <span class="card-sub mono-num" id="daylight-duration">&nbsp;</span>
    </div>
    <div class="arc-wrap">
      <svg viewBox="0 0 400 120" id="arc-svg">
        <defs>
          <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#40c4db"/>
            <stop offset="50%" stop-color="#c9a23d"/>
            <stop offset="100%" stop-color="#a9693a"/>
          </linearGradient>
        </defs>
        <line x1="20" y1="100" x2="380" y2="100" stroke="var(--hairline)" stroke-width="1.5" stroke-dasharray="2 4"/>
        <path d="M30,100 C30,58.6 106.1,25 200,25 C293.9,25 370,58.6 370,100" fill="none" stroke="url(#arc-grad)" stroke-width="4" stroke-linecap="round"/>
        <!-- sunrise marker -->
        <g transform="translate(30,100)">
          <circle r="9" fill="var(--band-bg)"/>
          <g transform="translate(-6,-6) scale(0.5)"><use href="#i-sun-core" fill="var(--khione-yellow)"/></g>
        </g>
        <!-- sunset marker -->
        <g transform="translate(370,100)">
          <circle r="9" fill="var(--band-bg)"/>
          <g transform="translate(-6,-6) scale(0.5)"><use href="#i-sun-core" fill="var(--accent)"/></g>
        </g>
        <!-- current position marker (computed from live sunrise/sunset/now) -->
        <g id="arc-now-marker">
          <line id="arc-now-drop" stroke="var(--khione-green)" stroke-width="1.5" stroke-dasharray="2 3"/>
          <circle id="arc-now-halo" r="16" fill="var(--khione-green)" opacity=".22"/>
          <g id="arc-now-icon" transform="translate(-9,-9) scale(0.55)"><use href="#i-sun-core" fill="var(--khione-yellow)"/></g>
          <text id="arc-now-text" class="arc-now-label" text-anchor="middle">&nbsp;</text>
        </g>
      </svg>
      <div class="arc-foot">
        <span class="arc-endlabel mono-num" id="arc-sunrise-label">&nbsp;</span>
        <span class="arc-endlabel mono-num" id="arc-sunset-label">&nbsp;</span>
      </div>
    </div>
  </section>
  </div>

  <!-- LIVE RADAR -->
  <section class="room card" aria-label="Live rain radar">
    <div class="card-head">
      <h2 class="card-title">Live radar</h2>
      <span class="card-sub mono-num" id="radar-updated">loading latest frame&hellip;</span>
    </div>
    <div class="radar-wrap">
      <div class="radar-map" id="radar-map"></div>
      <div class="radar-overlay-ui">
        <div class="radar-badge"><span class="radar-live-dot" aria-hidden="true"></span> Live &middot; RainViewer radar</div>
        <button class="radar-play" id="radar-play" type="button" aria-pressed="true">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" id="radar-play-icon"><rect x="1" y="1" width="3.2" height="10" rx="1" fill="currentColor"/><rect x="7.2" y="1" width="3.2" height="10" rx="1" fill="currentColor"/></svg>
          <span id="radar-play-label">Pause</span>
        </button>
      </div>
      <div class="radar-legend" aria-hidden="true">
        <div class="radar-legend-row"><span class="radar-legend-swatch" style="background:#6fb7d9"></span> Light</div>
        <div class="radar-legend-row"><span class="radar-legend-swatch" style="background:#3f8f5c"></span> Moderate</div>
        <div class="radar-legend-row"><span class="radar-legend-swatch" style="background:#c9833d"></span> Heavy</div>
      </div>
    </div>
    <div class="radar-foot">
      <input type="range" class="radar-scrub" id="radar-scrub" min="0" max="0" value="0" step="1" aria-label="Scrub radar frame">
      <span class="mono-num" id="radar-frame-label">&mdash;</span>
    </div>
    <div class="radar-note" id="radar-note">&nbsp;</div>
  </section>

  <!-- METRICS -->
  <section class="room" aria-label="Supporting conditions">
    <div class="metrics-grid">
      <div class="metric">
        <div class="blob blob-green"></div>
        <div class="metric-icon"><svg viewBox="0 0 24 40"><path d="M9,4 C9,2 10.5,0.5 12,0.5 C13.5,0.5 15,2 15,4 L15,24 C17.6,25.4 19.1,28.5 18.4,31.5 C17.6,35.9 13.6,38.8 9.4,37.7 C5.7,36.8 3.2,33.1 4.1,29.3 C4.7,26.6 6.6,24.4 9,23.6 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.3"/><line x1="12" y1="6" x2="12" y2="24" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg></div>
        <div><div class="metric-val mono-num">&mdash;</div><div class="metric-label">Feels like</div></div>
      </div>
      <div class="metric">
        <div class="blob blob-sage"></div>
        <div class="metric-icon"><svg viewBox="0 0 12 18"><use href="#i-drop" fill="var(--khione-blue)" transform="scale(2.6) translate(0,1)"/></svg></div>
        <div><div class="metric-val mono-num">&mdash;</div><div class="metric-label">Humidity</div></div>
      </div>
      <div class="metric">
        <div class="blob blob-soft"></div>
        <div class="metric-icon"><svg viewBox="0 0 48 24"><g fill="none" stroke="var(--accent)" stroke-width="2.3" stroke-linecap="round"><path d="M3,8 C10,2 16,13 23,7 C28,2.5 33,6 36,8.5"/><path d="M2,16 C8,11 14,20 21,15 C25,11.8 29,14 31,16"/></g><circle cx="37" cy="8" r="1.6" fill="var(--accent)"/></svg></div>
        <div><div class="metric-val mono-num">&mdash;</div><div class="metric-label">Wind</div></div>
      </div>
      <div class="metric">
        <div class="blob blob-green"></div>
        <div class="metric-icon"><svg viewBox="0 0 48 48"><g transform="scale(0.72) translate(9,9)"><use href="#i-rays" stroke="var(--khione-yellow)"/><use href="#i-sun-core" fill="var(--accent-soft)"/></g></svg></div>
        <div><div class="metric-val mono-num">&mdash;</div><div class="metric-label">UV index</div></div>
      </div>
      <div class="metric">
        <div class="blob blob-sage"></div>
        <div class="metric-icon"><svg viewBox="0 0 48 48"><g transform="translate(2,1) scale(0.82)"><use href="#i-cloud" fill="var(--band-bg)" stroke="var(--accent)" stroke-width="1.6"/></g><use href="#i-drop" fill="var(--khione-blue)" transform="translate(27,27) scale(1.1)"/></svg></div>
        <div><div class="metric-val mono-num">&mdash;</div><div class="metric-label">Chance of rain</div></div>
      </div>
      <div class="metric">
        <div class="blob blob-soft"></div>
        <div class="metric-icon"><svg viewBox="0 0 40 24"><path d="M4,22 C4,11.5 11.6,3.5 20,3.5 C28.4,3.5 36,11.5 36,22" fill="none" stroke="var(--accent)" stroke-width="2.3" stroke-linecap="round"/><line x1="20" y1="22" x2="27" y2="9.5" stroke="var(--khione-green)" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="22" r="2.4" fill="var(--accent)"/></svg></div>
        <div><div class="metric-val mono-num">&mdash;</div><div class="metric-label">Pressure &middot; rising</div></div>
      </div>
    </div>
  </section>

  <!-- HOURLY -->
  <section class="room card" aria-label="Hourly forecast">
    <div class="card-head">
      <h2 class="card-title">Next 12 hours</h2>
      <span class="card-sub mono-num" id="hourly-sub">&nbsp;</span>
    </div>
    <div class="hourly-scroll">
      <div class="hourly-inner" id="hourly-inner"></div>
    </div>
  </section>

  <!-- WEEK -->
  <section class="room card" aria-label="7-day forecast">
    <div class="card-head">
      <h2 class="card-title">7-day outlook</h2>
      <span class="card-sub mono-num" id="week-sub">&nbsp;</span>
    </div>
    <div class="week-grid" id="week-grid"></div>
  </section>

</main>
</div>
`;

// ---------------------------------------------------------------------------
// Live-data helpers
// ---------------------------------------------------------------------------

// HA's weather condition enum has only one night-specific value
// ("clear-night"); "cloudy-night"/"rain-night" are mockup-only icon
// flavours, so we derive night-ness ourselves from sunrise/sunset minutes.
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

function conditionToIcon(condition, isNight) {
  switch (condition) {
    case "clear-night":
      return "clear-night";
    case "sunny":
      return isNight ? "clear-night" : "sun";
    case "partlycloudy":
      return isNight ? "cloudy-night" : "partly-cloudy";
    case "cloudy":
    case "fog":
    case "windy":
    case "windy-variant":
    case "exceptional":
      return "cloudy";
    case "rainy":
    case "pouring":
    case "lightning":
    case "lightning-rainy":
      return isNight ? "rain-night" : "rain";
    case "snowy":
    case "snowy-rainy":
    case "hail":
      return "sleet";
    default:
      return "cloudy";
  }
}

function parseSunTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function nowMinutes(d) {
  d = d || new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function fmtHM(mins) {
  if (mins == null || isNaN(mins)) return "—";
  mins = Math.round(mins) % 1440;
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function fmtDuration(mins) {
  if (mins == null || isNaN(mins) || mins < 0) return "—";
  mins = Math.round(mins);
  return Math.floor(mins / 60) + "h " + (mins % 60) + "m";
}

function fmtTime(d) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function fmtDateLine(d) {
  try {
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  } catch (e) {
    return "—";
  }
}

function fmtDeg(value) {
  return value == null || isNaN(value) ? "—" : Math.round(value) + "°";
}

function bearingToCompass(deg) {
  if (deg == null || isNaN(deg)) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function uvLabel(uv) {
  if (uv == null || isNaN(uv)) return "";
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function isNightAt(date, sunriseMin, sunsetMin) {
  if (sunriseMin == null || sunsetMin == null) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins < sunriseMin || mins > sunsetMin;
}

// ---- hand-drawn icon markup (pure functions, verbatim logic from the
// mockup's iconMarkup/dropRow/starField/weatherSVG helpers) ----
function dropRow(xs, y) {
  return xs
    .map(function (x, i) {
      return '<use href="#i-drop" class="drop-fill" transform="translate(' + (x - 3) + "," + (y + (i % 2 ? 3 : 0)) + ') scale(0.95)"/>';
    })
    .join("");
}
function starField(n) {
  const pts = [
    [8, 10, 0.9],
    [38, 13, 0.7],
    [33, 30, 0.6],
    [6, 26, 0.5],
  ];
  return pts
    .slice(0, n || pts.length)
    .map(function (p) {
      return '<circle class="star-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="1.2" opacity="' + p[2] + '"/>';
    })
    .join("");
}
function iconMarkup(type) {
  switch (type) {
    case "sun":
      return '<g class="sun-ray" transform="translate(0,0)"><use href="#i-rays"/></g><use href="#i-sun-core" class="sun-body"/>';
    case "partly-cloudy":
      return (
        '<g transform="translate(5,-5) scale(0.82)"><use href="#i-rays" class="sun-ray"/><use href="#i-sun-core" class="sun-body"/></g>' +
        '<g transform="translate(0,7)"><use href="#i-cloud" class="cloud-fill cloud-line" stroke-width="1.6"/></g>'
      );
    case "cloudy":
      return (
        '<g transform="translate(-3,-4) scale(0.68)" opacity=".85"><use href="#i-cloud" class="cloud-fill cloud-line" stroke-width="1.8"/></g>' +
        '<g transform="translate(4,6) scale(0.95)"><use href="#i-cloud" class="cloud-fill cloud-line" stroke-width="1.8"/></g>'
      );
    case "rain":
      return '<g transform="translate(2,-6) scale(0.85)"><use href="#i-cloud" class="cloud-fill cloud-line" stroke-width="1.7"/></g>' + dropRow([13, 24, 35], 30);
    case "sleet":
      return (
        '<g transform="translate(2,-6) scale(0.85)"><use href="#i-cloud" class="cloud-fill cloud-line" stroke-width="1.7"/></g>' +
        '<use href="#i-drop" class="drop-fill" transform="translate(13,30) scale(1.15)"/>' +
        '<g class="flake-line" transform="translate(20,34) scale(0.9)"><use href="#i-flake"/></g>' +
        '<g class="flake-line" transform="translate(30,30) scale(0.75)"><use href="#i-flake"/></g>'
      );
    case "clear-night":
      return '<use href="#i-moon-body" class="moon-body"/><use href="#i-moon-cut" class="moon-cut"/>' + starField();
    case "cloudy-night":
      return (
        '<g transform="translate(-2,-7) scale(0.72)" opacity=".9"><use href="#i-moon-body" class="moon-body"/><use href="#i-moon-cut" class="moon-cut"/></g>' +
        '<g transform="translate(3,8) scale(0.92)"><use href="#i-cloud" class="cloud-fill cloud-line" stroke-width="1.7"/></g>' +
        starField(2)
      );
    case "rain-night":
      return '<g transform="translate(2,-6) scale(0.85)"><use href="#i-cloud" fill="var(--muted)" class="cloud-line" stroke-width="1.7"/></g>' + dropRow([13, 24, 35], 30);
    default:
      return '<use href="#i-cloud" class="cloud-fill cloud-line"/>';
  }
}
function weatherSVG(type, extraClass) {
  return '<svg viewBox="0 0 48 48" class="wicon ' + (extraClass || "") + '">' + iconMarkup(type) + "</svg>";
}

const LEAFLET_SRC = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
// shortcut: RainViewer's 256px radar tiles only have real data up to zoom 7
// (confirmed live: every z>=8 request returns an identical "Zoom Level Not
// Supported" placeholder) — keep default ZOOM and maxNativeZoom at 7.
const DEFAULT_LAT = 54.3;
const DEFAULT_LON = -2.2;
const ZOOM = 7;

class KhioneWeatherPanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._rendered = false;
    this._leafletReady = false;
    this._radarInitialized = false;
    this._forecastSubscribed = false;
    this._hourlyForecast = null;
    this._dailyForecast = null;
    this._unsubHourly = null;
    this._unsubDaily = null;
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

  disconnectedCallback() {
    if (this._unsubHourly) {
      this._unsubHourly();
      this._unsubHourly = null;
    }
    if (this._unsubDaily) {
      this._unsubDaily();
      this._unsubDaily = null;
    }
    this._forecastSubscribed = false;
    if (this._radarRefreshInterval) {
      clearInterval(this._radarRefreshInterval);
      this._radarRefreshInterval = null;
    }
  }

  _render() {
    if (!this._hass) return;
    if (!this._rendered) {
      this._root.innerHTML = `${GOOGLE_FONTS_LINK_HTML}<style>${SHARED_TOKENS_CSS}${PAGE_CSS}${LEAFLET_CSS}</style>${PAGE_SHELL_HTML}`;
      initTheme(this);
      this._bindStaticHandlers();
      this._loadLeaflet();
      this._rendered = true;
    }
    this._maybeSubscribeForecasts();
    this._renderLiveData();
  }

  // Click handlers and other wiring that doesn't need live data.
  _bindStaticHandlers() {
    const btn = this._root.getElementById("theme-toggle");
    const icon = this._root.getElementById("theme-toggle-icon");
    const paintIcon = (theme) => {
      if (!icon) return;
      icon.innerHTML =
        theme === "dark"
          ? '<g transform="translate(5,-5) scale(0.82)"><use href="#i-rays" stroke="currentColor"/><use href="#i-sun-core" fill="currentColor"/></g>'
          : '<use href="#i-moon-body" fill="currentColor"/><use href="#i-moon-cut" fill="var(--band-bg)"/>';
    };
    paintIcon(this.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    if (btn) {
      btn.addEventListener("click", () => {
        const next = toggleTheme(this);
        paintIcon(next);
      });
    }
  }

  // Leaflet ships as a classic <script src>; innerHTML never executes
  // <script> tags (shadow DOM or not), so it has to be created and
  // appended programmatically — this runs once, in the one-time render
  // branch.
  _loadLeaflet() {
    const script = document.createElement("script");
    script.src = LEAFLET_SRC;
    script.onload = () => {
      this._leafletReady = true;
      this._tryInitRadar();
    };
    this._root.appendChild(script);
  }

  // Hourly/daily forecast arrays are not static attributes on modern HA —
  // subscribe once over the websocket and keep the latest arrays, re-
  // rendering whenever a new forecast push arrives.
  _maybeSubscribeForecasts() {
    if (this._forecastSubscribed) return;
    const hass = this._hass;
    if (!hass || !hass.connection || !hass.states["weather.home"]) return;
    this._forecastSubscribed = true;
    const entityId = "weather.home";
    hass.connection
      .subscribeMessage(
        (event) => {
          this._hourlyForecast = (event && event.forecast) || [];
          this._renderLiveData();
        },
        { type: "weather/subscribe_forecast", entity_id: entityId, forecast_type: "hourly" }
      )
      .then((unsub) => {
        this._unsubHourly = unsub;
      })
      .catch(() => {});
    hass.connection
      .subscribeMessage(
        (event) => {
          this._dailyForecast = (event && event.forecast) || [];
          this._renderLiveData();
        },
        { type: "weather/subscribe_forecast", entity_id: entityId, forecast_type: "daily" }
      )
      .then((unsub) => {
        this._unsubDaily = unsub;
      })
      .catch(() => {});
  }

  _tryInitRadar() {
    if (this._radarInitialized || !this._leafletReady || !this._hass) return;
    const zone = this._hass.states["zone.home"];
    const lat = (zone && zone.attributes && zone.attributes.latitude) ?? DEFAULT_LAT;
    const lon = (zone && zone.attributes && zone.attributes.longitude) ?? DEFAULT_LON;
    this._radarInitialized = true;
    this._initRadar(lat, lon);
  }

  // Live rain radar: real Leaflet map, real OpenStreetMap base tiles, real
  // live rain-radar tiles from RainViewer's free public API (no key
  // needed). Logic kept identical to the already-fixed mockup version:
  // ONE reused tile layer swapped per-frame via setUrl() (not one layer per
  // frame, which previously rate-limited RainViewer), maxNativeZoom:7.
  _initRadar(LAT, LON) {
    const root = this._root;
    const mapEl = root.getElementById("radar-map");
    if (typeof L === "undefined" || !mapEl) return;

    const map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([LAT, LON], ZOOM);

    // shortcut: NOT tile.openstreetmap.org -- OSM's own demo tile server
    // explicitly isn't meant for embedding in an app (their tile usage
    // policy blocks exactly this), confirmed live: it returned a 403
    // "Access blocked" tile across the whole map. CARTO's basemaps turned
    // out to require an API key too (confirmed live, second failed
    // attempt). Esri's "Canvas/World_Light_Gray_Base" tile service is
    // genuinely keyless -- verified with a direct HTTP request before
    // deploying this time, not assumed. Note the path order is
    // {z}/{y}/{x}, not {z}/{x}/{y} like most other providers.
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 12,
        minZoom: 5,
        attribution:
          "Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS community",
      }
    ).addTo(map);

    L.marker([LAT, LON], {
      icon: L.divIcon({
        className: "",
        html: '<svg viewBox="0 0 24 34" width="26" height="36"><use href="#i-pin" fill="#704d2c" stroke="#fefae0" stroke-width="1.2"/></svg>',
        iconSize: [26, 36],
        iconAnchor: [13, 34],
      }),
    }).addTo(map);

    let radarLayer = null;
    let frames = [];
    let activeIdx = -1;
    let playing = true;
    let timer = null;

    function tileUrlForFrame(frame) {
      return "https://tilecache.rainviewer.com" + frame.path + "/256/{z}/{x}/{y}/2/1_1.png";
    }

    function showFrame(idx) {
      if (!frames.length) return;
      idx = ((idx % frames.length) + frames.length) % frames.length;
      if (radarLayer) radarLayer.setUrl(tileUrlForFrame(frames[idx]));
      activeIdx = idx;
      const f = frames[idx];
      const d = new Date(f.time * 1000);
      const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      root.getElementById("radar-updated").textContent = (f.isForecast ? "forecast " : "observed ") + label;
      root.getElementById("radar-frame-label").textContent = label;
      const scrub = root.getElementById("radar-scrub");
      if (scrub) scrub.value = idx;
    }

    function tick() {
      showFrame(activeIdx + 1);
    }
    function startLoop() {
      stopLoop();
      timer = setInterval(tick, 900);
    }
    function stopLoop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    // RainViewer publishes a new frame roughly every 10 minutes. Fetching
    // the frame LIST once at page load and never again means a tab left
    // open for hours keeps looping the same, increasingly stale frames
    // forever -- individual tile images cache fine (confirmed live:
    // RainViewer sends cache-control: max-age=172800), but the list of
    // *which* frames to show still needs to be re-pulled periodically for
    // the radar to stay actually live.
    function refreshFrames() {
      return fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then((r) => r.json())
        .then((data) => {
          const past = (data.radar && data.radar.past) || [];
          const nowcast = (data.radar && data.radar.nowcast) || [];
          const all = past.concat(
            nowcast.map((f) => {
              f.isForecast = true;
              return f;
            })
          );
          if (!all.length) throw new Error("no frames");
          frames = all.slice(-(8 + nowcast.length));
          if (!radarLayer) {
            radarLayer = L.tileLayer(tileUrlForFrame(frames[frames.length - 1]), {
              opacity: 0.65,
              zIndex: 500,
              maxZoom: 12,
              maxNativeZoom: 7,
              minZoom: 5,
            }).addTo(map);
          }
          const scrub = root.getElementById("radar-scrub");
          if (scrub) scrub.max = frames.length - 1;
          showFrame(frames.length - 1);
        })
        .catch(() => {
          root.getElementById("radar-updated").textContent = "radar unavailable right now";
          const ui = mapEl.parentElement.querySelector(".radar-overlay-ui");
          if (ui) ui.style.display = "none";
          const foot = root.querySelector(".radar-foot");
          if (foot) foot.style.display = "none";
        });
    }

    refreshFrames().then(() => startLoop());
    this._radarRefreshInterval = setInterval(refreshFrames, 10 * 60 * 1000);

    const playBtn = root.getElementById("radar-play");
    const playLabel = root.getElementById("radar-play-label");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        playing = !playing;
        playLabel.textContent = playing ? "Pause" : "Play";
        playBtn.setAttribute("aria-pressed", String(playing));
        if (playing) startLoop();
        else stopLoop();
      });
    }
    const scrubEl = root.getElementById("radar-scrub");
    if (scrubEl) {
      scrubEl.addEventListener("input", () => {
        playing = false;
        stopLoop();
        playLabel.textContent = "Play";
        playBtn.setAttribute("aria-pressed", "false");
        showFrame(parseInt(scrubEl.value, 10) || 0);
      });
    }
  }

  // Maps every live hass value onto the shell painted above. Every
  // attribute read is defended with `??`/guards so a missing Met.no field
  // never throws and blanks the page.
  _renderLiveData() {
    const hass = this._hass;
    if (!hass) return;
    const root = this._root;
    const weather = hass.states["weather.home"];
    const sun = hass.states["sun.sun"];
    const zone = hass.states["zone.home"];
    const clothing = hass.states["sensor.khione_clothing_recommendation"];

    const now = new Date();
    const sunriseMin = sun ? parseSunTime(sun.attributes && sun.attributes.next_rising) : null;
    const sunsetMin = sun ? parseSunTime(sun.attributes && sun.attributes.next_setting) : null;
    const nowMin = nowMinutes(now);
    const haveArc = sunriseMin != null && sunsetMin != null && sunsetMin > sunriseMin;
    const dayFrac = haveArc ? Math.max(0, Math.min(1, (nowMin - sunriseMin) / (sunsetMin - sunriseMin))) : 0.5;
    const isDaytime = haveArc ? nowMin >= sunriseMin && nowMin <= sunsetMin : true;

    const placeName = (zone && zone.attributes && zone.attributes.friendly_name) ?? "—";
    root.getElementById("hero-place").textContent = placeName;
    root.getElementById("topband-meta").textContent = placeName + " · " + fmtDateLine(now);
    root.getElementById("hero-date").textContent = fmtDateLine(now) + " · " + fmtTime(now);

    const attrs = (weather && weather.attributes) || {};
    const condition = weather ? weather.state : null;
    const temp = attrs.temperature ?? null;
    root.getElementById("hero-temp").textContent = fmtDeg(temp);
    root.getElementById("hero-cond-text").textContent = conditionLabel(condition);
    root.getElementById("hero-feels").textContent = "Feels like " + fmtDeg(temp);

    const dailyToday = (this._dailyForecast && this._dailyForecast[0]) || null;
    root.getElementById("hero-hi").textContent = "H: " + fmtDeg(dailyToday ? dailyToday.temperature : null);
    root.getElementById("hero-lo").textContent = "L: " + fmtDeg(dailyToday ? dailyToday.templow : null);
    root.getElementById("hero-note").textContent = (clothing && clothing.state) ?? "—";

    // ---- sun arc ----
    root.getElementById("daylight-duration").textContent = haveArc ? fmtDuration(sunsetMin - sunriseMin) + " of daylight today" : "—";
    root.getElementById("arc-sunrise-label").textContent = "Sunrise " + fmtHM(sunriseMin);
    root.getElementById("arc-sunset-label").textContent = "Sunset " + fmtHM(sunsetMin);
    (function placeArcMarker() {
      const cx = 200,
        cy = 100,
        rx = 170,
        ry = 75;
      const angle = Math.PI * dayFrac;
      const x = cx - rx * Math.cos(angle);
      const y = cy - ry * Math.sin(angle);
      const marker = root.getElementById("arc-now-marker");
      if (!marker) return;
      marker.setAttribute("transform", "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ")");
      const drop = root.getElementById("arc-now-drop");
      drop.setAttribute("x1", 0);
      drop.setAttribute("y1", 0);
      drop.setAttribute("x2", 0);
      drop.setAttribute("y2", (100 - y).toFixed(1));
      root.getElementById("arc-now-text").setAttribute("y", -22);
      root.getElementById("arc-now-text").textContent = "now · " + fmtTime(now);
      root.getElementById("arc-now-icon").innerHTML = isDaytime
        ? '<use href="#i-sun-core" fill="var(--khione-yellow)"/>'
        : '<use href="#i-moon-body" fill="var(--band-ink)"/><use href="#i-moon-cut" fill="var(--card-bg)"/>';
    })();

    // ---- metrics (feels-like / humidity / wind / UV / rain-chance / pressure) ----
    const metricVals = root.querySelectorAll(".metrics-grid .metric-val");
    if (metricVals.length >= 6) {
      metricVals[0].textContent = fmtDeg(attrs.temperature);
      metricVals[1].textContent = attrs.humidity != null ? Math.round(attrs.humidity) + "%" : "—";
      const windUnit = attrs.wind_speed_unit ? " " + attrs.wind_speed_unit : "";
      metricVals[2].textContent =
        attrs.wind_speed != null ? Math.round(attrs.wind_speed) + windUnit + " " + bearingToCompass(attrs.wind_bearing) : "—";
      metricVals[3].textContent = attrs.uv_index != null ? Math.round(attrs.uv_index) + " · " + uvLabel(attrs.uv_index) : "—";
      metricVals[4].textContent = attrs.precipitation_probability != null ? Math.round(attrs.precipitation_probability) + "%" : "—";
      const pressureUnit = attrs.pressure_unit || "hPa";
      metricVals[5].textContent = attrs.pressure != null ? Math.round(attrs.pressure) + " " + pressureUnit : "—";
    }

    // ---- hourly strip (next 12 hourly forecast entries) ----
    const hourly = (this._hourlyForecast || []).slice(0, 12).map((f) => {
      const dt = new Date(f.datetime);
      const night = isNightAt(dt, sunriseMin, sunsetMin);
      return {
        t: fmtTime(dt),
        temp: Math.round(f.temperature),
        cond: conditionToIcon(f.condition, night),
      };
    });
    const hourlyInner = root.getElementById("hourly-inner");
    const hourlySub = root.getElementById("hourly-sub");
    if (!hourly.length) {
      hourlyInner.innerHTML = '<div class="hour-chip"><span class="hour-time mono-num">loading&hellip;</span></div>';
      hourlySub.textContent = "—";
    } else {
      const minT = Math.min.apply(null, hourly.map((h) => h.temp));
      const maxT = Math.max.apply(null, hourly.map((h) => h.temp));
      const span = maxT - minT || 1;
      const colW = 600 / 12;
      const pts = hourly.map((h, i) => ({ x: colW * i + colW / 2, y: 60 - ((h.temp - minT) / span) * 50 }));
      const lineStr = pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
      const areaStr = "M" + pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" L") + " L600,65 L0,65 Z";
      const chartSVG =
        '<svg class="hourly-chart" viewBox="0 0 600 68" preserveAspectRatio="none">' +
        '<defs><linearGradient id="hour-grad" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#c9a23d"/>' +
        '<stop offset="22%" stop-color="#d4a373"/>' +
        '<stop offset="45%" stop-color="#40c4db"/>' +
        '<stop offset="100%" stop-color="#40c4db"/>' +
        "</linearGradient></defs>" +
        '<path d="' + areaStr + '" fill="url(#hour-grad)" opacity=".14"/>' +
        '<polyline points="' + lineStr + '" fill="none" stroke="url(#hour-grad)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        pts
          .map((p, i) =>
            i === 0
              ? '<circle cx="' + p.x + '" cy="' + p.y + '" r="5.5" fill="var(--khione-green)" stroke="var(--card-bg)" stroke-width="2"/>'
              : '<circle cx="' + p.x + '" cy="' + p.y + '" r="2.6" fill="var(--accent)"/>'
          )
          .join("") +
        "</svg>";
      const chipsHTML =
        '<div class="hourly-row">' +
        hourly
          .map(
            (h, i) =>
              '<div class="hour-chip' +
              (i === 0 ? " now" : "") +
              '">' +
              '<span class="hour-time mono-num">' +
              (i === 0 ? "now" : h.t) +
              "</span>" +
              weatherSVG(h.cond, "hour-icon") +
              '<span class="hour-temp mono-num">' +
              h.temp +
              "°</span>" +
              "</div>"
          )
          .join("") +
        "</div>";
      hourlyInner.innerHTML = chartSVG + chipsHTML;
      hourlySub.textContent = fmtDeg(hourly[0].temp) + " now → " + fmtDeg(hourly[hourly.length - 1].temp) + " by " + hourly[hourly.length - 1].t;
    }

    // ---- 7-day outlook ----
    const week = (this._dailyForecast || []).slice(0, 7).map((f, i) => ({
      d: new Date(f.datetime).toLocaleDateString(undefined, { weekday: "short" }),
      hi: f.temperature,
      lo: f.templow,
      cond: conditionToIcon(f.condition, false),
      today: i === 0,
    }));
    const weekGrid = root.getElementById("week-grid");
    const weekSub = root.getElementById("week-sub");
    if (!week.length) {
      weekGrid.innerHTML = "";
      weekSub.textContent = "—";
    } else {
      const los = week.map((d) => d.lo).filter((v) => v != null);
      const his = week.map((d) => d.hi).filter((v) => v != null);
      const weekMin = los.length ? Math.min.apply(null, los) : 0;
      const weekMax = his.length ? Math.max.apply(null, his) : 1;
      const weekSpan = weekMax - weekMin || 1;
      const todayNow = temp;
      weekGrid.innerHTML = week
        .map((d) => {
          const left = d.lo != null ? ((d.lo - weekMin) / weekSpan) * 100 : 0;
          const right = d.hi != null ? ((d.hi - weekMin) / weekSpan) * 100 : 0;
          const nowDot =
            d.today && todayNow != null
              ? '<div class="now-dot" style="left:' + (((todayNow - weekMin) / weekSpan) * 100).toFixed(1) + '%"></div>'
              : "";
          return (
            '<div class="day' +
            (d.today ? " today" : "") +
            '">' +
            '<div class="day-name">' +
            d.d +
            "</div>" +
            weatherSVG(d.cond, "day-icon") +
            '<div class="day-range">' +
            '<div class="track"></div>' +
            '<div class="seg" style="left:' + left.toFixed(1) + "%; width:" + Math.max(0, right - left).toFixed(1) + '%; background:linear-gradient(90deg,#40c4db,#c9a23d);"></div>' +
            nowDot +
            "</div>" +
            '<div class="day-hi mono-num">' + fmtDeg(d.hi) + "</div>" +
            '<div class="day-lo mono-num">' + fmtDeg(d.lo) + "</div>" +
            "</div>"
          );
        })
        .join("");
      weekSub.textContent = fmtDeg(weekMin) + " – " + fmtDeg(weekMax) + " this week";
    }

    // ---- live radar ----
    const zoneAttrs = (zone && zone.attributes) || {};
    root.getElementById("radar-note").textContent =
      "Centred on " + placeName + " · base map © Esri, OpenStreetMap contributors · radar imagery © RainViewer";
    this._tryInitRadar();
  }
}

customElements.define("khione-weather-panel", KhioneWeatherPanel);
