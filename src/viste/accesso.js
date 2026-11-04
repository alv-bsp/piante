import { html } from "../ui/html.js";
import { icona } from "../ui/icone.js";
import { accedi } from "../accesso.js";
import { SPECIE, fotoSpecie } from "../specie.js";

export function render() {
  return html`
    <main class="accesso">
      <div class="foto copertina"><img src="${fotoSpecie(SPECIE[2], "copertina")}" alt="" decoding="async"></div>
      <div class="accesso-testa">
        <h1>Le tue piante,<br>senza pensarci</h1>
        <p>Quando bagnarle, quando concimarle. Accedi per iniziare.</p>
      </div>
      <form id="form-accesso" novalidate>
        <label class="campo">
          <span>Email</span>
          <input type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" required>
        </label>
        <label class="campo">
          <span>Password</span>
          <input type="password" name="password" autocomplete="current-password" required>
        </label>
        <p class="errore" id="errore-accesso" role="alert" hidden></p>
        <button class="btn primario largo btn-freccia" type="submit">
          <span class="cerchio" aria-hidden="true">${icona("arrow-right", 20)}</span><span class="testo">Accedi</span>
        </button>
      </form>
    </main>`;
}

/** Gestisce l'invio del form senza ridisegnare la pagina, così i campi restano come sono. */
export async function invia(form) {
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const bottone = form.querySelector("button[type=submit]");
  const errore = form.querySelector("#errore-accesso");

  const mostra = (testo) => {
    errore.innerHTML = String(html`${icona("alert", 18)}<span>${testo}</span>`);
    errore.hidden = false;
  };

  if (!email || !password) {
    mostra("Inserisci email e password.");
    (email ? form.password : form.email).focus();
    return;
  }

  errore.hidden = true;
  bottone.setAttribute("aria-busy", "true");
  bottone.disabled = true;
  bottone.querySelector(".testo").textContent = "Accesso in corso…";
  try {
    await accedi(email, password);
    // Al successo ci pensa onAuthStateChange: la pagina passa a Oggi.
  } catch (e) {
    mostra(e.message);
    bottone.disabled = false;
    bottone.removeAttribute("aria-busy");
    bottone.querySelector(".testo").textContent = "Accedi";
    form.password.select();
  }
}
