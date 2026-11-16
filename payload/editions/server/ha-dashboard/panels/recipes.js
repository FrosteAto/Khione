// payload/editions/server/ha-dashboard/panels/recipes.js
// Khione Recipes custom panel. Ported from the approved mockup scratchpad
// mockups/recipes-redesign-washi-ghibli-brand.html — this file is a
// data-wiring change onto that approved design, not a redesign. See
// _tokens.js for the shared brand tokens/theme toggle, and weather.js/
// home.js/plants.js/meals.js for the sibling panels this follows the same
// wrapper mechanics as.
//
// Adaptations from the mockup, beyond the usual shadow-DOM/token
// retargeting (see plants.js's header comment for that baseline):
// 1. The mockup's own 22-recipe sample array (plus its optimistic, no-op
//    submit/delete handlers that only ever mutated that in-memory array)
//    is dropped. The library grid is now built from the real
//    sensor.khione_meals_recipes_{breakfast,lunch,snacks,dinner} sensors
//    (same sensors/attribute shape meals.js's recipe library reads, and
//    the now-retired recipes-view.yaml's Jinja used to read), and
//    Save/Delete go through
//    real hass.callService calls to Task 5's
//    khione_meals_save_recipe/delete_recipe.
// 2. Each sensor's `recipes` attribute gives {id, name, detail,
//    ingredients, instructions, batch, fresh} per recipe — not the
//    separate kcal_min/kcal_max/protein_min/protein_max numbers the
//    mockup's sample data (and its kcalRange()/proteinRange() helpers,
//    and the Edit-recipe form-fill) assume. `detail` is khione_meals.py's
//    macro_detail() output, e.g. "~315 kcal · ~27g protein" or
//    "~520–580 kcal · ~45–50g protein" — a deterministic, lossless
//    rendering of those exact 4 numbers, so parseMacroDetail() below
//    inverts it back into {kcalMin, kcalMax, proteinMin, proteinMax} and
//    feeds them into the mockup's own kcalRange()/proteinRange()/
//    loadIntoForm() unchanged. This is the only way to keep the Edit
//    button restoring every form field (including the macro-range
//    inputs) without changing khione_meals.py, which is out of this
//    file's scope. Falls back to 0/0 if a detail string ever doesn't
//    match the expected shape, rather than throwing.
// 3. Each recipe's `meal_type` isn't in the sensor payload either (the
//    backend already pre-filters each of the 4 sensors by meal type) —
//    tagged client-side from which of the 4 sensors it came from
//    (sensor-key "snacks" -> meal_type "snack", matching
//    khione_meals.py's MEAL_TYPES; the other 3 keys match their sensor
//    suffix as-is).
// 4. The mockup's logistics chip ("Cooked fresh" / "Batch ×N") was drawn
//    unconditionally on every card, assuming every sample recipe had a
//    meaningful batch/fresh value. Real breakfast/lunch/snack recipes are
//    all batch:0/fresh:false placeholders (only dinner recipes carry real
//    batch-cooking data) — same quirk meals.js's recipe library already
//    found in this exact data, handled the same way here: the chip is
//    only rendered when fresh is true or batch > 0, instead of showing a
//    nonsensical "Batch ×0" on every non-dinner card.
// 5. Recipe IDs: khione_meals_save_recipe ignores the submitted `id`
//    entirely unless it exactly matches an existing recipe's id (editing
//    that recipe) — otherwise it always slugifies a fresh id from `name`.
//    So the mockup's own client-side slugify/duplicate-id-check logic
//    (which existed only to manage its fake local array) is dropped
//    entirely; the form's Recipe ID field is sent through verbatim, same
//    as the now-retired recipes-view.yaml's own note said: "Leave Recipe
//    ID blank to create a new recipe, or paste an existing one's ID to
//    edit it."
// 6. A `.theme-toggle` button (+ a new ic-moon icon; every other mockup
//    icon is kept byte-for-byte) is added inside a new `.hero-row`
//    wrapper — the mockup had no toggle markup at all, same gap every
//    sibling panel's mockup had. `.hero-inner`/`.hero-row`/
//    `.theme-toggle` CSS is the same split meals.js already uses.
// 7. Checked the meal-type `<select>`'s options per the task brief's
//    explicit call-out (the same silent-failure class Task 6 found in the
//    profile form): every option already has an explicit, correct,
//    lowercase `value="breakfast"/"lunch"/"snack"/"dinner"` (singular
//    "snack", matching MEAL_TYPES) in the mockup as given — no fix
//    needed here, unlike Task 6's profile `<select>`.
// 8. The grid, stat-pill counts, tab counts, hero blurb count and footer
//    count are recomputed on every hass tick (not built once like
//    meals.js's recipe library) — safe here because, unlike meals.js's
//    `<details>` cards, this mockup's `<article class="rcard">` cards
//    hold no open/closed (or other mutable) DOM state of their own, so
//    rebuilding them can't silently discard anything a user was
//    interacting with. The active tab filter is kept in `this._filter`
//    (a plain instance field, not DOM state) and reapplied each rebuild.
import { SHARED_TOKENS_CSS, ensureGoogleFontsLoaded, initTheme, toggleTheme, ensureMobileMenuButton, setMobileMenuButtonVisible } from "./_tokens.js";

