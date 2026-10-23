/* ============================================================
   PaccoVeloce — Génération professionnelle des numéros de
   consignation + registre local des expéditions.

   FORMAT : PV + 8 chiffres de données + 1 chiffre de contrôle + IT
   - Les 3 premiers chiffres = jour de l'année (001–366)
   - Les 5 suivants = séquence aléatoire (crypto si disponible)
   - Le chiffre de contrôle suit l'algorithme S10 (norme UPU,
     utilisée par les opérateurs postaux) :
       poids 8,6,4,2,3,5,9,7 → somme → 11 − (somme mod 11),
       10 → 0, 11 → 5.

   STOCKAGE : localStorage (démo sans backend). En production,
   remplacer par un appel API POST /api/spedizioni — la structure
   du record est déjà prévue pour ça (voir README).
   ============================================================ */

(function () {
  "use strict";

  var CLE_STOCKAGE = "pv_spedizioni_v1";
  var RE_NUMERO = /^PV(\d{8})(\d)(IT)?$/;

  /* ---------- Chiffre de contrôle S10 (norme UPU) ---------- */

  function chiffreControle(donnees8) {
    var poids = [8, 6, 4, 2, 3, 5, 9, 7];
    var somme = 0;
    for (var i = 0; i < 8; i++) {
      somme += parseInt(donnees8.charAt(i), 10) * poids[i];
    }
    var reste = somme % 11;
    var check = 11 - reste;
    if (check === 10) return "0";
    if (check === 11) return "5";
    return String(check);
  }

  /* ---------- Aléatoire cryptographique (avec repli) ---------- */

  function chiffresAleatoires(n) {
    var sortie = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(n);
      window.crypto.getRandomValues(buf);
      for (var i = 0; i < n; i++) sortie += String(buf[i] % 10);
    } else {
      for (var j = 0; j < n; j++) sortie += String(Math.floor(Math.random() * 10));
    }
    return sortie;
  }

  /* ---------- Numéro : PV + JJJ + 5 aléatoires + check + IT ---------- */

  function jourAnnee(d) {
    var debut = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - debut) / 86400000);
  }

  function construireNumero() {
    var jjj = String(jourAnnee(new Date())).padStart(3, "0");
    var donnees = jjj + chiffresAleatoires(5);
    return "PV" + donnees + chiffreControle(donnees) + "IT";
  }

  /* ---------- Registre local ---------- */

  function charger() {
    try {
      var brut = localStorage.getItem(CLE_STOCKAGE);
      var liste = brut ? JSON.parse(brut) : [];
      return Array.isArray(liste) ? liste : [];
    } catch (e) {
      return [];
    }
  }

  function enregistrer(liste) {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(liste));
      return true;
    } catch (e) {
      return false;
    }
  }

  function normaliser(texte) {
    var t = String(texte || "").trim().toUpperCase();
    if (!t) return null;
    if (!/^PV/.test(t)) t = "PV" + t;
    if (!/IT$/.test(t)) t = t + "IT";
    return t;
  }

  /* API publique : window.PV_Spedizioni */

  window.PV_Spedizioni = {

    /* Vérifie format + chiffre de contrôle. Retourne {ok, numero, motivo} */
    validaNumero: function (texte) {
      var t = String(texte || "").trim().toUpperCase();
      var m = t.match(/^PV(\d{6,12})(IT)?$/);
      if (!m) return { ok: false, motivo: "formato" };
      var complet = m[0];
      var m9 = complet.match(RE_NUMERO);
      if (m9 && m9[1].length === 8) {
        var attendu = chiffreControle(m9[1]);
        if (attendu !== m9[2]) {
          return { ok: false, motivo: "checkdigit", numero: complet,
                   attendu: "PV" + m9[1] + attendu + "IT" };
        }
      }
      return { ok: true, numero: complet };
    },

    /* Crée l'expédition, génère un numéro unique et l'enregistre. */
    crea: function (record) {
      var liste = charger();
      var numero;
      var essais = 0;
      do {
        numero = construireNumero();
        essais++;
      } while (liste.some(function (s) { return s.numero === numero; }) && essais < 50);

      var sped = Object.assign({}, record, {
        numero: numero,
        creatoIl: new Date().toISOString(),
        versione: 1
      });

      liste.unshift(sped);
      if (!enregistrer(liste)) {
        /* Stockage indisponible : l'expédition reste valable pour la session */
        sped._nonSalvato = true;
      }
      return sped;
    },

    /* Génère un numéro S10 unique et construit l'expédition SANS
       enregistrer quoi que ce soit sur le site : la réservation est
       envoyée par e-mail à l'agence (voir form.js). L'unicité est
       vérifiée par rapport aux anciennes entrées locales restantes. */
    genera: function (record) {
      var liste = charger();
      var numero;
      var essais = 0;
      do {
        numero = construireNumero();
        essais++;
      } while (liste.some(function (s) { return s.numero === numero; }) && essais < 50);

      return Object.assign({}, record, {
        numero: numero,
        creatoIl: new Date().toISOString(),
        versione: 1
      });
    },

    /* Retrouve une expédition par numéro (tolérant sur le suffixe IT). */
    trova: function (texte) {
      var t = normaliser(texte);
      if (!t) return null;
      var liste = charger();
      for (var i = 0; i < liste.length; i++) {
        if (liste[i].numero === t) return liste[i];
      }
      return null;
    },

    /* Toutes les expéditions (la plus récente d'abord). */
    elenco: function () {
      return charger();
    },

    /* Statut courant déduit de l'âge de l'expédition et de la durée
       du service (mêmes seuils que la page de tracking). */
    stato: function (sped) {
      var durate = { express: 24, standard: 72, economico: 120 };
      var soglie = [0, 0.08, 0.35, 0.6, 0.88, 1.0];
      var nomi = ["Registrato", "Ritirato", "In smistamento", "In transito", "In consegna", "Consegnato"];
      var pill = ["status-pill--ok", "status-pill--ok", "status-pill--ok", "status-pill--ok", "status-pill--warn", "status-pill--ok"];
      var t0 = new Date((sped && sped.creatoIl) || Date.now()).getTime();
      var durataH = durate[sped && sped.servizio] || 72;
      var f = Math.max(0, Math.min(1, (Date.now() - t0) / (durataH * 3600 * 1000)));
      var idx = 0;
      for (var i = 0; i < soglie.length; i++) {
        if (f >= soglie[i]) idx = i;
      }
      return { indice: idx, label: nomi[idx], pill: pill[idx], avanzamento: Math.round(f * 100) };
    },

    /* Supprime une expédition du registre local (retourne true si
       elle existait). */
    rimuovi: function (texte) {
      var t = normaliser(texte);
      if (!t) return false;
      var liste = charger();
      var avant = liste.length;
      liste = liste.filter(function (s) { return s.numero !== t; });
      if (liste.length === avant) return false;
      enregistrer(liste);
      return true;
    },

    /* Pour tests : chiffre de contrôle d'une série de 8 chiffres. */
    _chiffreControle: chiffreControle
  };
})();