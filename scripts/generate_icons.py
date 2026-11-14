"""
Generates EDITH Holographic HUD App Icons for Tauri 2.
"""

from pathlib import Path
from PIL import Image, ImageDraw

ICONS_DIR = Path("src-tauri/icons")
ICONS_DIR.mkdir(parents=True, exist_ok=True)


def create_hud_icon(size: int) -> Image.Image:
    # 32-bit RGBA image
    img = Image.new("RGBA", (size, size), (10, 15, 24, 255))
    draw = ImageDraw.Draw(img)

    margin = size // 8
    # Cyan outer ring
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        outline=(0, 240, 255, 255),
        width=max(1, size // 24),
    )

    # Core arc reactor center
    core_margin = size // 3
    draw.ellipse(
        [core_margin, core_margin, size - core_margin, size - core_margin],
        fill=(0, 240, 255, 200),
        outline=(255, 255, 255, 255),
        width=max(1, size // 32),
    )

    return img


def generate_all_icons():
    # 32x32
    img_32 = create_hud_icon(32)
    img_32.save(ICONS_DIR / "32x32.png")

    # 128x128
    img_128 = create_hud_icon(128)
    img_128.save(ICONS_DIR / "128x128.png")

    # 128x128@2x (256x256)
    img_256 = create_hud_icon(256)
    img_256.save(ICONS_DIR / "128x128@2x.png")

    # icon.ico
    img_256.save(
        ICONS_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(f"✓ Successfully generated Tauri 2 app icons in {ICONS_DIR.resolve()}")


if __name__ == "__main__":
    generate_all_icons()