// ---------------------------------------------------------------------------
// PAGE_CSS — ported from the mockup's main <style> block. `:root{...}` /
// `:root[data-theme="dark"]{...}` / the prefers-color-scheme fallback are
// replaced by a `:host`/`:host([data-theme="dark"])` pair: `--bg`,
// `--card-bg`, `--ink`, `--muted`, `--accent`, `--accent-soft`,
// `--band-bg`, `--band-ink` already come from SHARED_TOKENS_CSS with the
// exact same light/dark hex values the mockup used. `--khione` aliases
// SHARED's `--khione-green` (identical value, theme-invariant). The
// mockup's secondary tag colors (`--purple`/`--blue`/`--yellow`) and its
// hover accent (`--khione-deep`) use different hex values than
// SHARED_TOKENS_CSS's fixed `--khione-purple`/`--khione-blue`/
// `--khione-yellow` (and have their own dark-mode variants SHARED doesn't
// provide), so they stay page-local, same as `--shadow-c` and the three
// font vars. `body`/`body::before` -> `:host`/`:host::before` (+
// display:block, custom elements default to inline).
// ---------------------------------------------------------------------------
const PAGE_CSS = `
*{ box-sizing:border-box; }
:host{
  display:block;
  --font-display:"Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-body:'IBM Plex Mono', 'Courier New', monospace;
  --font-script:'Satisfy', cursive;
  --khione: var(--khione-green);
  --khione-deep:#5f8a3c;
  --purple:#5d4799;
  --blue:#2f98ab;
  --yellow:#a9822f;
  --shadow-c: 112,77,44;
  background:var(--bg);
  color:var(--ink);
  font-family:var(--font-body);
  font-size:15px;
  line-height:1.55;
  position:relative;
}
:host([data-theme="dark"]){
  --khione-deep:#a7d185;
  --purple:#b6a3e8;
  --blue:#7fd4e3;
  --yellow:#d9b86a;
  --shadow-c: 0,0,0;
}
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"])){
    --khione-deep:#a7d185;
    --purple:#b6a3e8;
    --blue:#7fd4e3;
    --yellow:#d9b86a;
    --shadow-c: 0,0,0;
  }
}
:host::before{
  content:"";
  position:fixed; inset:0;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.16  0 0 0 0 0.21  0 0 0 0 0.09  0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode:multiply;
  opacity:.5;
  pointer-events:none;
  z-index:0;
}
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"]))::before{ mix-blend-mode:screen; opacity:.06; }
}
:host([data-theme="dark"])::before{ mix-blend-mode:screen; opacity:.06; }

h1,h2,h3,h4{ font-family:var(--font-display); font-weight:800; margin:0; text-wrap:balance; letter-spacing:-.01em; }
p{ margin:0; }
ul{ margin:0; padding:0; list-style:none; }
button, input, select, textarea{ font-family:inherit; color:inherit; }
:focus-visible{ outline:2.5px solid var(--khione-deep); outline-offset:2px; border-radius:4px; }
.sr-only{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
.icon{ width:1.2em; height:1.2em; stroke:currentColor; fill:none; stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }

.wrap{
  position:relative; z-index:1;
  padding-left:max(18px, env(safe-area-inset-left, 0px));
  padding-right:max(18px, env(safe-area-inset-right, 0px));
}

/* ---------- blobs & icon badges ---------- */
.blob{ position:absolute; z-index:0; }
.icon-badge{ position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.icon-badge .blob{
  position:absolute; inset:0;
  background:var(--card-bg);
  box-shadow:0 6px 14px rgba(var(--shadow-c),.16), 0 20px 36px -16px rgba(var(--shadow-c),.22);
}
.icon-badge .icon{ position:relative; width:26px; height:26px; color:var(--khione-deep); }
.badge-1 .blob{ border-radius:42% 58% 55% 45% / 48% 44% 56% 52%; }
.badge-2 .blob{ border-radius:58% 42% 46% 54% / 54% 60% 40% 46%; }
.badge-3 .blob{ border-radius:38% 62% 60% 40% / 55% 46% 54% 45%; }
.badge-4 .blob{ border-radius:62% 38% 44% 56% / 40% 58% 42% 60%; }
.icon-badge.on-band .blob{ background:rgba(254,250,224,.22); box-shadow:0 8px 18px rgba(0,0,0,.12); }
.icon-badge.on-band .icon{ color:var(--band-ink); }
.icon-badge.cat-breakfast .icon{ color:var(--yellow); }
.icon-badge.cat-lunch .icon{ color:var(--blue); }
.icon-badge.cat-snack .icon{ color:var(--purple); }
.icon-badge.cat-dinner .icon{ color:var(--khione-deep); }

/* ---------- hero band ---------- */
.hero{
  position:relative; overflow:hidden;
  background:linear-gradient(168deg, var(--band-bg) 0%, color-mix(in srgb, var(--band-bg) 82%, var(--ink) 10%) 100%);
  padding-block:2.6rem 2.1rem;
}
.hero .blob{ opacity:.5; }
.hero .blob.b1{ width:240px; height:240px; top:-90px; right:7%; background:#fff; opacity:.07; border-radius:46% 54% 58% 42% / 52% 46% 54% 48%; }
.hero .blob.b2{ width:150px; height:150px; bottom:-60px; left:9%; background:#fff; opacity:.06; border-radius:56% 44% 42% 58% / 44% 56% 40% 60%; }
.hero-inner{ position:relative; z-index:1; display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
.hero-row{ flex:1 1 auto; min-width:0; display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:1.4rem; }
.hero-title{ display:flex; align-items:center; gap:1rem; }
.hero h1{ color:var(--band-ink); font-size:clamp(1.9rem, 1.3rem + 1.8vw, 2.6rem); }
.hero .sub{ color:var(--band-ink); opacity:.82; font-size:.95rem; margin-top:.3rem; max-width:46ch; }
.hero .sub strong{ font-weight:700; opacity:1; }
.stat-pills{ display:flex; flex-wrap:wrap; gap:.55rem; }
.stat-pill{
  display:flex; align-items:center; gap:.4rem;
  background:rgba(254,250,224,.3); color:var(--band-ink);
  border-radius:999px; padding:.4rem .8rem .4rem .55rem; font-size:.82rem; font-weight:600;
}
.stat-pill .dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.stat-pill .n{ font-weight:700; font-variant-numeric:tabular-nums; }

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

/* ---------- sections ---------- */
section{ padding-block:2.2rem; position:relative; }
.section-head{ display:flex; align-items:center; gap:.9rem; margin-bottom:1.3rem; flex-wrap:wrap; }
.section-head h2{ font-size:1.4rem; color:var(--accent); }
.section-head .count{ color:var(--muted); font-size:.85rem; font-weight:600; }
.section-head-main{ display:flex; align-items:center; gap:.9rem; flex:1 1 auto; }
.note-script{ font-family:var(--font-script); color:var(--khione-deep); font-size:1.15rem; margin-left:auto; }

/* ---------- tabs ---------- */
.tabs{ display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:1.4rem; }
.tabs button{
  border:1.5px solid rgba(var(--shadow-c),.16); background:var(--card-bg); color:var(--muted);
  border-radius:999px; padding:.5rem 1rem; font-size:.85rem; font-weight:600; cursor:pointer;
  display:flex; align-items:center; gap:.45rem;
}
.tabs button .ct{ background:rgba(var(--shadow-c),.1); border-radius:999px; padding:.05rem .45rem; font-size:.78rem; font-variant-numeric:tabular-nums; }
.tabs button[aria-selected="true"]{ background:var(--khione); color:#fff; border-color:transparent; }
.tabs button[aria-selected="true"] .ct{ background:rgba(255,255,255,.25); color:#fff; }
.tabs button:hover{ border-color:var(--khione); }

/* ---------- recipe card grid ---------- */
.recipe-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1rem; }
.rcard{
  background:var(--card-bg);
  border-radius:20px;
  padding:1.1rem 1.2rem;
  box-shadow:0 3px 7px rgba(var(--shadow-c),.1), 0 18px 34px -18px rgba(var(--shadow-c),.22);
  border:1px solid rgba(var(--shadow-c),.07);
  display:flex; flex-direction:column; gap:.7rem;
  min-width:0;
}
.rcard-top{ display:flex; align-items:center; gap:.7rem; }
.rcard-top h3{ font-size:1.02rem; color:var(--ink); line-height:1.25; }
.chip{ display:inline-flex; align-items:center; gap:.3rem; border-radius:999px; padding:.22rem .6rem; font-size:.72rem; font-weight:700; letter-spacing:.01em; white-space:nowrap; }
.chip-breakfast{ background:color-mix(in srgb, var(--yellow) 18%, transparent); color:var(--yellow); }
.chip-lunch{ background:color-mix(in srgb, var(--blue) 18%, transparent); color:var(--blue); }
.chip-snack{ background:color-mix(in srgb, var(--purple) 16%, transparent); color:var(--purple); }
.chip-dinner{ background:color-mix(in srgb, var(--khione-deep) 16%, transparent); color:var(--khione-deep); }
.chip-logistics{ background:rgba(var(--shadow-c),.08); color:var(--muted); }
.rcard-meta{ display:flex; flex-wrap:wrap; gap:.4rem; }
.rcard-meta .chip .icon{ width:.95em; height:.95em; }
.rcard-id{ margin-top:auto; display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding-top:.6rem; border-top:1px dashed rgba(var(--shadow-c),.18); }
.rcard-id code{ font-size:.78rem; color:var(--accent); background:rgba(var(--shadow-c),.07); border-radius:7px; padding:.2rem .45rem; word-break:break-all; }
.rcard-edit{
  border:none; background:transparent; color:var(--khione-deep); font-weight:700; font-size:.78rem;
  cursor:pointer; padding:.3rem .2rem; flex-shrink:0;
}
.rcard-edit:hover{ text-decoration:underline; }
.empty-note{ color:var(--muted); font-size:.9rem; padding:1rem 0; }

/* ---------- form section ---------- */
.form-head-row{ display:flex; align-items:center; gap:.9rem; flex-wrap:wrap; justify-content:space-between; margin-bottom:1.3rem; }
.btn{
  border:none; border-radius:12px; cursor:pointer; font-weight:700; font-size:.88rem;
  padding:.65rem 1.15rem; display:inline-flex; align-items:center; gap:.5rem;
  box-shadow:0 3px 8px rgba(var(--shadow-c),.14);
}
.btn.ghost{ background:var(--card-bg); color:var(--accent); border:1.5px solid rgba(var(--shadow-c),.18); box-shadow:none; }
.btn.ghost:hover{ border-color:var(--khione); color:var(--khione-deep); }
.btn.save{ background:var(--khione); color:#fff; }
.btn.save:hover{ background:var(--khione-deep); }
.btn.delete{ background:transparent; color:#a24a3a; border:1.5px solid #a24a3a; box-shadow:none; }
.btn.delete:hover{ background:#a24a3a; color:#fff; }
.btn:disabled{ opacity:.6; cursor:not-allowed; }

.field-groups{ display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1.1rem; align-items:start; }
fieldset.group{
  border:none; margin:0; padding:1.15rem 1.25rem 1.3rem;
  background:var(--card-bg); border-radius:20px;
  box-shadow:0 3px 7px rgba(var(--shadow-c),.1), 0 18px 34px -18px rgba(var(--shadow-c),.2);
  border:1px solid rgba(var(--shadow-c),.07);
  min-width:0;
}
fieldset.group.content{ margin-top:1.1rem; }
.group legend{ display:flex; align-items:center; gap:.6rem; padding:0 0 .9rem; font-family:var(--font-display); font-weight:800; font-size:1rem; color:var(--accent); width:100%; }
.group legend .icon-badge{ width:36px; height:36px; }
.group legend .icon-badge .icon{ width:18px; height:18px; }
.field-row{ display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:.8rem; }
.field{ display:flex; flex-direction:column; gap:.35rem; margin-top:.8rem; }
.field label{ font-size:.76rem; font-weight:700; color:var(--muted); letter-spacing:.01em; }
.field input[type="text"], .field input[type="number"], .field select, .field textarea{
  background:var(--bg); color:var(--ink); border:1.5px solid rgba(var(--shadow-c),.18);
  border-radius:10px; padding:.55rem .65rem; font-size:.88rem; font-family:var(--font-body); width:100%;
}
.field input:focus-visible, .field select:focus-visible, .field textarea:focus-visible{ border-color:var(--khione-deep); }
.field textarea{ min-height:7.5rem; resize:vertical; line-height:1.5; }
.field.invalid input, .field.invalid select{ border-color:#a24a3a; }
.field .err{ font-size:.72rem; color:#a24a3a; min-height:1em; }
.content .field-row{ grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); }

/* cooked-fresh toggle */
.toggle-row{ display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin-top:.8rem; background:rgba(var(--shadow-c),.06); border-radius:12px; padding:.6rem .75rem; }
.toggle-row .lbl{ display:flex; flex-direction:column; gap:.1rem; }
.toggle-row .lbl span.t{ font-size:.82rem; font-weight:700; color:var(--ink); }
.toggle-row .lbl span.d{ font-size:.72rem; color:var(--muted); }
.switch{ position:relative; width:46px; height:26px; flex-shrink:0; }
.switch input{ position:absolute; opacity:0; width:100%; height:100%; margin:0; cursor:pointer; }
.switch .track{ position:absolute; inset:0; background:rgba(var(--shadow-c),.25); border-radius:999px; transition:background .15s; }
.switch .thumb{ position:absolute; top:3px; left:3px; width:20px; height:20px; background:#fff; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .15s; }
.switch input:checked + .track{ background:var(--khione); }
.switch input:checked + .track .thumb{ transform:translateX(20px); }
.switch input:focus-visible + .track{ outline:2.5px solid var(--khione-deep); outline-offset:2px; }

.form-actions{ display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-top:1.3rem; }
.status{ font-size:.85rem; font-weight:600; min-height:1.2em; }
.status.ok{ color:var(--khione-deep); }
.status.err{ color:#a24a3a; }
.buttons{ display:flex; gap:.7rem; flex-wrap:wrap; }

.confirm-row{
  margin-top:1rem; background:color-mix(in srgb, #a24a3a 12%, var(--card-bg));
  border:1.5px solid #a24a3a; border-radius:14px; padding:.9rem 1.1rem;
  display:flex; align-items:center; gap:1rem; flex-wrap:wrap;
}
.confirm-row p{ font-size:.86rem; flex:1 1 auto; min-width:200px; }
.confirm-row button{ border-radius:10px; padding:.45rem .9rem; font-weight:700; font-size:.82rem; cursor:pointer; border:none; }
.confirm-row #confirmYes{ background:#a24a3a; color:#fff; }
.confirm-row #confirmNo{ background:transparent; border:1.5px solid rgba(var(--shadow-c),.3); }

footer.foot{ padding-block:2rem 3rem; text-align:center; }
footer.foot .script{ font-family:var(--font-script); font-size:1.3rem; color:var(--khione-deep); }
footer.foot .small{ font-size:.76rem; color:var(--muted); margin-top:.3rem; }

@media (max-width:560px){
  .hero-inner{ align-items:flex-start; }
  .hero-row{ align-items:flex-start; }
  .section-head{ gap:.6rem; }
  .form-head-row{ flex-direction:column; align-items:stretch; }
}
`;

