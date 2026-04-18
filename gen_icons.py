"""
Nothing-style icon generator for karotter express.

Design:
  - OLED black background
  - White rounded-rect "keycap" frame (left-biased), monoline
  - "K" lettermark inside keycap
  - 3 horizontal speed lines extending right from keycap edge
  - Red dot (#D71921) on the rightmost speed line tip as accent
"""
from PIL import Image, ImageDraw
import os

BG    = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
RED   = (215, 25, 33, 255)

def draw_keycap(draw, x, y, w, h, r, stroke, color):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=r,
                            outline=color, width=stroke)

def draw_K(draw, cx, cy, size, stroke, color):
    half = size / 2
    x0 = cx - half * 0.30
    draw.line([(x0, cy - half), (x0, cy + half)], fill=color, width=stroke)
    mid_y = cy - half * 0.05
    draw.line([(x0, mid_y), (cx + half * 0.50, cy - half)], fill=color, width=stroke)
    draw.line([(x0, mid_y), (cx + half * 0.50, cy + half)], fill=color, width=stroke)

def draw_dot(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

def make_icon(size):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), BG)
    d   = ImageDraw.Draw(img)

    pad = S * 0.10

    # keycap occupies left ~62% of the icon (leaving room for speed lines)
    kw = S * 0.58
    kh = S - pad * 2
    r  = S * 0.16
    stroke_frame = max(1, round(S * 0.055))
    draw_keycap(d, pad, pad, kw, kh, r, stroke_frame, WHITE)

    # K inside the keycap
    cx = pad + kw * 0.48
    cy = S * 0.52
    k_size = kh * 0.44
    stroke_k = max(1, round(S * 0.065))
    draw_K(d, cx, cy, k_size, stroke_k, WHITE)

    # speed lines: 3 horizontal lines, right of keycap
    line_x0 = pad + kw + S * 0.04   # small gap from keycap right edge
    line_x_end = S - pad * 0.6      # near right edge of icon

    # vertical positions: top-third, center, bottom-third of keycap
    cap_top = pad
    cap_bot = pad + kh
    line_ys = [
        cap_top + kh * 0.22,
        cap_top + kh * 0.50,
        cap_top + kh * 0.78,
    ]
    # lengths: middle longest, outer shorter
    lengths = [0.55, 1.0, 0.55]
    full_len = line_x_end - line_x0
    stroke_line = max(1, round(S * 0.045))

    for ly, ratio in zip(line_ys, lengths):
        x1 = line_x0
        x2 = line_x0 + full_len * ratio
        d.line([(x1, ly), (x2, ly)], fill=WHITE, width=stroke_line)

    # red dot: top-right corner of keycap (notification badge)
    if size >= 48:
        dot_r = S * 0.085
    else:
        dot_r = S * 0.095
    dot_cx = pad + kw - dot_r * 0.3
    dot_cy = pad + dot_r * 0.3
    draw_dot(d, dot_cx, dot_cy, dot_r, RED)

    img = img.resize((size, size), Image.LANCZOS)
    return img

os.makedirs("chrome/icons", exist_ok=True)
os.makedirs("icons", exist_ok=True)

for sz in [16, 48, 128]:
    icon = make_icon(sz)
    for path in [f"chrome/icons/icon{sz}.png", f"icons/icon{sz}.png"]:
        icon.save(path, "PNG")
        print(f"  saved {path}")

print("Done.")
