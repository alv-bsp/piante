import onnxruntime as ort
_O = ort.SessionOptions
class _S(_O):
    def __init__(self):
        super().__init__(); self.enable_cpu_mem_arena = False; self.enable_mem_pattern = False
ort.SessionOptions = _S
import sys, json
import numpy as np
from rembg import new_session, remove
from PIL import Image, ImageFilter
# nome: (box in frazioni, punti negativi, punti positivi)
P = {
  "alocasia": ([0.2,0.0,0.75,0.92], [(0.08,0.6),(0.2,0.9)], []),
  "philodendron-birkin": ([0.13,0.28,0.82,0.88], [(0.9,0.85),(0.75,0.8)], [(0.5,0.85)]),
  "ficus-lyrata": ([0.22,0.25,0.73,0.92], [], [(0.47,0.8)]),
  "philodendron": ([0.28,0.0,0.8,0.98], [], [(0.55,0.88)]),
  "fittonia": ([0.3,0.05,0.9,0.85], [], [(0.55,0.65)]),
  "dieffenbachia": ([0.0,0.05,1.0,1.0], [(0.05,0.95)], [(0.55,0.95)]),
  "pothos": ([0.1,0.25,0.98,1.0], [(0.93,0.95)], [(0.5,0.65)]),
  "monstera-adansonii": ([0.2,0.2,0.75,0.65], [(0.65,0.55),(0.6,0.75)], [(0.45,0.55)]),
  "monstera-variegata": ([0.03,0.0,1.0,0.8], [(0.33,0.88),(0.72,0.88)], []),
  "monstera-deliciosa": ([0.1,0.0,0.92,0.92], [(0.4,0.96),(0.65,0.96)], [(0.5,0.85)]),
}
s = new_session("sam")
for n in sys.argv[1:]:
    box, neg, pos = P[n]
    im = Image.open(f"orig/{n}.jpg").convert("RGB"); im.thumbnail((1024,1024))
    w, h = im.size
    prompt = [{"type": "rectangle", "data": [box[0]*w, box[1]*h, box[2]*w, box[3]*h], "label": 1}]
    prompt += [{"type": "point", "data": [x*w, y*h], "label": 0} for x, y in neg]
    prompt += [{"type": "point", "data": [x*w, y*h], "label": 1} for x, y in pos]
    m = remove(im, session=s, only_mask=True, sam_prompt=prompt)
    m.save(f"cut/{n}.sam.png"); print(n, flush=True)