// ---------------------------------------------------------------------------
// PAGE_SHELL_HTML — markup ported from the mockup. Every hand-drawn icon
// <symbol> from the mockup's <svg aria-hidden="true"> defs block is kept
// byte-for-byte; ic-moon is new, for the theme toggle (ic-sun already
// existed and is reused for the toggle's light-mode icon). The already-
// fixed full-width 3-fieldset form row (the <!-- kept out of
// .field-groups --> comment and structure) and the tabbed recipe-card
// grid are kept exactly as they were in the mockup. The form fields'
// ids (f-id, f-name, f-mealtype, f-kcalmin, f-kcalmax, f-proteinmin,
// f-proteinmax, f-batch, f-cookedfresh, f-ingredients, f-instructions)
// and the delete-confirm row's ids (deleteBtn, confirmRow, confirmName,
// confirmYes, confirmNo, newBtn) are all the mockup's own — reused as-is.
// Added only: a `#hero-count`/`#stat-n-*`/`#tab-n-*`/`#footer-count` id
// each on text that used to be a hardcoded sample number, and the
// `.theme-toggle` button.
// ---------------------------------------------------------------------------
const PAGE_SHELL_HTML = `
<svg class="sr-only" aria-hidden="true">
  <symbol id="ic-book" viewBox="0 0 24 24"><path d="M4 5.5c2.5-1.3 5-1.4 7.5 0v13c-2.5-1.3-5-1.2-7.5 0z"/><path d="M19.5 5.5c-2.5-1.3-5-1.4-7.5 0v13c2.5-1.3 5-1.2 7.5 0z"/></symbol>
  <symbol id="ic-tag" viewBox="0 0 24 24"><path d="M11.8 3.5 19.8 4c.6 0 1 .5 1 1l.4 7.9-9.7 9.6L4 15l7.5-9.4c.3-.3.7-.6 1.3-.6z"/><circle cx="14.8" cy="8.3" r="1.3"/></symbol>
  <symbol id="ic-flame" viewBox="0 0 24 24"><path d="M12 3.5c1 2.4-.4 3.6-1.3 4.8-1.3 1.7-1.8 3-1.6 4.6.3-1 1-1.6 1.7-2-.2 2.4 1 3.6 2.6 4.6 2-1 3.3-2.8 3.1-5.2-.1-1.6-1-2.6-1.7-3.6.4 1 .2 1.9-.3 2.6-.1-2.6-1.3-4-2.5-5.8z"/></symbol>
  <symbol id="ic-leaf" viewBox="0 0 24 24"><path d="M19.5 4.6c.6 6.2-1.2 11-7 14.3-3.4 1.9-6.7 1-8-.4 4.3.2 7.6-1.4 9.9-4.3-2.6 1.1-5 1-7-.3C9.8 11 14.6 8.8 19.5 4.6z"/></symbol>
  <symbol id="ic-scale" viewBox="0 0 24 24"><path d="M12 3.5v16.5M6.5 7h11M6.5 7 4 12.5c1.6 1.4 4 1.4 5.5 0zM17.5 7 15 12.5c1.6 1.4 4 1.4 5.5 0z"/><path d="M8.5 20.5h7"/></symbol>
  <symbol id="ic-stove" viewBox="0 0 24 24"><path d="M5 9.5c1.6-1.4 3.4-1.4 5 0 1.6-1.4 3.4-1.4 5 0 1.6-1.4 3.4-1.4 4 0v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 13.5h8"/></symbol>
  <symbol id="ic-trash" viewBox="0 0 24 24"><path d="M5 7h14M9.5 7V5c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2M7 7l1 12.3c0 .9.7 1.7 1.7 1.7h4.6c1 0 1.7-.8 1.7-1.7L17 7"/><path d="M10.3 11v6M13.7 11v6"/></symbol>
  <symbol id="ic-plus" viewBox="0 0 24 24"><path d="M12 5.2v13.6M5.2 12h13.6"/></symbol>
  <symbol id="ic-pencil" viewBox="0 0 24 24"><path d="M16 4.3 19.6 7.9 8.8 18.7l-4 1 1-4z"/></symbol>
  <symbol id="ic-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.3"/><path d="M12 3.5v2.4M12 18v2.4M3.5 12h2.4M18 12h2.4M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M5.8 18.2l1.7-1.7M16.5 7.5l1.7-1.7"/></symbol>
  <symbol id="ic-sandwich" viewBox="0 0 24 24"><path d="M4 13.5h16L17.5 7a6 6 0 0 0-11 0z"/><path d="M4 13.5l1 5.5h14l1-5.5"/><path d="M8 13.5l1-2.5M12 13.5V10M16 13.5l-1-2.5"/></symbol>
  <symbol id="ic-seed" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="4.3" ry="7" transform="rotate(20 12 12)"/><path d="M9 7.5 15 16.8"/></symbol>
  <symbol id="ic-pot" viewBox="0 0 24 24"><path d="M5 11h14l-1.2 7.3a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7z"/><path d="M3.5 11h17M8 8.5c.5-1.5 2-1 2-2.5M12 8.5c.5-1.5 2-1 2-2.5M16 8.5c.3-1 1.3-1 1.5-2"/></symbol>
  <symbol id="ic-shelf" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="7" cy="6" r=".2"/></symbol>
  <symbol id="ic-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" stroke-linejoin="round"/></symbol>
</svg>

<header class="hero">
  <span class="blob b1"></span><span class="blob b2"></span>
  <div class="wrap hero-inner">
    <div class="hero-row">
      <div class="hero-title">
        <div class="icon-badge on-band badge-1"><span class="blob"></span><svg class="icon"><use href="#ic-book"/></svg></div>
        <div>
          <h1>Recipe Kitchen</h1>
          <p class="sub">Browse the <strong id="hero-count">&hellip;</strong> already in rotation, or add a new one. Copy an ID below into the form to edit that recipe.</p>
        </div>
      </div>
      <div class="stat-pills">
        <span class="stat-pill"><span class="dot" style="background:var(--yellow)"></span>Breakfast <span class="n" id="stat-n-breakfast">&hellip;</span></span>
        <span class="stat-pill"><span class="dot" style="background:var(--blue)"></span>Lunch <span class="n" id="stat-n-lunch">&hellip;</span></span>
        <span class="stat-pill"><span class="dot" style="background:var(--purple)"></span>Snacks <span class="n" id="stat-n-snack">&hellip;</span></span>
        <span class="stat-pill"><span class="dot" style="background:var(--khione)"></span>Dinner <span class="n" id="stat-n-dinner">&hellip;</span></span>
      </div>
    </div>
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
      <svg id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-moon"></use></svg>
    </button>
  </div>
</header>

<main class="wrap">
  <section aria-labelledby="library-heading">
    <div class="section-head">
      <div class="section-head-main">
        <div class="icon-badge badge-2"><span class="blob"></span><svg class="icon"><use href="#ic-shelf"/></svg></div>
        <h2 id="library-heading">Recipe Library</h2>
        <span class="count" id="libraryCount">&hellip;</span>
      </div>
    </div>
    <div class="tabs" role="tablist" aria-label="Filter recipes by meal type">
      <button role="tab" aria-selected="true" data-filter="all">All <span class="ct" id="tab-n-all">&hellip;</span></button>
      <button role="tab" aria-selected="false" data-filter="breakfast">Breakfast <span class="ct" id="tab-n-breakfast">&hellip;</span></button>
      <button role="tab" aria-selected="false" data-filter="lunch">Lunch <span class="ct" id="tab-n-lunch">&hellip;</span></button>
      <button role="tab" aria-selected="false" data-filter="snack">Snacks <span class="ct" id="tab-n-snack">&hellip;</span></button>
      <button role="tab" aria-selected="false" data-filter="dinner">Dinner <span class="ct" id="tab-n-dinner">&hellip;</span></button>
    </div>
    <div class="recipe-grid" id="recipeGrid"></div>
  </section>

  <section aria-labelledby="form-heading">
    <div class="form-head-row">
      <div class="section-head-main">
        <div class="icon-badge badge-3"><span class="blob"></span><svg class="icon"><use href="#ic-pencil"/></svg></div>
        <h2 id="form-heading">Add / Edit Recipe</h2>
      </div>
      <button type="button" class="btn ghost" id="newBtn"><svg class="icon"><use href="#ic-plus"/></svg>New recipe</button>
    </div>

    <form id="recipeForm" novalidate>
      <div class="field-groups">
        <fieldset class="group identity">
          <legend><div class="icon-badge badge-1"><span class="blob"></span><svg class="icon"><use href="#ic-tag"/></svg></div>Identity</legend>
          <div class="field">
            <label for="f-id">Recipe ID</label>
            <input type="text" id="f-id" name="id" placeholder="e.g. chicken-curry" autocomplete="off">
            <span class="err" id="err-id"></span>
          </div>
          <div class="field">
            <label for="f-name">Name</label>
            <input type="text" id="f-name" name="name" placeholder="e.g. Chicken curry" autocomplete="off">
            <span class="err" id="err-name"></span>
          </div>
          <div class="field">
            <label for="f-mealtype">Meal type</label>
            <select id="f-mealtype" name="mealType">
              <option value="">Choose one&hellip;</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="snack">Snack</option>
              <option value="dinner">Dinner</option>
            </select>
            <span class="err" id="err-mealtype"></span>
          </div>
        </fieldset>

        <fieldset class="group macros">
          <legend><div class="icon-badge badge-2"><span class="blob"></span><svg class="icon"><use href="#ic-flame"/></svg></div>Macro ranges</legend>
          <div class="field-row">
            <div class="field"><label for="f-kcalmin">Kcal min</label><input type="number" id="f-kcalmin" name="kcalMin" min="0"></div>
            <div class="field"><label for="f-kcalmax">Kcal max</label><input type="number" id="f-kcalmax" name="kcalMax" min="0"></div>
          </div>
          <div class="field-row">
            <div class="field"><label for="f-proteinmin">Protein min (g)</label><input type="number" id="f-proteinmin" name="proteinMin" min="0"></div>
            <div class="field"><label for="f-proteinmax">Protein max (g)</label><input type="number" id="f-proteinmax" name="proteinMax" min="0"></div>
          </div>
        </fieldset>

        <fieldset class="group logistics">
          <legend><div class="icon-badge badge-4"><span class="blob"></span><svg class="icon"><use href="#ic-scale"/></svg></div>Cooking logistics</legend>
          <div class="field">
            <label for="f-batch">Batch size (portions made at once)</label>
            <input type="number" id="f-batch" name="batch" min="0" value="1">
          </div>
          <div class="toggle-row">
            <div class="lbl"><span class="t">Cooked fresh</span><span class="d">Off = batch-cooked and stored</span></div>
            <label class="switch">
              <input type="checkbox" id="f-cookedfresh" name="cookedFresh">
              <span class="track"><span class="thumb"></span></span>
            </label>
          </div>
        </fieldset>
      </div>

      <!-- kept out of .field-groups: that auto-fit grid computes its track
           count from the container width regardless of how many items
           actually sit in a row, and a full-width-spanning sibling here kept
           3+ extra tracks "non-empty" so they never collapsed, leaving the
           Identity/Macros/Logistics row stuck narrow with dead space beside
           it on a wide screen (confirmed via a real rendered screenshot) -->
      <fieldset class="group content">
        <legend><div class="icon-badge badge-1"><span class="blob"></span><svg class="icon"><use href="#ic-pot"/></svg></div>Ingredients &amp; instructions</legend>
        <div class="field-row">
          <div class="field"><label for="f-ingredients">Ingredients</label><textarea id="f-ingredients" name="ingredients" placeholder="Comma-separated list"></textarea></div>
          <div class="field"><label for="f-instructions">Instructions</label><textarea id="f-instructions" name="instructions" placeholder="Short numbered steps"></textarea></div>
        </div>
      </fieldset>

      <div class="form-actions">
        <div class="status" id="formStatus" role="status" aria-live="polite"></div>
        <div class="buttons">
          <button type="submit" class="btn save"><svg class="icon"><use href="#ic-leaf"/></svg>Save recipe</button>
          <button type="button" class="btn delete" id="deleteBtn"><svg class="icon"><use href="#ic-trash"/></svg>Delete recipe</button>
        </div>
      </div>

      <div class="confirm-row" id="confirmRow" hidden>
        <p>Delete <strong id="confirmName"></strong>? This can&rsquo;t be undone.</p>
        <button type="button" id="confirmYes">Yes, delete</button>
        <button type="button" id="confirmNo">Cancel</button>
      </div>
    </form>
  </section>
</main>

<footer class="foot">
  <p class="script">stocked from the Khione kitchen, one batch at a time</p>
  <p class="small"><span id="footer-count">&hellip;</span> &middot; last tended by hand</p>
</footer>
`;

