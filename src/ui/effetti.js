// Micro interazioni: vibrazione, schizzi d'acqua, foglioline, cuori, coriandoli, molla, transizioni tra pagine.
// #app si ridisegna con innerHTML, quindi le particelle vivono in un livello fisso fuori dall'app e sopravvivono
// ai ridisegni.


let livello = null;
function strato() {
  if (!livello?.isConnected) {
    livello = document.createElement("div");
    livello.className = "effetti";
    livello.setAttribute("aria-hidden", "true");
    document.body.append(livello);
  }
  return livello;
}

const togli = (el) => () => el.remove();
const caso = (a, b) => a + Math.random() * (b - a);
const scegli = (v) => v[Math.floor(Math.random() * v.length)];

/**
 * Vibrazione breve. Android: Vibration API. iPhone (Safari 18+): il tocco su un interruttore nativo
 * (<input type="checkbox" switch>) fa partire il feedback aptico di sistema, quindi ne clicco uno invisibile.
 */
export function vibra(ms = 10) {
  if (navigator.vibrate) {
    navigator.vibrate(ms);
    return;
  }
  try {
    const l = document.createElement("label");
    l.ariaHidden = "true";
    l.style.display = "none";
    const i = document.createElement("input");
    i.type = "checkbox";
    i.setAttribute("switch", "");
    l.append(i);
    document.head.append(l);
    l.click();
    l.remove();
  } catch { /* niente aptica */ }
}

