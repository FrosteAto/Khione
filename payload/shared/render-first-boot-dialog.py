#!/usr/bin/env python3
import configparser
import html
import re
import sys
from pathlib import Path


def parse_rgb(value):
    try:
        parts = [int(p.strip()) for p in value.split(",")]
    except Exception:
        return None
    if len(parts) != 3:
        return None
    if any(p < 0 or p > 255 for p in parts):
        return None
    return tuple(parts)


def rgb_css(rgb):
    return f"rgb({rgb[0]}, {rgb[1]}, {rgb[2]})"


def mix(base, fg, ratio):
    return tuple(int(round(base[i] * (1.0 - ratio) + fg[i] * ratio)) for i in range(3))


def color_distance(a, b):
    return sum(abs(a[i] - b[i]) for i in range(3))


def load_theme_colors():
    cfg_path = Path.home() / ".config" / "kdeglobals"
    if not cfg_path.is_file():
        return None, None, None, None

    cfg = configparser.ConfigParser(interpolation=None, strict=False)
    cfg.optionxform = str
    try:
        cfg.read(cfg_path, encoding="utf-8")
    except Exception:
        return None, None, None, None

    sections = [cfg[s] for s in ("Colors:View", "Colors:Window") if s in cfg]

    def pick(*keys):
        for sec in sections:
            for key in keys:
                rgb = parse_rgb(sec.get(key, ""))
                if rgb is not None:
                    return rgb
        return None

    bg = pick("BackgroundNormal")
    alt = pick("BackgroundAlternate")
    fg = pick("ForegroundNormal", "ForegroundActive", "ForegroundInactive")
    fg_inactive = pick("ForegroundInactive", "ForegroundNormal", "ForegroundActive")
    return bg, alt, fg, fg_inactive


def resolve_code_colors():
    bg, alt, fg, fg_inactive = load_theme_colors()
    if bg and fg:
        code_block_bg = alt or bg
        if color_distance(code_block_bg, bg) < 24:
            code_block_bg = mix(bg, fg, 0.16)

        code_inline_bg = code_block_bg
        if color_distance(code_inline_bg, bg) < 36:
            code_inline_bg = mix(bg, fg, 0.24)

        code_border = fg_inactive or mix(bg, fg, 0.32)
        return rgb_css(code_block_bg), rgb_css(code_inline_bg), rgb_css(code_border)

    return "palette(alternate-base)", "palette(alternate-base)", "palette(mid)"


def render_markdown_to_html(text):
    try:
        import markdown  # type: ignore

        return markdown.markdown(text, extensions=["extra", "sane_lists", "nl2br"])
    except Exception:
        return "<pre style=\"white-space: pre-wrap; font-family: sans-serif;\">" + html.escape(text) + "</pre>"


def style_open_tag(source, tag, style):
    pattern = re.compile(rf"<{tag}([^>]*)>", flags=re.IGNORECASE)

    def repl(match):
        attrs = match.group(1) or ""
        if re.search(r"\bstyle\s*=", attrs, flags=re.IGNORECASE):
            attrs = re.sub(
                r'(\bstyle\s*=\s*")(.*?)(")',
                lambda m: f"{m.group(1)}{m.group(2)}; {style}{m.group(3)}",
                attrs,
                count=1,
                flags=re.IGNORECASE,
            )
            return f"<{tag}{attrs}>"
        return f"<{tag}{attrs} style=\"{style}\">"

    return pattern.sub(repl, source)


def apply_spacing_styles(body):
    replacements = [
        ("<h1>", '<h1 style="margin: 0 0 0.45em 0; font-size: 1.45em;">'),
        ("<h2>", '<h2 style="margin: 0.2em 0 0.45em 0; font-size: 1.25em;">'),
        ("<h3>", '<h3 style="margin: 0.2em 0 0.35em 0; font-size: 1.12em;">'),
        ("<p>", '<p style="margin: 0.2em 0 0.85em 0;">'),
        ("<ul>", '<ul style="margin: 0.2em 0 0.9em 1.2em; padding: 0;">'),
        ("<ol>", '<ol style="margin: 0.2em 0 0.9em 1.2em; padding: 0;">'),
        ("<li>", '<li style="margin: 0.2em 0;">'),
    ]
    for plain, styled in replacements:
        body = body.replace(plain, styled)
    return body


def extract_code_blocks(source, block_bg_css, border_css):
    pattern = re.compile(r"<pre([^>]*)>\s*<code([^>]*)>(.*?)</code>\s*</pre>", flags=re.IGNORECASE | re.DOTALL)
    blocks = {}

    def repl(match):
        code_attrs = match.group(2) or ""
        code_content = match.group(3) or ""
        token = f"__FROSTEARCH_CODE_BLOCK_{len(blocks)}__"
        blocks[token] = (
            '<table role="presentation" cellspacing="0" cellpadding="0" width="100%" '
            'style="margin: 0.5em 0 1.1em 0; border-collapse: collapse; table-layout: fixed;">'
            '<tr><td style="padding: 0.65em 0.85em; border-radius: 6px; '
            f'background-color: {block_bg_css}; border: 1px solid {border_css}; overflow-wrap: anywhere; word-break: break-word;">'
            f'<pre style="margin: 0; white-space: pre-wrap;"><code{code_attrs} '
            'style="font-family: monospace; font-size: 0.95em; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">'
            f"{code_content}</code></pre></td></tr></table>"
        )
        return token

    return pattern.sub(repl, source), blocks


def build_document(body):
    return (
        '<html><body style="line-height: 1.5; margin: 0; overflow-wrap: anywhere; word-break: break-word;">'
        '<div style="margin: 8px auto; padding: 0 10px; max-width: 92ch;">'
        + body
        + "</div></body></html>"
    )


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {Path(sys.argv[0]).name} <markdown-input> <html-output>", file=sys.stderr)
        return 2

    message_path = Path(sys.argv[1])
    html_path = Path(sys.argv[2])

    try:
        text = message_path.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"Failed to read markdown input: {exc}", file=sys.stderr)
        return 1

    body = render_markdown_to_html(text)
    body = apply_spacing_styles(body)

    block_bg_css, inline_bg_css, border_css = resolve_code_colors()
    body, code_blocks = extract_code_blocks(body, block_bg_css, border_css)
    body = style_open_tag(
        body,
        "code",
        "font-family: monospace; font-size: 0.95em; padding: 0.08em 0.30em; border-radius: 4px; overflow-wrap: anywhere; word-break: break-word; "
        + f"background-color: {inline_bg_css};",
    )
    for token, html_block in code_blocks.items():
        body = body.replace(token, html_block)

    try:
        html_path.write_text(build_document(body), encoding="utf-8")
    except Exception as exc:
        print(f"Failed to write html output: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
