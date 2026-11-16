// payload/editions/server/ha-dashboard/panels/meals.js
// Khione Meals custom panel. Ported from the approved mockup scratchpad
// mockups/meals-redesign-10b-washi-ghibli-brand.html — this file is a
// data-wiring change onto that approved design, not a redesign. See
// _tokens.js for the shared brand tokens/theme toggle, and weather.js/
// home.js/plants.js for the sibling panels this follows the same wrapper
// mechanics as.
//
// Adaptations from the mockup, beyond the usual shadow-DOM/token
// retargeting (see plants.js's header comment for that baseline):
// 1. The mockup's own local week-nav state (`var week = 9; MIN=1; MAX=12;`
//    with Prev/Next disabled at the edges) assumed a hand-edited demo. The
//    real backend (khione_meals.py's khione_meals_preview_prev/next) wraps
//    the week number cyclically with `% total_weeks`, so there is no real
//    edge to disable at — that logic is dropped. "Today"'s aria-pressed and
//    the whole week table/shopping list are driven by live
//    sensor.khione_meals_preview attributes instead (same shape
//    meals-view.yaml already templates from it).
// 2. The mockup's hero "today's note: tuna & potato night" names a specific
//    meal that would be wrong on any other day — dropped rather than
//    faked, along with its now-unused `.hero .note` CSS rule.
// 3. The mockup drew recipe ingredients/method as hand-typed `<ul><li>`
//    lists. The real `recipes_{slot}` sensors give `ingredients`/
//    `instructions` as single prose strings (same shape
//    khione_meals.py's SEED_RECIPES and meals-view.yaml's markdown cards
//    use), so each renders as one `<p class="instr">` (a style the mockup
//    already used for the one dinner recipe it gave full method text to)
//    instead of a fabricated bullet list.
// 4. Recipe chips (`Batch N` / `Cook fresh`) only ever appeared on the
//    mockup's Dinner group — real breakfast/lunch/snack recipes are all
//    batch:0/fresh:false too, so that grouping is kept as-is.
// 5. Recipe cards are built once, from whatever `hass` the panel first
//    mounts with, not rebuilt on every `_renderLiveData()` tick like the
//    rest of the page. `<details>` holds real interactive open/closed
//    state a user may have just toggled; rebuilding that grid on every
//    hass change (which fires for ANY entity in the house, not just meals
//    ones) would silently collapse whatever the user just opened.
//    shortcut: the recipe catalog itself only changes via
//    khione_meals_save_recipe/delete_recipe, which this panel has no UI
//    for — if that ever changes live elsewhere, a reload picks it up.
// 6. The mockup's profile `<select>` options had no `value=` attribute
//    (so their value was their visible text, e.g. "Male" / "1.2 —
//    Sedentary") and was missing the 4th activity tier entirely. Real
//    khione_meals_save_profile validates `sex in ("male","female")` and
//    `str(activity) in ("1.2","1.375","1.55","1.725")` — sending the
//    mockup's literal option text would silently fail that check (pyscript
//    logs an error and keeps the old profile) rather than erroring
//    visibly, so every option now carries the exact lowercase/bare-number
//    `value` the backend expects, and the missing 1.725 tier is added so a
//    profile already on it round-trips instead of silently downgrading.
// 7. Each write button disables itself for the life of its service-call
//    promise (re-enabling in a `.finally`) so a fast double-click/double-tap
//    on Prev/Next can't fire two preview-week shifts before pyscript
//    recomputes between them.
import { SHARED_TOKENS_CSS, GOOGLE_FONTS_LINK_HTML, initTheme, toggleTheme } from "./_tokens.js";

// Same defaults khione_meals.py's DEFAULT_PROFILE/START_KG use, so an
// unconfigured profile/weight form shows the same numbers the backend
// would fall back to, not independently-invented sample values.
const DEFAULT_PROFILE = { age: 30, height_cm: 183, sex: "male", activity: "1.375" };
const DEFAULT_WEIGHT_KG = 90.0;

