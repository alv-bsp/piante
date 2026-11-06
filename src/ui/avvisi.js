// Toast in basso (con un'azione facoltativa, es. Annulla) e foglio dal basso (un <dialog> unico in index.html).
// Il foglio sale e scende animato, e si chiude anche trascinandolo giù.
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
  // La barretta del tempo che resta riparte a ogni toast.
  el.style.setProperty("--durata", `${durata}ms`);
  el.classList.remove("on");
  void el.offsetWidth;
  el.classList.add("on");
  clearTimeout(timer);
  timer = setTimeout(chiudiToast, durata);
}

function chiudiToast() {
  azioneToast = null;
  document.getElementById("toast").classList.remove("on");
}

const foglio = () => document.getElementById("foglio");
let chiusura = null; // timer della chiusura animata in corso

/** Apre il foglio (o ne cambia il contenuto). `nome` serve a ridisegnarlo quando cambiano i dati. */
export function apriFoglio(contenuto, nome = "") {
  const d = foglio();
  if (chiusura) {
    // Riaperto mentre scendeva: lo fermo e lo riporto su.
    clearTimeout(chiusura);
    chiusura = null;
    d.classList.remove("chiude");
  }
  d.innerHTML = String(contenuto);
  d.dataset.nome = nome;
  d.style.transform = "";
  if (!d.open) d.showModal();
}

export const foglioAperto = (nome) => foglio().open && !chiusura && (!nome || foglio().dataset.nome === nome);

/** Chiude il foglio facendolo scendere. `subito` salta l'animazione (es. cambio pagina). */
export function chiudiFoglio({ subito = false } = {}) {
  const d = foglio();
  if (!d.open) return;
  if (subito) {
    clearTimeout(chiusura);
    chiusura = null;
    d.classList.remove("chiude");
    d.close();
    return;
  }
  if (chiusura) return;
  d.classList.add("chiude");
  chiusura = setTimeout(() => {
    chiusura = null;
    d.classList.remove("chiude");
    d.style.transform = "";
    d.close();
  }, 220);
}

// Un tocco sullo sfondo scuro chiude il foglio (il click arriva al <dialog> stesso, fuori dal contenuto).
export function preparaFoglio() {
  const d = foglio();
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const fuori = e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right;
    if (fuori) chiudiFoglio();
  });
  // Esc: stessa animazione del tocco fuori.
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    chiudiFoglio();
  });
  d.addEventListener("close", () => {
    d.innerHTML = "";
    d.dataset.nome = "";
    d.style.transform = "";
  });
  trascinaPerChiudere(d);
}

/** Trascinato giù dalla cima (o dalla maniglia), il foglio segue il dito; oltre una soglia si chiude. */
function trascinaPerChiudere(d) {
  let inizio = null;
  let dy = 0;
  let trascina = false;

  d.addEventListener("touchstart", (e) => {
    const t = e.target;
    if (e.touches.length !== 1 || t.closest("input, textarea, select, .scelta-specie")) {
      inizio = null;
      return;
    }
    inizio = { y: e.touches[0].clientY, t: performance.now(), daCima: d.scrollTop <= 0 || Boolean(t.closest(".maniglia, .foglio-testa")) };
    dy = 0;
    trascina = false;
  }, { passive: true });

  d.addEventListener("touchmove", (e) => {
    if (!inizio) return;
    dy = e.touches[0].clientY - inizio.y;
    if (!trascina) {
      if (!inizio.daCima || dy < 8) {
        if (dy < -4) inizio = null; // sta scorrendo su: lascia fare il browser
        return;
      }
      trascina = true;
      d.classList.add("trascinato");
    }
    e.preventDefault();
    // Più tira, meno segue: un po' di resistenza.
    const y = Math.max(0, dy - 8);
    d.style.transform = `translateY(${y}px)`;
  }, { passive: false });

  const fine = () => {
    if (!trascina) {
      inizio = null;
      return;
    }
    const velocita = dy / Math.max(1, performance.now() - inizio.t); // px/ms
    d.classList.remove("trascinato");
    inizio = null;
    trascina = false;
    if (dy > 110 || velocita > 0.6) {
      d.style.transform = `translateY(${Math.max(0, dy - 8)}px)`;
      chiudiFoglio();
    } else {
      d.style.transform = "";
    }
  };
  d.addEventListener("touchend", fine);
  d.addEventListener("touchcancel", fine);
}
