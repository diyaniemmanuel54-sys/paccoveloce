/* ============================================================
   PaccoVeloce — Suivi de colis

   1) Si le numéro correspond à une expédition réellement créée
      sur cet appareil (registre localStorage via shipments.js),
      les VRAIES données sont affichées : expéditeur, destinataire,
      adresses complètes, carte géolocalisée (OpenStreetMap /
      Nominatim) et distance restante calculée selon le temps
      écoulé depuis le dépôt.

   2) Sinon, mode démonstration déterministe (hash du numéro) :
      idéal pour tester avec PV12345678IT sans backend.
   ============================================================ */

(function () {
  "use strict";

  var ETAPES = [
    { id: "registrato",   titre: "Pacco registrato",      desc: "Il pacco è stato registrato e ha ricevuto un codice di spedizione." },
    { id: "ritirato",     titre: "Ritiro effettuato",     desc: "Il corriere ha ritirato il pacco presso il mittente." },
    { id: "smistamento",  titre: "Centro di smistamento", desc: "Il pacco è in elaborazione presso l'hub nazionale di Bologna." },
    { id: "transito",     titre: "In transito",           desc: "Il pacco è in viaggio verso il centro di consegna di destinazione." },
    { id: "consegna",     titre: "In consegna",           desc: "Il pacco è con il corriere: consegna prevista oggi." },
    { id: "consegnato",   titre: "Consegnato",            desc: "Il pacco è stato consegnato e firmato dal destinatario." }
  ];

  var STATUTS = {
    registrato:  { label: "Registrato",   pill: "status-pill--ok" },
    ritirato:    { label: "In transito",  pill: "status-pill--ok" },
    smistamento: { label: "In transito",  pill: "status-pill--ok" },
    transito:    { label: "In transito",  pill: "status-pill--ok" },
    consegna:    { label: "In consegna",  pill: "status-pill--warn" },
    consegnato:  { label: "Consegnato",   pill: "status-pill--ok" }
  };

  /* Durée de transit en heures selon le service */
  var DURATE = { express: 24, standard: 72, economico: 120 };
  /* Franchises des étapes sur la durée totale (0 → 1) */
  var SOGLIE = [0, 0.08, 0.35, 0.6, 0.88, 1.0];

  /* Villes de secours avec coordonnées (si géocodage indisponible) */
  var CITTA = [
    { nome: "Milano",  cap: "20100", prov: "MI", lat: 45.4642, lng:  9.1900 },
    { nome: "Roma",    cap: "00100", prov: "RM", lat: 41.9028, lng: 12.4964 },
    { nome: "Torino",  cap: "10100", prov: "TO", lat: 45.0703, lng:  7.6869 },
    { nome: "Napoli",  cap: "80100", prov: "NA", lat: 40.8518, lng: 14.2681 },
    { nome: "Bologna", cap: "40100", prov: "BO", lat: 44.4949, lng: 11.3426 },
    { nome: "Firenze", cap: "50100", prov: "FI", lat: 43.7696, lng: 11.2558 },
    { nome: "Palermo", cap: "90100", prov: "PA", lat: 38.1157, lng: 13.3615 },
    { nome: "Verona",  cap: "37100", prov: "VR", lat: 45.4384, lng: 10.9916 },
    { nome: "Genova",  cap: "16100", prov: "GE", lat: 44.4056, lng:  8.9463 },
    { nome: "Bari",    cap: "70100", prov: "BA", lat: 41.1171, lng: 16.8719 }
  ];
  var HUB = CITTA[4]; /* Hub national : Bologna */

  var VIE = ["Via Dante Alighieri", "Corso Vittorio Emanuele II", "Via Garibaldi", "Viale della Repubblica", "Via Roma", "Via Mazzini", "Corso Italia", "Via Cavour", "Via Verdi", "Viale Trieste"];
  var PREFISSI = ["333", "340", "347", "348", "349", "320", "328", "331"];
  var PRENOMI = ["Marco", "Giulia", "Luca", "Sofia", "Andrea", "Chiara", "Paolo", "Alessia", "Matteo", "Francesca"];
  var NOMI = ["Rossi", "Bianchi", "Romano", "Ferrari", "Esposito", "Colombo", "Ricci", "Marino", "Greco", "Conti"];

  /* ---------- Utilitaires ---------- */

  function hash32(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h * 33) + s.charCodeAt(i)) & 0xFFFFFFFF;
    }
    return h & 0xFFFFFFFF;
  }

  function extraireNumero(texte) {
    var m = texte.trim().toUpperCase().match(/^PV(\d{6,12})(IT)?$/);
    return m ? m[0] : null;
  }

  function formatKm(v) {
    return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function distanzaKm(a, b) {
    var R = 6371;
    function rad(x) { return x * Math.PI / 180; }
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function lerp(a, b, t) {
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function indirizzoCompleto(p) {
    return p.indirizzo + ", " + p.cap + " " + p.citta + " (" + p.provincia + ")";
  }

  /* Position du colis sur le trajet origine → hub → destination */
  function posiziona(f, origine, destinazione) {
    if (f <= 0.1) return { lat: origine.lat, lng: origine.lng };
    if (f <= 0.4) return lerp(origine, HUB, (f - 0.1) / 0.3);
    if (f < 1)    return lerp(HUB, destinazione, (f - 0.4) / 0.6);
    return { lat: destinazione.lat, lng: destinazione.lng };
  }

  function formatDateTime(d) {
    var jours = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    var mois = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
    return jours[d.getDay()] + " " + d.getDate() + " " + mois[d.getMonth()] +
      ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ---------- Carte Leaflet partagée (démo + réel) ---------- */

  var mappaCorrente = null;

  function costruisciMappa(cont, origine, destinazione, pos, idx, popups) {
    if (mappaCorrente) { mappaCorrente.remove(); mappaCorrente = null; }

    if (typeof L === "undefined") {
      cont.innerHTML = '<div class="map-fallback">\uD83D\uDDFA\uFE0F Carta non disponibile: ' +
        "per visualizzare la mappa serve una connessione a internet (OpenStreetMap).</div>";
      return;
    }

    var iconaPacco = L.divIcon({
      className: "",
      html: '<div class="pv-marker pv-marker--pacco">\uD83D\uDCE6</div>',
      iconSize: [36, 36], iconAnchor: [18, 18]
    });
    var iconaDest = L.divIcon({
      className: "",
      html: '<div class="pv-marker pv-marker--dest">\uD83D\uDCCD</div>',
      iconSize: [30, 30], iconAnchor: [15, 28]
    });

    var map = L.map(cont, { scrollWheelZoom: false });
    mappaCorrente = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "\u00A9 OpenStreetMap"
    }).addTo(map);

    var distTot = distanzaKm(origine, destinazione);
    var distRest = idx >= 5 ? 0 : distanzaKm(pos, destinazione);

    L.polyline([[origine.lat, origine.lng], [destinazione.lat, destinazione.lng]],
      { color: "#9aa8b5", weight: 2, dashArray: "4 8" })
      .addTo(map)
      .bindPopup("Trajetto completo: " + popups.origineCitta + " \u2192 " + popups.destCitta +
        " (" + formatKm(distTot) + " km)");

    if (idx < 5 && distRest > 1) {
      L.polyline([[pos.lat, pos.lng], [destinazione.lat, destinazione.lng]],
        { color: "#ff6b1a", weight: 3, dashArray: "6 8" })
        .addTo(map)
        .bindPopup("Distanza rimanente: " + formatKm(distRest) + " km");
    }

    L.circleMarker([origine.lat, origine.lng], {
      radius: 6, color: "#163a56", fillColor: "#163a56", fillOpacity: 0.9
    }).addTo(map).bindPopup(popups.origine);

    L.marker([destinazione.lat, destinazione.lng], { icon: iconaDest })
      .addTo(map).bindPopup(popups.destinazione);

    if (idx < 5) {
      L.marker([pos.lat, pos.lng], { icon: iconaPacco })
        .addTo(map).bindPopup(popups.pos);
    }

    try {
      map.fitBounds(L.latLngBounds([
        [origine.lat, origine.lng],
        [destinazione.lat, destinazione.lng],
        [pos.lat, pos.lng]
      ]), { padding: [45, 45] });
    } catch (e) {}

    return { distTot: distTot, distRest: distRest };
  }

  function fallbackMappa(cont, messaggio) {
    if (mappaCorrente) { mappaCorrente.remove(); mappaCorrente = null; }
    cont.innerHTML = '<div class="map-fallback">' + esc(messaggio) + "</div>";
  }

  /* ---------- Géocodage réel (Nominatim / OpenStreetMap) ---------- */

  var CLE_GEO = "pv_geocode_v1";

  function cacheGeoLire(chiave) {
    try {
      var c = JSON.parse(localStorage.getItem(CLE_GEO) || "{}");
      return c[chiave] || null;
    } catch (e) { return null; }
  }
  function cacheGeoScrivi(chiave, val) {
    try {
      var c = JSON.parse(localStorage.getItem(CLE_GEO) || "{}");
      c[chiave] = val;
      localStorage.setItem(CLE_GEO, JSON.stringify(c));
    } catch (e) {}
  }

  function cercaCitta(p) {
    var q = (p.citta || "").toLowerCase();
    for (var i = 0; i < CITTA.length; i++) {
      if (CITTA[i].nome.toLowerCase() === q) return { lat: CITTA[i].lat, lng: CITTA[i].lng };
    }
    for (var j = 0; j < CITTA.length; j++) {
      if (q && CITTA[j].nome.toLowerCase().indexOf(q) === 0) return { lat: CITTA[j].lat, lng: CITTA[j].lng };
    }
    return null;
  }

  function geocoda(p) {
    var adresse = p.indirizzo + ", " + p.cap + " " + p.citta + " (" + p.provincia + "), Italia";
    var chiave = adresse.toLowerCase();

    return new Promise(function (resolve) {
      var cache = cacheGeoLire(chiave);
      if (cache) { resolve(cache); return; }

      var url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=" +
        encodeURIComponent(adresse);

      var fini = false;
      var timeout = setTimeout(function () {
        if (!fini) { fini = true; resolve(cercaCitta(p)); }
      }, 7000);

      fetch(url, { headers: { "Accept-Language": "it" } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("http")); })
        .then(function (data) {
          if (fini) return;
          fini = true;
          clearTimeout(timeout);
          if (data && data.length && typeof data[0].lat === "string") {
            var pt = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), reale: true };
            cacheGeoScrivi(chiave, pt);
            resolve(pt);
          } else {
            resolve(cercaCitta(p));
          }
        })
        .catch(function () {
          if (fini) return;
          fini = true;
          clearTimeout(timeout);
          resolve(cercaCitta(p));
        });
    });
  }

  /* ---------- Cartes expéditeur / destinataire ---------- */

  function partyCard(icona, ruolo, p, tel) {
    return '<div class="party-card">' +
      '<div class="party-head"><span class="party-icon">' + icona + '</span>' +
      '<span class="party-role">' + ruolo + '</span></div>' +
      '<div class="party-name">' + esc(p.nome) + '</div>' +
      '<div class="party-addr">' + esc(indirizzoCompleto(p)) + '</div>' +
      (tel ? '<div class="party-tel">\uD83D\uDCDE ' + esc(tel) + "</div>" : "") +
      "</div>";
  }

  /* ---------- Rendu : expédition RÉELLE ---------- */

  function afficherReelle(sped) {
    var html = "";
    var creatoIl = new Date(sped.creatoIl);
    var durataMs = (DURATE[sped.servizio] || 72) * 3600 * 1000;
    var trascorso = Date.now() - creatoIl.getTime();
    var f = Math.max(0, Math.min(1, trascorso / durataMs));

    var idx = 0;
    for (var i = 0; i < SOGLIE.length; i++) {
      if (f >= SOGLIE[i]) idx = i;
    }
    var statut = STATUTS[ETAPES[idx].id];

    html += '<div class="alert alert--success show">';
    html += "  <strong>Pacco trovato</strong> — spedizione reale registrata su questo dispositivo — stato attuale: <span class='" + statut.pill + "'>" + statut.label + "</span>";
    html += "</div>";

    html += '<div class="package-meta">';
    html += "  <div><small>Numero di spedizione</small><strong>" + esc(sped.numero) + "</strong></div>";
    html += "  <div><small>Servizio</small><strong>" + esc(sped.servizio.charAt(0).toUpperCase() + sped.servizio.slice(1)) + "</strong></div>";
    html += "  <div><small>Peso dichiarato</small><strong>" + esc(sped.peso) + " kg</strong></div>";
    html += "  <div><small>Registrata il</small><strong>" + formatDateTime(creatoIl) + "</strong></div>";
    html += "</div>";

    html += '<div class="parties">';
    html += partyCard("\uD83D\uDCE4", "Mittente", sped.mittente, sped.mittente.telefono);
    html += partyCard("\uD83D\uDCE5", "Destinatario", sped.destinatario, sped.destinatario.telefono);
    html += "</div>";

    /* Actions rapides : étiquette imprimable + espace personnel */
    html += '<div class="track-actions">';
    html += '  <button type="button" class="btn btn--ghost js-et-spedizione">\uD83D\uDCC4 Stampa etichetta</button>';
    html += '  <a class="btn btn--ghost" href="spedizioni.html">\uD83D\uDCE6 Le mie spedizioni</a>';
    html += "</div>";

    /* Carte : géocodage réel des deux adresses */
    html += '<div id="track-map" class="track-map"></div>';
    html += '<p class="map-note" id="map-note">\uD83D\uDD0D Localizzazione degli indirizzi in corso (OpenStreetMap)…</p>';

    /* Timeline : dates réelles calculées sur la durée du service */
    html += '<div class="timeline">';
    for (var t = 0; t < ETAPES.length; t++) {
      var istante = new Date(creatoIl.getTime() + SOGLIE[t] * durataMs);
      var futuro = istante.getTime() > Date.now();
      var cls = t < idx ? "done" : (t === idx ? "current" : "pending");
      html += '<div class="timeline-item' + (t > idx ? " pending" : "") + '">';
      html += '  <div class="timeline-dot ' + cls + '">' + (t < idx ? "\u2713" : (t === idx ? "\u25CF" : "\u2022")) + "</div>";
      html += "  <div>";
      html += '    <span class="timeline-date">' + formatDateTime(istante) + (futuro ? " (previsto)" : "") + "</span>";
      html += '    <div class="timeline-title">' + ETAPES[t].titre + "</div>";
      html += '    <div class="timeline-desc">' + ETAPES[t].desc + "</div>";
      html += "  </div></div>";
    }
    html += "</div>";

    var conteneur = document.getElementById("track-result");
    if (conteneur) conteneur.innerHTML = html;

    /* Bouton étiquette imprimable (code-barres Code 128) */
    var btnEt = conteneur.querySelector(".js-et-spedizione");
    if (btnEt && window.PV_Etichetta) {
      btnEt.addEventListener("click", function () {
        window.PV_Etichetta.mostra(sped);
      });
    }

    var contMappa = document.getElementById("track-map");
    Promise.all([geocoda(sped.mittente), geocoda(sped.destinatario)]).then(function (res) {
      var origine = res[0], destinazione = res[1];
      var nota = document.getElementById("map-note");
      if (!origine || !destinazione) {
        if (contMappa) fallbackMappa(contMappa,
          "Impossibile localizzare gli indirizzi: verifica la connessione o precisa città e CAP. " +
          "La timeline e i dati restano comunque validi.");
        return;
      }
      var pos = posiziona(f, origine, destinazione);
      var dist = costruisciMappa(contMappa, origine, destinazione, pos, idx, {
        origine: "<strong>Partenza</strong><br>" + esc(sped.mittente.nome) + "<br>" + esc(indirizzoCompleto(sped.mittente)),
        destinazione: "<strong>Destinatario</strong><br>" + esc(sped.destinatario.nome) + "<br>" + esc(indirizzoCompleto(sped.destinatario)),
        pos: "<strong>\uD83D\uDCE6 Il tuo pacco</strong><br>In viaggio verso " + esc(sped.destinatario.citta),
        origineCitta: esc(sped.mittente.citta),
        destCitta: esc(sped.destinatario.citta)
      });
      if (nota && dist) {
        nota.innerHTML = "\uD83D\uDDFA\uFE0F Posizione attuale del pacco (\uD83D\uDCE6) e destinazione (\uD83D\uDCCD). " +
          "Linea grigia: percorso totale (" + formatKm(dist.distTot) + " km) — linea arancione: distanza rimanente (" +
          formatKm(dist.distRest) + " km).";
      }
    });

    try { conteneur.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
  }

  /* ---------- Rendu : mode démonstration ---------- */

  function generaInfoDemo(numero) {
    var h = hash32(numero);
    var iOrig = h % CITTA.length;
    var iDest = (iOrig + 1 + ((h >> 3) % (CITTA.length - 1))) % CITTA.length;
    function via(hv, salt) {
      return VIE[(hv + salt * 7) % VIE.length] + " " + (1 + ((hv >> (salt + 1)) % 120));
    }
    return {
      mittente: {
        nome: PRENOMI[h % PRENOMI.length] + " " + NOMI[(h >> 2) % NOMI.length],
        indirizzo: via(h, 1), cap: CITTA[iOrig].cap, citta: CITTA[iOrig].nome, provincia: CITTA[iOrig].prov
      },
      destinatario: {
        nome: PRENOMI[(h >> 4) % PRENOMI.length] + " " + NOMI[(h >> 6) % NOMI.length],
        indirizzo: via(h, 2), cap: CITTA[iDest].cap, citta: CITTA[iDest].nome, provincia: CITTA[iDest].prov
      },
      origine: CITTA[iOrig],
      destinazione: CITTA[iDest],
      peso: (2 + (h % 14)) + " kg",
      servizio: (h % 3 === 0) ? "Express" : "Standard",
      telMitt: "+39 " + PREFISSI[(h + 3) % PREFISSI.length] + " \u2022\u2022\u2022 \u2022\u2022" + (10 + ((h >> 3) % 90)),
      telDest: "+39 " + PREFISSI[(h + 5) % PREFISSI.length] + " \u2022\u2022\u2022 \u2022\u2022" + (10 + ((h >> 5) % 90))
    };
  }

  function genererDateDemo(etape, index) {
    var j = new Date();
    j.setDate(j.getDate() + (etape - index));
    var jours = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    var mois = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
    return jours[j.getDay()] + " " + j.getDate() + " " + mois[j.getMonth()] + (etape > index ? " (previsto)" : "");
  }

  function afficherDemo(numero) {
    var h = hash32(numero);
    var idx = h % ETAPES.length;
    var info = generaInfoDemo(numero);
    var statut = STATUTS[ETAPES[idx].id];

    var pos, origine, destinazione;
    if (idx <= 1)      pos = { lat: info.origine.lat, lng: info.origine.lng };
    else if (idx === 2) pos = { lat: HUB.lat, lng: HUB.lng };
    else if (idx === 3) pos = posiziona(0.65, info.origine, info.destinazione);
    else                pos = { lat: info.destinazione.lat, lng: info.destinazione.lng };
    origine = info.origine;
    destinazione = info.destinazione;
    var distRest = idx >= 5 ? 0 : distanzaKm(pos, destinazione);
    var distTot = distanzaKm(origine, destinazione);

    var html = "";
    html += '<div class="alert alert--success show">';
    html += "  <strong>Pacco trovato</strong> — stato attuale: <span class='" + statut.pill + "'>" + statut.label + "</span>";
    html += "</div>";
    html += '<p class="map-note" style="margin-top:0;">\u2139\uFE0F Modalit\u00E0 dimostrativa: spedizione non trovata su questo dispositivo, dati di esempio. ' +
      "Le spedizioni create dal modulo di prenotazione mostrano i dati reali.</p>";

    html += '<div class="package-meta">';
    html += "  <div><small>Numero di spedizione</small><strong>" + esc(numero) + "</strong></div>";
    html += "  <div><small>Servizio</small><strong>" + esc(info.servizio) + "</strong></div>";
    html += "  <div><small>Peso</small><strong>" + esc(info.peso) + "</strong></div>";
    html += "  <div><small>Distanza rimanente</small><strong>" + formatKm(distRest) + " km <span style='font-weight:400;color:#5c6b77;'>(su " + formatKm(distTot) + " km totali)</span></strong></div>";
    html += "</div>";

    html += '<div class="parties">';
    html += partyCard("\uD83D\uDCE4", "Mittente", info.mittente, info.telMitt);
    html += partyCard("\uD83D\uDCE5", "Destinatario", info.destinatario, info.telDest);
    html += "</div>";

    html += '<div id="track-map" class="track-map"></div>';
    html += '<p class="map-note" id="map-note">\uD83D\uDDFA\uFE0F Posizione attuale del pacco (\uD83D\uDCE6) e destinazione (\uD83D\uDCCD). ' +
      "Linea grigia: percorso totale — linea arancione: distanza rimanente (" + formatKm(distRest) + " km).</p>";

    html += '<div class="timeline">';
    for (var t = 0; t < ETAPES.length; t++) {
      var cls = t < idx ? "done" : (t === idx ? "current" : "pending");
      html += '<div class="timeline-item' + (t > idx ? " pending" : "") + '">';
      html += '  <div class="timeline-dot ' + cls + '">' + (t < idx ? "\u2713" : (t === idx ? "\u25CF" : "\u2022")) + "</div>";
      html += "  <div>";
      html += '    <span class="timeline-date">' + genererDateDemo(t, idx) + "</span>";
      html += '    <div class="timeline-title">' + ETAPES[t].titre + "</div>";
      html += '    <div class="timeline-desc">' + ETAPES[t].desc + "</div>";
      html += "  </div></div>";
    }
    html += "</div>";

    var conteneur = document.getElementById("track-result");
    if (conteneur) conteneur.innerHTML = html;

    var contMappa = document.getElementById("track-map");
    if (contMappa) {
      var dist = costruisciMappa(contMappa, origine, destinazione, pos, idx, {
        origine: "<strong>Partenza</strong><br>" + esc(info.mittente.nome) + "<br>" + esc(indirizzoCompleto(info.mittente)),
        destinazione: "<strong>Destinatario</strong><br>" + esc(info.destinatario.nome) + "<br>" + esc(indirizzoCompleto(info.destinatario)),
        pos: "<strong>\uD83D\uDCE6 Il tuo pacco</strong><br>" + (idx === 2 ? "Hub nazionale di Bologna" : "In viaggio verso " + esc(info.destinatario.citta)),
        origineCitta: esc(origine.nome),
        destCitta: esc(destinazione.nome)
      });
      var nota = document.getElementById("map-note");
      if (nota && dist && dist.distTot > 0) { /* rien à changer : note déjà correcte */ }
    }

    try { conteneur.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
  }

  /* ---------- Point d'entrée ---------- */

  function afficher(numero) {
    var sped = null;
    if (window.PV_Spedizioni) {
      try { sped = window.PV_Spedizioni.trova(numero); } catch (e) { sped = null; }
    }
    if (sped) {
      afficherReelle(sped);
    } else {
      afficherDemo(numero);
    }
  }

  function erreur() {
    var conteneur = document.getElementById("track-result");
    if (conteneur) {
      conteneur.innerHTML =
        '<div class="alert alert--error show"><strong>Numero non valido o non trovato.</strong> ' +
        "Controlla il formato (es. PV12345678IT) e riprova.</div>";
    }
  }

  var form = document.getElementById("track-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var champ = document.getElementById("track-number");
      var numero = extraireNumero(champ.value);
      if (!numero) { erreur(); return; }
      afficher(numero);
    });

    /* Lecture d'un éventuel paramètre ?n=... (confirmation de réservation) */
    var params = new URLSearchParams(window.location.search);
    var n = params.get("n");
    if (n) {
      var champ = document.getElementById("track-number");
      if (champ) champ.value = n;
      var numero = extraireNumero(n);
      if (numero) afficher(numero);
    }
  }
})();