// ---------------------------------------------------------------------------
// PAGE_CSS — ported from the mockup's main <style> block, with the same
// kinds of shadow-DOM/token retargeting as weather.js/home.js/plants.js:
// `body`/`body::before` -> `:host`/`:host::before` (+ display:block, custom
// elements default to inline); the mockup's own `:root{...}` block isn't
// duplicated for the tokens SHARED_TOKENS_CSS already provides (--bg,
// --card-bg, --ink, --muted, --accent, --accent-soft, --khione-green,
// --khione-blue, --khione-purple, --khione-yellow); `--header-footer-bg`/
// `--header-footer-accent` are renamed to SHARED_TOKENS_CSS's `--band-bg`/
// `--band-ink` (identical hex values, light and dark, confirmed against
// _tokens.js). Every other page-local derived token (--surface-2, --faint,
// --green-deep, --shadow-rgb, the noise --texture-img, etc.) is kept,
// since _tokens.js doesn't provide them — declared once if its formula is
// theme-invariant (it recomputes automatically off the vars above when the
// host's data-theme/color-scheme flips), or re-declared under
// :host([data-theme="dark"]) / the prefers-color-scheme fallback when the
// mockup itself used a different formula for dark (today-text, the
// *-deep accents, shadow-rgb, the noise texture) — same split the mockup's
// own light/dark :root blocks drew.
// A `.theme-toggle` button (+ i-moon icon, i-sun already existed) is added
// inside a new `.hero-row` wrapper — the mockup had no toggle markup at
// all, same gap every sibling panel's mockup had.
// ---------------------------------------------------------------------------
const PAGE_CSS = `
:host{
  display:block;
  --font-display:"Helvetica Neue",Helvetica,Arial,sans-serif;
  --font-body:"IBM Plex Mono",ui-monospace,"SFMono-Regular",Menlo,monospace;
  --font-script:"Satisfy",cursive;
  --surface-2: color-mix(in srgb, var(--card-bg) 72%, var(--accent-soft) 28%);
  --faint: color-mix(in srgb, var(--muted) 55%, var(--bg) 45%);
  --border-soft: color-mix(in srgb, var(--khione-green) 12%, transparent);
  --divider: color-mix(in srgb, var(--khione-green) 22%, transparent);
  --accent-soft-tint: color-mix(in srgb, var(--accent-soft) 34%, var(--card-bg) 66%);
  --today-text: var(--band-ink);
  --green-pale: color-mix(in srgb, var(--khione-green) 26%, var(--card-bg) 74%);
  --green-deep: color-mix(in srgb, var(--khione-green) 62%, black 28%);
  --blue-pale: color-mix(in srgb, var(--khione-blue) 22%, var(--card-bg) 78%);
  --blue-deep: color-mix(in srgb, var(--khione-blue) 68%, black 25%);
  --yellow-pale: color-mix(in srgb, var(--khione-yellow) 26%, var(--card-bg) 74%);
  --yellow-deep: color-mix(in srgb, var(--khione-yellow) 65%, black 25%);
  --purple-pale: color-mix(in srgb, var(--khione-purple) 20%, var(--card-bg) 80%);
  --purple-deep: color-mix(in srgb, var(--khione-purple) 70%, black 15%);
  --hero-overlay: color-mix(in srgb, var(--band-ink) 13%, transparent);
  --hero-overlay-strong: color-mix(in srgb, var(--band-ink) 19%, transparent);
  --shadow-rgb: 112, 77, 44;
  --texture-img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.157  0 0 0 0 0.212  0 0 0 0 0.094  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --texture-blend: multiply;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  position: relative;
}
:host([data-theme="dark"]){
  --today-text: var(--ink);
  --green-deep: color-mix(in srgb, var(--khione-green) 70%, white 15%);
  --blue-deep: color-mix(in srgb, var(--khione-blue) 75%, white 15%);
  --yellow-deep: color-mix(in srgb, var(--khione-yellow) 75%, white 15%);
  --purple-deep: color-mix(in srgb, var(--khione-purple) 70%, white 20%);
  --shadow-rgb: 0, 0, 0;
  --texture-img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.996  0 0 0 0 0.980  0 0 0 0 0.878  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --texture-blend: screen;
}
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"])){
    --today-text: var(--ink);
    --green-deep: color-mix(in srgb, var(--khione-green) 70%, white 15%);
    --blue-deep: color-mix(in srgb, var(--khione-blue) 75%, white 15%);
    --yellow-deep: color-mix(in srgb, var(--khione-yellow) 75%, white 15%);
    --purple-deep: color-mix(in srgb, var(--khione-purple) 70%, white 20%);
    --shadow-rgb: 0, 0, 0;
    --texture-img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.996  0 0 0 0 0.980  0 0 0 0 0.878  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    --texture-blend: screen;
  }
}
*{ box-sizing:border-box; }
:host::before{
  content:"";
  position: fixed;
  inset: 0;
  background-image: var(--texture-img);
  mix-blend-mode: var(--texture-blend);
  opacity: .6;
  pointer-events: none;
  z-index: 0;
}
h1,h2,h3{ font-family: var(--font-display); font-weight: 800; margin: 0; text-wrap: balance; color: var(--ink); }
p{ margin:0; }
ul{ margin:0; padding:0; list-style:none; }
button{ font-family: inherit; }
:focus-visible{ outline: 2.5px solid var(--khione-green); outline-offset: 2px; border-radius: 4px; }
.sr-only{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
.icon{ width:1.2em; height:1.2em; stroke:currentColor; fill:none; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }
.flourish{ font-family: var(--font-script); font-size:1.15rem; font-weight:400; }

.wrap{
  position: relative;
  z-index: 1;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}

/* ---------- blobs ---------- */
.blob{
  position:absolute;
  background: var(--green-pale);
  z-index:0;
}
.blob-a{ border-radius: 42% 58% 53% 47% / 46% 42% 58% 54%; }
.blob-b{ border-radius: 58% 42% 46% 54% / 54% 58% 42% 46%; }
.blob-c{ border-radius: 38% 62% 60% 40% / 55% 48% 52% 45%; }
.blob-d{ border-radius: 62% 38% 44% 56% / 40% 60% 42% 58%; }

.icon-badge{
  position: relative;
  width: 52px; height: 52px;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.icon-badge .blob{ position:absolute; inset:0; box-shadow: 0 6px 14px rgba(var(--shadow-rgb),.18), 0 20px 34px -14px rgba(var(--shadow-rgb),.22); }
.icon-badge .icon{ position:relative; width:26px; height:26px; color: var(--green-deep); stroke-width:1.8; }
.icon-badge.terracotta .blob{ background: var(--accent-soft-tint); }
.icon-badge.terracotta .icon{ color: var(--band-ink); }
.icon-badge.info .blob{ background: var(--blue-pale); }
.icon-badge.info .icon{ color: var(--blue-deep); }
.icon-badge.success .blob{ background: var(--green-pale); }
.icon-badge.success .icon{ color: var(--green-deep); }

/* ---------- header ---------- */
.hero{
  position: relative;
  overflow: hidden;
  background: linear-gradient(170deg, var(--band-bg) 0%, color-mix(in srgb, var(--band-bg) 78%, var(--band-ink) 22%) 100%);
  padding-block: 2.6rem 2.2rem;
}
.hero .blob{ opacity:.5; }
.hero .blob.b1{ width:220px; height:220px; top:-70px; right:6%; background: var(--band-ink); opacity:.08; }
.hero .blob.b2{ width:140px; height:140px; bottom:-50px; left:10%; background: var(--band-ink); opacity:.07; }
.hero-inner{
  position:relative; z-index:1;
  display:flex; align-items:center; gap:1rem; flex-wrap:wrap;
}
.hero-row{
  flex:1 1 auto; min-width:0;
  display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:1.4rem;
}
.hero-title{ display:flex; align-items:center; gap:.9rem; }
.hero-title .icon-badge .blob{ background: var(--hero-overlay-strong); box-shadow: 0 8px 18px rgba(var(--shadow-rgb),.15); }
.hero-title .icon-badge .icon{ color: var(--band-ink); }
.hero h1{ color: var(--band-ink); font-size: clamp(1.8rem, 1.3rem + 1.6vw, 2.5rem); }
.hero .sub{ color: var(--band-ink); opacity:.78; font-size: .98rem; margin-top:.25rem; }
.hero .sub strong{ opacity:1; font-weight:700; }

.theme-toggle{
  flex:0 0 auto; align-self:center;
  width:40px; height:40px;
  border-radius:50%; border:1px solid color-mix(in srgb, var(--band-ink) 30%, transparent);
  background: color-mix(in srgb, var(--band-ink) 10%, transparent);
  color: var(--band-ink);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer;
}
.theme-toggle:hover{ background: color-mix(in srgb, var(--band-ink) 18%, transparent); }
.theme-toggle svg{ width:20px; height:20px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.theme-toggle:focus-visible{ outline:2px solid var(--khione-blue); outline-offset:2px; }

.weeknav{ display:flex; flex-direction:column; align-items:flex-end; gap:.5rem; }
.weeknav-controls{ display:flex; align-items:center; gap:.5rem; background: var(--hero-overlay); border-radius: 999px; padding: .3rem; }
.weeknav button{
  border:none; cursor:pointer; background: transparent; color: var(--band-ink);
  padding:.45rem .8rem; border-radius:999px; font-size:.85rem; font-weight:700;
  display:flex; align-items:center; gap:.3rem;
}
.weeknav button:not(:disabled):hover{ background: var(--hero-overlay-strong); }
.weeknav button:disabled{ opacity:.35; cursor:not-allowed; }
.weeknav button.today-btn[aria-pressed="true"]{ background: var(--card-bg); color: var(--band-ink); }
.weeknav-label{ color: var(--band-ink); opacity:.8; font-size:.82rem; }

/* ---------- sections ---------- */
section{ padding-block: 2.2rem; position:relative; }
.section-head{ display:flex; align-items:center; gap:.85rem; margin-bottom: 1.2rem; }
.section-head h2{ font-size: 1.35rem; }
.section-head .count{ color: var(--faint); font-size:.85rem; font-weight:600; }

.card{
  background: var(--card-bg);
  border-radius: 22px;
  padding: 1.25rem 1.3rem;
  box-shadow: 0 3px 6px rgba(var(--shadow-rgb),.12), 0 20px 38px -18px rgba(var(--shadow-rgb),.22);
  border: 1px solid var(--border-soft);
  min-width: 0;
}

/* overview grid */
.overview-grid{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.1rem;
}
.ov-card h3{ font-size: 1.02rem; margin-bottom:.15rem; }
.ov-head{ display:flex; align-items:center; gap:.7rem; margin-bottom:.8rem; }
.meal-row{ display:flex; gap:.5rem; padding-block:.3rem; font-size:.92rem; border-top: 1px dashed var(--divider); }
.meal-row:first-of-type{ border-top:none; }
.meal-row .tag{ flex-shrink:0; font-weight:700; color: var(--green-deep); min-width: 4.6em; }

.stat{ margin-top:.2rem; }
.stat-row{ display:flex; justify-content:space-between; align-items:baseline; font-size:.88rem; margin-bottom:.3rem; }
.stat-row b{ font-family: var(--font-body); font-variant-numeric: tabular-nums; color: var(--ink); }
.bar{ height:10px; border-radius:999px; background: var(--surface-2); overflow:hidden; margin-bottom:.9rem; }
.bar > span{ display:block; height:100%; border-radius:999px; }
.bar.olive > span{ background: var(--khione-green); }
.bar.success > span{ background: var(--accent); }

.goal-row{ display:flex; align-items:center; gap:.6rem; padding-block:.4rem; font-size:.92rem; }
.goal-row .icon{ color: var(--green-deep); width:1.1em; height:1.1em; }

.weight-figs{ display:flex; flex-direction:column; gap:.45rem; font-size:.92rem; margin-top:.2rem;}
.weight-figs .big{ font-family: var(--font-body); font-size:1.65rem; color: var(--ink); font-weight:800; }
.progress-wrap{ margin-top:.6rem; }
.progress-wrap small{ color: var(--muted); }

/* forms */
.form-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.1rem; }
.field{ display:flex; flex-direction:column; gap:.3rem; margin-bottom:.8rem; }
.field label{ font-size:.82rem; font-weight:700; color: var(--green-deep); }
.field input, .field select{
  font-family: inherit; font-size:.95rem;
  background: var(--bg); border: 1.5px solid var(--divider);
  border-radius: 12px; padding: .5rem .7rem; color: var(--ink);
}
.field input[type="range"]{ padding: 0; accent-color: var(--khione-green); }
.slider-row{ display:flex; align-items:center; gap:.8rem; }
.slider-row output{ font-weight:800; font-variant-numeric: tabular-nums; min-width:4.2em; color: var(--ink); }
.btn{
  border:none; cursor:pointer; font-weight:700; font-size:.92rem;
  padding:.65rem 1.3rem; border-radius:999px; color: var(--card-bg);
  background: var(--accent);
  box-shadow: 0 4px 10px rgba(var(--shadow-rgb),.22);
  display:inline-flex; align-items:center; gap:.4rem;
}
.btn:hover{ background: color-mix(in srgb, var(--accent) 82%, black 12%); }
.btn:disabled{ opacity:.6; cursor:not-allowed; }
.confirm-msg{ margin-top:.6rem; font-size:.85rem; font-weight:700; color: var(--green-deep); display:flex; align-items:center; gap:.4rem; min-height:1.2em; }
.confirm-msg[hidden]{ display:none; }

/* spotlight */
.spotlight-grid{ display:grid; grid-template-columns: 1.5fr 1fr; gap:1.1rem; }
.spot-card{ background: var(--surface-2); }
.spot-tag{
  display:inline-flex; align-items:center; gap:.3rem;
  background: var(--accent); color: var(--card-bg); font-weight:800; font-size:.72rem;
  letter-spacing:.02em; padding:.25rem .65rem; border-radius:999px; margin-bottom:.6rem;
}
.spot-tag.muted{ background: var(--blue-pale); color: var(--blue-deep); }
.spot-kcal{ color: var(--muted); font-size:.88rem; margin-bottom:.7rem; }
.spot-cols{ display:grid; grid-template-columns: 1fr 1fr; gap:1rem; }
.spot-cols h4{ font-size:.82rem; color: var(--green-deep); margin-bottom:.4rem; font-weight:800; }
.spot-cols p{ font-size:.88rem; line-height:1.5; }
.tomorrow-card{ display:flex; flex-direction:column; justify-content:center; }

/* this-week table */
.table-scroll{
  overflow-x:auto; border-radius: 20px; box-shadow: 0 3px 6px rgba(var(--shadow-rgb),.12), 0 20px 38px -18px rgba(var(--shadow-rgb),.22);
  /* shortcut: CSS-only scroll-shadow so a narrow screen shows a visible hint
     that the table scrolls sideways, instead of just clipping silently */
  background:
    linear-gradient(to right, var(--card-bg) 30%, rgba(0,0,0,0)) ,
    linear-gradient(to right, rgba(0,0,0,0), var(--card-bg) 70%) 100% 0,
    linear-gradient(to right, rgba(var(--shadow-rgb),.18), rgba(var(--shadow-rgb),0) 30px),
    linear-gradient(to left, rgba(var(--shadow-rgb),.18), rgba(var(--shadow-rgb),0) 30px) 100% 0;
  background-repeat:no-repeat;
  background-color:var(--card-bg);
  background-size:44px 100%, 44px 100%, 16px 100%, 16px 100%;
  background-attachment:local, local, scroll, scroll;
}
table.week{ width:100%; border-collapse: separate; border-spacing:0; background: var(--card-bg); min-width: 960px; }
table.week caption{ text-align:left; font-size:.8rem; color: var(--faint); padding:.8rem 1.1rem 0; }
.scroll-hint{ display:none; font-weight:700; color: var(--accent); }
@media (max-width:720px){ .scroll-hint{ display:inline; } }
table.week th, table.week td{ padding:.75rem .9rem; text-align:left; vertical-align:top; font-size:.86rem; border-bottom: 1px solid var(--divider); white-space:nowrap; }
table.week thead th{
  font-family: var(--font-display); font-weight:700; color: var(--ink);
  background: var(--surface-2); font-size:.8rem;
  position:sticky; top:0;
}
table.week thead th:first-child{ border-top-left-radius:20px; }
table.week thead th:last-child{ border-top-right-radius:20px; }
table.week tbody th{ font-weight:800; color: var(--ink); white-space:nowrap; }
table.week tbody tr:last-child td, table.week tbody tr:last-child th{ border-bottom:none; }
table.week tbody tr.today{ background: var(--accent-soft-tint); }
table.week tbody tr.today th{ color: var(--today-text); }
.today-pill{
  display:inline-block; margin-left:.4rem; font-size:.65rem; font-weight:800;
  background: var(--accent); color: var(--card-bg); border-radius:999px; padding:.1rem .5rem; vertical-align:middle;
}

/* shopping */
.shop-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:1.1rem; }
.shop-card ul{ display:flex; flex-direction:column; gap:.45rem; margin-top:.2rem; }
.shop-card li{ font-size:.88rem; padding-left:1.1rem; position:relative; }
.shop-card li::before{
  content:""; position:absolute; left:0; top:.45em; width:6px; height:6px;
  background: var(--khione-green); border-radius: 60% 40% 55% 45% / 45% 55% 40% 60%;
}
.shop-card .empty{ font-size:.86rem; color: var(--faint); }

/* recipes */
.recipe-group{ margin-bottom: 1.8rem; }
.recipe-group:last-child{ margin-bottom:0; }
.recipe-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 1rem; }
details.recipe{
  background: var(--card-bg); border-radius: 20px;
  box-shadow: 0 3px 6px rgba(var(--shadow-rgb),.1), 0 16px 30px -16px rgba(var(--shadow-rgb),.2);
  overflow:hidden; min-width:0;
}
details.recipe > summary{
  list-style:none; cursor:pointer; padding: .95rem 1.05rem; display:flex; gap:.7rem; align-items:flex-start;
}
details.recipe > summary::-webkit-details-marker{ display:none; }
.rc-main{ flex:1; min-width:0; }
.rc-name{ font-weight:800; color: var(--ink); font-size:.95rem; margin-bottom:.15rem; }
.rc-sub{ font-size:.82rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.rc-chips{ display:flex; gap:.35rem; margin-top:.4rem; flex-wrap:wrap; }
.chip{ font-size:.68rem; font-weight:800; padding:.15rem .5rem; border-radius:999px; background: var(--blue-pale); color: var(--blue-deep); }
.chip.hot{ background: var(--yellow-pale); color: var(--yellow-deep); }
.chip.info{ background: var(--purple-pale); color: var(--purple-deep); }
.expand-ctl{
  flex-shrink:0; display:flex; align-items:center; gap:.3rem; font-size:.74rem; font-weight:800;
  color: var(--green-deep); background: var(--surface-2); border-radius:999px; padding:.35rem .6rem .35rem .75rem;
  align-self:center;
}
.expand-ctl .icon{ width:.9em; height:.9em; transition: transform .2s ease; }
details.recipe[open] .expand-ctl .icon{ transform: rotate(180deg); }
details.recipe[open] .expand-ctl .txt-closed{ display:none; }
details.recipe:not([open]) .expand-ctl .txt-open{ display:none; }
.rc-body{ padding: 0 1.05rem 1.05rem; border-top: 1px dashed var(--divider); margin-top:.1rem; }
.rc-body h5{ font-size:.75rem; letter-spacing:.02em; color: var(--green-deep); margin:.8rem 0 .4rem; font-weight:800; }
.rc-body p.instr{ font-size:.86rem; margin-top:.3rem; line-height:1.55; }

footer{ padding-block: 2rem 2.6rem; text-align:center; color: var(--faint); font-size:.8rem; }
footer .flourish{ display:block; font-size:1.3rem; color: var(--green-deep); margin-bottom:.3rem; opacity:.9; }

@media (prefers-reduced-motion: no-preference){
  .reveal{ animation: riseIn .6s ease both; }
  .reveal:nth-of-type(2){ animation-delay:.05s; }
  .reveal:nth-of-type(3){ animation-delay:.1s; }
  .reveal:nth-of-type(4){ animation-delay:.15s; }
  @keyframes riseIn{ from{ opacity:0; transform: translateY(10px); } to{ opacity:1; transform:none; } }
}

@media (max-width: 760px){
  .spotlight-grid{ grid-template-columns: 1fr; }
  .spot-cols{ grid-template-columns:1fr; }
  .hero-inner{ align-items:flex-start; }
  .hero-row{ align-items:flex-start; }
  .weeknav{ align-items:flex-start; width:100%; }
}
`;

