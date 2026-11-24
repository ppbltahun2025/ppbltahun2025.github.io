"""Buat ikon & splash aplikasi dari logo KENDATI (assets/icon-menu.png).

Pemakaian:  python3 scripts/make_resources.py <path-logo.png>
Hasil ke folder resources/ lalu jalankan:  npm run icons
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter

CREAM = (246, 243, 234, 255)
NAVY = (7, 27, 58, 255)
GOLD = (240, 180, 41, 255)

src = sys.argv[1] if len(sys.argv) > 1 else "www/logo.png"
out = "resources"
os.makedirs(out, exist_ok=True)

logo = Image.open(src).convert("RGBA")
logo = logo.crop(logo.getbbox())


def fit(img, box):
    im = img.copy()
    im.thumbnail((box, box), Image.LANCZOS)
    return im


def paste_center(canvas, im):
    canvas.alpha_composite(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2))


# 1) ikon penuh (iOS & Android lama): latar krem, logo 72%
icon = Image.new("RGBA", (1024, 1024), CREAM)
paste_center(icon, fit(logo, 740))
icon.convert("RGB").save(f"{out}/icon-only.png")

# 2) adaptive icon Android: foreground transparan (zona aman ~ 60%), background krem
fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
paste_center(fg, fit(logo, 560))
fg.save(f"{out}/icon-foreground.png")
Image.new("RGBA", (1024, 1024), CREAM).save(f"{out}/icon-background.png")

# 3) splash: latar navy + orb krem bercincin emas di tengah (seperti orb di halaman Home)
S = 2732
splash = Image.new("RGBA", (S, S), NAVY)
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([S/2-700, S/2-700, S/2+700, S/2+700], fill=(11, 75, 145, 150))
splash.alpha_composite(glow.filter(ImageFilter.GaussianBlur(220)))
d = ImageDraw.Draw(splash)
R = 300
d.ellipse([S/2-R-26, S/2-R-26, S/2+R+26, S/2+R+26], outline=GOLD, width=10)
d.ellipse([S/2-R, S/2-R, S/2+R, S/2+R], fill=CREAM)
paste_center(splash, fit(logo, int(R * 2 * 0.74)))
splash.convert("RGB").save(f"{out}/splash.png")
splash.convert("RGB").save(f"{out}/splash-dark.png")
print("resources/ siap:", sorted(os.listdir(out)))
