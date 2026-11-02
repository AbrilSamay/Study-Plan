"""Genera iconos propios con la biblioteca estándar. No requiere instalar paquetes."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "interface" / "assets"
OUTPUT.mkdir(exist_ok=True)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


for size in (16, 32, 48, 128):
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)  # Filtro PNG: cada fila contiene RGBA sin transformar.
        for x in range(size):
            u, v = (x + 0.5) / size, (y + 0.5) / size
            dx = max(0.18 - u, u - 0.82, 0)
            dy = max(0.18 - v, v - 0.82, 0)
            inside = dx * dx + dy * dy <= 0.18 ** 2
            color = (197, 179, 250, 255) if inside else (0, 0, 0, 0)
            for left, height in ((0.23, 0.38), (0.445, 0.58), (0.66, 0.46)):
                if left <= u <= left + 0.11 and (1 - height) / 2 <= v <= (1 + height) / 2:
                    color = (36, 32, 46, 255)
            pixels.extend(color)
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    image = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b"")
    (OUTPUT / f"icon-{size}.png").write_bytes(image)
