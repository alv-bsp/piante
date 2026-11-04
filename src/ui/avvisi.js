// Toast in basso (con un'azione facoltativa, es. Annulla) e foglio dal basso (un <dialog> unico in index.html).
let timer = null;
let azioneToast = null;

export function toast(testo, { azione = null, etichetta = "Annulla", durata = azione ? 5000 : 2800 } = {}) {
  const el = document.getElementById("toast");
  el.replaceChildren(document.createTextNode(testo));
  azioneToast = azione;
  if (azione) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-azione";
    b.textContent = etichetta;
    b.addEventListener("click", () => {
      const f = azioneToast;
      chiudiToast();
      f?.();
    });
    el.append(b);
  }
  el.classList.toggle("con-azione", Boolean(azione));
  el.classList.add("on");
  clearTimeout(timer);
  timer = setTimeout(chiudiToast, durata);
}

function chiudiToast() {
  azioneToast = null;
  document.getElementById("toast").classList.remove("on");
}

const foglio = () => document.getElementById("foglio");

/** Apre il foglio (o ne cambia il contenuto). `nome` serve a ridisegnarlo quando cambiano i dati. */
export function apriFoglio(contenuto, nome = "") {
  const d = foglio();
  d.innerHTML = String(contenuto);
  d.dataset.nome = nome;
  if (!d.open) d.showModal();
}

export const foglioAperto = (nome) => foglio().open && (!nome || foglio().dataset.nome === nome);

export function chiudiFoglio() {
  const d = foglio();
  if (d.open) d.close();
}

// Un tocco sullo sfondo scuro chiude il foglio (il click arriva al <dialog> stesso, fuori dal contenuto).
export function preparaFoglio() {
  const d = foglio();
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const fuori = e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right;
    if (fuori) d.close();
  });
  d.addEventListener("close", () => {
    d.innerHTML = "";
    d.dataset.nome = "";
  });
}
