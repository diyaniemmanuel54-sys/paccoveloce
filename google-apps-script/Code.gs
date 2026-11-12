/**
 * ============================================================
 *  PaccoVeloce — Registro condiviso delle spedizioni
 *  Backend gratuito: Google Apps Script + Google Sheet
 * ------------------------------------------------------------
 *  INSTALLAZIONE (5 minuti, vedi GUIDE-BACKEND.md):
 *   1. script.google.com  ->  Nuovo progetto
 *   2. Incolla questo file, poi Esegui la funzione setup()
 *      (autorizza l'accesso quando richiesto)
 *   3. Distribuisci -> Nuovo deployment -> Applicazione web
 *      Esegui come: Me · Chi ha accesso: Chiunque
 *   4. Copia l'URL che termina con /exec e incollalo in
 *      assets/js/api-config.js  ->  window.PV_API_URL
 * ============================================================
 */

/* Deve coincidere con TOKEN in assets/js/api.js */
var TOKEN = "pv-9f3c1a7e";

var NOME_FOGLIO = "Spedizioni";
var PROP_ID = "SPREADSHEET_ID";

/* Se true, i numeri di telefono non vengono restituiti al
   pubblico (consigliato). Gli indirizzi restano perché servono
   alla mappa del tracking. */
var NASCONDI_TELEFONI = true;

var INTESTAZIONI = [
  "numero", "creatoIl", "servizio", "peso", "fascia", "note", "email",
  "mittente_nome", "mittente_telefono", "mittente_via", "mittente_citta",
  "mittente_cap", "mittente_provincia",
  "dest_nome", "dest_telefono", "dest_via", "dest_citta", "dest_cap",
  "dest_provincia", "aggiornatoIl"
];

/* ============================================================
   SETUP — eseguire una volta sola
   ============================================================ */

function setup() {
  var foglio = getFoglio_();
  var url = ScriptApp.getService().getUrl();
  Logger.log("Foglio: " + getSS_().getUrl());
  Logger.log("URL applicazione web: " + (url || "distribuisci prima l'app web"));
  return "OK";
}

/* ============================================================
   LETTURA (JSONP)
   ============================================================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var callback = p.callback || "";
  var out;

  try {
    if (p.action === "get") {
      out = cerca_(p.numero, p.token);
    } else if (p.action === "list") {
      out = elenco_(p.token);
    } else if (p.action === "ping") {
      out = { ok: true, servizio: "paccoveloce", versione: 1 };
    } else {
      out = { ok: false, errore: "azione_non_valida" };
    }
  } catch (err) {
    out = { ok: false, errore: String(err) };
  }

  return risposta_(out, callback);
}

function risposta_(oggetto, callback) {
  var json = JSON.stringify(oggetto).replace(/<\//g, "<\\/");
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   SCRITTURA (POST)
   ============================================================ */