// ---------------------------------------------------------------------------
// Live-data helpers — module-local, pure functions, kept outside the class
// since none of them touch `this`. mealMeta/kcalRange/proteinRange are the
// mockup's own helpers, unchanged.
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

// Inverts khione_meals.py's macro_detail() string (the only place the
// sensor exposes a recipe's kcal/protein range) back into the 4 raw
// numbers — see file header comment #2. Falls back to zeros if the
// string doesn't match the expected shape.
function parseMacroDetail(detail) {
  const m = /^~?(\d+)(?:[–-](\d+))?\s*kcal\s*·\s*~?(\d+)(?:[–-](\d+))?\s*g\s*protein/i.exec(String(detail || "").trim());
  if (!m) return { kcalMin: 0, kcalMax: 0, proteinMin: 0, proteinMax: 0 };
  const kcalMin = Number(m[1]);
  const kcalMax = m[2] !== undefined ? Number(m[2]) : kcalMin;
  const proteinMin = Number(m[3]);
  const proteinMax = m[4] !== undefined ? Number(m[4]) : proteinMin;
  return { kcalMin, kcalMax, proteinMin, proteinMax };
}

const mealMeta = {
  breakfast: { label: "Breakfast", icon: "ic-sun", chip: "chip-breakfast", badge: "cat-breakfast" },
  lunch: { label: "Lunch", icon: "ic-sandwich", chip: "chip-lunch", badge: "cat-lunch" },
  snack: { label: "Snack", icon: "ic-seed", chip: "chip-snack", badge: "cat-snack" },
  dinner: { label: "Dinner", icon: "ic-pot", chip: "chip-dinner", badge: "cat-dinner" },
};