// ---------------------------------------------------------------------------
// PAGE_SHELL_HTML — markup ported from the mockup. Every hand-drawn icon
// <symbol> from the mockup's <svg aria-hidden="true"> defs block is kept
// byte-for-byte; i-moon is new, for the theme toggle (i-sun already
// existed and is reused for the toggle's light-mode icon). The weeknav
// buttons and the weight/profile form fields/buttons carry the exact ids
// Task 5's write services are wired to below. Containers the live data
// fills (meal rows, macros, weight card, tonight/tomorrow, the week table
// body, shopping lists, recipe grids) start empty and are populated by
// _renderLiveData() / the one-time recipe build.
// ---------------------------------------------------------------------------
const PAGE_SHELL_HTML = `
<svg class="sr-only" aria-hidden="true" focusable="false">
  <symbol id="i-sun" viewBox="0 0 24 24">
    <path d="M12 4.2c2.1-.5 4.3.2 5.8 1.8 1.6 1.7 2.3 3.8 1.9 6.1-.4 2.5-2.1 4.5-4.5 5.4-2.7 1-5.5.3-7.4-1.7-1.8-1.9-2.4-4.6-1.5-7.1.8-2.4 2.9-4 5.7-4.5z"/>
    <path d="M12 1.5v2.1M12 20.4v2.1M3.3 12h2.1M18.6 12h2.1M5.6 5.4l1.5 1.5M16.9 17l1.5 1.4M18.4 5.4l-1.5 1.5M7.1 17l-1.5 1.4" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-moon" viewBox="0 0 24 24">
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke-linejoin="round"/>
  </symbol>
  <symbol id="i-sandwich" viewBox="0 0 24 24">
    <path d="M3 13.9c.5-3.7 3.9-6.4 9-6.4s8.5 2.7 9 6.4c.1.6-.4 1.1-1 1.1H4c-.6 0-1.1-.5-1-1.1z"/>
    <path d="M4.2 16.4h15.6" stroke-linecap="round"/>
    <path d="M6.2 8.7c.9-2 2.7-3.3 5.9-3.3" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-acorn" viewBox="0 0 24 24">
    <path d="M8 10.2c-.1-3.1 1.7-5.2 4-5.2s4.1 2.1 4 5.2c-.1 3.6-1.9 7.3-4 9.3-2.1-2-3.9-5.7-4-9.3z"/>
    <path d="M8.2 9.4c1.2-.9 2.4-1.3 3.8-1.3s2.6.4 3.8 1.3" stroke-linecap="round"/>
    <path d="M9.1 5.3c.7-1 1.7-1.6 2.9-1.6s2.2.6 2.9 1.6" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-pot" viewBox="0 0 24 24">
    <path d="M4.5 11.3h15c.3 2.9-1 5.4-3 6.8-1.6 1.1-3.5 1.6-4.5 1.6s-2.9-.5-4.5-1.6c-2-1.4-3.3-3.9-3-6.8z"/>
    <path d="M2.5 11.3h19" stroke-linecap="round"/>
    <path d="M4.9 9.6c.4-1.6 2-2.7 3.6-2.3M19.1 9.6c-.4-1.6-2-2.7-3.6-2.3" stroke-linecap="round"/>
    <path d="M11.6 4.3c-.7.6-.7 1.4 0 2" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-flame" viewBox="0 0 24 24">
    <path d="M12.1 3c1 2.3.3 3.5-.8 4.9-1.2 1.5-2.1 2.9-2.1 4.8 0 2.9 2.2 5.2 5 5.2s4.9-2.3 4.9-5.1c0-2-1-3.3-2.1-4.3.4 1.6-.3 2.6-1.3 3 .2-2.7-1-4.7-2.6-6.1.1 1.2-.2 2-1 2.5-.1-2-.1-3.6 0-4.9z"/>
  </symbol>
  <symbol id="i-target" viewBox="0 0 24 24">
    <path d="M12 4.4c4.2-.1 7.7 3.3 7.7 7.6s-3.4 7.7-7.7 7.7-7.7-3.4-7.7-7.7S7.7 4.3 12 4.4z"/>
    <path d="M12 8.2c2.1 0 3.9 1.7 3.9 3.8s-1.7 3.9-3.9 3.9-3.9-1.7-3.9-3.9 1.8-3.8 3.9-3.8z"/>
    <path d="M12 11.1c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z" fill="currentColor" stroke="none"/>
  </symbol>
  <symbol id="i-scale" viewBox="0 0 24 24">
    <path d="M5 9.3c0-1.7 1.5-2.5 3.3-2.7 2.4-.3 5-.3 7.4 0 1.8.2 3.3 1 3.3 2.7v7.1c0 1.8-1.5 2.9-3.3 3.1-2.4.3-5 .3-7.4 0C6.5 19.3 5 18.2 5 16.4z"/>
    <path d="M12 10.7c1.3 0 2.3 1 2.3 2.3s-1 2.3-2.3 2.3-2.3-1-2.3-2.3 1-2.3 2.3-2.3z"/>
    <path d="M12 10.7v1.4" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24">
    <path d="M4.6 5.9c0-1 .8-1.7 2-1.8 3.6-.4 7.2-.4 10.8 0 1.2.1 2 .8 2 1.8v12c0 1-.8 1.8-2 1.9-3.6.4-7.2.4-10.8 0-1.2-.1-2-.9-2-1.9z"/>
    <path d="M4.6 9.6h14.8" stroke-linecap="round"/>
    <path d="M8 3.2v3.5M16 3.2v3.5" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-basket" viewBox="0 0 24 24">
    <path d="M5 10.5h14l-1.4 8.1c-.2 1.1-1.2 1.9-2.4 1.9H8.8c-1.2 0-2.2-.8-2.4-1.9z"/>
    <path d="M3.5 10.5h17" stroke-linecap="round"/>
    <path d="M8.6 10.5 11 4.6M15.4 10.5 13 4.6" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-book" viewBox="0 0 24 24">
    <path d="M4.3 5.7c2.4-1.3 5-1.6 7.7-.8v13.7c-2.6-.8-5.3-.5-7.7.8z"/>
    <path d="M19.7 5.7c-2.4-1.3-5-1.6-7.7-.8v13.7c2.6-.8 5.3-.5 7.7.8z"/>
  </symbol>
  <symbol id="i-chevron" viewBox="0 0 24 24">
    <path d="M7 9.5c1.7 1.9 3.3 3.6 5 5.2 1.7-1.6 3.3-3.3 5-5.2" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="i-leaf" viewBox="0 0 24 24">
    <path d="M5 18c-.7-6 2-11.5 8.6-13.3 3 4.8 2.3 10.7-2 13.9-2 1.5-4.4 1.5-6.6-.6z"/>
    <path d="M6 17c3-3.4 5.7-6.4 8.5-9.6" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-arrow-l" viewBox="0 0 24 24">
    <path d="M15 6c-2 2-4 4-6 6 2 2 4 4 6 6" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="i-arrow-r" viewBox="0 0 24 24">
    <path d="M9 6c2 2 4 4 6 6-2 2-4 4-6 6" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
</svg>

<header class="hero">
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  <div class="wrap hero-inner">
    <div class="hero-row">
      <div class="hero-title">
        <div class="icon-badge"><div class="blob blob-a"></div><svg class="icon"><use href="#i-sun"></use></svg></div>
        <div>
          <h1>Meals</h1>
          <p class="sub" id="hero-sub">Loading…</p>
        </div>
      </div>
      <div class="weeknav">
        <div class="weeknav-controls">
          <button type="button" id="week-prev-btn" aria-label="Previous week">
            <svg class="icon" style="width:.9em;height:.9em"><use href="#i-arrow-l"></use></svg> Prev
          </button>
          <button type="button" id="week-today-btn" class="today-btn" aria-pressed="true">Today</button>
          <button type="button" id="week-next-btn" aria-label="Next week">
            Next <svg class="icon" style="width:.9em;height:.9em"><use href="#i-arrow-r"></use></svg>
          </button>
        </div>
        <p class="weeknav-label">Viewing <span id="week-view-label">—</span></p>
      </div>
    </div>
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
      <svg id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"></use></svg>
    </button>
  </div>
</header>

<main class="wrap">

  <section aria-labelledby="h-today">
    <div class="section-head reveal">
      <div class="icon-badge success"><div class="blob blob-b"></div><svg class="icon"><use href="#i-leaf"></use></svg></div>
      <h2 id="h-today">Today at a glance</h2>
    </div>
    <div class="overview-grid">
      <div class="card ov-card reveal">
        <div class="ov-head"><div class="icon-badge"><div class="blob blob-a"></div><svg class="icon"><use href="#i-sun"></use></svg></div><h3>Today's meals</h3></div>
        <div class="meal-row"><span class="tag">Breakfast</span><span id="today-breakfast">—</span></div>
        <div class="meal-row"><span class="tag">Lunch</span><span id="today-lunch">—</span></div>
        <div class="meal-row"><span class="tag">Snacks</span><span id="today-snacks">—</span></div>
        <div class="meal-row"><span class="tag">Dinner</span><span id="today-dinner">—</span></div>
      </div>

      <div class="card ov-card reveal">
        <div class="ov-head"><div class="icon-badge terracotta"><div class="blob blob-b"></div><svg class="icon"><use href="#i-flame"></use></svg></div><h3>Today's macros</h3></div>
        <div class="stat">
          <div class="stat-row"><span>Calories</span><b id="kcal-text">—</b></div>
          <div class="bar olive"><span id="kcal-bar" style="width:0%"></span></div>
          <div class="stat-row"><span>Protein</span><b id="protein-text">—</b></div>
          <div class="bar success"><span id="protein-bar" style="width:0%"></span></div>
        </div>
      </div>

      <div class="card ov-card reveal">
        <div class="ov-head"><div class="icon-badge info"><div class="blob blob-c"></div><svg class="icon"><use href="#i-target"></use></svg></div><h3>Targets</h3></div>
        <div class="goal-row"><svg class="icon"><use href="#i-leaf"></use></svg><span>3&times;/week running goal</span></div>
        <div class="goal-row"><svg class="icon"><use href="#i-scale"></use></svg><span>90 &rarr; 75kg weight goal</span></div>
      </div>

      <div class="card ov-card reveal">
        <div class="ov-head"><div class="icon-badge"><div class="blob blob-d"></div><svg class="icon"><use href="#i-scale"></use></svg></div><h3>Weight</h3></div>
        <div class="weight-figs" id="weight-figs"><span>Loading…</span></div>
        <div class="progress-wrap">
          <div class="bar success"><span id="weight-bar" style="width:0%"></span></div>
          <small id="weight-progress-note"></small>
        </div>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-logging">
    <div class="section-head reveal">
      <div class="icon-badge"><div class="blob blob-c"></div><svg class="icon"><use href="#i-scale"></use></svg></div>
      <h2 id="h-logging">Log &amp; profile</h2>
    </div>
    <div class="form-grid">
      <form class="card reveal" id="form-weight">
        <h3 style="margin-bottom:.9rem">Log weight</h3>
        <div class="field">
          <label for="weight-input">Weight (kg)</label>
          <div class="slider-row">
            <input type="range" id="weight-input" min="50" max="150" step="0.1" value="80.0">
            <output id="weight-output" for="weight-input">80.0kg</output>
          </div>
        </div>
        <button type="button" id="log-weight-btn" class="btn">
          <svg class="icon" style="width:.9em;height:.9em;color:var(--card-bg)"><use href="#i-scale"></use></svg>
          Log Weight
        </button>
        <p class="confirm-msg" id="weight-confirm" hidden></p>
      </form>

      <form class="card reveal" id="form-profile">
        <h3 style="margin-bottom:.9rem">Weight profile</h3>
        <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:.6rem 1rem;">
          <div class="field"><label for="profile-age">Age</label><input type="number" id="profile-age" value="30" min="10" max="120"></div>
          <div class="field"><label for="profile-height">Height (cm)</label><input type="number" id="profile-height" value="183" min="100" max="250"></div>
          <div class="field"><label for="profile-sex">Sex</label>
            <select id="profile-sex">
              <option value="male" selected>Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div class="field"><label for="profile-activity">Activity level</label>
            <select id="profile-activity">
              <option value="1.2">1.2 &mdash; Sedentary</option>
              <option value="1.375" selected>1.375 &mdash; Light</option>
              <option value="1.55">1.55 &mdash; Moderate</option>
              <option value="1.725">1.725 &mdash; Very active</option>
            </select>
          </div>
        </div>
        <button type="button" id="save-profile-btn" class="btn">Save Profile</button>
        <p class="confirm-msg" id="profile-confirm" hidden></p>
      </form>
    </div>
  </section>

  <section aria-labelledby="h-tonight">
    <div class="section-head reveal">
      <div class="icon-badge terracotta"><div class="blob blob-a"></div><svg class="icon"><use href="#i-pot"></use></svg></div>
      <h2 id="h-tonight">Tonight &amp; tomorrow</h2>
    </div>
    <div class="spotlight-grid">
      <div class="card spot-card reveal">
        <span class="spot-tag" id="tonight-tag"><svg class="icon" style="width:.9em;height:.9em;color:var(--card-bg)"><use href="#i-pot"></use></svg> <span id="tonight-tag-text">Tonight</span></span>
        <h3 id="tonight-name">—</h3>
        <p class="spot-kcal" id="tonight-detail"></p>
        <div class="spot-cols">
          <div>
            <h4>Ingredients</h4>
            <p id="tonight-ingredients">—</p>
          </div>
          <div>
            <h4>Method</h4>
            <p id="tonight-method">—</p>
          </div>
        </div>
      </div>
      <div class="card spot-card tomorrow-card reveal">
        <span class="spot-tag muted"><svg class="icon" style="width:.9em;height:.9em;color:var(--blue-deep)"><use href="#i-calendar"></use></svg> Tomorrow</span>
        <h3 id="tomorrow-name">—</h3>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-week">
    <div class="section-head reveal">
      <div class="icon-badge"><div class="blob blob-b"></div><svg class="icon"><use href="#i-calendar"></use></svg></div>
      <h2 id="h-week">This week</h2>
      <span class="count" id="week-count">—</span>
    </div>
    <div class="table-scroll reveal">
      <table class="week">
        <caption>Breakfast, lunch and snacks repeat daily; dinner changes through the week. <span class="scroll-hint">Swipe to see every day &rarr;</span></caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Breakfast</th><th scope="col">Lunch</th><th scope="col">Snacks</th><th scope="col">Dinner</th></tr>
        </thead>
        <tbody id="week-tbody"></tbody>
      </table>
    </div>
  </section>

  <section aria-labelledby="h-shop">
    <div class="section-head reveal">
      <div class="icon-badge success"><div class="blob blob-c"></div><svg class="icon"><use href="#i-basket"></use></svg></div>
      <h2 id="h-shop">Shopping list</h2>
      <span class="count" id="shop-count">—</span>
    </div>
    <div class="shop-grid">
      <div class="card shop-card reveal">
        <h3 style="font-size:1rem">Breakfast</h3>
        <ul id="shop-breakfast"></ul>
      </div>
      <div class="card shop-card reveal">
        <h3 style="font-size:1rem">Lunch</h3>
        <ul id="shop-lunch"></ul>
      </div>
      <div class="card shop-card reveal">
        <h3 style="font-size:1rem">Snacks</h3>
        <ul id="shop-snacks"></ul>
      </div>
      <div class="card shop-card reveal">
        <h3 style="font-size:1rem">Dinner</h3>
        <ul id="shop-dinner"></ul>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-recipes">
    <div class="section-head reveal">
      <div class="icon-badge"><div class="blob blob-d"></div><svg class="icon"><use href="#i-book"></use></svg></div>
      <h2 id="h-recipes">Recipe library</h2>
      <span class="count">Tap a recipe to expand it</span>
    </div>

    <div class="recipe-group">
      <h3 style="font-size:1rem; margin-bottom:.7rem; display:flex; align-items:center; gap:.5rem;"><svg class="icon" style="color:var(--green-deep)"><use href="#i-sun"></use></svg>Breakfast</h3>
      <div class="recipe-grid" id="recipes-breakfast"></div>
    </div>

    <div class="recipe-group">
      <h3 style="font-size:1rem; margin-bottom:.7rem; display:flex; align-items:center; gap:.5rem;"><svg class="icon" style="color:var(--green-deep)"><use href="#i-sandwich"></use></svg>Lunch</h3>
      <div class="recipe-grid" id="recipes-lunch"></div>
    </div>

    <div class="recipe-group">
      <h3 style="font-size:1rem; margin-bottom:.7rem; display:flex; align-items:center; gap:.5rem;"><svg class="icon" style="color:var(--green-deep)"><use href="#i-acorn"></use></svg>Snacks</h3>
      <div class="recipe-grid" id="recipes-snacks"></div>
    </div>

    <div class="recipe-group">
      <h3 style="font-size:1rem; margin-bottom:.7rem; display:flex; align-items:center; gap:.5rem;"><svg class="icon" style="color:var(--green-deep)"><use href="#i-pot"></use></svg>Dinner</h3>
      <div class="recipe-grid" id="recipes-dinner"></div>
    </div>
  </section>

  <footer><span class="flourish">hand-drawn for the week, just for you</span>Meals &middot; Washi Ghibli, Khione palette</footer>
</main>
`;