export function centro(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Una particella con una traiettoria balistica: velocità iniziale (px/s) e gravità (px/s²). */
function particella({ x, y, classe, colore, dimensione, vx, vy, g = 1000, durata = 800, giro = 0, ritardo = 0, contenuto = "" }) {
  const p = document.createElement("span");
  p.className = `particella ${classe}`;
  p.style.cssText = `left:${x}px;top:${y}px;width:${dimensione}px;height:${dimensione}px;margin:${-dimensione / 2}px 0 0 ${-dimensione / 2}px;--c:${colore}`;
  if (contenuto) p.innerHTML = contenuto;
  strato().append(p);
  const passi = 8;
  const T = durata / 1000;
  const fotogrammi = Array.from({ length: passi + 1 }, (_, k) => {
    const f = k / passi;
    const t = f * T;
    const scala = f < 0.12 ? 0.3 + f * 5.8 : 1 - Math.max(0, f - 0.55) * 0.9;
    return {
      transform: `translate(${(vx * t).toFixed(1)}px, ${(vy * t + (g * t * t) / 2).toFixed(1)}px) rotate(${(giro * f).toFixed(0)}deg) scale(${scala.toFixed(3)})`,
      opacity: f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1,
    };
  });
  p.animate(fotogrammi, { duration: durata, delay: ritardo, easing: "linear", fill: "both" }).finished.then(togli(p), togli(p));
}

/** Un'onda che si allarga dal punto toccato. */
function anello(x, y, colore, scala = 3.2, durata = 560) {
  const a = document.createElement("span");
  a.className = "anello";
  a.style.cssText = `left:${x}px;top:${y}px;--c:${colore}`;
  strato().append(a);
  a.animate(
    [{ transform: "scale(.25)", opacity: 0.9 }, { transform: `scale(${scala})`, opacity: 0 }],
    { duration: durata, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" },
  ).finished.then(togli(a), togli(a));
}

const ACQUA = ["#7dd3fc", "#38bdf8", "#bae6fd", "#0ea5e9"];
const VERDI = ["#c9f59a", "#8ef0a8", "#3fe06f", "#e6ffd6"];
const CUORE = '<svg viewBox="0 0 24 24"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

/** Schizzi dal centro di un elemento: gocce d'acqua o foglioline verdi (concime). */
export function schizzi(el, tipo = "acqua", { quante = 14, forza = 1 } = {}) {
  if (!el?.isConnected) return;
  const { x, y } = centro(el);
  const acqua = tipo === "acqua";
  anello(x, y, acqua ? "#7dd3fc" : "#8ef0a8", 2.6 * forza);
  for (let i = 0; i < quante; i++) {
    const angolo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25; // a ventaglio, verso l'alto
    const v = caso(240, 470) * forza;
    particella({
      x, y,
      classe: acqua ? "p-goccia" : "p-foglia",
      colore: scegli(acqua ? ACQUA : VERDI),
      dimensione: caso(acqua ? 6 : 8, acqua ? 13 : 14),
      vx: Math.cos(angolo) * v,
      vy: Math.sin(angolo) * v,
      g: 1300,
      durata: caso(620, 900),
      giro: acqua ? 0 : caso(-420, 420),
    });
  }
}

/** Piccole cose che salgono piano dall'elemento: cuori, "z". */
function sali(el, { classe, contenuto, colori, quanti = 5, dimensione = [14, 24] }) {
  if (!el?.isConnected) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < quanti; i++) {
    particella({
      x: r.left + r.width * caso(0.3, 0.7),
      y: r.top + r.height * 0.3,
      classe,
      colore: scegli(colori),
      dimensione: caso(...dimensione),
      vx: caso(-70, 70),
      vy: caso(-300, -200),
      g: 160,
      durata: caso(1000, 1400),
      giro: caso(-40, 40),
      ritardo: i * 70,
      contenuto,
    });
  }
}

/** Cuori (la mascotte coccolata). */
export const cuori = (el, quanti = 5) =>
  sali(el, { classe: "p-cuore", contenuto: CUORE, colori: ["#ff8fa3", "#ffb3c1", "#8ef0a8", "#ffffff"], quanti });

/** "z" che salgono (ancora umida: se ne riparla tra qualche giorno). */
export const zeta = (el) =>
  sali(el, { classe: "p-zeta", contenuto: "z", colori: ["#fbcfe8", "#e9d5ff", "#ffffff"], quanti: 4, dimensione: [16, 26] });

/** Festa: coriandoli di gocce e foglie (l'ultima pianta del giorno sistemata). */
export function festa(el) {
  if (!el?.isConnected) return;
  const { x, y } = centro(el);
  anello(x, y, "#3fe06f", 4, 800);
  for (let i = 0; i < 34; i++) {
    const angolo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const v = caso(280, 640);
    const acqua = i % 3 === 0;
    particella({
      x, y,
      classe: acqua ? "p-goccia" : i % 3 === 1 ? "p-foglia" : "p-coriandolo",
      colore: scegli(acqua ? ACQUA : [...VERDI, "#ffffff", "#fde68a"]),
      dimensione: caso(7, 14),
      vx: Math.cos(angolo) * v,
      vy: Math.sin(angolo) * v,
      g: 1100,
      durata: caso(1100, 1600),
      giro: caso(-720, 720),
      ritardo: caso(0, 90),
    });
  }
}

/** Schiaccia e allunga un elemento, come una gelatina. */
export function molla(el, forza = 1) {
  if (!el?.isConnected) return;
  const s = (a) => (1 + a * forza).toFixed(3);
  el.animate(
    [
      { transform: "none" },
      { transform: `scale(${s(0.16)}, ${s(-0.16)})`, offset: 0.18 },
      { transform: `translateY(${(-16 * forza).toFixed(1)}px) scale(${s(-0.08)}, ${s(0.12)})`, offset: 0.45 },
      { transform: `scale(${s(0.06)}, ${s(-0.06)})`, offset: 0.72 },
      { transform: "none" },
    ],
    { duration: 640, easing: "ease-out" },
  );
}

/** Un piccolo sobbalzo (es. la mascotte quando tocchi Bagna, prima che arrivi la risposta). */
export function saltello(el) {
  if (!el?.isConnected) return;
  el.animate(
    [{ transform: "none" }, { transform: "translateY(-10px) rotate(-4deg)", offset: 0.4 }, { transform: "none" }],
    { duration: 380, easing: "cubic-bezier(.3,.7,.4,1)" },
  );
}

/** Un'occhiata di conferma su una riga o una carta appena segnata. */
export function lampo(el) {
  if (!el?.isConnected) return;
  el.animate(
    [{ boxShadow: "inset 0 0 0 999px rgba(63,224,111,.22)" }, { boxShadow: "inset 0 0 0 999px rgba(63,224,111,0)" }],
    { duration: 900, easing: "ease-out" },
  );
}

/** Una carta che se ne va (la pianta non è più da fare oggi). Ritorna la funzione per rimetterla se il salvataggio fallisce. */
export function congeda(el) {
  if (!el?.isConnected) return () => {};
  const h = el.getBoundingClientRect().height;
  const a = el.animate(
    [
      { opacity: 1, transform: "none", height: `${h}px` },
      { opacity: 0, transform: "scale(.94) translateY(-6px)", height: `${h}px`, offset: 0.45 },
      { opacity: 0, transform: "scale(.94)", height: "0px" },
    ],
    { duration: 520, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
  );
  return () => a.cancel();
}

/**
 * Cambio pagina con la View Transitions API (Safari 18+, Chrome): `tipo` (avanti, indietro, tab) sceglie l'animazione
 * in CSS. `cambia` può essere asincrona: la vecchia pagina resta ferma finché non ha finito.
 */
let gettone = 0;
export function transizione(tipo, cambia) {
  if (!document.startViewTransition) {
    cambia();
    return;
  }
  const mio = ++gettone;
  const radice = document.documentElement;
  radice.dataset.transizione = tipo;
  const t = document.startViewTransition(cambia);
  // Se la transizione salta (es. la barra di Safari cambia l'altezza della pagina) il cambio avviene lo stesso:
  // l'errore non serve a niente.
  t.ready.catch(() => {});
  t.updateCallbackDone.catch((e) => console.error("cambio pagina", e));
  t.finished.catch(() => {}).finally(() => {
    if (gettone === mio) delete radice.dataset.transizione;
  });
}
