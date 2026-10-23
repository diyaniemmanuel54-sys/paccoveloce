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
  }

  /* Sessione già aperta (stessa scheda): niente password ridigitata */
  try {
    if (sessionStorage.getItem(CHIAVE) === "1") apri();
  } catch (eSess) {}

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