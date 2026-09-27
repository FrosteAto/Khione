#!/usr/bin/env python3
"""Draws the Deepwood xfwm4 theme (flat title bar, plain-symbol buttons) into ./xfwm4.
Change the colours below and re-run, then reselect the theme in Window Manager settings."""
import os, subprocess, tempfile

C = dict(bar='#121611', border_active='#39432f', border_inactive='#242b21',
         glyph_active='#a2ab96', glyph_inactive='#6c7564', glyph_hover='#d5dac8', glyph_pressed='#8bb862',
         close_hover='#c65d4f', hover_bg='#242b21', pressed_bg='#1a1f18')
TITLE_H, SIDE, BTN_W = 28, 2, 28
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'xfwm4')

def png(name, w, h, body):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" shape-rendering="crispEdges">{body}</svg>'
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False) as f:
        f.write(svg)
    subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), f.name, '-o', os.path.join(OUT, name + '.png')], check=True)
    os.unlink(f.name)

rect = lambda x, y, w, h, c: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>'

# Frame: 1px outline plus 1px of title-bar colour around the window.
for state in ('active', 'inactive'):
    b = C['border_' + state]
    bar_bg = rect(0, 0, 99, TITLE_H, C['bar']) + rect(0, 0, 99, 1, b)
    for i in range(1, 6):
        png(f'title-{i}-{state}', 2, TITLE_H, bar_bg)
    png(f'top-left-{state}', SIDE, TITLE_H, bar_bg + rect(0, 0, 1, TITLE_H, b))
    png(f'top-right-{state}', SIDE, TITLE_H, bar_bg + rect(SIDE - 1, 0, 1, TITLE_H, b))
    png(f'left-{state}', SIDE, 8, rect(0, 0, SIDE, 8, C['bar']) + rect(0, 0, 1, 8, b))
    png(f'right-{state}', SIDE, 8, rect(0, 0, SIDE, 8, C['bar']) + rect(SIDE - 1, 0, 1, 8, b))
    png(f'bottom-{state}', 8, SIDE, rect(0, 0, 8, SIDE, C['bar']) + rect(0, SIDE - 1, 8, 1, b))
    png(f'bottom-left-{state}', 16, SIDE, rect(0, 0, 16, SIDE, C['bar']) + rect(0, 0, 1, SIDE, b) + rect(0, SIDE - 1, 16, 1, b))
    png(f'bottom-right-{state}', 16, SIDE, rect(0, 0, 16, SIDE, C['bar']) + rect(15, 0, 1, SIDE, b) + rect(0, SIDE - 1, 16, 1, b))

# Buttons: plain symbols, 10 px, centred in the title bar.
def line(d, c, w=1): return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision"/>'
GLYPHS = {
    'hide':             lambda c: line('M9.5 15.5h9', c),
    'maximize':         lambda c: f'<rect x="9.5" y="10.5" width="9" height="9" fill="none" stroke="{c}"/>',
    'maximize-toggled': lambda c: f'<rect x="9.5" y="12.5" width="7" height="7" fill="none" stroke="{c}"/>' + line('M11.5 12.5v-2h7v7h-2', c),
    'close':            lambda c: line('M9.5 10.5l9 9M18.5 10.5l-9 9', c, 1.4),
    'shade':            lambda c: line('M9.5 17.5l4.5-4.5 4.5 4.5', c, 1.3),
    'shade-toggled':    lambda c: line('M9.5 13l4.5 4.5 4.5-4.5', c, 1.3),
    'stick':            lambda c: f'<circle cx="14" cy="15" r="3.2" fill="none" stroke="{c}" stroke-width="1.2" shape-rendering="geometricPrecision"/>',
    'stick-toggled':    lambda c: f'<circle cx="14" cy="15" r="3.6" fill="{c}" shape-rendering="geometricPrecision"/>',
    'menu':             lambda c: '',   # the window's app icon is drawn here
}
for name, glyph in GLYPHS.items():
    for state in ('active', 'inactive', 'prelight', 'pressed'):
        border = C['border_inactive' if state == 'inactive' else 'border_active']
        bg = rect(0, 0, BTN_W, TITLE_H, C['bar']) + rect(0, 0, BTN_W, 1, border)
        if state in ('prelight', 'pressed') and name != 'menu':
            bg += f'<rect x="4" y="5" width="20" height="20" rx="4" fill="{C["hover_bg" if state == "prelight" else "pressed_bg"]}" shape-rendering="geometricPrecision"/>'
        colour = {'active': C['glyph_active'], 'inactive': C['glyph_inactive'],
                  'prelight': C['close_hover'] if name == 'close' else C['glyph_hover'],
                  'pressed': C['glyph_pressed']}[state]
        png(f'{name}-{state}', BTN_W, TITLE_H, bg + glyph(colour))

with open(os.path.join(OUT, 'themerc'), 'w') as f:
    f.write(f"""# Deepwood: flat title bar, plain-symbol buttons
active_text_color={C['glyph_hover']}
inactive_text_color={C['glyph_inactive']}
title_shadow_active=false
title_shadow_inactive=false
title_vertical_offset_active=1
title_vertical_offset_inactive=1
title_horizontal_offset=0
full_width_title=true
button_offset=4
button_spacing=0
maximized_offset=0
show_app_icon=true
shadow_delta_x=-4
shadow_delta_y=-2
shadow_delta_width=8
shadow_delta_height=8
shadow_opacity=50
""")
print('wrote', len(os.listdir(OUT)), 'files to', OUT)
