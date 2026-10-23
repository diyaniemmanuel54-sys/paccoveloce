/* ============================================================
   PaccoVeloce — Modèle tarifaire partagé (PV_Prezzi)

   Source unique du calcul des prix, utilisée par :
   - le calculateur de la page Tariffe (tarifs.html)
   - le formulaire de réservation (devis en direct + coût affiché
     sur l'écran de confirmation)
   - la page « Le mie spedizioni » (coût estimé par expédition)

   Trois services distincts :
   - economico (3–6 giorni) : base et prix/kg réduits (~15 % moins cher)
   - standard  (2–4 giorni) : tarif de référence
   - express   (24–48 h)    : majoration +40 % sur le standard

   La zone (Nord / Centro / Sud & Isole) est déduite du CAP du
   destinataire : les CAP italiens étant attribués par zone
   géographique, les deux premiers chiffres suffisent.
   ============================================================ */

(function () {
  "use strict";

  var ZONES = {
    nord:   { label: "Nord Italia",   coeff: 1.0 },
    centro: { label: "Centro Italia", coeff: 1.15 },
    sud:    { label: "Sud & Isole",   coeff: 1.35 }
  };

  var SERVIZI = {
    standard: {
      label: "Standard (2\u20134 giorni)",
      base: 4.9,          // € — prise en charge
      fino5: 0.85,        // €/kg jusqu'à 5 kg
      oltre5: 0.6,        // €/kg au-delà de 5 kg
      coeffExpress: null
    },
    express: {
      label: "Express (24\u201348 h)",
      base: 4.9,
      fino5: 0.85,
      oltre5: 0.6,
      coeffExpress: 1.4   // +40 %
    },
    economico: {
      label: "Economico (3\u20136 giorni)",
      base: 4.2,
      fino5: 0.7,
      oltre5: 0.45,
      coeffExpress: null
    }
  };

  var SURCHARGE_DIMENSIONS = 2.5;  // si L+H+P > 100 cm
  var TAUX_ASSURANCE = 0.02;       // 2 % de la valeur déclarée

  /* Zone déduite du CAP (5 chiffres). Plages italiennes :
     00–06 Lazio/Umbria → Centro · 09 Sardegna → Sud · 10–49 → Nord
     50–59 Toscana → Centro · 60–63 Marche → Centro · 64–67 Abruzzo → Sud
     70–99 Puglia/Campania/Basilicata/Molise/Calabria/Sicilia → Sud */
  function zonaDaCAP(cap) {
    var c = String(cap || "").replace(/\s/g, "");
    if (!/^\d{5}$/.test(c)) return null;
    var p = parseInt(c.slice(0, 2), 10);
    if (p === 9 || (p >= 64 && p <= 67) || p >= 70) return "sud";
    if (p <= 6 || (p >= 50 && p <= 63)) return "centro";
    return "nord";
  }

  /* Résout le service demandé. Rétrocompatible :
     - {servizio: "economico"|"standard"|"express"} prime,
     - sinon legacy {express: "1"|true} → express,
     - par défaut → standard. */
  function serviceDe(donnees) {
    var expressLegacy = donnees.express === "1" || donnees.express === true ||
      donnees.express === "express" || donnees.express === "true";
    var cle = String(donnees.servizio || (expressLegacy ? "express" : "standard"))
      .toLowerCase().trim();
    if (!SERVIZI[cle]) cle = "standard";
    return {
      key: cle,
      data: SERVIZI[cle],
      express: cle === "express"
    };
  }

  /* Calcule le devis à partir de {poids, longueur, largeur,
     hauteur, zone|cap, servizio|express, valore}. Renvoie le détail
     ligne par ligne + le total. */
  function calcola(donnees) {
    var poids = Math.max(0.1, parseFloat(donnees.poids) || 0.1);
    var longueur = parseFloat(donnees.longueur) || 0;
    var largeur = parseFloat(donnees.largeur) || 0;
    var hauteur = parseFloat(donnees.hauteur) || 0;

    var zoneCle = donnees.zone ||
      (donnees.cap ? zonaDaCAP(donnees.cap) : null) || "nord";
    var zone = ZONES[zoneCle] || ZONES.nord;

    var service = serviceDe(donnees);
    var valore = Math.max(0, parseFloat(donnees.valore) || 0);

    var kg5 = Math.min(poids, 5);
    var reste = Math.max(0, poids - 5);
    var trasporto = kg5 * service.data.fino5 + reste * service.data.oltre5;

    var sottoTotale = service.data.base + trasporto;

    var sovrapprezzoDim = (longueur + largeur + hauteur) > 100 ? SURCHARGE_DIMENSIONS : 0;
    sottoTotale += sovrapprezzoDim;

    var maggiorazioneZona = sottoTotale * (zone.coeff - 1);
    var sottoTotale2 = sottoTotale + maggiorazioneZona;

    var maggiorazioneExpress = service.data.coeffExpress
      ? sottoTotale2 * (service.data.coeffExpress - 1) : 0;
    var sottoTotale3 = sottoTotale2 + maggiorazioneExpress;

    var assicurazione = valore > 0 ? valore * TAUX_ASSURANCE : 0;
    var totale = sottoTotale3 + assicurazione;

    return {
      zonaKey: zoneCle,
      zoneLabel: zone.label,
      coeffZone: zone.coeff,
      servizioKey: service.key,
      servizioLabel: service.data.label,
      peso: poids,
      rigaBase: service.data.base,
      rigaTrasporto: trasporto,
      sovrapprezzoDim: sovrapprezzoDim,
      maggiorazioneZona: maggiorazioneZona,
      maggiorazioneExpress: maggiorazioneExpress,
      assicurazione: assicurazione,
      totale: totale
    };
  }

  function formatta(v) {
    return v.toFixed(2).replace(".", ",") + " \u20AC";
  }

  window.PV_Prezzi = {
    ZONES: ZONES,
    SERVIZI: SERVIZI,
    zonaDaCAP: zonaDaCAP,
    calcola: calcola,
    formatta: formatta
  };
})();
