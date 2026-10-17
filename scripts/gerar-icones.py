# Gera a logo das telas, os ícones do app instalável e o favicon a partir da logo recortada.
# Uso: python3 scripts/gerar-icones.py docs/marca/logo-transparente.png apps/web/public
import sys
import numpy as np
from PIL import Image
logo = Image.open(sys.argv[1]).convert('RGBA'); pub = sys.argv[2]
def ajustar(img, alt=None, larg=None):
    w, h = img.size
    if alt: return img.resize((round(w * alt / h), alt), Image.LANCZOS)
    return img.resize((larg, round(h * larg / w)), Image.LANCZOS)
# Telas: login/abertura mostram até 200px de largura e o cabeçalho 40px; arquivos em 2x/3x.
ajustar(logo, larg=400).save(f'{pub}/logo.webp', quality=90, method=6)
ajustar(logo, alt=120).save(f'{pub}/logo-pequeno.webp', quality=90, method=6)
def quadrado(lado, ocupa, fundo=None):
    c = Image.new('RGBA', (lado, lado), fundo or (0, 0, 0, 0))
    l = ajustar(logo, larg=round(lado * ocupa))
    c.alpha_composite(l, ((lado - l.width) // 2, (lado - l.height) // 2))
    return c
# raio máximo do desenho a partir do centro, para caber na área segura (círculo de 40%)
a = np.asarray(logo.getchannel('A')) > 128
ys, xs = np.nonzero(a); h, w = a.shape
r = np.sqrt((xs - w / 2) ** 2 + (ys - h / 2) ** 2).max() / w
# 0,44 passa um pouco da área segura (0,40) só nas pontas da faixa, para o selo encher o ícone.
ocupa_mask = 0.44 / r
# Fundo vinho da marca (o mesmo da tela de abertura) nos ícones que não podem ser transparentes.
VINHO = (0x6E, 0x0F, 0x14, 255)
quadrado(192, 0.96).save(f'{pub}/icones/icone-192.png', optimize=True)
quadrado(512, 0.96).save(f'{pub}/icones/icone-512.png', optimize=True)
quadrado(180, 0.94, VINHO).convert('RGB').save(f'{pub}/icones/icone-180.png', optimize=True)
quadrado(512, ocupa_mask, VINHO).convert('RGB').save(f'{pub}/icones/icone-maskable-512.png', optimize=True)
quadrado(32, 1.0).save(f'{pub}/favicon-32.png', optimize=True)
quadrado(256, 1.0).save(f'{pub}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('mask ocupa', round(ocupa_mask, 3))
