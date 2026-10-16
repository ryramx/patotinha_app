# Tira o fundo branco da arte original e recorta no contorno do selo (requer numpy, scipy e Pillow).
# Uso: python3 scripts/recortar-logo.py docs/marca/logo-original.png docs/marca/logo-transparente.png
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = im.shape
mn = im.min(axis=2)
quase_branco = (im.max(axis=2) >= 246) & (mn >= 222)
rot, _ = ndimage.label(quase_branco)
borda = set(np.unique(np.concatenate([rot[0], rot[-1], rot[:, 0], rot[:, -1]]))) - {0}
fundo = np.isin(rot, list(borda))
# Fica só o selo (maior pedaço), sem respingos soltos do fundo.
pecas, n = ndimage.label(~fundo)
tam = ndimage.sum(np.ones_like(pecas), pecas, range(1, n + 1))
selo = ndimage.binary_fill_holes(pecas == (1 + int(np.argmax(tam))))
selo = ndimage.binary_opening(selo, iterations=1)
fundo = ~selo
# Faixa de transição: 2px em volta do fundo; alfa pelo "quanto não é branco".
faixa = ndimage.binary_dilation(fundo, iterations=2) & ~fundo
dist_fg = ~ndimage.binary_dilation(fundo, iterations=2)
# cor de referência: pixel opaco mais próximo
_, (iy, ix) = ndimage.distance_transform_edt(~dist_fg, return_indices=True)
ref = im[iy, ix]
alfa = np.ones((h, w), np.float32)
alfa[fundo] = 0
den = np.clip(255 - ref, 1, None)
a_faixa = np.clip(((255 - im) / den).max(axis=2), 0, 1)
alfa[faixa] = a_faixa[faixa]
# cor "desmisturada" do branco na faixa
cor = im.copy()
m = faixa & (alfa > 0.02)
cor[m] = ref[m]
out = np.dstack([cor, alfa * 255]).round().clip(0, 255).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
img = img.crop(img.getbbox())
img.save(dst)
print(img.size, fundo.sum(), faixa.sum())
