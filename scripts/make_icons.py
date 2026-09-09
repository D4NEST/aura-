"""Genera los iconos PWA de AURA en PNG puro (sin dependencias externas).
Graduado cian->violeta con una 'A' geométrica. Uso: python scripts/make_icons.py
"""
import os
import struct
import zlib

DARK = (0x06, 0x12, 0x1A)
C1 = (0x22, 0xD3, 0xEE)   # cian
C2 = (0xA7, 0x8B, 0xFA)   # violeta

OUTER = ((0.5, 0.18), (0.30, 0.86), (0.70, 0.86))
INNER = ((0.5, 0.375), (0.40, 0.86), (0.60, 0.86))


def in_tri(px, py, tri):
    (ax, ay), (bx, by), (cx, cy) = tri
    dx = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    e = (cx - bx) * (py - by) - (cy - by) * (px - bx)
    f = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
    return dx >= 0 and e >= 0 and f >= 0


def pixel(u, v, maskable):
    t = (u + v) / 2.0
    r = int(C1[0] + (C2[0] - C1[0]) * t)
    g = int(C1[1] + (C2[1] - C1[1]) * t)
    b = int(C1[2] + (C2[2] - C1[2]) * t)
    if in_tri(u, v, OUTER) and not in_tri(u, v, INNER):
        r, g, b = DARK
    a = 255
    if not maskable:
        # esquinas redondeadas (radio 18%)
        rad = 0.18
        cx = min(u, 1 - u) / rad
        cy = min(v, 1 - v) / rad
        if cx < 1 and cy < 1 and (1 - cx) ** 2 + (1 - cy) ** 2 > 1:
            a = 0
    return r, g, b, a


def make_png(size, path, maskable=False):
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filtro None
        for x in range(size):
            u, v = (x + 0.5) / size, (y + 0.5) / size
            rows.extend(pixel(u, v, maskable))
    raw = zlib.compress(bytes(rows), 9)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', raw)
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('ok', path, len(png), 'bytes')


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public = os.path.join(root, 'public')
    os.makedirs(public, exist_ok=True)
    make_png(512, os.path.join(public, 'icon-512.png'))
    make_png(192, os.path.join(public, 'icon-192.png'))
    make_png(512, os.path.join(public, 'icon-maskable-512.png'), maskable=True)

    favicon = os.path.join(public, 'favicon.svg')
    with open(favicon, 'w', encoding='utf-8') as f:
        f.write('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/>
</linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<polygon points="50,16 28,86 72,86" fill="#06121a"/>
<polygon points="50,38 38,86 62,86" fill="url(#g)"/>
</svg>''')
    print('ok', favicon)


if __name__ == '__main__':
    main()