function doPost(e) {
  var out;
  try {
    var dati = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (dati.token !== TOKEN) {
      out = { ok: false, errore: "token" };
    } else if (dati.action === "save") {
      out = salva_(dati.record);
    } else {
      out = { ok: false, errore: "azione_non_valida" };
    }
  } catch (err) {
    out = { ok: false, errore: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function salva_(record) {
  if (!record || !record.numero) return { ok: false, errore: "record" };

  var numero = String(record.numero).toUpperCase().trim();
  if (!numeroValido_(numero)) return { ok: false, errore: "numero_non_valido" };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var foglio = getFoglio_();
    var riga = rigaDaRecord_(record, numero);
    var indice = trovaRiga_(foglio, numero);

    if (indice > 0) {
      foglio.getRange(indice, 1, 1, riga.length).setValues([riga]);
    } else {
      foglio.appendRow(riga);
    }
    return { ok: true, numero: numero, aggiornato: indice > 0 };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   RICERCA
   ============================================================ */

function cerca_(numeroGrezzo, token) {
  var numero = String(numeroGrezzo || "").toUpperCase().trim();
  if (!numero) return { ok: false, errore: "numero_mancante" };

  var foglio = getFoglio_();
  var indice = trovaRiga_(foglio, numero);
  if (indice < 1) return { ok: true, trovata: false, spedizione: null };

  var righe = foglio.getRange(indice, 1, 1, INTESTAZIONI.length).getValues()[0];
  var obj = {};
  for (var i = 0; i < INTESTAZIONI.length; i++) obj[INTESTAZIONI[i]] = righe[i];

  return { ok: true, trovata: true, spedizione: recordDaRiga_(obj) };
}

function elenco_(token) {
  if (token !== TOKEN) return { ok: false, errore: "token" };
  var foglio = getFoglio_();
  var valori = foglio.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < valori.length; i++) {
    var obj = {};
    for (var j = 0; j < INTESTAZIONI.length; j++) obj[INTESTAZIONI[j]] = valori[i][j];
    out.push(recordDaRiga_(obj));
  }
  return { ok: true, spedizioni: out };
}

/* ============================================================
   CONVERSIONI
   ============================================================ */

function recordDaRiga_(r) {
  var data = r.creatoIl;
  if (data instanceof Date) data = data.toISOString();

  return {
    numero: String(r.numero || ""),
    creatoIl: data || new Date().toISOString(),
    servizio: String(r.servizio || "standard").toLowerCase(),
    peso: String(r.peso || ""),
    fascia: String(r.fascia || ""),
    note: String(r.note || ""),
    email: "",
    mittente: {
      nome: String(r.mittente_nome || ""),
      telefono: NASCONDI_TELEFONI ? "" : String(r.mittente_telefono || ""),
      indirizzo: String(r.mittente_via || ""),
      citta: String(r.mittente_citta || ""),
      cap: String(r.mittente_cap || ""),
      provincia: String(r.mittente_provincia || "")
    },
    destinatario: {
      nome: String(r.dest_nome || ""),
      telefono: NASCONDI_TELEFONI ? "" : String(r.dest_telefono || ""),
      indirizzo: String(r.dest_via || ""),
      citta: String(r.dest_citta || ""),
      cap: String(r.dest_cap || ""),
      provincia: String(r.dest_provincia || "")
    },
    versione: 1
  };
}

function rigaDaRecord_(rec, numero) {
  var m = rec.mittente || {};
  var d = rec.destinatario || {};
  return [
    numero,
    rec.creatoIl || new Date().toISOString(),
    String(rec.servizio || "standard").toLowerCase(),
    String(rec.peso || ""),
    String(rec.fascia || ""),
    String(rec.note || ""),
    String(rec.email || ""),
    String(m.nome || ""),
    String(m.telefono || ""),
    String(m.indirizzo || ""),
    String(m.citta || ""),
    String(m.cap || ""),
    String(m.provincia || ""),
    String(d.nome || ""),
    String(d.telefono || ""),
    String(d.indirizzo || ""),
    String(d.citta || ""),
    String(d.cap || ""),
    String(d.provincia || ""),
    new Date().toISOString()
  ];
}

/* ============================================================
   FOGLIO
   ============================================================ */

function getSS_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_ID);

  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* ricrea */ }
  }

  var ss = SpreadsheetApp.create("PaccoVeloce — Registro spedizioni");
  props.setProperty(PROP_ID, ss.getId());
  return ss;
}

function getFoglio_() {
  var ss = getSS_();
  var foglio = ss.getSheetByName(NOME_FOGLIO);

  if (!foglio) {
    foglio = ss.insertSheet(NOME_FOGLIO);
  }

  if (foglio.getLastRow() === 0) {
    foglio.appendRow(INTESTAZIONI);
    foglio.getRange(1, 1, 1, INTESTAZIONI.length).setFontWeight("bold");
    foglio.setFrozenRows(1);
  }

  return foglio;
}

function trovaRiga_(foglio, numero) {
  var ultima = foglio.getLastRow();
  if (ultima < 2) return -1;

  var valori = foglio.getRange(2, 1, ultima - 1, 1).getValues();
  for (var i = 0; i < valori.length; i++) {
    if (String(valori[i][0]).toUpperCase().trim() === numero) return i + 2;
  }
  return -1;
}

/* ============================================================
   VALIDAZIONE S10 (norma UPU)
   ============================================================ */

function numeroValido_(numero) {
  var m = String(numero || "").toUpperCase().match(/^PV(\d{8})(\d)(IT)?$/);
  if (!m) return false;
  return String(controllo_(m[1])) === m[2];
}

function controllo_(donnees8) {
  var pesi = [8, 6, 4, 2, 3, 5, 9, 7];
  var somma = 0;
  for (var i = 0; i < 8; i++) {
    somma += parseInt(donnees8.charAt(i), 10) * pesi[i];
  }
  var c = 11 - (somma % 11);
  if (c === 10) c = 0;
  if (c === 11) c = 5;
  return c;
}

/* ============================================================
   TEST — eseguire per verificare che tutto funzioni
   ============================================================ */

function test() {
  var finto = {
    numero: "PV123456789IT",
    creatoIl: new Date().toISOString(),
    servizio: "standard",
    peso: "2",
    fascia: "9_12",
    mittente: { nome: "Test Mittente", telefono: "333", indirizzo: "Via Roma 1", citta: "Milano", cap: "20100", provincia: "MI" },
    destinatario: { nome: "Test Destinatario", telefono: "340", indirizzo: "Via Napoli 2", citta: "Roma", cap: "00100", provincia: "RM" }
  };
  Logger.log(JSON.stringify(salva_(finto)));
  Logger.log(JSON.stringify(cerca_("PV123456789IT", "")));
  return "OK";
}
