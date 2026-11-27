"""Khione TODO: post-it-note style cards with markdown bodies.

Same shape as khione_meals.py -- plain Python above the pyscript glue
marker (testable with a normal python3 interpreter, no HA/pyscript
runtime needed), pyscript-only glue below it. Cards live under
/config/todo/cards.json, newest first.
"""
import json
import os
import uuid
from datetime import datetime

# pyscript requires blocking I/O (like plain open()) inside service/trigger
# functions to go through its executor so it doesn't stall the async event
# loop; outside pyscript (e.g. this file's own plain-Python test harness)
# that name doesn't exist, so fall back to a no-op decorator.
try:
    pyscript_executor
except NameError:
    def pyscript_executor(f):
        return f

DATA_DIR = "/config/todo"
CARDS_PATH = f"{DATA_DIR}/cards.json"

TITLE_MAX = 100
BODY_MAX = 20000


@pyscript_executor
def write_json(path, data, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
    os.replace(tmp, path)


@pyscript_executor
def load_json(path, default=None):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def load_cards():
    return load_json(CARDS_PATH, {"cards": []})["cards"]


def new_card_id(existing_ids):
    cid = uuid.uuid4().hex[:10]
    while cid in existing_ids:
        cid = uuid.uuid4().hex[:10]
    return cid


def clean_title(title):
    return (title or "").strip()[:TITLE_MAX]


def clean_body(body):
    return (body or "").strip()[:BODY_MAX]


def add_card(cards, now_iso):
    """Mutates cards in place (prepends), returns the new card."""
    card = {
        "id": new_card_id({c["id"] for c in cards}),
        "title": "", "body": "",
        "created": now_iso, "updated": now_iso,
    }
    cards.insert(0, card)
    return card


def save_card(cards, cid, title, body, now_iso):
    """Mutates the matching card in place. Returns it, or None if not found."""
    for c in cards:
        if c["id"] == cid:
            c["title"] = clean_title(title)
            c["body"] = clean_body(body)
            c["updated"] = now_iso
            return c
    return None


def delete_card(cards, cid):
    return [c for c in cards if c["id"] != cid]


# ---------------------------------------------------------------------------
# pyscript glue -- only runs inside the real pyscript/HA runtime. Everything
# above this line is plain Python, independently testable with python3.
# ---------------------------------------------------------------------------


def _recompute():
    cards = load_cards()
    state.set("sensor.khione_todo_cards", len(cards), new_attributes={"cards": cards})


@service
def khione_todo_add_card():
    cards = load_cards()
    add_card(cards, datetime.now().isoformat())
    write_json(CARDS_PATH, {"cards": cards})
    _recompute()


@service
def khione_todo_save_card(id=None, title=None, body=None):
    cid = (id or "").strip()
    if not cid:
        log.error("khione_todo_save_card: missing id")
        return
    cards = load_cards()
    if save_card(cards, cid, title, body, datetime.now().isoformat()) is None:
        log.error(f"khione_todo_save_card: no card with id {cid!r}")
        return
    write_json(CARDS_PATH, {"cards": cards})
    _recompute()


@service
def khione_todo_delete_card(id=None):
    cid = (id or "").strip()
    if not cid:
        log.error("khione_todo_delete_card: missing id")
        return
    cards = load_cards()
    # pyscript's restricted interpreter doesn't implement bare generator
    # expressions (confirmed live: NotImplementedError ast_generatorexp) --
    # needs the explicit list brackets, same as khione_meals.py's any([...]).
    if not any([c["id"] == cid for c in cards]):
        log.error(f"khione_todo_delete_card: no card with id {cid!r}")
        return
    write_json(CARDS_PATH, {"cards": delete_card(cards, cid)})
    _recompute()


# Run once at (re)load so the sensor exists immediately, not just after the
# first add/save/delete call.
_recompute()
