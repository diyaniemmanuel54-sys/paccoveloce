/* ============================================================
   PaccoVeloce — Ricevuta de réservation téléchargeable en PDF.
   Génération 100 % côté navigateur, SANS dépendance externe :
   le PDF (A4) est construit octet par octet puis téléchargé.
   Fonctionne donc même ouvert en file:// et hors ligne.
   Repli : fenêtre d'impression (« Salva come PDF »).
   ============================================================ */

(function () {
  "use strict";

  var LIBELLE_SERVICES = {
    standard: "Standard (2\u20134 giorni)",
    express: "Express (24\u201348 h)",
    economico: "Economico (3\u20136 giorni)"
  };
  var LIBELLE_FASCE = {
    "9_12": "9:00 \u2013 12:00",
    "12_15": "12:00 \u2013 15:00",
    "15_18": "15:00 \u2013 18:00"
  };

  /* --- Encodage texte : Unicode -> WinAnsi (encodage PDF standard) --- */
  var WINANSI = {
    8364: 128,   /* € */
    8218: 130, 402: 131, 8222: 132, 8230: 133, 8224: 134, 8225: 135,
    710: 136, 8240: 137, 352: 138, 8249: 139, 381: 140, 8216: 145,
    8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151,
    732: 152, 8482: 153, 353: 154, 8250: 155, 382: 156, 376: 159, 160: 32
  };

  function pdfTexte(valeur) {
    var s = String(valeur == null ? "" : valeur);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "\\" || c === "(" || c === ")") { out += "\\" + c; continue; }
      var code = s.charCodeAt(i);
      if (WINANSI[code] !== undefined) out += String.fromCharCode(WINANSI[code]);
      else if (code < 256) out += c;
      else out += "?";
    }
    return out;
  }

  /* Découpe un texte trop long (valeur renvoyée à la ligne). */
  function wrap(texte, max) {
    var mots = String(texte == null ? "" : texte).split(" ");
    var lignes = [], cur = "";
    for (var i = 0; i < mots.length; i++) {
      var test = cur ? cur + " " + mots[i] : mots[i];
      if (test.length > max && cur) { lignes.push(cur); cur = mots[i]; }
      else cur = test;
    }
    if (cur) lignes.push(cur);
    return lignes.length ? lignes : [""];
  }

  function formattaData(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || "\u2014");
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
      " alle " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function indirizzoRiga(parte) {
    return parte.indirizzo + ", " + parte.cap + " " + parte.citta + " (" + parte.provincia + ")";
  }

  /* Coût estimé (même modèle que le formulaire : zone = CAP destinataire) */
  function costo(sped) {
    if (!window.PV_Prezzi || !sped || !sped.destinatario) return null;
    try {
      var zona = window.PV_Prezzi.zonaDaCAP(sped.destinatario.cap) || "nord";
      return window.PV_Prezzi.calcola({ poids: sped.peso, zone: zona, servizio: sped.servizio });
    } catch (e) {
      return null;
    }
  }

  function righeRiepilogo(sped) {
    var costo1 = costo(sped);
    var r = [];
    r.push({ l: "Data e ora", v: formattaData(sped.creatoIl) });
    r.push({ l: "Mittente", v: sped.mittente.nome + " \u2013 " + sped.mittente.telefono });
    r.push({ l: "Indirizzo di ritiro", v: indirizzoRiga(sped.mittente) });
    if (sped.email) r.push({ l: "E-mail mittente", v: sped.email });
    r.push({ l: "Destinatario", v: sped.destinatario.nome + " \u2013 " + sped.destinatario.telefono });
    r.push({ l: "Indirizzo di consegna", v: indirizzoRiga(sped.destinatario) });
    r.push({ l: "Servizio", v: LIBELLE_SERVICES[sped.servizio] || sped.servizio });
    r.push({ l: "Peso dichiarato", v: sped.peso + " kg" });
    r.push({ l: "Fascia oraria di ritiro", v: LIBELLE_FASCE[sped.fascia] || sped.fascia });
    if (costo1) r.push({ l: "Costo stimato", v: window.PV_Prezzi.formatta(costo1.totale) + " (" + costo1.zoneLabel + ")" });
    if (sped.note) r.push({ l: "Note", v: sped.note });
    return r;
  }

  /* --- Construction du flux de dessin PDF (page A4, origine en bas) --- */
  function buildContent(sped) {
    var L = [];
    var x0 = 40, xVal = 190, y = 600;

    /* Bandeau d'en-tête orange + nom de l'enseigne */
    L.push("1 0.42 0.10 rg");
    L.push("0 782 595 60 re f");
    L.push("1 1 1 rg");
    L.push("BT /F2 24 Tf 40 808 Td (PaccoVeloce) Tj ET");
    L.push("BT /F1 10 Tf 40 789 Td (Spedizioni rapide in tutta Italia) Tj ET");

    /* Titre du document */
    L.push("0.20 0.21 0.23 rg");
    L.push("BT /F2 15 Tf 40 742 Td (RICEVUTA DI PRENOTAZIONE) Tj ET");
    L.push("0.45 0.47 0.50 rg");
    L.push("BT /F1 10 Tf 40 725 Td (Documento generato automaticamente dal sito PaccoVeloce) Tj ET");

    /* Encadré du numéro de consignation (norme S10) */
    L.push("0.953 0.961 0.976 rg");
    L.push("40 645 515 64 re f");
    L.push("0.45 0.47 0.50 rg");
    L.push("BT /F1 9 Tf 58 691 Td (NUMERO DI CONSIGNAZIONE) Tj ET");
    L.push("1 0.42 0.10 rg");
    L.push("BT /F2 22 Tf 58 662 Td (" + pdfTexte(sped.numero) + ") Tj ET");

    /* Riepilogo ligne à ligne */
    function ligne(label, valeur) {
      var morceaux = wrap(valeur, 58);
      L.push("0.36 0.38 0.42 rg");
      L.push("BT /F2 10 Tf " + x0 + " " + y + " Td (" + pdfTexte(label) + ") Tj ET");
      for (var i = 0; i < morceaux.length; i++) {
        L.push("0.13 0.15 0.17 rg");
        L.push("BT /F1 11 Tf " + xVal + " " + y + " Td (" + pdfTexte(morceaux[i]) + ") Tj ET");
        if (i < morceaux.length - 1) y -= 15;
      }
      y -= 21;
    }
    var righe = righeRiepilogo(sped);
    for (var i = 0; i < righe.length; i++) ligne(righe[i].l, righe[i].v);

    /* Pied de page : contacts de l'agence */
    L.push("0.80 0.82 0.85 RG");
    L.push("1 w");
    L.push("40 130 m 555 130 l S");
    L.push("0.20 0.21 0.23 rg");
    L.push("BT /F2 11 Tf 40 104 Td (PaccoVeloce) Tj ET");
    L.push("0.36 0.38 0.42 rg");
    L.push("BT /F1 9.5 Tf 40 86 Td (WhatsApp: +39 350 870 7243 \u2022 E-mail: velocepacco653@gmail.com) Tj ET");
    L.push("BT /F1 9.5 Tf 40 70 Td (Agenzia: Via del Fontanile Arenato, 180) Tj ET");
    L.push("0.50 0.52 0.55 rg");
    L.push("BT /F1 8.5 Tf 40 52 Td (Conserva questa ricevuta: il numero di consignazione permette di tracciare la spedizione.) Tj ET");

    return L.join("\n");
  }

  /* --- Assemblage du fichier PDF (objets + table xref) --- */
  function assemble(contenu) {
    var objets = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Length " + contenu.length + " >>\nstream\n" + contenu + "\nendstream"
    ];

    var pdf = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n";
    var offsets = [];
    for (var i = 0; i < objets.length; i++) {
      offsets.push(pdf.length);
      pdf += (i + 1) + " 0 obj\n" + objets[i] + "\nendobj\n";
    }
    var xrefPos = pdf.length;
    pdf += "xref\n0 " + (objets.length + 1) + "\n";
    pdf += "0000000000 65535 f \n";
    for (var j = 0; j < offsets.length; j++) {
      pdf += ("0000000000" + offsets[j]).slice(-10) + " 00000 n \n";
    }
    pdf += "trailer\n<< /Size " + (objets.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";

    var octets = new Uint8Array(pdf.length);
    for (var k = 0; k < pdf.length; k++) octets[k] = pdf.charCodeAt(k) & 0xFF;
    return octets;
  }

  /* Version texte (repli impression) */
  function ricevutaTesto(sped) {
    var righe = righeRiepilogo(sped);
    var out = [
      "PaccoVeloce \u2014 Spedizioni rapide in tutta Italia",
      "RICEVUTA DI PRENOTAZIONE",
      "",
      "Numero di consignazione: " + sped.numero
    ];
    for (var i = 0; i < righe.length; i++) out.push(righe[i].l + ": " + righe[i].v);
    out.push("");
    out.push("PaccoVeloce \u2022 WhatsApp: +39 350 870 7243 \u2022 velocepacco653@gmail.com");
    out.push("Agenzia: Via del Fontanile Arenato, 180");
    return out.join("\n");
  }

  window.PV_Ricevuta = {
    /* Génère les octets du PDF (utilisable sans télécharger). */
    generaBytes: function (sped) {
      if (!sped || !sped.numero) throw new Error("Spedizione senza numero di consignazione");
      return assemble(buildContent(sped));
    },
    /* Télécharge ricevuta-<NUMERO>.pdf ; repli : impression. */
    scarica: function (sped) {
      var bytes;
      try {
        bytes = this.generaBytes(sped);
      } catch (eGen) {
        this.stampa(sped);
        return false;
      }
      try {
        var blob = new Blob([bytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "ricevuta-" + sped.numero + ".pdf";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          if (a.parentNode) a.parentNode.removeChild(a);
          URL.revokeObjectURL(url);
        }, 5000);
        return true;
      } catch (eDown) {
        this.stampa(sped);
        return false;
      }
    },
    /* Repli : fenêtre d'impression -> l'utilisateur choisit « PDF ». */
    stampa: function (sped) {
      var w = window.open("", "_blank", "width=720,height=900");
      if (!w) {
        window.alert("Per favore consenti i popup per scaricare la ricevuta.");
        return;
      }
      var testo = ricevutaTesto(sped)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      w.document.write(
        "<html><head><title>Ricevuta " + pdfTexte(sped.numero) + "</title></head>" +
        "<body style=\"font-family:Arial,Helvetica,sans-serif;padding:24px;\">" +
        "<pre style=\"font-size:14px;white-space:pre-wrap;\">" + testo + "</pre>" +
        "<script>window.onload=function(){window.print()}<\/script>" +
        "</body></html>"
      );
      w.document.close();
    }
  };
})();