// ---------------------------------------------------------------------------
// Live-data helpers — module-local, pure functions, kept outside the class
// since none of them touch `this`.
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function attr(stateObj, name, fallback) {
  const v = stateObj && stateObj.attributes ? stateObj.attributes[name] : undefined;
  return v === undefined || v === null ? fallback : v;
}

class KhioneMealsPanel extends HTMLElement {
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
      this._initFormDefaults();
      this._renderRecipes();
      this._rendered = true;
    }
    this._renderLiveData();
  }

  // Click handler + initial icon paint for the theme toggle — same
  // mechanics as weather.js/home.js/plants.js: initTheme(this)/
  // toggleTheme(this), the custom element itself, never the shadow root.
  _bindStaticHandlers() {
    const root = this._root;
    const btn = root.getElementById("theme-toggle");
    const icon = root.getElementById("theme-toggle-icon");
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

    // Weight slider live readout.
    const range = root.getElementById("weight-input");
    const out = root.getElementById("weight-output");
    const syncWeight = () => { out.textContent = parseFloat(range.value).toFixed(1) + "kg"; };
    range.addEventListener("input", syncWeight);
    syncWeight();

    // Fades a confirm-msg element back out after showing it, same UI
    // feedback pattern the mockup's own (optimistic, no-op) submit
    // handlers showed, just with a timed fade instead of staying up
    // forever.
    const showConfirm = (el, text) => {
      el.textContent = text;
      el.hidden = false;
      clearTimeout(el._fadeTimer);
      el._fadeTimer = setTimeout(() => { el.hidden = true; }, 4000);
    };

    // Wraps a write-action click in a disable/re-enable cycle so a fast
    // double click/tap can't fire the same service call twice before the
    // backend recomputes between them.
    const guardedClick = (btnEl, fn) => {
      btnEl.addEventListener("click", () => {
        if (btnEl.disabled) return;
        btnEl.disabled = true;
        Promise.resolve(fn()).finally(() => { btnEl.disabled = false; });
      });
    };

    const logBtn = root.getElementById("log-weight-btn");
    guardedClick(logBtn, () => {
      const kg = parseFloat(root.getElementById("weight-input").value);
      const msg = root.getElementById("weight-confirm");
      if (Number.isNaN(kg)) {
        showConfirm(msg, "Enter a valid weight first.");
        return;
      }
      showConfirm(msg, "Logged " + kg.toFixed(1) + "kg for today.");
      return this._hass.callService("pyscript", "khione_meals_log_weight", { kg });
    });

    const saveProfileBtn = root.getElementById("save-profile-btn");
    guardedClick(saveProfileBtn, () => {
      const msg = root.getElementById("profile-confirm");
      const age = parseInt(root.getElementById("profile-age").value, 10);
      const height_cm = parseInt(root.getElementById("profile-height").value, 10);
      const sex = root.getElementById("profile-sex").value;
      const activity = root.getElementById("profile-activity").value;
      if (Number.isNaN(age) || Number.isNaN(height_cm)) {
        showConfirm(msg, "Enter a valid age and height first.");
        return;
      }
      showConfirm(msg, "Profile saved.");
      return this._hass.callService("pyscript", "khione_meals_save_profile", { age, height_cm, sex, activity });
    });

    guardedClick(root.getElementById("week-prev-btn"), () =>
      this._hass.callService("pyscript", "khione_meals_preview_prev", {}));
    guardedClick(root.getElementById("week-today-btn"), () =>
      this._hass.callService("pyscript", "khione_meals_preview_today", {}));
    guardedClick(root.getElementById("week-next-btn"), () =>
      this._hass.callService("pyscript", "khione_meals_preview_next", {}));
  }

  // Pre-fills the weight slider and profile form from whatever `hass` the
  // panel first mounts with, once — never re-touched afterwards so a
  // periodic hass update (fired for ANY entity in the house) can't stomp
  // on a value the user is mid-editing. Falls back to the same defaults
  // khione_meals.py's own DEFAULT_PROFILE/START_KG use.
  _initFormDefaults() {
    const root = this._root;
    const weight = this._hass.states["sensor.khione_weight"];
    const configured = attr(weight, "configured", false);
    const currentKg = configured ? Number(attr(weight, "current", DEFAULT_WEIGHT_KG)) : DEFAULT_WEIGHT_KG;
    const range = root.getElementById("weight-input");
    const out = root.getElementById("weight-output");
    range.value = currentKg;
    out.textContent = currentKg.toFixed(1) + "kg";

    const age = attr(weight, "profile_age", DEFAULT_PROFILE.age);
    const height = attr(weight, "profile_height", DEFAULT_PROFILE.height_cm);
    const sex = attr(weight, "profile_sex", DEFAULT_PROFILE.sex);
    const activity = String(attr(weight, "profile_activity", DEFAULT_PROFILE.activity));
    root.getElementById("profile-age").value = age;
    root.getElementById("profile-height").value = height;
    const sexSel = root.getElementById("profile-sex");
    if ([...sexSel.options].some((o) => o.value === sex)) sexSel.value = sex;
    const activitySel = root.getElementById("profile-activity");
    if ([...activitySel.options].some((o) => o.value === activity)) activitySel.value = activity;
  }

  // Builds a single recipe-library group's cards. Dinner recipes get a
  // Batch/Cook-fresh chip (the only group the mockup ever drew one for —
  // real breakfast/lunch/snack recipes are all batch:0/fresh:false too).
  // Ingredients/instructions are each one prose string from the sensor
  // (see file header comment #3), not a fabricated bullet list.
  _recipeCardHTML(r, showChip) {
    const chip = !showChip ? "" :
      r.fresh ? '<div class="rc-chips"><span class="chip hot">Cook fresh</span></div>' :
      r.batch > 0 ? '<div class="rc-chips"><span class="chip">Batch ' + r.batch + '</span></div>' : "";
    const ingredients = (r.ingredients || "").trim();
    const instructions = (r.instructions || "").trim();
    return (
      '<details class="recipe">' +
        '<summary>' +
          '<div class="rc-main">' +
            '<div class="rc-name">' + escapeHtml(r.name) + '</div>' +
            '<div class="rc-sub">' + escapeHtml(r.detail) + '</div>' +
            chip +
          '</div>' +
          '<span class="expand-ctl"><span class="txt-closed">Expand</span><span class="txt-open">Collapse</span><svg class="icon"><use href="#i-chevron"></use></svg></span>' +
        '</summary>' +
        '<div class="rc-body">' +
          (ingredients ? '<h5>Ingredients</h5><p class="instr">' + escapeHtml(ingredients) + '</p>' : '') +
          (instructions ? '<h5>Method</h5><p class="instr">' + escapeHtml(instructions) + '</p>' : '') +
        '</div>' +
      '</details>'
    );
  }

  _renderRecipes() {
    const root = this._root;
    const groups = [["breakfast", false], ["lunch", false], ["snacks", false], ["dinner", true]];
    for (const [slot, showChip] of groups) {
      const sensor = this._hass.states["sensor.khione_meals_recipes_" + slot];
      const recipes = attr(sensor, "recipes", []) || [];
      const grid = root.getElementById("recipes-" + slot);
      grid.innerHTML = recipes.length
        ? recipes.map((r) => this._recipeCardHTML(r, showChip)).join("")
        : '<p class="shop-card empty">No recipes yet.</p>';
    }
  }

  _renderLiveData() {
    const hass = this._hass;
    if (!hass) return;
    const root = this._root;
    const states = hass.states;

    const today = states["sensor.khione_meals_today"];
    const tonight = states["sensor.khione_meals_tonight"];
    const preview = states["sensor.khione_meals_preview"];
    const weight = states["sensor.khione_weight"];

    // Hero + today's meals/macros.
    const dayName = (today && today.state) || "—";
    const week = attr(today, "week", "—");
    const totalWeeks = attr(today, "total_weeks", "—");
    root.getElementById("hero-sub").innerHTML =
      "Today is <strong>" + escapeHtml(dayName) + "</strong> &middot; Week <strong>" + escapeHtml(week) +
      "</strong> of <strong>" + escapeHtml(totalWeeks) + "</strong> of the rotation";
    root.getElementById("today-breakfast").textContent = attr(today, "breakfast", "—");
    root.getElementById("today-lunch").textContent = attr(today, "lunch", "—");
    root.getElementById("today-snacks").textContent = attr(today, "snacks", "—");
    root.getElementById("today-dinner").textContent = attr(today, "dinner", "—");

    const kcal = Number(attr(today, "kcal", 0)) || 0;
    const kcalPct = Number(attr(today, "kcal_percent", 0)) || 0;
    const protein = Number(attr(today, "protein", 0)) || 0;
    const proteinPct = Number(attr(today, "protein_percent", 0)) || 0;
    root.getElementById("kcal-text").textContent = kcal.toLocaleString() + " kcal · " + kcalPct + "%";
    root.getElementById("kcal-bar").style.width = Math.min(100, kcalPct) + "%";
    root.getElementById("protein-text").textContent = protein + "g · " + proteinPct + "%";
    root.getElementById("protein-bar").style.width = Math.min(100, proteinPct) + "%";

    // Weight card.
    const figsEl = root.getElementById("weight-figs");
    const barEl = root.getElementById("weight-bar");
    const noteEl = root.getElementById("weight-progress-note");
    if (attr(weight, "configured", false)) {
      const current = attr(weight, "current", "—");
      const currentDate = attr(weight, "current_date", "—");
      const lost = attr(weight, "lost", "—");
      const toGo = attr(weight, "to_go", "—");
      const percent = Number(attr(weight, "percent", 0)) || 0;
      const maint = attr(weight, "maint", "—");
      figsEl.innerHTML =
        '<span class="big">' + escapeHtml(current) + 'kg</span>' +
        '<span>Logged ' + escapeHtml(currentDate) + '</span>' +
        '<span>Lost ' + escapeHtml(lost) + 'kg · ' + escapeHtml(toGo) + 'kg to go</span>' +
        '<span>Est. maintenance ~' + escapeHtml(maint) + ' kcal/day</span>';
      barEl.style.width = Math.min(100, Math.max(0, percent)) + "%";
      noteEl.textContent = percent + "% of the way to goal";
    } else {
      figsEl.innerHTML = '<span>No weigh-ins logged yet.</span>';
      barEl.style.width = "0%";
      noteEl.textContent = "";
    }

    // Tonight & tomorrow.
    const tonightKind = attr(tonight, "kind", "cook");
    root.getElementById("tonight-tag-text").textContent = tonightKind === "cook" ? "Cook fresh tonight" : "Tonight's leftovers";
    root.getElementById("tonight-name").textContent = (tonight && tonight.state) || "—";
    root.getElementById("tonight-detail").textContent = attr(tonight, "detail", "");
    root.getElementById("tonight-ingredients").textContent = attr(tonight, "ingredients", "—");
    root.getElementById("tonight-method").textContent = attr(tonight, "instructions", "—");
    root.getElementById("tomorrow-name").textContent = attr(tonight, "tomorrow", "—");

    // Week nav label + "Today" pressed state, from the browsable preview.
    const previewWeek = (preview && preview.state) || "—";
    const previewTotal = attr(preview, "total_weeks", "—");
    const isCurrent = !!attr(preview, "is_current", false);
    root.getElementById("week-view-label").textContent = "Week " + previewWeek + " of " + previewTotal;
    root.getElementById("week-today-btn").setAttribute("aria-pressed", isCurrent ? "true" : "false");
    root.getElementById("week-count").textContent = "Week " + previewWeek + " of " + previewTotal;
    root.getElementById("shop-count").textContent = "Week " + previewWeek + " of " + previewTotal;

    // This week's table, from the preview's `days` array.
    const days = attr(preview, "days", []) || [];
    root.getElementById("week-tbody").innerHTML = days.map((d) => (
      '<tr' + (d.is_today ? ' class="today"' : '') + '>' +
        '<th scope="row">' + escapeHtml(d.name) + (d.is_today ? '<span class="today-pill">today</span>' : '') + '</th>' +
        '<td>' + escapeHtml(d.breakfast) + '</td>' +
        '<td>' + escapeHtml(d.lunch) + '</td>' +
        '<td>' + escapeHtml(d.snacks) + '</td>' +
        '<td>' + escapeHtml(d.dinner) + '</td>' +
      '</tr>'
    )).join("");

    // Shopping list, from the preview's shopping_{section} attributes.
    for (const section of ["breakfast", "lunch", "snacks", "dinner"]) {
      const items = attr(preview, "shopping_" + section, []) || [];
      const ul = root.getElementById("shop-" + section);
      ul.innerHTML = items.length
        ? items.map((item) => '<li>' + escapeHtml(item) + '</li>').join("")
        : '<li class="empty">Nothing needed.</li>';
    }
  }
}

customElements.define("khione-meals-panel", KhioneMealsPanel);
