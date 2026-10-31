# Gera os icones da Tribuna: placar luminoso com arquibancada.
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
BG, VOLT, INK = (14, 17, 19), (212, 245, 60), (243, 245, 242)

def mark(d, s, pad):
    u = (s - 2 * pad) / 100
    X = lambda v: pad + v * u
    # Tres degraus de arquibancada sobem em direcao ao centro, formando um T.
    d.rounded_rectangle([X(8), X(14), X(92), X(38)], radius=6 * u, fill=VOLT)
    d.rounded_rectangle([X(37), X(38), X(63), X(90)], radius=0, fill=VOLT)
    d.rounded_rectangle([X(37), X(78), X(63), X(90)], radius=4 * u, fill=VOLT)
    d.rectangle([X(8), X(46), X(29), X(53)], fill=INK)
    d.rectangle([X(71), X(46), X(92), X(53)], fill=INK)
    d.rectangle([X(8), X(61), X(29), X(68)], fill=(120, 130, 136))
    d.rectangle([X(71), X(61), X(92), X(68)], fill=(120, 130, 136))

def icon(size, pad_ratio, rounded=False):
    S = size * 4
    im = Image.new('RGBA', (S, S), BG + (255,))
    mark(ImageDraw.Draw(im), S, int(S * pad_ratio))
    return im.resize((size, size), Image.LANCZOS).convert('RGB')

icon(512, .2).save(f'{OUT}/icon-512.png')
icon(192, .2).save(f'{OUT}/icon-192.png')
icon(180, .2).save(f'{OUT}/apple-touch-icon.png')
icon(512, .28).save(f'{OUT}/icon-maskable-512.png')
icon(32, .12).save(f'{OUT}/favicon-32.png')
# Badge do Android/Chrome: so o desenho, branco com fundo transparente.
S = 96 * 4
b = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(b); u = S * .8 / 100; p = S * .1
d.rectangle([p + 8 * u, p + 14 * u, p + 92 * u, p + 38 * u], fill=(255, 255, 255, 255))
d.rectangle([p + 37 * u, p + 38 * u, p + 63 * u, p + 90 * u], fill=(255, 255, 255, 255))
b.resize((96, 96), Image.LANCZOS).save(f'{OUT}/badge-96.png')
