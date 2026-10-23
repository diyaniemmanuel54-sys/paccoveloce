/* ============================================================
   PaccoVeloce — Calculateur de devis (page Tariffe)

   Le modèle tarifaire est centralisé dans prezzi.js (PV_Prezzi),
   chargé AVANT ce fichier : le calculateur de la page Tariffe,
   le devis en direct du formulaire de réservation et la page
   « Le mie spedizioni » utilisent donc exactement les mêmes
   tarifs et la même logique de zone par CAP.
   ============================================================ */

(function () {
  "use strict";

  var form = document.getElementById("quote-form");
  if (!form) return;
  if (!window.PV_Prezzi) {
    /* File d'attente de secours : recommence quand prezzi.js est chargé.
       Ne devrait jamais arriver (les scripts sont dans le bon ordre). */
    window.setTimeout(function () { window.location.reload(); }, 800);
    return;
  }

  function formatPrice(v) {
    return window.PV_Prezzi.formatta(v);
  }

  function lireValeur(id, def) {
    var el = document.getElementById(id);
    if (!el) return def;
    if (el.type === "checkbox") return el.checked ? "1" : "0";
    return el.value || def;
  }

  function collecter() {
    return {
      poids: lireValeur("quote-poids", "1"),
      longueur: lireValeur("quote-longueur", "0"),
      largeur: lireValeur("quote-largeur", "0"),
      hauteur: lireValeur("quote-hauteur", "0"),
      zone: lireValeur("quote-zone", "nord"),
      servizio: lireValeur("quote-servizio", "standard"),
      valore: lireValeur("quote-valeur", "0")
    };
  }

  function afficher(result) {
    var lignes = document.getElementById("quote-lines");
    var totalEl = document.getElementById("quote-total-amount");
    var zoneEl = document.getElementById("quote-zone-label");
    if (!lignes || !totalEl) return;

    var items = [
      ["Ritiro in agenzia", formatPrice(result.rigaBase)],
      ["Trasporto (" + result.peso.toFixed(1).replace(".", ",") + " kg)", formatPrice(result.rigaTrasporto)]
    ];
    if (result.sovrapprezzoDim > 0) {
      items.push(["Suppl. dimensioni (L+H+P > 100 cm)", formatPrice(result.sovrapprezzoDim)]);
    }
    items.push(["Zona: " + result.zoneLabel + " (×" + result.coeffZone.toFixed(2).replace(".", ",") + ")", "+ " + formatPrice(result.maggiorazioneZona)]);
    items.push(["Servizio: " + result.servizioLabel, formatPrice(result.rigaBase + result.rigaTrasporto + result.sovrapprezzoDim)]);
    if (result.maggiorazioneExpress > 0) {
      items.push(["Consegna Express (+40 %)", "+ " + formatPrice(result.maggiorazioneExpress)]);
    }
    if (result.assicurazione > 0) {
      items.push(["Assicurazione (2 % del valore)", formatPrice(result.assicurazione)]);
    }

    lignes.innerHTML = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      var nom = document.createElement("span");
      nom.textContent = item[0];
      var montant = document.createElement("span");
      montant.textContent = item[1];
      li.appendChild(nom);
      li.appendChild(montant);
      lignes.appendChild(li);
    });

    totalEl.textContent = formatPrice(result.totale);
    if (zoneEl) zoneEl.textContent = result.zoneLabel;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    afficher(window.PV_Prezzi.calcola(collecter()));
  });

  /* Recalcul « live » à chaque modification du formulaire */
  ["input", "change"].forEach(function (type) {
    form.addEventListener(type, function () {
      afficher(window.PV_Prezzi.calcola(collecter()));
    });
  });

  afficher(window.PV_Prezzi.calcola(collecter()));
})();