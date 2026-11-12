/* ============================================================
   PaccoVeloce — Validation des formulaires, navigation mobile
   et confirmation de réservation avec numéro S10 généré.
   ============================================================ */

(function () {
  "use strict";

  /* --- Menu burger (telephone + tablette) ---
     Chaque en-tête est branché séparément : nécessaire pour le
     fichier unique où les 6 pages coexistent dans le DOM. */
  var menus = [];
  Array.prototype.forEach.call(document.querySelectorAll(".nav-toggle"), function (tg) {
    var racine = tg.closest(".navbar") || document;
    var lk = racine.querySelector(".nav-links");
    if (!lk) return;
    menus.push({ toggle: tg, links: lk });
    tg.addEventListener("click", function (e) {
      e.stopPropagation();
      var ouvert = lk.classList.toggle("open");
      tg.classList.toggle("active", ouvert);
      tg.setAttribute("aria-expanded", ouvert ? "true" : "false");
      tg.setAttribute("aria-label", ouvert ? "Chiudi menu" : "Apri menu");
    });
    Array.prototype.forEach.call(lk.querySelectorAll("a"), function (a) {
      a.addEventListener("click", function () {
        lk.classList.remove("open");
        tg.classList.remove("active");
        tg.setAttribute("aria-expanded", "false");
        tg.setAttribute("aria-label", "Apri menu");
      });
    });
  });
  function fermerTousMenus() {
    menus.forEach(function (m) {
      m.links.classList.remove("open");
      m.toggle.classList.remove("active");
      m.toggle.setAttribute("aria-expanded", "false");
      m.toggle.setAttribute("aria-label", "Apri menu");
    });
  }
  document.addEventListener("click", function (e) {
    var ouvert = menus.filter(function (m) { return m.links.classList.contains("open"); });
    if (!ouvert.length) return;
    var dansMenu = ouvert.some(function (m) {
      return m.links.contains(e.target) || m.toggle.contains(e.target);
    });
    if (!dansMenu) fermerTousMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.key === "Esc") fermerTousMenus();
  });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 880) fermerTousMenus();
  });

  /* --- Validation générique --- */
  function marquer(el, valide) {
    var groupe = el.closest ? el.closest(".form-group") : null;
    if (!groupe) return;
    if (valide) {
      el.classList.remove("invalid");
      groupe.classList.remove("invalid");
    } else {
      el.classList.add("invalid");
      groupe.classList.add("invalid");
    }
  }

  function validerChamp(el) {
    var valeur = el.value.trim();
    var ok = true;
    if (el.hasAttribute("required") && valeur === "") ok = false;
    if (el.type === "email" && valeur !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur)) ok = false;
    if (el.type === "tel" && valeur !== "" && valeur.replace(/[\s()\-+]/g, "").length < 8) ok = false;
    if (el.hasAttribute("min") && el.type === "number") {
      if (valeur !== "" && parseFloat(valeur) < parseFloat(el.getAttribute("min"))) ok = false;
    }
    if (el.getAttribute("data-regex") && valeur !== "") {
      var r = new RegExp(el.getAttribute("data-regex"));
      if (!r.test(valeur)) ok = false;
    }
    marquer(el, ok);
    return ok;
  }

  function validerFormulaire(form) {
    var toutOk = true;
    Array.prototype.slice.call(form.querySelectorAll("input, select, textarea")).forEach(function (el) {
      if (!validerChamp(el)) toutOk = false;
    });
    return toutOk;
  }

  function lireValeur(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  var LIBELLE_SERVICES = {
    standard: "Standard (2–4 giorni)",
    express: "Express (24–48 h)",
    economico: "Economico (3–6 giorni)"
  };
  var LIBELLE_FASCE = {
    "9_12": "9:00 – 12:00",
    "12_15": "12:00 – 15:00",
    "15_18": "15:00 – 18:00"
  };

  /* --- Confirmation après réservation : envoi à l'agence par e-mail --- */

  var EMAIL_AGENZIA = "velocepacco653@gmail.com";

  /* Coût estimé d'une expédition (modèle PV_Prezzi, zone = CAP du destinataire) */
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

  /* Envoie la réservation (numéro généré inclus) vers la boîte Gmail
     de l'agence via FormSubmit — service e-mail pour sites statiques,
     sans backend. Appelle callback(true/false). */
  function inviaAdAgenzia(sped, callback) {
    var costo = costoStimato(sped);
    var messaggio = {
      _subject: "Nuova prenotazione " + sped.numero + " \u2014 PaccoVeloce",
      _template: "table",
      _captcha: "false",
      "Numero di consignazione": sped.numero,
      "Mittente": sped.mittente.nome,
      "Telefono mittente": sped.mittente.telefono,
      "E-mail mittente": sped.email || "\u2014",
      "Indirizzo di ritiro": sped.mittente.indirizzo + ", " + sped.mittente.cap + " " + sped.mittente.citta + " (" + sped.mittente.provincia + ")",
      "Destinatario": sped.destinatario.nome,
      "Telefono destinatario": sped.destinatario.telefono,
      "Indirizzo di consegna": sped.destinatario.indirizzo + ", " + sped.destinatario.cap + " " + sped.destinatario.citta + " (" + sped.destinatario.provincia + ")",
      "Servizio": LIBELLE_SERVICES[sped.servizio] || sped.servizio,
      "Peso": sped.peso + " kg",
      "Fascia oraria di ritiro": LIBELLE_FASCE[sped.fascia] || sped.fascia,
      "Costo stimato": costo ? window.PV_Prezzi.formatta(costo.totale) + " (" + costo.zoneLabel + ")" : "\u2014",
      "Note": sped.note || "\u2014",
      "Creato il": sped.creatoIl
    };
    if (typeof fetch !== "function") { callback(false); return; }

    /* Garde-fou : FormSubmit peut ne jamais répondre (réseau bloqué,
       opérateur, service lent). Sans délai maximum, l'utilisateur
       restait bloqué sur « Invio in corso… » et ne voyait JAMAIS son
       numéro. On plafonne donc l'attente et on rend la main. */
    var finito = false;
    var minuteur = null;
    function concludi(ok, motivo) {
      if (finito) return;
      finito = true;
      if (minuteur) clearTimeout(minuteur);
      callback(ok, motivo || "");
    }

    var ctrl = (typeof AbortController === "function") ? new AbortController() : null;
    minuteur = setTimeout(function () {
      if (ctrl) { try { ctrl.abort(); } catch (eAbort) {} }
      concludi(false, "timeout");
    }, 12000);

    fetch("https://formsubmit.co/ajax/" + EMAIL_AGENZIA, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messaggio),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (risposta) { return risposta.json(); })
      .then(function (dati) {
        var ok = !!dati && (dati.success === "true" || dati.success === true);
        concludi(ok, ok ? "" : ((dati && dati.message) || ""));
      })
      .catch(function () { concludi(false, "network"); });
  }

  /* Repli : lien e-mail prérempli si l'envoi automatique échoue. */
  function linkMailto(sped) {
    var costo = costoStimato(sped);
    var testo =
      "Nuova prenotazione PaccoVeloce\n\n" +
      "Numero di consignazione: " + sped.numero + "\n" +
      "Mittente: " + sped.mittente.nome + " \u2014 " + sped.mittente.telefono + " \u2014 " +
      sped.mittente.indirizzo + ", " + sped.mittente.cap + " " + sped.mittente.citta +
      " (" + sped.mittente.provincia + ")\n" +
      "E-mail mittente: " + (sped.email || "\u2014") + "\n" +
      "Destinatario: " + sped.destinatario.nome + " \u2014 " + sped.destinatario.telefono + " \u2014 " +
      sped.destinatario.indirizzo + ", " + sped.destinatario.cap + " " + sped.destinatario.citta +
      " (" + sped.destinatario.provincia + ")\n" +
      "Servizio: " + (LIBELLE_SERVICES[sped.servizio] || sped.servizio) + "\n" +
      "Peso: " + sped.peso + " kg\n" +
      "Ritiro: " + (LIBELLE_FASCE[sped.fascia] || sped.fascia) + "\n" +
      (costo ? "Costo stimato: " + window.PV_Prezzi.formatta(costo.totale) + " (" + costo.zoneLabel + ")\n" : "") +
      (sped.note ? "Note: " + sped.note + "\n" : "") +
      "Creato il: " + sped.creatoIl;
    return "mailto:" + EMAIL_AGENZIA +
      "?subject=" + encodeURIComponent("Nuova prenotazione " + sped.numero + " \u2014 PaccoVeloce") +
      "&body=" + encodeURIComponent(testo);
  }

  function lineaRiepilogo(a, b) {
    return "<div class='bc-ligne'><span>" + a + "</span><strong>" + b + "</strong></div>";
  }

  function riepilogoHtml(sped) {
    var costo = costoStimato(sped);
    return "<div class='bc-summary'>" +
      lineaRiepilogo("Mittente", sped.mittente.nome + " \u2014 " + sped.mittente.indirizzo + ", " + sped.mittente.cap + " " + sped.mittente.citta + " (" + sped.mittente.provincia + ")") +
      lineaRiepilogo("Destinatario", sped.destinatario.nome + " \u2014 " + sped.destinatario.indirizzo + ", " + sped.destinatario.cap + " " + sped.destinatario.citta + " (" + sped.destinatario.provincia + ")") +
      lineaRiepilogo("Servizio", LIBELLE_SERVICES[sped.servizio] || sped.servizio) +
      lineaRiepilogo("Peso dichiarato", sped.peso + " kg") +
      lineaRiepilogo("Ritiro", (LIBELLE_FASCE[sped.fascia] || sped.fascia)) +
      (costo ? lineaRiepilogo("Costo stimato", window.PV_Prezzi.formatta(costo.totale) + " (" + costo.zoneLabel + ")") : "") +
      (sped.note ? lineaRiepilogo("Note", sped.note) : "") +
      "</div>";
  }

  /* Branche le bouton « Scarica la ricevuta (PDF) » d'un panneau de confirmation. */
  function collegaPulsantePdf(conteneur, sped) {
    var btn = conteneur.querySelector(".bc-pdf");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (window.PV_Ricevuta && typeof window.PV_Ricevuta.scarica === "function") {
        window.PV_Ricevuta.scarica(sped);
      } else {
        window.alert("Ricevuta non disponibile: ricarica la pagina e riprova.");
      }
    });
  }

  /* ---------- Partage : lien de suivi autonome ----------
     Le lien contient les données non nominatives du colis : il
     fonctionne sur n'importe quel téléphone, même si le registre
     en ligne est indisponible. C'est la garantie côté client. */

  function soloCifre(tel) {
    var d = String(tel || "").replace(/[^0-9]/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    return d;
  }

  function bloccoCondivisione(sped) {
    var lien = (window.PV_API && window.PV_API.lienSuivi) ? window.PV_API.lienSuivi(sped) : "";
    if (!lien) return "";

    var tel = soloCifre(sped.destinatario && sped.destinatario.telefono) || "393508707243";
    var msg = "PaccoVeloce — spedizione " + sped.numero +
      ". Segui il tuo pacco da qualsiasi telefono: " + lien;
    var wa = "https://wa.me/" + tel + "?text=" + encodeURIComponent(msg);

    return "<div class='bc-share'>" +
      "  <div class='bc-share-title'>\uD83D\uDD17 Link di tracciamento (funziona su qualsiasi telefono, senza registro online)</div>" +
      "  <input class='bc-share-url' type='text' readonly value='" + lien.replace(/'/g, "&#39;") + "'>" +
      "  <div class='bc-actions'>" +
      "    <button type='button' class='btn bc-copia'>\uD83D\uDCCB Copia il link</button>" +
      "    <a class='btn btn--ghost' href='" + wa + "' target='_blank' rel='noopener'>\uD83D\uDCAC Invia al destinatario</a>" +
      "  </div>" +
      "</div>";
  }

  function collegaCondivisione(conteneur) {
    var btn = conteneur.querySelector(".bc-copia");
    var champ = conteneur.querySelector(".bc-share-url");
    if (!btn || !champ) return;

    btn.addEventListener("click", function () {
      var festeggia = function () {
        btn.textContent = "\u2705 Link copiato";
        setTimeout(function () { btn.textContent = "\uD83D\uDCCB Copia il link"; }, 2200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(champ.value).then(festeggia).catch(function () {
          try { champ.select(); document.execCommand("copy"); festeggia(); } catch (e) {}
        });
      } else {
        try { champ.select(); document.execCommand("copy"); festeggia(); } catch (e) {}
      }
    });
  }

  function afficherInvio(conteneur) {
    conteneur.innerHTML =
      "<div class='booking-confirm'>" +
      "  <div class='bc-head'>\u23F3 Invio in corso\u2026</div>" +
      "  <p>Stiamo generando il tuo numero di consignazione e inviando la prenotazione all'agenzia. Attendi qualche istante.</p>" +
      "</div>";
  }

  /* Pubblica la spedizione nel registro condiviso (API) così che il
     numero sia consultabile da qualsiasi dispositivo. Aggiorna poi il
     messaggio con l'esito reale (verificato con una rilettura). */
  function pubblicaOnline(conteneur, sped, amministrazione) {
    var riga = conteneur.querySelector("[data-online]");
    if (!riga) return;

    if (!window.PV_API || !window.PV_API.attivo()) {
      riga.innerHTML = "\u26A0\uFE0F <strong>Registro condiviso non disponibile</strong> — " +
        "questo numero resta visibile solo su questo dispositivo. Riprova pi\u00F9 tardi.";
      return;
    }

    riga.innerHTML = "\uD83C\uDF10 Pubblicazione nel registro condiviso in corso\u2026";

    window.PV_API.salvaEVerifica(sped).then(function (ok) {
      /* Il conteneur a pu être réaffiché : on relit la ligne courante */
      var cible = conteneur.querySelector("[data-online]");
      if (!cible) return;
      if (ok === "ok") {
        cible.innerHTML = "\uD83C\uDF10 <strong>Online (verificato)</strong> — chiunque pu\u00F2 cercare questo numero " +
          "da qualsiasi telefono o PC.";
      } else if (ok === "unverified") {
        cible.innerHTML = "\uD83C\uDF10 <strong>Pubblicato</strong> — il numero \u00E8 stato inviato al registro " +
          "online; la rilettura di controllo non ha risposto (rete o cache). In caso di dubbio usa il link qui sotto.";
      } else {
        cible.innerHTML = "\u26A0\uFE0F <strong>Registro online non raggiungibile</strong> da questo dispositivo. " +
          "Il numero funziona comunque: usa il <strong>link di tracciamento</strong> qui sotto, che non dipende da nessun servizio esterno. " +
          "Puoi anche riprovare con \u00AB Ripubblica registro online \u00BB nell'Area riservata.";
      }
    });
  }

  function afficherConfermaInvio(conteneur, sped, amministrazione) {
    var head = amministrazione ? "\u2705 Spedizione registrata" : "\u2705 Prenotazione confermata";
    var intro = amministrazione
      ? "Numero di consignazione <strong>generato e registrato</strong>. Riepilogo inviato all'agenzia (" + EMAIL_AGENZIA + ")."
      : "Il tuo numero di consignazione \u00E8 stato <strong>inviato all'agenzia</strong> (" + EMAIL_AGENZIA + "). Ti contatteremo su WhatsApp per confermare il ritiro.";
    conteneur.innerHTML =
      "<div class='booking-confirm'>" +
      "  <div class='bc-head'>" + head + "</div>" +
      "  <p>" + intro + "</p>" +
      "  <div class='bc-number'>" +
      "    <span class='bc-code'>" + sped.numero + "</span>" +
      "  </div>" +
      riepilogoHtml(sped) +
      (amministrazione
        ? "  <p class='bc-note'>Conserva questo numero: \u00E8 gi\u00E0 attivo e tracciabile da qualsiasi telefono o PC.</p>"
        : "  <p class='bc-note'>Conserva questo numero: sar\u00E0 attivo nel tracciamento appena l'agenzia registra la spedizione (di solito entro poche ore).</p>") +
      (amministrazione ? "  <p class='bc-note bc-online' data-online></p>" : "") +
      (amministrazione ? "  <p class='bc-note bc-email' data-email>\uD83D\uDCE7 Invio del riepilogo all'agenzia in corso\u2026</p>" : "") +
      (amministrazione ? bloccoCondivisione(sped) : "") +
      "  <button type='button' class='btn bc-pdf' style='margin-top:16px;'>\u2B07\uFE0F Scarica la ricevuta (PDF)</button>" +
      "</div>";
    collegaPulsantePdf(conteneur, sped);
    if (amministrazione) collegaCondivisione(conteneur);

    if (amministrazione) pubblicaOnline(conteneur, sped, amministrazione);
  }

  function afficherErroreInvio(conteneur, sped, messaggioServeur) {
    var msg = String(messaggioServeur || "");
    var noteAttivazione = "";
    if (/activation/i.test(msg)) {
      noteAttivazione =
        "  <p class='bc-note'>\uD83D\uDCE2 <strong>Attivazione richiesta (una sola volta):</strong> apri la casella <strong>" + EMAIL_AGENZIA + "</strong>, cerca l'e-mail di FormSubmit e clicca « Activate Form ». In alternativa, premi Invia nella tua e-mail qui sotto.</p>";
    }
    conteneur.innerHTML =
      "<div class='booking-confirm'>" +
      "  <div class='bc-head'>\uD83D\uDCEE Il tuo numero \u00E8 pronto \u2014 invio tramite la tua e-mail</div>" +
      "  <p>Il tuo numero di consignazione \u00E8: <strong>" + sped.numero + "</strong>. La tua applicazione e-mail si sta aprendo con il riepilogo gi\u00E0 compilato: <strong>premi Invia</strong> per mandare la prenotazione all'agenzia (" + EMAIL_AGENZIA + ").</p>" +
      riepilogoHtml(sped) +
      noteAttivazione +
      "  <p style='margin:14px 0 0;'>Se l'e-mail non si \u00E8 aperta: \u2709\uFE0F <a class='bc-mailto' href='" + linkMailto(sped) + "'>Apri la tua e-mail</a></p>" +
      "  <button type='button' class='btn bc-pdf' style='margin-top:16px;'>\u2B07\uFE0F Scarica la ricevuta (PDF)</button>" +
      "</div>";
    collegaPulsantePdf(conteneur, sped);
    /* Ouverture automatique du client e-mail avec le récapitulatif
       prérempli : l'e-mail part même si l'envoi automatique échoue. */
    setTimeout(function () {
      try { window.location.href = linkMailto(sped); } catch (eAuto) {}
    }, 1500);
  }

  /* --- Branchement des formulaires (attribut data-validate) --- */
  document.querySelectorAll("form[data-validate]").forEach(function (form) {
    ["input", "select", "textarea"].forEach(function (type) {
      form.querySelectorAll(type).forEach(function (el) {
        el.addEventListener("blur", function () {
          if (el.value.trim() !== "") validerChamp(el);
        });
        el.addEventListener("input", function () {
          if (el.classList.contains("invalid")) validerChamp(el);
        });
      });
    });

    /* Devis en direct (formulaire de réservation) : mis à jour à
       chaque saisie du poids, du service ou du CAP du destinataire. */
    if (form.dataset.generator === "shipment" && window.PV_Prezzi) {
      var majEstimation = function () { mettreAJourEstimation(form); };
      ["rs-peso", "rs-servizio", "rs-cap-dest", "rs-prov-dest"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", majEstimation);
        /* Un <select> émet « change » (et pas toujours « input ») :
           on branche les deux pour un devis toujours à jour. */
        if (el.tagName === "SELECT") el.addEventListener("change", majEstimation);
      });
      majEstimation();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      /* Anti-spam : champ piège invisible (honeypot). S'il est
         rempli, c'est un robot : on ignore silencieusement. */
      var trappola = form.querySelector(".hp-field input");
      if (trappola && trappola.value.trim() !== "") {
        form.reset();
        return;
      }

      if (!validerFormulaire(form)) return;

      /* Flux réservation : le numéro S10 est généré puis ENVOYÉ À
         L'AGENCE PAR E-MAIL (velocepacco653@gmail.com) — rien n'est
         stocké sur le site. Bouton unique « Conferma la prenotazione ». */
      if (form.dataset.generator === "shipment" && window.PV_Spedizioni) {
        /* data-store="1" (Area riservata agenzia) : il numero viene
           anche REGISTRATO nell'elenco locale per il tracking reale.
           Formulario pubblico: nessun dato salvato sul sito. */
        var amministrazione = !!form.dataset.store;
        var sped = window.PV_Spedizioni[amministrazione ? "crea" : "genera"]({
          mittente: {
            nome: lireValeur("rs-nome"),
            telefono: lireValeur("rs-tel"),
            indirizzo: lireValeur("rs-via"),
            citta: lireValeur("rs-citta"),
            cap: lireValeur("rs-cap"),
            provincia: lireValeur("rs-prov").toUpperCase()
          },
          email: lireValeur("rs-email"),
          destinatario: {
            nome: lireValeur("rs-nome-dest"),
            telefono: lireValeur("rs-tel-dest"),
            indirizzo: lireValeur("rs-via-dest"),
            citta: lireValeur("rs-citta-dest"),
            cap: lireValeur("rs-cap-dest"),
            provincia: lireValeur("rs-prov-dest").toUpperCase()
          },
          peso: lireValeur("rs-peso"),
          servizio: lireValeur("rs-servizio"),
          fascia: lireValeur("rs-fascia"),
          note: lireValeur("rs-note")
        });

        var cible = document.getElementById(form.dataset.result || "reservation-result");
        form.style.display = "none";
        if (cible) {
          cible.classList.add("show");
          if (amministrazione) {
            /* Area riservata : il numero e il link di tracciamento sono
               l'informazione utile, quindi compaiono SUBITO. L'e-mail
               all'agenzia parte in secondo piano e il suo esito viene
               scritto nella riga dedicata: nessuna attesa bloccante. */
            afficherConfermaInvio(cible, sped, true);
            try { cible.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (eInvio) {}
            inviaAdAgenzia(sped, function (inviato) {
              var riga = cible.querySelector("[data-email]");
              if (!riga) return;
              riga.innerHTML = inviato
                ? "\uD83D\uDCE7 Riepilogo inviato all'agenzia (" + EMAIL_AGENZIA + ")."
                : "\u26A0\uFE0F Riepilogo non inviato via e-mail (rete o servizio lento). Il numero e il link qui sopra sono comunque validi.";
            });
          } else {
            afficherInvio(cible);
            try { cible.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (eInvio2) {}
            inviaAdAgenzia(sped, function (inviato, messaggioServeur) {
              if (inviato) afficherConfermaInvio(cible, sped, amministrazione);
              else afficherErroreInvio(cible, sped, messaggioServeur);
            });
          }
        }
        return;
      }

      /* Flux générique (contact…) : référence simple */
      var ref = genererReference();
      var idResult = form.getAttribute("data-result");
      var alerte = idResult ? document.getElementById(idResult) : null;
      if (alerte) {
        var refEl = alerte.querySelector(".ref");
        if (refEl) refEl.textContent = ref;
        alerte.classList.remove("alert--error");
        alerte.classList.add("alert--success");
        alerte.classList.add("show");
        try { alerte.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e2) {}
      }
      form.reset();
      form.setAttribute("data-sent", "1");
    });
  });

  /* Panneau « Preventivo stimato » du formulaire de réservation */
  function mettreAJourEstimation(form) {
    var cont = document.getElementById("pv-estimate");
    if (!cont || !window.PV_Prezzi) return;
    var peso = lireValeur("rs-peso");
    var capDest = lireValeur("rs-cap-dest");
    if (!peso || !capDest) {
      cont.style.display = "none";
      return;
    }
    var zona = window.PV_Prezzi.zonaDaCAP(capDest);
    if (!zona) {
      cont.style.display = "none";
      return;
    }
    var servizio = lireValeur("rs-servizio");
    var res = window.PV_Prezzi.calcola({
      poids: peso,
      zone: zona,
      servizio: servizio
    });
    var totalEl = cont.querySelector(".pv-est-total");
    var zonaEl = cont.querySelector(".pv-est-zone");
    if (totalEl) totalEl.textContent = window.PV_Prezzi.formatta(res.totale);
    if (zonaEl) zonaEl.textContent = res.zoneLabel;
    cont.style.display = "block";
  }

  function genererReference() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var j = String(d.getDate()).padStart(2, "0");
    var alea = Math.floor(1000 + Math.random() * 9000);
    return "PV-" + y + m + j + "-" + alea;
  }
})();