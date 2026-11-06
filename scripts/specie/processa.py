import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

R = {
  "monstera-variegata": dict(src="sam"),
  "monstera-adansonii": dict(src="u2net", pelle=True, taglio=0.43),
  "monstera-deliciosa": dict(src="sam"),
  "ficus-lyrata": dict(src="sam"),
  "strelitzia-nicolai": dict(src="isnet-general-use"),
  "alocasia": dict(src="u2net", pelle=True, taglio=0.83),
  "begonia-maculata": dict(src="u2net"),
  "begonia-rex": dict(src="isnet-general-use"),
  "begonia-corallina": dict(src="isnet-general-use"),
  "philodendron": dict(src="sam"),
  "philodendron-birkin": dict(src="u2net", pelle=True, limite="sam"),
  "pothos": dict(src="u2net"),
  "fittonia": dict(src="sam"),
  "dieffenbachia": dict(src="u2net"),
  "sansevieria": dict(src="isnet-general-use"),
  "limone": dict(src="isnet-general-use", file="limone-b", rosso=True),
  "melo": dict(src="isnet-general-use", file="melo-b"),
  "pianta": dict(src="isnet-general-use"),
}

def carica(nome, r):
    f = r.get("file", nome)
    im = Image.open(f"orig/{f}.jpg").convert("RGB"); im.thumbnail((1400, 1400))
    if r["src"] == "sam":
        m = Image.open(f"cut/{f}.sam.png").convert("L").resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
        a = np.asarray(m, dtype=np.float32) / 255
        a = np.clip((a - 0.5) * 2.2 + 0.5, 0, 1)
    else:
        c = Image.open(f"cut/{f}.{r['src']}.png").convert("RGBA")
        assert c.size == im.size, (c.size, im.size)
        a = np.asarray(c, dtype=np.float32)[..., 3] / 255
    return im, a

def pelle(im):
    ycc = np.asarray(im.convert("YCbCr"), dtype=np.int16)
    y, cb, cr = ycc[..., 0], ycc[..., 1], ycc[..., 2]
    s = (cr > 136) & (cr < 178) & (cb > 77) & (cb < 132) & (y > 50)
    return ndimage.binary_dilation(ndimage.binary_opening(s, iterations=2), iterations=4)

def rosso(im):
    hsv = np.asarray(im.convert("HSV"), dtype=np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return ((h < 12) | (h > 235)) & (s > 90) & (v > 60)

for nome, r in R.items():
    im, a = carica(nome, r)
    H = a.shape[0]
    if r.get("pelle"): a[pelle(im)] = 0
    if r.get("rosso"): a[ndimage.binary_dilation(rosso(im), iterations=3)] = 0
    if r.get("taglio"): a[int(r["taglio"] * H):] = 0
    if r.get("limite"):
        f = r.get("file", nome)
        m = np.asarray(Image.open(f"cut/{f}.sam.png").convert("L").resize(im.size)) > 127
        a = a * ndimage.binary_dilation(m, iterations=12)
    # Tiene il pezzo principale e i pezzi grandi staccati (foglie), butta i frammenti.
    lab, n = ndimage.label(a > 0.35)
    if n:
        aree = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        tieni = [i + 1 for i, ar in enumerate(aree) if ar >= 0.04 * aree.max()]
        maschera = ndimage.binary_dilation(np.isin(lab, tieni), iterations=3)
        a = a * maschera
    alfa = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    out = im.convert("RGBA"); out.putalpha(alfa)
    bb = out.getbbox(); out = out.crop(bb)
    g = out.copy(); g.thumbnail((900, 900), Image.LANCZOS); g.save(f"fine/{nome}.webp", quality=82, method=6)
    m = out.copy(); m.thumbnail((220, 220), Image.LANCZOS); m.save(f"fine/{nome}-mini.webp", quality=80, method=6)
    print(nome, g.size, flush=True)
