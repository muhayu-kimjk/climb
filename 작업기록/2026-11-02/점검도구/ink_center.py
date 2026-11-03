"""PNG 사진에서 정한 가로 구간들의 잉크(바탕보다 어두운 점) 세로 가운데를 잼. 바깥 도구 없이 zlib로 PNG를 풂.
사용: python -I ink_center.py <png> <x0:x1> [<x0:x1> ...]   (x는 사진 픽셀)
  각 구간에서 바탕(가장 밝은 값)과의 차이를 무게로 한 세로 가운데(픽셀)를 출력"""
import struct
import sys
import zlib

sys.stdout.reconfigure(encoding='utf-8')


def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, w = 8, b'', 0
    while pos < len(data):
        n = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + n]
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
            assert depth == 8 and ctype in (2, 6), (depth, ctype)
            bpp = 4 if ctype == 6 else 3
        elif typ == b'IDAT':
            idat += body
        pos += 12 + n
    raw = zlib.decompress(idat)
    stride = w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, bpp, rows


w, h, bpp, rows = read_png(sys.argv[1])
for spec in sys.argv[2:]:
    xs, _, ys = spec.partition("@")
    x0, x1 = map(int, xs.split(":"))
    y0, y1 = map(int, ys.split(":")) if ys else (0, h)
    lum = [[sum(r[x * bpp:x * bpp + 3]) / 3 for x in range(x0, x1)] if y0 <= yy < y1 else [255.0] * (x1 - x0) for yy, r in enumerate(rows)]
    bg = max(max(l) for l in lum)
    tot = wsum = 0.0
    top = bot = None
    for y, l in enumerate(lum):
        ink = sum(max(0.0, bg - v) for v in l)
        if ink > 20:
            top = y if top is None else top
            bot = y
        tot += ink
        wsum += ink * (y + 0.5)
    print(f'{spec}: 무게 가운데 {wsum / tot:.2f}px, 잉크 위 {top} 아래 {bot} (위아래 가운데 {(top + bot + 1) / 2:.2f})' if tot else f'{spec}: 잉크 없음')
