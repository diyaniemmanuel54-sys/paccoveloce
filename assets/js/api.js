/* ============================================================
   PaccoVeloce — Registre partagé (API)

   But : un client doit pouvoir saisir son numéro de suivi sur
   n'importe quel appareil et voir son colis.

   Deux fournisseurs :
   1) "store"  (par défaut) : espace JSON public, aucune
      configuration, fonctionne immédiatement ;
   2) "script" (facultatif) : Google Apps Script + Google Sheet,
      activé si window.PV_API_URL est renseigné (voir
      GUIDE-BACKEND.md). Filtrage côté serveur, plus privé.

   Confidentialité de l'espace public :
   - clés = empreinte SHA-256 du numéro → non énumérables ;
   - valeurs = données NON nominatives (villes, CAP, province,
     service, poids, dates). Aucun nom, aucune rue, aucun
     téléphone n'est publié.
   ============================================================ */

(function () {
  "use strict";

  var STORE_URL = String(window.PV_STORE_URL || "").trim();
  var SCRIPT_URL = String(window.PV_API_URL || "").trim();

  /* Doit coïncider avec TOKEN dans google-apps-script/Code.gs */
  var TOKEN = "pv-9f3c1a7e";

  var contatore = 0;

  function storeAttivo() { return /^https?:\/\//i.test(STORE_URL); }
  function scriptAttivo() { return /^https?:\/\//i.test(SCRIPT_URL); }
  function attivo() { return storeAttivo() || scriptAttivo(); }

  function provider() {
    if (scriptAttivo()) return "script";
    if (storeAttivo()) return "store";
    return "aucun";
  }

  function pausa(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* ============================================================
     Empreinte du numéro (clé de stockage)
     ============================================================ */

  function empreinteSimple(txt) {
    /* FNV-1a en 64 bits simulés : repli si crypto.subtle absent */
    var h1 = 0x811c9dc5, h2 = 0x1000193;
    for (var i = 0; i < txt.length; i++) {
      var c = txt.charCodeAt(i);
      h1 = (h1 ^ c) * 0x01000193 >>> 0;
      h2 = (h2 + c * (i + 7)) * 0x85ebca6b >>> 0;
    }
    return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
  }

  function impronta(numero) {
    var s = "paccoveloce::" + String(numero).toUpperCase().replace(/\s+/g, "");
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      try {
        return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
          .then(function (buf) {
            var b = new Uint8Array(buf), out = "";
            for (var i = 0; i < 12; i++) out += ("0" + b[i].toString(16)).slice(-2);
            return out;
          })
          .catch(function () { return empreinteSimple(s); });
      } catch (e) { /* repli */ }
    }
    return Promise.resolve(empreinteSimple(s));
  }

  /* ============================================================
     Compression / expansion des enregistrements
     ============================================================ */

  function comprimi(rec) {
    var m = rec.mittente || {};
    var d = rec.destinatario || {};
    return {
      n: String(rec.numero || ""),
      c: rec.creatoIl || new Date().toISOString(),
      s: String(rec.servizio || "standard").toLowerCase(),
      p: String(rec.peso || ""),
      f: String(rec.fascia || ""),
      om: { citta: String(m.citta || ""), cap: String(m.cap || ""), provincia: String(m.provincia || "") },
      de: { citta: String(d.citta || ""), cap: String(d.cap || ""), provincia: String(d.provincia || "") }
    };
  }

  function espandi(x) {
    var om = x.om || {}, de = x.de || {};
    return {
      numero: String(x.n || ""),
      creatoIl: x.c || new Date().toISOString(),
      servizio: String(x.s || "standard"),
      peso: String(x.p || ""),
      fascia: String(x.f || ""),
      mittente: {
        nome: "", indirizzo: "", telefono: "",
        cap: String(om.cap || ""), citta: String(om.citta || ""), provincia: String(om.provincia || "")
      },
      destinatario: {
        nome: "", indirizzo: "", telefono: "",
        cap: String(de.cap || ""), citta: String(de.citta || ""), provincia: String(de.provincia || "")
      },
      parziale: true
    };
  }

  /* ============================================================
     Fournisseur "store" : espace JSON public
     ============================================================ */

  function estraiJson(txt) {
    if (!txt) return null;
    var t = String(txt).trim();
    var coupe = t.search(/<!doctype|<!DOCTYPE|<html|<HTML/);
    if (coupe > 0) t = t.slice(0, coupe).trim();
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  function storeLeggi() {
    var url = STORE_URL + (STORE_URL.indexOf("?") === -1 ? "?" : "&") + "cb=" + Date.now();
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http-" + r.status);
      return r.text();
    }).then(function (t) {
      var d = estraiJson(t);
      if (!d || typeof d !== "object") throw new Error("json-invalide");
      return d;
    });
  }

  function storeScrivi(dati) {
    return fetch(STORE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dati)
    }).then(function (r) {
      if (!r.ok) throw new Error("http-" + r.status);
      return r.text();
    });
  }

  /* File d'attente des écritures.
     Le registre est UN objet JSON : chaque écriture le lit en entier,
     le modifie puis le réécrit en entier. Deux écritures simultanées
     (deux téléphones, ou deux suppressions) repartaient de la même
     version et la seconde écrasait la première → des numéros
     disparaissaient du registre. On les exécute donc l'une après
     l'autre, dans l'ordre d'arrivée. */
  var fileEcriture = Promise.resolve();
  function enFile(tache) {
    var p = fileEcriture.then(tache, tache);
    fileEcriture = p.then(function () {}, function () {});
    return p;
  }

  function storeSalva(rec) {
    if (!rec || !rec.numero) return Promise.resolve(false);
    return enFile(function () {
      return impronta(rec.numero).then(function (cle) {
        return storeLeggi().then(function (dati) {
          dati[cle] = comprimi(rec);
          return storeScrivi(dati).then(function () { return true; });
        });
      });
    }).catch(function () { return false; });
  }

  function storeCerca(numero) {
    return impronta(numero).then(function (cle) {
      return storeLeggi().then(function (dati) {
        var v = dati[cle];
        return v ? espandi(v) : null;
      });
    });
  }

  function storePubblicaTutti(liste) {
    if (!liste || !liste.length) return Promise.resolve(0);
    return enFile(function () {
      return storeLeggi().then(function (dati) {
      var n = 0;
      return Promise.all(liste.map(function (rec) {
        if (!rec || !rec.numero) return Promise.resolve();
        return impronta(rec.numero).then(function (cle) {
          dati[cle] = comprimi(rec);
          n++;
        });
        })).then(function () {
          return storeScrivi(dati).then(function () { return n; });
        });
      });
    });
  }

  /* ============================================================
     Fournisseur "script" : Google Apps Script (JSONP + POST)
     ============================================================ */

  function jsonp(parametri, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var nome = "__pvcb" + Date.now().toString(36) + (++contatore);
      var script = document.createElement("script");
      var fini = false;

      var timer = setTimeout(function () {
        fini = true;
        nettoyer();
        reject(new Error("timeout"));
      }, timeoutMs || 12000);

      function nettoyer() {
        clearTimeout(timer);
        try { delete window[nome]; } catch (e) { window[nome] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[nome] = function (dati) {
        if (fini) return;
        fini = true;
        nettoyer();
        resolve(dati);
      };
      script.onerror = function () {
        if (fini) return;
        fini = true;
        nettoyer();
        reject(new Error("rete"));
      };

      var parti = [];
      for (var k in parametri) {
        if (Object.prototype.hasOwnProperty.call(parametri, k)) {
          parti.push(encodeURIComponent(k) + "=" + encodeURIComponent(parametri[k]));
        }
      }
      parti.push("callback=" + encodeURIComponent(nome));

      script.src = SCRIPT_URL + (SCRIPT_URL.indexOf("?") === -1 ? "?" : "&") + parti.join("&");
      document.head.appendChild(script);
    });
  }

  function scriptSalva(rec) {
    var corps = JSON.stringify({ action: "save", token: TOKEN, record: rec }).replace(/<\//g, "<\\/");
    return fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: corps,
      keepalive: true
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function scriptCerca(numero) {
    return jsonp({ action: "get", numero: numero }, 12000).then(function (r) {
      if (!r || r.ok !== true || !r.spedizione) return null;
      return r.spedizione;
    });
  }

  /* ============================================================
     Lien de suivi autonome (aucun service externe)
     ------------------------------------------------------------
     Les données non nominatives du colis (villes, CAP, province,
     service, poids, date) sont encodées en base64url dans l'URL :
         suivi.html?d=…
     Ce lien fonctionne sur n'importe quel téléphone, même si le
     registre en ligne est indisponible, vidé ou bloqué par le
     réseau de l'opérateur. C'est la voie de secours garantie.
     ============================================================ */

  function utf8VersBase64(txt) {
    var i, bin = "";
    if (window.TextEncoder) {
      var octets = new TextEncoder().encode(txt);
      for (i = 0; i < octets.length; i++) bin += String.fromCharCode(octets[i]);
    } else {
      bin = unescape(encodeURIComponent(txt));
    }
    return btoa(bin);
  }

  function base64VersUtf8(b64) {
    var bin = atob(b64), i;
    if (window.TextDecoder) {
      var octets = new Uint8Array(bin.length);
      for (i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(octets);
    }
    return decodeURIComponent(escape(bin));
  }

  function codifica(rec) {
    try {
      var json = JSON.stringify(comprimi(rec));
      return utf8VersBase64(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch (e) { return ""; }
  }

  function decodifica(code) {
    try {
      var s = String(code || "").replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      var obj = JSON.parse(base64VersUtf8(s));
      if (!obj || !obj.n) return null;
      return espandi(obj);
    } catch (e) { return null; }
  }

  function lienSuivi(rec) {
    var base = "https://paccoveloce.com/suivi.html";
    if (!rec || !rec.numero) return base;
    var d = codifica(rec);
    return d ? base + "?d=" + d : base + "?n=" + encodeURIComponent(rec.numero);
  }

  /* ============================================================
     API publique
     ============================================================ */

  function cerca(numero) {
    if (scriptAttivo()) return scriptCerca(numero);
    if (storeAttivo()) return storeCerca(numero);
    return Promise.reject(new Error("api-non-configurata"));
  }

  function salva(rec) {
    if (scriptAttivo()) return scriptSalva(rec);
    if (storeAttivo()) return storeSalva(rec);
    return Promise.resolve(false);
  }

  /* Sauvegarde puis tentative de relecture.
     Retourne :
       "ok"         → écrit ET relu (certitude)
       "unverified" → écrit, relecture impossible (cache CDN, réseau)
       false        → écriture refusée / hors ligne
     On ne transforme plus un doute de lecture en échec : cela
     faisait croire à une panne alors que le numéro était publié. */
  function salvaEVerifica(rec, tentativi) {
    var max = tentativi || 3;

    return salva(rec).then(function (ok) {
      if (!ok) return false;

      var n = 0;
      function essai() {
        n++;
        return cerca(rec.numero).then(function (t) {
          if (t) return "ok";
          if (n >= max) return "unverified";
          return pausa(1000).then(essai);
        }).catch(function () {
          if (n >= max) return "unverified";
          return pausa(1000).then(essai);
        });
      }
      return essai();
    }).catch(function () { return false; });
  }

  /* Supprime un enregistrement (utilisé par le test de diagnostic) */
  function elimina(numero) {
    if (!storeAttivo()) return Promise.resolve(false);
    return enFile(function () {
      return impronta(numero).then(function (cle) {
        return storeLeggi().then(function (dati) {
          if (!(cle in dati)) return false;
          delete dati[cle];
          return storeScrivi(dati).then(function () { return true; });
        });
      });
    }).catch(function () { return false; });
  }

  /* Diagnostic : écrit puis relit un numéro de test, et le supprime.
     Permet de savoir depuis CET appareil si la publication en ligne
     fonctionne réellement. */
  function testRegistro() {
    if (!storeAttivo() && !scriptAttivo()) {
      return Promise.resolve({ ok: false, motivo: "non-configurato" });
    }
    var prova = {
      numero: "PVTEST" + Date.now(),
      creatoIl: new Date().toISOString(),
      servizio: "standard",
      peso: "1",
      mittente: { citta: "Roma", cap: "00100", provincia: "RM" },
      destinatario: { citta: "Milano", cap: "20100", provincia: "MI" }
    };
    return salva(prova).then(function (ok) {
      if (!ok) return { ok: false, motivo: "scrittura" };
      return cerca(prova.numero).then(function (t) {
        return elimina(prova.numero).then(function () {
          return t ? { ok: true, motivo: "ok" } : { ok: false, motivo: "lettura" };
        });
      }).catch(function () {
        return { ok: false, motivo: "lettura" };
      });
    }).catch(function () { return { ok: false, motivo: "rete" }; });
  }

  function pubblicaTutti(liste) {
    if (!storeAttivo()) return Promise.resolve(0);
    return storePubblicaTutti(liste).catch(function () { return 0; });
  }

  window.PV_API = {
    attivo: attivo,
    provider: provider,
    cerca: cerca,
    salva: salva,
    salvaEVerifica: salvaEVerifica,
    pubblicaTutti: pubblicaTutti,
    codifica: codifica,
    decodifica: decodifica,
    lienSuivi: lienSuivi,
    testRegistro: testRegistro,
    elimina: elimina
  };
})();
