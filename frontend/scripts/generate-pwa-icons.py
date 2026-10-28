"""Regenerates the PWA icons in public/icons from public/task-logo.png (needs Pillow).

    python scripts/generate-pwa-icons.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
src = Image.open(root / "public" / "task-logo.png").convert("RGB")
bg = src.getpixel((5, 5))  # the logo's own off-white background
out = root / "public" / "icons"
out.mkdir(exist_ok=True)


def plain(size):
    return src.resize((size, size), Image.LANCZOS)


def maskable(size, inner=0.64):
    """Logo inside the 80% safe zone so any launcher mask (circle, squircle) keeps it whole."""
    canvas = Image.new("RGB", (size, size), bg)
    logo = src.resize((int(size * inner), int(size * inner)), Image.LANCZOS)
    offset = (size - logo.size[0]) // 2
    canvas.paste(logo, (offset, offset))
    return canvas


plain(192).save(out / "icon-192.png", optimize=True)
plain(512).save(out / "icon-512.png", optimize=True)
maskable(192).save(out / "maskable-192.png", optimize=True)
maskable(512).save(out / "maskable-512.png", optimize=True)
plain(180).save(out / "apple-touch-icon.png", optimize=True)   # iOS rounds the corners itself
plain(32).save(out / "favicon-32.png", optimize=True)
print("icons written to", out)
