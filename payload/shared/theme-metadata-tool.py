#!/usr/bin/env python3
import json
import sys
from pathlib import Path, PurePath

SEP = "\x1f"


def fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(1)


def load_profiles(config_path: Path):
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"Failed to parse theme config JSON: {exc}")

    profiles = data.get("profiles")
    if not isinstance(profiles, list) or not profiles:
        fail("Theme config must contain a non-empty 'profiles' array.")

    return profiles


def parse_profile(idx: int, item: object):
    if not isinstance(item, dict):
        fail(f"profiles[{idx}] is not an object.")

    pid = str(item.get("id", "")).strip()
    name = str(item.get("name", "")).strip()
    knsv = str(item.get("knsv", "")).strip()
    desc = str(item.get("description", "")).strip().replace("\n", " ")
    profile_name = str(item.get("profileName", "")).strip() or Path(knsv).stem
    color_scheme = str(item.get("colorScheme", "")).strip()
    wallpaper = str(item.get("wallpaper", "")).strip()
    dotfiles = str(item.get("dotfiles", pid)).strip()

    if not pid:
        fail(f"profiles[{idx}] missing required field: id")
    if not knsv:
        fail(f"profiles[{idx}] missing required field: knsv")

    return {
        "id": pid,
        "name": name,
        "desc": desc,
        "knsv": knsv,
        "profileName": profile_name,
        "colorScheme": color_scheme,
        "wallpaper": wallpaper,
        "dotfiles": dotfiles,
    }


def emit_switcher_rows(config_path: Path) -> None:
    for idx, p in enumerate(load_profiles(config_path), start=1):
        parsed = parse_profile(idx, p)

        if not parsed["name"]:
            fail(f"profiles[{idx}] missing required field: name")

        row = SEP.join(
            [
                parsed["id"],
                parsed["name"],
                parsed["desc"],
                parsed["knsv"],
                parsed["profileName"],
                parsed["colorScheme"],
                parsed["wallpaper"],
                parsed["dotfiles"],
            ]
        )
        print(row)


def emit_installer_rows(config_path: Path) -> None:
    seen_ids = set()
    seen_knsv = set()
    seen_wallpapers = set()

    for idx, p in enumerate(load_profiles(config_path), start=1):
        parsed = parse_profile(idx, p)
        pid = parsed["id"]
        knsv = parsed["knsv"]
        wallpaper = parsed["wallpaper"]
        dotfiles = parsed["dotfiles"]

        if PurePath(knsv).name != knsv:
            fail(f"profiles[{idx}] knsv must be a filename only: {knsv}")
        if wallpaper and PurePath(wallpaper).name != wallpaper:
            fail(f"profiles[{idx}] wallpaper must be a filename only: {wallpaper}")
        if not dotfiles:
            fail(f"profiles[{idx}] dotfiles cannot be empty")
        if PurePath(dotfiles).name != dotfiles:
            fail(f"profiles[{idx}] dotfiles must be a directory name only: {dotfiles}")

        if pid in seen_ids:
            fail(f"Duplicate profile id in theme metadata: {pid}")
        seen_ids.add(pid)

        if knsv in seen_knsv:
            fail(f"Duplicate knsv filename in theme metadata: {knsv}")
        seen_knsv.add(knsv)

        if wallpaper:
            if wallpaper in seen_wallpapers:
                fail(
                    "Duplicate wallpaper filename in theme metadata: "
                    f"{wallpaper}\nUse unique wallpaper filenames per theme when flattening assets."
                )
            seen_wallpapers.add(wallpaper)

        print(SEP.join([pid, knsv, wallpaper, dotfiles]))


def main() -> None:
    if len(sys.argv) != 3:
        fail("Usage: theme-metadata-tool.py <switcher-rows|installer-rows> <config-path>")

    mode = sys.argv[1].strip()
    config_path = Path(sys.argv[2]).expanduser()

    if not config_path.is_file():
        fail(f"Theme config file not found: {config_path}")

    if mode == "switcher-rows":
        emit_switcher_rows(config_path)
    elif mode == "installer-rows":
        emit_installer_rows(config_path)
    else:
        fail(f"Unknown mode: {mode}")


if __name__ == "__main__":
    main()
