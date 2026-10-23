"""
生成「争渡」内置的无版权合成音频。
全部由正弦波 + 包络合成，不采样任何现有音乐，可自由使用。
输出：src/assets/songs/*.wav （22050Hz / 单声道 / 16bit）
"""

import math
import os
import struct
import wave

SR = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "assets", "songs")


def env(t, dur, a=0.35, r=0.6):
    if t < a:
        return t / a
    if t > dur - r:
        return max(0.0, (dur - t) / r)
    return 1.0


def add_tone(buf, start, dur, freq, amp, harmonics=(1.0, 0.28, 0.12)):
    n0 = int(start * SR)
    n = int(dur * SR)
    for i in range(n):
        idx = n0 + i
        if idx >= len(buf):
            break
        t = i / SR
        e = env(t, dur)
        s = 0.0
        for h, a in enumerate(harmonics, start=1):
            s += a * math.sin(2 * math.pi * freq * h * t)
        buf[idx] += amp * e * s


def build(kind, dur=10.0):
    buf = [0.0] * int(dur * SR)

    if kind == "calm":
        chords = [
            (0.0, [261.63, 329.63, 392.00, 493.88]),  # Cmaj7
            (2.5, [220.00, 261.63, 329.63, 392.00]),  # Am7
            (5.0, [174.61, 220.00, 261.63, 329.63]),  # Fmaj7
            (7.5, [196.00, 246.94, 293.66, 392.00]),  # G
        ]
        for st, notes in chords:
            for f in notes:
                add_tone(buf, st, 2.5, f, 0.05, (1.0, 0.22, 0.08))
        for st, f in [(0.6, 783.99), (3.1, 659.25), (5.6, 698.46), (8.1, 587.33)]:
            add_tone(buf, st, 1.4, f, 0.04, (1.0, 0.15))

    elif kind == "nap":
        add_tone(buf, 0.0, dur, 130.81, 0.05, (1.0, 0.2))   # C3 drone
        add_tone(buf, 0.0, dur, 196.00, 0.032, (1.0, 0.2))  # G3 drone
        notes = [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33]
        t = 0.4
        while t < dur - 0.9:
            for f in notes:
                if t >= dur - 0.9:
                    break
                add_tone(buf, t, 0.55, f, 0.055, (1.0, 0.15))
                t += 0.5

    else:  # cross
        chords = [
            (0.0, [220.00, 261.63, 329.63]),
            (2.5, [174.61, 220.00, 261.63]),
            (5.0, [261.63, 329.63, 392.00]),
            (7.5, [196.00, 246.94, 293.66]),
        ]
        for st, notes in chords:
            for f in notes:
                add_tone(buf, st, 2.5, f, 0.048, (1.0, 0.25, 0.1))
        for st, f in [(1.2, 880.00), (4.0, 783.99), (6.6, 698.46), (9.0, 659.25)]:
            add_tone(buf, st, 1.6, f, 0.038, (1.0, 0.12))

    # 整体淡入淡出，避免循环接缝爆音
    fade = int(0.05 * SR)
    for i in range(fade):
        buf[i] *= i / fade
        buf[-1 - i] *= i / fade

    peak = max(max(abs(x) for x in buf), 1e-9)
    scale = 0.72 / peak
    frames = bytearray()
    for x in buf:
        v = int(max(-1.0, min(1.0, x * scale)) * 32767)
        frames += struct.pack("<h", v)
    return frames


def main():
    os.makedirs(OUT, exist_ok=True)
    for kind, name in [("calm", "calm.wav"), ("nap", "nap.wav"), ("cross", "cross.wav")]:
        data = build(kind)
        path = os.path.join(OUT, name)
        with wave.open(path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(bytes(data))
        print(f"{name}: {len(data) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
