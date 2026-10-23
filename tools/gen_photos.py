"""
生成「争渡」相册的内置示例图片（纯 SVG 抽象海景，无版权）。
输出：src/assets/photos/01.svg ... 09.svg
"""

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "assets", "photos")

PALETTES = [
    ("#dff2ff", "#8cc7f7"),
    ("#eaf7ff", "#a8d8ff"),
    ("#d7edff", "#73b8ef"),
    ("#e6f6ff", "#9fd0f8"),
    ("#f2fbff", "#7fc4f3"),
    ("#e0f2fe", "#6fb2ea"),
    ("#eaf8ff", "#93cdf6"),
    ("#dcedff", "#82c1f0"),
    ("#f5fcff", "#a6d9ff"),
]


def wave(y, amp, phase, opacity, fill):
    # 三层海浪，phase 控制起伏位置
    d = (
        f"M0 {y} "
        f"C 60 {y - amp} 120 {y + amp * 0.7} 180 {y} "
        f"S 300 {y - amp * 0.8} 400 {y + phase} "
        f"L400 400 L0 400 Z"
    )
    return f'<path d="{d}" fill="{fill}" opacity="{opacity}"/>'


def seal(cx, cy, s=1.0, opacity=0.5):
    return f"""
  <g opacity="{opacity}" fill="#ffffff">
    <ellipse cx="{cx}" cy="{cy}" rx="{42 * s}" ry="{22 * s}"/>
    <circle cx="{cx - 34 * s}" cy="{cy - 8 * s}" r="{14 * s}"/>
    <circle cx="{cx - 44 * s}" cy="{cy - 12 * s}" r="{2.2 * s}" fill="#8cc7f7" opacity=".9"/>
    <path d="M{cx + 36 * s} {cy + 4 * s} q {14 * s} {-10 * s} {24 * s} {2 * s} q {-14 * s} {4 * s} {-24 * s} {2 * s} Z"/>
  </g>"""


def make_svg(i, c1, c2):
    sun_x = [300, 92, 250, 140, 330, 180, 70, 290, 210][i]
    sun_y = [86, 74, 110, 96, 70, 120, 88, 104, 82][i]
    sun_r = [46, 34, 58, 40, 30, 52, 36, 44, 48][i]

    waves = (
        wave(238, 18, 6, 0.26, "#ffffff")
        + wave(272, 24, -8, 0.32, "#ffffff")
        + wave(312, 16, 5, 0.22, "#bfe3ff")
    )

    extra = ""
    if i in (1, 4, 7):
        extra = seal(312 if i != 7 else 120, 342, 1.0, 0.55)
    elif i in (2, 8):
        extra = seal(320, 348, 0.8, 0.42)

    stars = ""
    for k in range(4):
        sx = 40 + k * 88 + (i * 13) % 40
        sy = 30 + (k * 37 + i * 19) % 70
        stars += f'<circle cx="{sx}" cy="{sy}" r="1.8" fill="#ffffff" opacity=".7"/>'

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{c1}"/>
      <stop offset="1" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <circle cx="{sun_x}" cy="{sun_y}" r="{sun_r}" fill="#ffffff" opacity=".62"/>
  <circle cx="{sun_x}" cy="{sun_y}" r="{sun_r + 16}" fill="#ffffff" opacity=".16"/>
  {stars}
  {waves}
  {extra}
</svg>
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (c1, c2) in enumerate(PALETTES):
        path = os.path.join(OUT, f"{i + 1:02d}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(make_svg(i, c1, c2))
        print(os.path.basename(path))


if __name__ == "__main__":
    main()
