import sys, time
from rembg import new_session, remove
from PIL import Image
modello = sys.argv[1]; nomi = sys.argv[2:]
s = new_session(modello)
for n in nomi:
    t = time.time()
    im = Image.open(f"orig/{n}.jpg").convert("RGB")
    im.thumbnail((1400, 1400))
    out = remove(im, session=s, post_process_mask=True)
    out.save(f"cut/{n}.{modello}.png")
    print(n, modello, round(time.time() - t, 1), "s", flush=True)