// Sensor-key -> real meal_type (MEAL_TYPES uses singular "snack"; the
// sensor/suffix convention uses plural "snacks" — see header comment #3).
const SLOT_TO_MEALTYPE = { breakfast: "breakfast", lunch: "lunch", snacks: "snack", dinner: "dinner" };

function kcalRange(r) { return r.kcalMin === r.kcalMax ? (r.kcalMin + " kcal") : (r.kcalMin + "–" + r.kcalMax + " kcal"); }
function proteinRange(r) { return r.proteinMin === r.proteinMax ? (r.proteinMin + "g protein") : (r.proteinMin + "–" + r.proteinMax + "g protein"); }

// Builds one recipe card. The logistics chip is only shown when it's
// actually meaningful (fresh, or a real batch size) — see header
// comment #4 for why an unconditional chip would show "Batch ×0" on
// every non-dinner recipe in the real data.
function recipeCardHTML(r) {
  const m = mealMeta[r.mealType] || mealMeta.dinner;
  const logisticsChip = r.cookedFresh
    ? '<span class="chip chip-logistics"><svg class="icon"><use href="#ic-stove"/></svg>Cooked fresh</span>'
    : r.batch > 0
      ? '<span class="chip chip-logistics"><svg class="icon"><use href="#ic-scale"/></svg>Batch &times;' + r.batch + '</span>'
      : "";
  return (
    '<article class="rcard" data-id="' + escapeHtml(r.id) + '">' +
      '<div class="rcard-top">' +
        '<div class="icon-badge badge-2 ' + m.badge + '"><span class="blob"></span><svg class="icon"><use href="#' + m.icon + '"/></svg></div>' +
        '<h3>' + escapeHtml(r.name) + '</h3>' +
      '</div>' +
      '<div class="rcard-meta">' +
        '<span class="chip ' + m.chip + '">' + m.label + '</span>' +
        '<span class="chip chip-logistics"><svg class="icon"><use href="#ic-flame"/></svg>' + kcalRange(r) + '</span>' +
        '<span class="chip chip-logistics"><svg class="icon"><use href="#ic-leaf"/></svg>' + proteinRange(r) + '</span>' +
        logisticsChip +
      '</div>' +
      '<div class="rcard-id">' +
        '<code>' + escapeHtml(r.id) + '</code>' +
        '<button type="button" class="rcard-edit" data-edit="' + escapeHtml(r.id) + '">Edit recipe</button>' +
      '</div>' +
    '</article>'
  );
}

