/* ============================================================
   PaccoVeloce — Registro condiviso (API)

   Permette di leggere/scrivere le spedizioni su un registro
   UNICO, accessibile da qualsiasi dispositivo:
   Google Apps Script + Google Sheet (vedi GUIDE-BACKEND.md).

   - Scrittura : POST "no-cors" (il corpo viene inviato come
     testo semplice, accettato da Apps Script).
   - Lettura   : JSONP (Apps Script non invia header CORS).

   Se window.PV_API_URL è vuoto, l'API risulta non configurata
   e il sito continua a usare il solo localStorage.
   ============================================================ */

(function () {
  "use strict";

  var URL_API = String(window.PV_API_URL || "").trim();

  /* Deve coincidere con TOKEN in google-apps-script/Code.gs */
  var TOKEN = "pv-9f3c1a7e";

  var contatore = 0;

  function attivo() {
    return /^https?:\/\//i.test(URL_API);
  }

  function pulisciTesto(s) {
    /* Evita che un "</script>" nei dati rompa il JSONP */
    return String(s).replace(/<\//g, "<\\/");
  }

  /* ---------- Lettura via JSONP ---------- */

  function jsonp(parametri, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!attivo()) { reject(new Error("api-non-configurata")); return; }

      var nome = "__pvcb" + Date.now().toString(36) + (++contatore);
      var script = document.createElement("script");
      var finito = false;

      var timer = setTimeout(function () {
        chiudi();
        reject(new Error("timeout"));
      }, timeoutMs || 12000);

      function chiudi() {
        if (finito) return;
        finito = true;
        clearTimeout(timer);
        try { delete window[nome]; } catch (eDel) { window[nome] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[nome] = function (dati) { chiudi(); resolve(dati); };
      script.onerror = function () { chiudi(); reject(new Error("rete")); };

      var parti = [];
      for (var k in parametri) {
        if (Object.prototype.hasOwnProperty.call(parametri, k)) {
          parti.push(encodeURIComponent(k) + "=" + encodeURIComponent(parametri[k]));
        }
      }
      parti.push("callback=" + encodeURIComponent(nome));

      script.src = URL_API + (URL_API.indexOf("?") === -1 ? "?" : "&") + parti.join("&");
      document.head.appendChild(script);
    });
  }

  /* ---------- Scrittura via POST ---------- */

  function invia(record) {
    return new Promise(function (resolve) {
      if (!attivo()) { resolve(false); return; }

      var corpo = pulisciTesto(JSON.stringify({
        action: "save",
        token: TOKEN,
        record: record
      }));

      try {
        fetch(URL_API, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: corpo,
          keepalive: true
        }).then(function () {
          resolve(true);
        }).catch(function () {
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function cerca(numero) {
    return jsonp({ action: "get", numero: numero }, 12000).then(function (r) {
      if (!r || r.ok !== true || !r.spedizione) return null;
      return r.spedizione;
    });
  }

  /* Salva e verifica che il numero sia davvero consultabile
     (il POST no-cors non espone la risposta del server). */
  function salvaEVerifica(record, tentativi) {
    var max = tentativi || 4;
    return invia(record).then(function (ok) {
      if (!ok) return false;

      var n = 0;
      function prova() {
        n++;
        return cerca(record.numero).then(function (trovato) {
          if (trovato) return true;
          if (n >= max) return false;
          return new Promise(function (res) {
            setTimeout(function () { res(prova()); }, 1500);
          });
        }).catch(function () {
          if (n >= max) return false;
          return new Promise(function (res) {
            setTimeout(function () { res(prova()); }, 1500);
          });
        });
      }
      return prova();
    });
  }

  window.PV_API = {
    attivo: attivo,
    url: function () { return URL_API; },
    salva: invia,
    cerca: cerca,
    salvaEVerifica: salvaEVerifica,
    /* Permette di impostare l'URL a runtime (utile per i test) */
    configura: function (url) { URL_API = String(url || "").trim(); }
  };
})();
