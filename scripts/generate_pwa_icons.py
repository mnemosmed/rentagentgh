"""Generate RentAgentGhana PWA icons in coral/navy palette."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

POP = (255, 90, 95, 255)  # #FF5A5F
NAVY = (11, 19, 43, 255)  # #0B132B
WHITE = (255, 255, 255, 255)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "icons"
APP_FAV = ROOT / "frontend" / "src" / "app" / "favicon.ico"
PUBLIC_FAV = ROOT / "frontend" / "public" / "favicon.ico"


def find_font(size: int):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def draw_rg(img: Image.Image, fill=WHITE, font_ratio=0.42) -> None:
    draw = ImageDraw.Draw(img)
    size = img.size[0]
    font = find_font(max(10, int(size * font_ratio)))
    text = "RG"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, font=font, fill=fill)


def make_any(size: int) -> Image.Image:
    """Coral rounded tile on navy — mirrors navbar brand mark."""
    img = Image.new("RGBA", (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.12)
    radius = int(size * 0.22)
    draw.rounded_rectangle(
        (pad, pad, size - pad - 1, size - pad - 1),
        radius=radius,
        fill=POP,
    )
    draw_rg(img, WHITE, font_ratio=0.38)
    return img


def make_maskable(size: int) -> Image.Image:
    """Full-bleed coral for Android maskable safe zone."""
    img = Image.new("RGBA", (size, size), POP)
    draw_rg(img, WHITE, font_ratio=0.34)
    return img


def make_solid(size: int, bg=POP) -> Image.Image:
    img = Image.new("RGBA", (size, size), bg)
    draw_rg(img, WHITE, font_ratio=0.42 if size >= 64 else 0.5)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    make_any(192).save(OUT / "icon-192.png", optimize=True)
    make_any(512).save(OUT / "icon-512.png", optimize=True)
    make_maskable(512).save(OUT / "maskable-512.png", optimize=True)
    make_any(180).save(OUT / "apple-touch-icon.png", optimize=True)
    make_solid(32).save(OUT / "favicon-32.png", optimize=True)

    ico_sizes = [16, 32, 48]
    ico_images = [make_solid(s) for s in ico_sizes]
    for dest in (APP_FAV, PUBLIC_FAV):
        dest.parent.mkdir(parents=True, exist_ok=True)
        ico_images[0].save(
            dest,
            format="ICO",
            sizes=[(s, s) for s in ico_sizes],
            append_images=ico_images[1:],
        )

    for path in sorted(OUT.iterdir()):
        print(path, path.stat().st_size)
    print(APP_FAV, APP_FAV.stat().st_size)
    print(PUBLIC_FAV, PUBLIC_FAV.stat().st_size)


if __name__ == "__main__":
    main()
