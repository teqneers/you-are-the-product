# Store images that are not screenshots: the Chrome Web Store icon (96 px artwork with 16 px transparent padding)
# and the promotional tiles (no text and no third-party brands, as Google recommends): the logo on an abstract graph.
# Run from the repository root; needs Pillow.
import math
import random

from PIL import Image, ImageDraw, ImageFilter

BG = (15, 17, 21)
icon = Image.open('public/icon/128.png').convert('RGBA')
# The mark without its dark tile: assets/icon.svg rendered without the background rectangle (see docs/store/).
MARK = Image.open('docs/store/mark.png').convert('RGBA')

store_icon = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
store_icon.paste(icon.resize((96, 96), Image.LANCZOS), (16, 16))
store_icon.save('docs/store/chrome-icon-128.png')

RED, AMBER, BLUE, LINE = (255, 77, 94), (245, 165, 36), (78, 161, 255), (60, 66, 80)


def network(W, H, seed):
    """An abstract tracking graph without any brand: sites (blue squares) with companies around them."""
    rnd = random.Random(seed)
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    n = max(5, W // 220)
    hubs = []
    for i in range(n):
        ang = 6.283 * i / n + rnd.uniform(-0.25, 0.25)
        hubs.append((W / 2 + math.cos(ang) * W * rnd.uniform(0.3, 0.42), H / 2 + math.sin(ang) * H * rnd.uniform(0.28, 0.4)))
    shared = []
    for i in range(n // 2 + 1):
        ang = rnd.uniform(0, 6.283)
        shared.append((W / 2 + math.cos(ang) * W * 0.2, H / 2 + math.sin(ang) * H * 0.22))
    for hx, hy in hubs:
        for sx, sy in shared:
            if rnd.random() < 0.6:
                d.line((hx, hy, sx, sy), fill=LINE, width=2)
        for i in range(rnd.randint(10, 18)):
            ang = rnd.uniform(0, 6.283)
            dist = rnd.uniform(70, 130) * H / 560
            x, y = hx + dist * math.cos(ang), hy + dist * math.sin(ang)
            d.line((hx, hy, x, y), fill=LINE, width=2)
            r = rnd.uniform(6, 13) * H / 560
            d.ellipse((x - r, y - r, x + r, y + r), fill=RED if rnd.random() < 0.6 else AMBER)
    for sx, sy in shared:
        r = rnd.uniform(18, 28) * H / 560
        d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=RED)
    for hx, hy in hubs:
        a = 22 * H / 560
        d.rounded_rectangle((hx - a, hy - a, hx + a, hy + a), a * 0.3, fill=BG, outline=BLUE, width=max(3, int(a / 5)))
    return img.filter(ImageFilter.GaussianBlur(0.6))


def promo(width, height, path):
    scale = 2
    W, H = width * scale, height * scale
    img = Image.blend(network(W, H, seed=width), Image.new('RGB', (W, H), BG), 0.25)
    # dark halo behind the logo so it stands out from the graph
    halo = Image.new('L', (W, H), 0)
    r = int(H * 0.42)
    ImageDraw.Draw(halo).ellipse((W // 2 - r, H // 2 - r, W // 2 + r, H // 2 + r), fill=235)
    halo = halo.filter(ImageFilter.GaussianBlur(r // 3))
    img.paste(Image.new('RGB', (W, H), BG), (0, 0), halo)
    size = int(H * 0.62)
    logo = MARK.resize((size, size), Image.LANCZOS)
    img.paste(logo, ((W - size) // 2, (H - size) // 2), logo)
    img.resize((width, height), Image.LANCZOS).save(path)


promo(440, 280, 'docs/store/chrome-promo-small-440x280.png')
promo(1400, 560, 'docs/store/chrome-promo-marquee-1400x560.png')
