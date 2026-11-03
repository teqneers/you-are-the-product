# Adds headlines to raw captures (page and live-view screenshots) for the store listings.
# Run it in the folder with the captures; needs Pillow and macOS's Helvetica Neue.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ICON = Path(__file__).resolve().parent.parent / 'public/icon/128.png'
W, H = 2560, 1600
BG = (15, 17, 21)
RED = (255, 77, 94)
TEXT = (232, 234, 240)
MUTED = (138, 146, 166)
def font(size, bold=True):
    f = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', size, index=1 if bold else 0)
    return f

def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); return lines

def compose(page, panel, number, headline, sub, out, label):
    img = Image.new('RGB', (W, H), BG)
    # faint, blurred website on the right half behind the panel
    p = Image.open(page).convert('RGB').resize((1760, 1600))
    p = p.filter(ImageFilter.GaussianBlur(22))
    p = Image.blend(p, Image.new('RGB', p.size, BG), 0.8)
    # fade the website in from the left so there is no hard edge
    fade = Image.new('L', p.size, 255)
    for i in range(1000):
        ImageDraw.Draw(fade).line([(i, 0), (i, p.height)], fill=int(255 * (i / 1000) ** 1.5))
    img.paste(p, (W - 1760, 0), fade)
    # panel with shadow and rounded corners
    pan = Image.open(panel).convert('RGB')  # 800x1600
    scale = 1440 / pan.height
    pan = pan.resize((int(pan.width * scale), 1440))
    x, y = W - pan.width - 150, 80
    shadow = Image.new('L', (pan.width + 120, pan.height + 120), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((60, 60, pan.width + 60, pan.height + 60), 40, fill=170)
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    img.paste(Image.new('RGB', shadow.size, (0, 0, 0)), (x - 60, y - 40), shadow)
    mask = Image.new('L', pan.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pan.width, pan.height), 36, fill=255)
    img.paste(pan, (x, y), mask)
    ImageDraw.Draw(img).rounded_rectangle((x, y, x + pan.width, y + pan.height), 36, outline=(42, 47, 58), width=3)
    d = ImageDraw.Draw(img)
    left, width = 150, x - 150 - 140
    # brand
    logo = Image.open(ICON).convert('RGBA').resize((88, 88))
    img.paste(logo, (left, 130), logo)
    d.text((left + 112, 150), 'You Are The Product', font=font(46), fill=TEXT)
    yy = 420
    if number:
        d.text((left, yy), number, font=font(230), fill=RED)
        yy += 270
    for line in wrap(d, headline, font(92), width):
        d.text((left, yy), line, font=font(92), fill=TEXT); yy += 112
    yy += 40
    for line in wrap(d, sub, font(46, False), width):
        d.text((left, yy), line, font=font(46, False), fill=MUTED); yy += 64
    d.text((left, H - 150), label, font=font(36, False), fill=MUTED)
    img.resize((1280, 800), Image.LANCZOS).save(out)
    img.save(out.replace('.png', '@2x.png'))

compose('1-live-page.png', '1-live-panel.png', '29', 'companies watched one news page.',
        'See live who tracks you, what they learn about you and who buys your attention. Nothing is blocked, nothing leaves your browser.',
        'store-1.png', 'Measured on cnn.com, November 2026')
compose('2-consent-page.png', '2-consent-panel.png', '5', 'started tracking before you answered the cookie banner.',
        'The cookie banner check shows who ran before your choice, who keeps going after “Reject”, and every company you consented to.',
        'store-2.png', 'Measured on cnn.com, November 2026')
compose('3-reach-page.png', '3-reach-panel.png', '98 %', 'of the most visited websites have Google on them.',
        'See how far each company reaches, which registered data brokers watch and where your data goes outside the EU.',
        'store-3.png', 'Reach: WhoTracks.me (CC BY 4.0) · Countries: IP Geolocation by DB-IP')
