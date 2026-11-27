// payload/editions/server/ha-dashboard/panels/todo.js
// Khione TODO custom panel. Post-it-note style cards with a markdown
// body each -- add, edit (click the body to edit raw markdown, blur to
// save + re-render), delete. See _tokens.js for shared tokens/theme.
import { SHARED_TOKENS_CSS, ensureGoogleFontsLoaded, initTheme, toggleTheme, ensureMobileMenuButton, setMobileMenuButtonVisible } from "./_tokens.js";

const MARKED_SRC = "https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js";

const PAGE_CSS = `
:host{
  display:block;
  min-height: 100vh;
  --khione-deep:#5f8a3f;
  --shadow-c:112,77,44;
  --ink-rgb:40,54,24;
  --font-display:"Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-body:'IBM Plex Mono', 'Courier New', monospace;
  --note-bg:#e9dfc4;
  --note-ink:#3a3418;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
}
:host([data-theme="dark"]){ --khione-deep:#a3cf7d; --shadow-c:0,0,0; --ink-rgb:206,226,180; --note-bg:#3a3526; --note-ink:#e9dfc4; }
@media (prefers-color-scheme: dark){
  :host(:not([data-theme="light"])){ --khione-deep:#a3cf7d; --shadow-c:0,0,0; --ink-rgb:206,226,180; --note-bg:#3a3526; --note-ink:#e9dfc4; }
}

*{ box-sizing:border-box; }
h1{ font-family: var(--font-display); font-weight: 800; margin:0; text-wrap: balance; color: var(--ink); }
.icon{ width:1.2em; height:1.2em; stroke:currentColor; fill:none; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }

.wrap{ position:relative; padding: max(18px, env(safe-area-inset-top,0px)) max(18px, env(safe-area-inset-right,0px)) 2rem max(18px, env(safe-area-inset-left,0px)); max-width: 1400px; margin: 0 auto; }

.page-head{ display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.2rem; flex-wrap:wrap; }
.page-head-actions{ display:flex; align-items:center; gap:.7rem; }
.theme-toggle{
  position:relative; width:38px; height:38px; flex:0 0 auto;
  border-radius:50%; border:1px solid rgba(var(--ink-rgb),.15);
  background: color-mix(in srgb, var(--accent-soft) 30%, var(--card-bg)); color: var(--accent);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
}
.theme-toggle:hover{ background: color-mix(in srgb, var(--accent-soft) 45%, var(--card-bg)); }
.theme-toggle .icon{ width:18px; height:18px; }

.action-btn{
  font-family: inherit; font-size:.82rem; font-weight:700; cursor:pointer;
  border:none; border-radius:999px; padding:.55rem 1.1rem;
  background: color-mix(in srgb, var(--khione-green) 24%, var(--card-bg)); color: var(--khione-deep);
}
.action-btn:hover{ background: color-mix(in srgb, var(--khione-green) 38%, var(--card-bg)); }

.empty-state{ color:var(--muted); font-size:.9rem; padding:2rem 0; text-align:center; }

.todo-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:1.1rem; align-items:start; }
@media (max-width: 900px){ .todo-grid{ grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 500px){ .todo-grid{ grid-template-columns: 1fr; } }

.note-card{
  position:relative;
  background: var(--note-bg); color: var(--note-ink);
  border-radius: 6px;
  padding: 1rem 1.1rem 1.2rem;
  box-shadow: 0 4px 10px rgba(var(--shadow-c),.22);
  min-height: 280px;
  display:flex; flex-direction:column; gap:.6rem;
}
.note-card::after{
  content:""; position:absolute; right:0; bottom:0; width:0; height:0;
  border-style:solid; border-width:0 0 16px 16px;
  border-color: transparent transparent rgba(var(--shadow-c),.28) transparent;
}
.note-delete{
  position:absolute; top:.6rem; right:.6rem; width:20px; height:20px;
  border-radius:50%; border:none; background:#e53935; color:#fff;
  font-size:13px; font-weight:800; line-height:20px; text-align:center;
  cursor:pointer; padding:0;
}
.note-delete:hover{ background:#c62828; }
.note-title{
  font-family: var(--font-display); font-weight:800; font-size:1.05rem;
  background:transparent; border:none; color:inherit; padding:0; padding-right:1.6rem;
  outline:none; width:100%;
}
.note-title::placeholder{ color: color-mix(in srgb, currentColor 55%, transparent); }
.note-title:focus{ text-decoration:underline; text-decoration-style:dotted; }
.note-body{ flex:1; font-size:.85rem; line-height:1.5; }
.note-body-view{ cursor:text; min-height:2.5em; }
.note-body-view p{ margin:0 0 .5em; }
.note-body-view ul,.note-body-view ol{ margin:.3em 0 .5em 1.1em; padding:0; }
.note-body-view h1,.note-body-view h2,.note-body-view h3{ font-size:1em; margin:.4em 0 .2em; }
.note-body-view:empty::before{ content:"Click to write..."; color: color-mix(in srgb, currentColor 55%, transparent); font-style:italic; }
.note-body-edit{
  width:100%; min-height:10em; resize:vertical; border:none; outline:none;
  background: color-mix(in srgb, var(--note-ink) 6%, transparent);
  color:inherit; font-family: var(--font-body); font-size:.85rem; line-height:1.5;
  padding:.4em; border-radius:3px;
}
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
    <h1>TODO</h1>
    <div class="page-head-actions">
      <button class="action-btn" id="btn-add-note" type="button">+ Add note</button>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle light/dark theme" title="Toggle light/dark theme">
        <svg class="icon" id="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-moon"></use></svg>
      </button>
    </div>
  </div>

  <div class="todo-grid" id="todo-grid"></div>
</main>
`;

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

class KhioneTodoPanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._rendered = false;
    // Card ids currently showing the raw-markdown textarea instead of
    // the rendered view -- survives across re-renders triggered by
    // unrelated hass state updates while someone's mid-edit elsewhere.
    this._editingBody = new Set();
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
      this._loadMarked();
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

    const addBtn = this._root.getElementById("btn-add-note");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this._hass.callService("pyscript", "khione_todo_add_card", {});
      });
    }
  }

  // marked ships as a classic <script src>; innerHTML never executes
  // <script> tags (shadow DOM or not), so it has to be created and
  // appended programmatically -- same technique weather.js uses for
  // Leaflet. Runs once, in the one-time render branch.
  _loadMarked() {
    if (window.marked) {
      this._markedReady = true;
      return;
    }
    const script = document.createElement("script");
    script.src = MARKED_SRC;
    script.onload = () => {
      this._markedReady = true;
      this._renderLiveData();
    };
    this._root.appendChild(script);
  }

  _renderMarkdown(raw) {
    if (!raw) return "";
    if (this._markedReady && window.marked) {
      try {
        return window.marked.parse(raw);
      } catch (e) {
        // Malformed input shouldn't take the whole card down -- fall
        // through to the escaped-plain-text rendering below.
      }
    }
    // Before marked loads (or if parsing throws), still show the text
    // -- escaped, with line breaks -- rather than leaving the card blank.
    return escapeHtml(raw).replace(/\n/g, "<br>");
  }

  _cardsFromHass() {
    const sensor = this._hass.states["sensor.khione_todo_cards"];
    return (sensor && sensor.attributes && sensor.attributes.cards) || [];
  }

  _renderLiveData() {
    if (!this._hass) return;
    const root = this._root;
    const grid = root.getElementById("todo-grid");

    // hass pushes a new object on basically every entity change system-
    // wide, not just this panel's own sensor -- rebuilding the grid's
    // innerHTML on every single one wiped out whatever title/body text
    // was mid-typing (confirmed live: unusable, reload every ~1s).
    // Skip the rebuild entirely while focus is inside the grid; the
    // save-on-blur handlers already trigger a fresh render once editing
    // actually finishes, so nothing is lost by waiting.
    if (grid && grid.contains(root.activeElement)) return;

    const cards = this._cardsFromHass();

    if (!cards.length) {
      grid.innerHTML = '<p class="empty-state">No notes yet — click "+ Add note" to start one.</p>';
      return;
    }

    grid.innerHTML = cards.map((c) => {
      const editingBody = this._editingBody.has(c.id);
      return (
        '<div class="note-card" data-id="' + escapeHtml(c.id) + '">' +
        '<button class="note-delete" type="button" aria-label="Delete note" data-action="delete">&times;</button>' +
        '<input class="note-title" type="text" placeholder="Untitled" value="' + escapeHtml(c.title || "") + '" data-action="title">' +
        '<div class="note-body">' +
        (editingBody
          ? '<textarea class="note-body-edit" data-action="body-edit">' + escapeHtml(c.body || "") + '</textarea>'
          : '<div class="note-body-view" data-action="body-view">' + this._renderMarkdown(c.body || "") + '</div>') +
        '</div>' +
        '</div>'
      );
    }).join("");

    // The grid's innerHTML is fully replaced on every render, so old
    // nodes (and their listeners) are discarded wholesale -- fresh
    // listeners on the new nodes each time, nothing to unbind by hand.
    this._bindGridHandlers(grid);
  }

  _bindGridHandlers(grid) {
    grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest(".note-card").dataset.id;
        if (!window.confirm("Delete this note?")) return;
        this._hass.callService("pyscript", "khione_todo_delete_card", { id });
      });
    });

    grid.querySelectorAll('[data-action="title"]').forEach((input) => {
      input.addEventListener("blur", () => {
        const card = input.closest(".note-card");
        const id = card.dataset.id;
        const editor = card.querySelector('[data-action="body-edit"]');
        // If the body isn't being edited right now, its raw markdown
        // isn't in the DOM (only the rendered HTML is) -- read it back
        // from the last-known sensor data instead of losing it.
        const body = editor ? editor.value : this._rawBodyFor(id);
        this._hass.callService("pyscript", "khione_todo_save_card", { id, title: input.value, body });
      });
    });

    grid.querySelectorAll('[data-action="body-view"]').forEach((view) => {
      view.addEventListener("click", () => {
        const id = view.closest(".note-card").dataset.id;
        this._editingBody.add(id);
        this._renderLiveData();
        const textarea = grid.querySelector('.note-card[data-id="' + id + '"] [data-action="body-edit"]');
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      });
    });

    grid.querySelectorAll('[data-action="body-edit"]').forEach((textarea) => {
      textarea.addEventListener("blur", () => {
        const card = textarea.closest(".note-card");
        const id = card.dataset.id;
        const title = card.querySelector('[data-action="title"]').value;
        this._editingBody.delete(id);
        this._hass.callService("pyscript", "khione_todo_save_card", { id, title, body: textarea.value });
      });
    });
  }

  _rawBodyFor(id) {
    const card = this._cardsFromHass().find((c) => c.id === id);
    return card ? card.body || "" : "";
  }
}

customElements.define("khione-todo-panel", KhioneTodoPanel);