// Reads the 4 recipes_* sensors into one flat array shaped like the
// mockup's own sample objects (id, name, mealType, kcalMin/Max,
// proteinMin/Max, batch, cookedFresh, ingredients, instructions), so the
// rest of this file's rendering/editing logic can stay close to the
// mockup's own functions.
function loadRecipesFromHass(hass) {
  const out = [];
  for (const [slot, mealType] of Object.entries(SLOT_TO_MEALTYPE)) {
    const sensor = hass.states["sensor.khione_meals_recipes_" + slot];
    const list = attr(sensor, "recipes", []) || [];
    for (const r of list) {
      const macros = parseMacroDetail(r.detail);
      out.push({
        id: r.id || "", name: r.name || "", mealType,
        kcalMin: macros.kcalMin, kcalMax: macros.kcalMax,
        proteinMin: macros.proteinMin, proteinMax: macros.proteinMax,
        batch: Number(r.batch) || 0, cookedFresh: !!r.fresh,
        ingredients: r.ingredients || "", instructions: r.instructions || "",
        inUse: !!r.in_use,
      });
    }
  }
  return out;
}

class KhioneRecipesPanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._rendered = false;
    this._filter = "all";
    this._recipes = [];
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
    this._renderLiveData();
  }

  // One-time DOM wiring: theme toggle, tab filter clicks, grid
  // edit-click delegation, the form's submit (Save) handler, and the
  // Delete/confirm flow. initTheme(this)/toggleTheme(this) are called
  // with the custom element itself, never this._root (a ShadowRoot has
  // no setAttribute/getAttribute).
  _bindStaticHandlers() {
    const root = this._root;

    const btn = root.getElementById("theme-toggle");
    const icon = root.getElementById("theme-toggle-icon");
    const paintIcon = (theme) => {
      if (!icon) return;
      icon.innerHTML = theme === "dark" ? '<use href="#ic-sun"></use>' : '<use href="#ic-moon"></use>';
    };
    paintIcon(this.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    if (btn) {
      btn.addEventListener("click", () => {
        const next = toggleTheme(this);
        paintIcon(next);
      });
    }

    // ---- Recipe Library tabs ----
    root.querySelectorAll(".tabs button").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        root.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", "false"));
        tabBtn.setAttribute("aria-selected", "true");
        this._filter = tabBtn.getAttribute("data-filter");
        this._renderRecipeGrid();
      });
    });

    // ---- Edit-recipe click (pure client-side form-fill, no service call) ----
    const grid = root.getElementById("recipeGrid");
    grid.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit]");
      if (!editBtn) return;
      const r = this._recipes.find((x) => x.id === editBtn.getAttribute("data-edit"));
      if (!r) return;
      loadIntoForm(r);
      root.getElementById("form-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // ---- Add/Edit Recipe form ----
    const form = root.getElementById("recipeForm");
    const fId = root.getElementById("f-id");
    const fName = root.getElementById("f-name");
    const fMeal = root.getElementById("f-mealtype");
    const fKcalMin = root.getElementById("f-kcalmin");
    const fKcalMax = root.getElementById("f-kcalmax");
    const fProMin = root.getElementById("f-proteinmin");
    const fProMax = root.getElementById("f-proteinmax");
    const fBatch = root.getElementById("f-batch");
    const fCookedFresh = root.getElementById("f-cookedfresh");
    const fIngredients = root.getElementById("f-ingredients");
    const fInstructions = root.getElementById("f-instructions");
    const statusEl = root.getElementById("formStatus");
    const confirmRow = root.getElementById("confirmRow");
    const confirmName = root.getElementById("confirmName");
    const saveBtn = form.querySelector('button[type="submit"]');
    const deleteBtn = root.getElementById("deleteBtn");
    const confirmYes = root.getElementById("confirmYes");
    const confirmNo = root.getElementById("confirmNo");

    const setStatus = (msg, kind) => {
      statusEl.textContent = msg;
      statusEl.className = "status" + (kind ? " " + kind : "");
    };
    const clearErrors = () => {
      ["id", "name", "mealtype"].forEach((key) => {
        root.getElementById("err-" + key).textContent = "";
        root.getElementById("f-" + key).closest(".field").classList.remove("invalid");
      });
    };
    const markError = (key, msg) => {
      root.getElementById("err-" + key).textContent = msg;
      root.getElementById("f-" + key).closest(".field").classList.add("invalid");
    };
    const hideConfirm = () => { confirmRow.hidden = true; };

    function loadIntoForm(r) {
      fId.value = r.id;
      fName.value = r.name;
      fMeal.value = r.mealType;
      fKcalMin.value = r.kcalMin;
      fKcalMax.value = r.kcalMax;
      fProMin.value = r.proteinMin;
      fProMax.value = r.proteinMax;
      fBatch.value = r.batch ?? 0;
      fCookedFresh.checked = !!r.cookedFresh;
      fIngredients.value = r.ingredients;
      fInstructions.value = r.instructions;
      setStatus("Editing “" + r.name + "”.", "ok");
      hideConfirm();
      clearErrors();
    }

    const clearForm = () => {
      form.reset();
      fBatch.value = 1;
      setStatus("", "");
      hideConfirm();
      clearErrors();
      fId.focus();
    };

    root.getElementById("newBtn").addEventListener("click", clearForm);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors();
      const name = fName.value.trim();
      const mealType = fMeal.value;
      let ok = true;
      if (!name) { markError("name", "Name is required."); ok = false; }
      if (!mealType) { markError("mealtype", "Choose a meal type."); ok = false; }
      if (!ok) { setStatus("Fix the highlighted fields before saving.", "err"); return; }

      const payload = {
        id: fId.value.trim(), name, meal_type: mealType,
        kcal_min: Number(fKcalMin.value) || 0, kcal_max: Number(fKcalMax.value) || 0,
        protein_min: Number(fProMin.value) || 0, protein_max: Number(fProMax.value) || 0,
        ingredients: fIngredients.value.trim(), instructions: fInstructions.value.trim(),
        batch: Number(fBatch.value) || 0, fresh: fCookedFresh.checked,
      };

      // Mirrors khione_meals.py's khione_meals_save_recipe validation
      // exactly (0 <= min <= max <= 3000/300, 0 <= batch <= 20): the
      // backend rejects out-of-range values with a silent log.error +
      // return (no exception), so the service call still resolves and a
      // naive .then() would show "Saved" even though nothing was
      // written. Check client-side first so the user gets a real error
      // instead of a false success.
      if (!(0 <= payload.kcal_min && payload.kcal_min <= payload.kcal_max && payload.kcal_max <= 3000)) {
        setStatus("Kcal min/max must be between 0 and 3000, with min ≤ max.", "err");
        return;
      }
      if (!(0 <= payload.protein_min && payload.protein_min <= payload.protein_max && payload.protein_max <= 300)) {
        setStatus("Protein min/max must be between 0 and 300, with min ≤ max.", "err");
        return;
      }
      if (!(0 <= payload.batch && payload.batch <= 20)) {
        setStatus("Batch size must be between 0 and 20.", "err");
        return;
      }

      saveBtn.disabled = true;
      setStatus("Saving “" + name + "”…", "");
      this._hass.callService("pyscript", "khione_meals_save_recipe", payload)
        .then(() => setStatus("Saved “" + name + "”.", "ok"))
        .catch(() => setStatus("Save failed — check the Home Assistant logs.", "err"))
        .finally(() => { saveBtn.disabled = false; });
    });

    deleteBtn.addEventListener("click", () => {
      const id = fId.value.trim();
      const r = this._recipes.find((x) => x.id === id);
      if (!r) { setStatus("Enter or choose a Recipe ID that already exists to delete it.", "err"); return; }
      // khione_meals_delete_recipe refuses in-use recipes with a silent
      // log.error + return (same convention as its other validation),
      // so the service call would still resolve -- check client-side
      // first so Delete can't report a false "Deleted" when nothing
      // happened.
      if (r.inUse) {
        setStatus("“" + r.name + "” is still used in the meal plan — remove it from the plan before deleting.", "err");
        return;
      }
      confirmName.textContent = r.name;
      confirmRow.hidden = false;
    });
    confirmNo.addEventListener("click", hideConfirm);
    confirmYes.addEventListener("click", () => {
      const id = fId.value.trim();
      hideConfirm();
      confirmYes.disabled = true;
      this._hass.callService("pyscript", "khione_meals_delete_recipe", { id })
        .then(() => setStatus("Deleted recipe “" + id + "”.", "ok"))
        .catch(() => setStatus("Delete failed — check the Home Assistant logs.", "err"))
        .finally(() => { confirmYes.disabled = false; });
      clearForm();
    });
  }

  // Filters this._recipes (already refreshed by _renderLiveData) by the
  // active tab and repaints the grid + its count. Safe to call on every
  // tick or on a tab click — see header comment #8 for why these cards
  // hold no mutable DOM state that could be lost by rebuilding.
  _renderRecipeGrid() {
    const root = this._root;
    const visible = this._recipes.filter((r) => this._filter === "all" || r.mealType === this._filter);
    root.getElementById("libraryCount").textContent = visible.length + (visible.length === 1 ? " recipe" : " recipes");
    const grid = root.getElementById("recipeGrid");
    grid.innerHTML = visible.length
      ? visible.map(recipeCardHTML).join("")
      : '<p class="empty-note">No recipes in this category yet. Use the form below to add one.</p>';
  }

  _renderLiveData() {
    const hass = this._hass;
    if (!hass) return;
    const root = this._root;

    this._recipes = loadRecipesFromHass(hass);
    const counts = { all: this._recipes.length, breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
    for (const r of this._recipes) counts[r.mealType] = (counts[r.mealType] || 0) + 1;

    const plural = (n) => n + (n === 1 ? " recipe" : " recipes");
    root.getElementById("hero-count").textContent = plural(counts.all);
    root.getElementById("footer-count").textContent = plural(counts.all);
    root.getElementById("stat-n-breakfast").textContent = counts.breakfast;
    root.getElementById("stat-n-lunch").textContent = counts.lunch;
    root.getElementById("stat-n-snack").textContent = counts.snack;
    root.getElementById("stat-n-dinner").textContent = counts.dinner;
    root.getElementById("tab-n-all").textContent = counts.all;
    root.getElementById("tab-n-breakfast").textContent = counts.breakfast;
    root.getElementById("tab-n-lunch").textContent = counts.lunch;
    root.getElementById("tab-n-snack").textContent = counts.snack;
    root.getElementById("tab-n-dinner").textContent = counts.dinner;

    this._renderRecipeGrid();
  }
}

customElements.define("khione-recipes-panel", KhioneRecipesPanel);
