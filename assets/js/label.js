/* ============================================================
   PaccoVeloce — Étiquette d'expédition imprimable (PV_Etichetta)

   Génère une étiquette A4 professionnelle (format classique des
   étiquettes de colis) : expéditeur, destinataire, code-barres
   Code 128 de l'UPU S10, service, poids, date.

   Le code-barres est encodé localement (aucune dépendance) :
   Code 128, jeu B, somme de contrôle mod 103, caractère stop.

   Utilisation :
     window.PV_Etichetta.mostra(sped)
   où sped est une expédition du registre PV_Spedizioni.
   ============================================================ */

(function () {
  "use strict";

  /* Table des motifs Code 128 (largeurs barre/espace, 6 éléments
     par symbole, 11 modules). L'indice = valeur du symbole.
     Le motif 2331112 (7 éléments, 13 modules) est le caractère stop. */
  var MOTIFS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
  ];
  /* 103 = Start A · 104 = Start B · 105 = Start C · 106 = Stop */

  function encoderCode128(texte) {
    var valeurs = [];
    var start = 104; /* Code B : ASCII 32–126 */
    var check = start;
    valeurs.push(start);
    for (var i = 0; i < texte.length; i++) {
      var code = texte.charCodeAt(i);
      if (code < 32 || code > 126) return null;
      var v = code - 32;
      valeurs.push(v);
      check += v * (i + 1);
    }
    valeurs.push(check % 103);
    valeurs.push(106); /* stop */
    return valeurs;
  }

  function dessinerBarres(canvas, texte) {
    var valeurs = encoderCode128(texte);
    if (!valeurs) return false;
    var ctx = canvas.getContext("2d");
    var ZONE_QUIETE = 10; /* modules */

    var totalModules = 0;
    valeurs.forEach(function (v) {
      var pat = v === 106 ? MOTIFS[106] : MOTIFS[v];
      totalModules += pat.split("").reduce(function (s, n) { return s + parseInt(n, 10); }, 0);
    });
    totalModules += ZONE_QUIETE * 2;

    var echelle = Math.floor((canvas.width * 0.96) / totalModules);
    if (echelle < 1) echelle = 1;
    var largeurReelle = totalModules * echelle;
    var x0 = Math.floor((canvas.width - largeurReelle) / 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111111";

    var x = x0 + ZONE_QUIETE * echelle;
    valeurs.forEach(function (v) {
      var pat = v === 106 ? MOTIFS[106] : MOTIFS[v];
      var largeurs = pat.split("").map(Number);
      for (var i = 0; i < largeurs.length; i++) {
        if (i % 2 === 0) { /* barre */
          ctx.fillRect(x, 0, largeurs[i] * echelle, canvas.height);
        }
        x += largeurs[i] * echelle;
      }
    });
    return true;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function indirizzo(p) {
    return esc(p.indirizzo + ", " + p.cap + " " + p.citta + " (" + p.provincia + ")");
  }

  var SERVIZI = {
    express: "Express (24–48 h)",
    standard: "Standard (2–4 giorni)",
    economico: "Economico (3–6 giorni)"
  };

  function dataBreve(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function htmlEtichetta(sped) {
    return (
      '<div class="etichetta">' +
      '  <div class="et-testata">' +
      '    <div class="et-marchio">' +
      '      <svg width="38" height="38" viewBox="0 0 32 32" aria-hidden="true">' +
      '        <rect x="4" y="4" width="24" height="24" rx="5" fill="#0f2a3f"/>' +
      '        <path d="M18 10 L26 14 L10 18 L18 22 Z" fill="#ff6b1a"/>' +
      "      </svg>" +
      '      <div><strong>PaccoVeloce</strong><small>Spedizioni in Italia</small></div>' +
      "    </div>" +
      '    <div class="et-tipo">ETICHETTA DI SPEDIZIONE<br><strong>' + esc(SERVIZI[sped.servizio] || sped.servizio) + "</strong></div>" +
      "  </div>" +
      '  <div class="et-corpo">' +
      '    <div class="et-parte et-parte--mittente">' +
      "      <h4>Da / Mittente</h4>" +
      '      <div class="et-nome">' + esc(sped.mittente.nome) + "</div>" +
      '      <div>' + indirizzo(sped.mittente) + "</div>" +
      '      <div class="et-tel">\uD83D\uDCDE ' + esc(sped.mittente.telefono || "") + "</div>" +
      "    </div>" +
      '    <div class="et-parte et-parte--destinatario">' +
      "      <h4>A / Destinatario</h4>" +
      '      <div class="et-nome">' + esc(sped.destinatario.nome) + "</div>" +
      '      <div class="et-via">' + indirizzo(sped.destinatario) + "</div>" +
      '      <div class="et-tel">\uD83D\uDCDE ' + esc(sped.destinatario.telefono || "") + "</div>" +
      "    </div>" +
      "  </div>" +
      '  <div class="et-barcode">' +
      '    <canvas width="580" height="120" aria-label="Codice a barre ' + esc(sped.numero) + '"></canvas>' +
      '    <div class="et-numero">' + esc(sped.numero) + "</div>" +
      "  </div>" +
      '  <div class="et-piedi">' +
      '    <span>Peso: <strong>' + esc(sped.peso) + " kg</strong></span>" +
      '    <span>Registrata: <strong>' + dataBreve(sped.creatoIl) + "</strong></span>" +
      '    <span>Riferimento: <strong>' + esc(sped.numero) + "</strong></span>" +
      "  </div>" +
      "</div>"
    );
  }

  function zonaStampabile() {
    var pa = document.getElementById("pv-print-area");
    if (!pa) {
      pa = document.createElement("div");
      pa.id = "pv-print-area";
      document.body.appendChild(pa);
    }
    return pa;
  }

  function stampa(etichettaHtml) {
    var pa = zonaStampabile();
    pa.innerHTML = etichettaHtml;
    /* Laisse le temps au navigateur de poser l'étiquette avant print */
    window.setTimeout(function () {
      window.print();
      window.setTimeout(function () { pa.innerHTML = ""; }, 800);
    }, 60);
  }

  window.PV_Etichetta = {

    /* Affiche l'étiquette dans une fenêtre modale avec boutons
       « Stampa etichetta » et « Chiudi ». */
    mostra: function (sped) {
      var precedente = document.getElementById("pv-etichetta-root");
      if (precedente) precedente.remove();

      var root = document.createElement("div");
      root.id = "pv-etichetta-root";
      root.className = "et-modal";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "Etichetta di spedizione " + (sped.numero || ""));

      var html = htmlEtichetta(sped);
      root.innerHTML =
        '<div class="et-finestra">' +
        '  <div class="et-bar">' +
        "    <span>\uD83D\uDCC4 Etichetta di spedizione</span>" +
        '    <button type="button" class="et-x js-et-chiudi" aria-label="Chiudi">\u2715</button>' +
        "  </div>" +
        html +
        '  <div class="et-azioni">' +
        '    <button type="button" class="btn js-et-stampa">\uD83D\uDDA8\uFE0F Stampa etichetta</button>' +
        '    <button type="button" class="btn btn--ghost js-et-chiudi">Chiudi</button>' +
        "  </div>" +
        '  <p class="et-consiglio">Suggerimento: seleziona formato A4 e attiva \u201CAdatta alla pagina\u201D nelle impostazioni di stampa.</p>' +
        "</div>";

      document.body.appendChild(root);

      var canvas = root.querySelector("canvas");
      if (canvas && sped.numero) {
        var ok = dessinerBarres(canvas, sped.numero);
        if (!ok) {
          canvas.parentNode.removeChild(canvas);
        }
      }

      var fermer = function () { root.remove(); };
      root.querySelectorAll(".js-et-chiudi").forEach(function (b) {
        b.addEventListener("click", fermer);
      });
      var btnStampa = root.querySelector(".js-et-stampa");
      if (btnStampa) {
        btnStampa.addEventListener("click", function () {
          stampa(htmlEtichetta(sped));
        });
      }
      root.addEventListener("click", function (e) {
        if (e.target === root) fermer();
      });
      try { root.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
    },

    /* Pour tests : dessine le code-barres sur un canvas donné. */
    dessineBarres: dessinerBarres,

    /* Pour tests : valeurs Code 128 d'une chaîne. */
    _encoder: encoderCode128
  };
})();
