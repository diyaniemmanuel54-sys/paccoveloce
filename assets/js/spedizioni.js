/* ============================================================
   PaccoVeloce — Le mie spedizioni (spedizioni.html)

   Affiche l'historique local des expéditions (localStorage via
   shipments.js) sous forme de cartes : numéro S10, route
   mittente → destinatario, statut en temps réel (PV_Spedizioni.stato),
   coût estimé (PV_Prezzi, zone déduite du CAP du destinataire)
   et actions (traçage, étiquette imprimable, suppression).

   Démonstration sans backend : le registre vit dans le
   localStorage du navigateur. En production, remplacer par un
   appel GET /api/spedizioni (voir README).
   ============================================================ */

(function () {
  "use strict";

  var LIEN_TRACKING = "suivi.html?n=";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function indirizzoBreve(p) {
    return p.citta + " (" + p.provincia + ")";
  }

  function dataBreve(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  var LIBELLE_SERVIZI = {
    express: "Express (24–48 h)",
    standard: "Standard (2–4 giorni)",
    economico: "Economico (3–6 giorni)"
  };

  function costoStimato(sped) {
    if (!window.PV_Prezzi || !sped || !sped.destinatario) return null;
    try {
      var zona = window.PV_Prezzi.zonaDaCAP(sped.destinatario.cap) || "nord";
      return window.PV_Prezzi.calcola({
        poids: sped.peso,
        zone: zona,
        servizio: sped.servizio
      });
    } catch (e) {
      return null;
    }
  }

  function htmlCard(sped) {
    var st = window.PV_Spedizioni.stato(sped);
    var costo = costoStimato(sped);
    return (
      '<article class="sped-card">' +
      '  <div class="sped-card-top">' +
      '    <div>' +
      '      <div class="sped-numero">' + esc(sped.numero) + "</div>" +
      '      <div class="sped-data">Registrata il ' + dataBreve(sped.creatoIl) + "</div>" +
      "    </div>" +
      '    <span class="status-pill ' + st.pill + '">' + esc(st.label) + "</span>" +
      "  </div>" +
      '  <div class="sped-route">' +
      '    <div class="sped-stop">' +
      '      <span class="sped-stop-ic">📤</span>' +
      "      <div><small>Mittente</small><strong>" + esc(sped.mittente.nome) + "</strong>" +
      "      <span>" + esc(indirizzoBreve(sped.mittente)) + "</span></div>" +
      "    </div>" +
      '    <div class="sped-freccia" aria-hidden="true">→</div>' +
      '    <div class="sped-stop">' +
      '      <span class="sped-stop-ic">📥</span>' +
      "      <div><small>Destinatario</small><strong>" + esc(sped.destinatario.nome) + "</strong>" +
      "      <span>" + esc(indirizzoBreve(sped.destinatario)) + "</span></div>" +
      "    </div>" +
      "  </div>" +
      '  <div class="sped-meta">' +
      '    <span>Servizio: <strong>' + esc(LIBELLE_SERVIZI[sped.servizio] || sped.servizio) + "</strong></span>" +
      '    <span>Peso: <strong>' + esc(sped.peso) + " kg</strong></span>" +
      (costo ? '<span>Costo stimato: <strong>' + window.PV_Prezzi.formatta(costo.totale) +
        "</strong> (" + esc(costo.zoneLabel) + ")</span>" : "") +
      "  </div>" +
      '  <div class="sped-azioni">' +
      '    <a class="btn" href="' + LIEN_TRACKING + encodeURIComponent(sped.numero) + '">Traccia</a>' +
      '    <button type="button" class="btn btn--ghost js-sped-stampa">📄 Etichetta</button>' +
      '    <button type="button" class="btn btn--ghost js-sped-elimina" data-numero="' + esc(sped.numero) + '">🗑 Elimina</button>' +
      "  </div>" +
      "</article>"
    );
  }

  function htmlVuoto() {
    return (
      '<div class="sped-empty">' +
      '  <div class="sped-empty-icon">📭</div>' +
      "  <h3>Nessuna spedizione registrata</h3>" +
      "  <p>Le spedizioni create con il modulo di prenotazione appariranno qui, con il loro stato in tempo reale.</p>" +
      '  <a class="btn" href="reservation.html">Prenota il primo ritiro</a>' +
      "</div>"
    );
  }

  function aggiornaConteggio(lista) {
    var cont = document.getElementById("sped-conteggio");
    var svuota = document.getElementById("sped-svuota");
    if (cont) {
      var inCorso = lista.filter(function (s) {
        var st = window.PV_Spedizioni.stato(s);
        return st.indice < 5; /* tout sauf « Consegnato » */
      }).length;
      cont.textContent = lista.length === 0
        ? "Nessuna spedizione registrata su questo dispositivo."
        : lista.length + (lista.length === 1 ? " spedizione" : " spedizioni") +
          (inCorso > 0 ? " — " + inCorso + (inCorso === 1 ? " in corso" : " in corso") : " — nessuna in corso");
    }
    if (svuota) svuota.style.display = lista.length > 0 ? "" : "none";
  }

  function render() {
    var cont = document.getElementById("spedizioni-list");
    if (!cont) return;
    var lista = window.PV_Spedizioni.elenco();
    cont.innerHTML = lista.length === 0 ? htmlVuoto() : lista.map(htmlCard).join("");
    aggiornaConteggio(lista);

    cont.querySelectorAll(".js-sped-stampa").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".sped-card");
        var numero = card ? card.querySelector(".sped-numero").textContent.trim() : null;
        if (!numero) return;
        var sped = window.PV_Spedizioni.trova(numero);
        if (sped && window.PV_Etichetta) window.PV_Etichetta.mostra(sped);
      });
    });

    cont.querySelectorAll(".js-sped-elimina").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var numero = btn.getAttribute("data-numero");
        if (!numero) return;
        if (!window.confirm("Eliminare la spedizione " + numero + " dall'elenco locale?")) return;
        window.PV_Spedizioni.rimuovi(numero);
        render();
        try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {}
      });
    });
  }

  var svuota = document.getElementById("sped-svuota");
  if (svuota) {
    svuota.addEventListener("click", function () {
      var lista = window.PV_Spedizioni.elenco();
      if (lista.length === 0) { render(); return; }
      if (!window.confirm("Vuoi davvero eliminare tutte le " + lista.length + " spedizioni registrate?")) return;
      lista.forEach(function (s) { window.PV_Spedizioni.rimuovi(s.numero); });
      render();
    });
  }

  render();
})();