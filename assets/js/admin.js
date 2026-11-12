/* ============================================================
   PaccoVeloce — Area riservata (accesso solo agenzia)
   Serratura lato client: il pannello di gestione (inserimento
   dati + generazione numero di consignazione) resta nascosto
   finché non viene inserita la password dell'agenzia.
   NOTA: su un sito statico la protezione è dimostrativa; per
   una sicurezza reale serve un backend (vedi README).
   ============================================================ */

(function () {
  "use strict";

  var PASSWORD = "pacco2026";
  var CHIAVE = "pv_admin_ok";

  var gate = document.getElementById("admin-gate");
  var panel = document.getElementById("admin-panel");
  var modulo = document.getElementById("gate-form");
  var campo = document.getElementById("gate-pass");
  var errore = document.getElementById("gate-errore");

  if (!gate || !panel) return;

  function apri() {
    gate.style.display = "none";
    panel.hidden = false;
    try { sessionStorage.setItem(CHIAVE, "1"); } catch (eStore) {}
    mostraLocali();
  }

  /* Liste les expéditions enregistrées sur CET appareil : permet à
     l'agence de vérifier si un numéro (ex. émis avant l'activation
     du registre) est bien présent ici avant de le republier. */
  function mostraLocali() {
    var zone = document.getElementById("admin-locales");
    if (!zone) return;

    var lista = [];
    try {
      if (window.PV_Spedizioni && window.PV_Spedizioni.elenco) lista = window.PV_Spedizioni.elenco() || [];
    } catch (e) { lista = []; }

    if (!lista.length) {
      zone.textContent = "📦 Nessuna spedizione salvata su questo dispositivo.";
      return;
    }

    var numeri = lista.map(function (s) { return s.numero; }).slice(0, 12).join(", ");
    zone.textContent = "📦 " + lista.length + " spedizion" + (lista.length === 1 ? "e" : "i") +
      " su questo dispositivo: " + numeri + (lista.length > 12 ? "…" : "");
  }

  /* Sessione già aperta (stessa scheda): niente password ridigitata */
  try {
    if (sessionStorage.getItem(CHIAVE) === "1") apri();
  } catch (eSess) {}

  /* --- Ripubblicazione del registro condiviso ------------------
     Se un numero non si trova da un altro dispositivo, questo
     pulsante rispedisce tutte le spedizioni locali allo spazio
     online. Utile anche per ripristinare i dati se lo spazio
     pubblico viene svuotato. */
  var btnRipubblica = document.getElementById("btn-ripubblica");
  var esitoRipubblica = document.getElementById("ripubblica-esito");

  if (btnRipubblica) {
    btnRipubblica.addEventListener("click", function () {
      var lista = [];
      try {
        if (window.PV_Spedizioni && window.PV_Spedizioni.elenco) lista = window.PV_Spedizioni.elenco() || [];
      } catch (eLista) { lista = []; }

      if (!lista.length) {
        if (esitoRipubblica) esitoRipubblica.textContent = "⚠️ Nessuna spedizione salvata su questo dispositivo.";
        return;
      }
      if (!window.PV_API || !window.PV_API.attivo()) {
        if (esitoRipubblica) esitoRipubblica.textContent = "⚠️ Registro online non disponibile.";
        return;
      }

      btnRipubblica.disabled = true;
      if (esitoRipubblica) esitoRipubblica.textContent = "⏳ Pubblicazione di " + lista.length + " spedizioni…";

      window.PV_API.pubblicaTutti(lista).then(function (n) {
        btnRipubblica.disabled = false;
        if (esitoRipubblica) {
          esitoRipubblica.textContent = n
            ? "✅ " + n + " spedizioni ripubblicate: ora sono consultabili da qualsiasi dispositivo."
            : "⚠️ Pubblicazione non riuscita: controlla la connessione e riprova.";
        }
      }).catch(function () {
        btnRipubblica.disabled = false;
        if (esitoRipubblica) esitoRipubblica.textContent = "⚠️ Pubblicazione non riuscita: controlla la connessione e riprova.";
      });
    });
  }

  /* --- Diagnostic du registre en ligne -------------------------
     Écrit puis relit un numéro de test depuis CET appareil : dit
     si la publication en ligne fonctionne réellement ici. */
  var btnTest = document.getElementById("btn-test-registro");

  if (btnTest) {
    btnTest.addEventListener("click", function () {
      if (!window.PV_API || typeof window.PV_API.testRegistro !== "function") {
        if (esitoRipubblica) esitoRipubblica.textContent = "⚠️ Modulo registro non caricato: ricarica la pagina.";
        return;
      }

      btnTest.disabled = true;
      if (esitoRipubblica) esitoRipubblica.textContent = "⏳ Verifica in corso…";

      window.PV_API.testRegistro().then(function (r) {
        btnTest.disabled = false;
        if (!esitoRipubblica) return;

        if (r && r.ok) {
          esitoRipubblica.textContent = "✅ Registro online funzionante da questo dispositivo.";
        } else if (r && r.motivo === "scrittura") {
          esitoRipubblica.textContent = "⚠️ Scrittura rifiutata: il registro non accetta dati da questo dispositivo. Usa il link di tracciamento.";
        } else if (r && r.motivo === "lettura") {
          esitoRipubblica.textContent = "⚠️ Scrittura accettata ma rilettura fallita (rete o cache). Il numero può comunque funzionare: usa il link di tracciamento.";
        } else if (r && r.motivo === "non-configurato") {
          esitoRipubblica.textContent = "⚠️ Nessun registro configurato.";
        } else {
          esitoRipubblica.textContent = "⚠️ Registro non raggiungibile: controlla la connessione. Usa il link di tracciamento.";
        }
      });
    });
  }

  if (modulo && campo) {
    modulo.addEventListener("submit", function (e) {
      e.preventDefault();
      if (campo.value === PASSWORD) {
        if (errore) errore.style.display = "none";
        campo.value = "";
        apri();
      } else {
        if (errore) {
          errore.textContent = "❌ Password errata. Riprova.";
          errore.style.display = "block";
        }
        campo.value = "";
        campo.focus();
      }
    });
  }
})();