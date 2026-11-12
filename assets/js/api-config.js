/* ============================================================
   PaccoVeloce — Configuration du registre partagé
   ------------------------------------------------------------
   PV_STORE_URL : espace JSON public qui rend chaque numéro
   consultable depuis N'IMPORTE QUEL appareil (client, smartphone,
   autre PC), sans aucune installation ni compte.

   Il ne contient QUE des données non nominatives (villes, CAP,
   province, service, poids, dates) : les noms, rues et téléphones
   restent sur l'appareil de l'agence.

   PV_API_URL (facultatif) : si vous migrez un jour vers un backend
   privé Google Apps Script (voir GUIDE-BACKEND.md), collez son URL
   ici — elle est prioritaire sur PV_STORE_URL.
   ============================================================ */

window.PV_STORE_URL = "https://extendsclass.com/api/json-storage/bin/ffaccce";

window.PV_API_URL = "";
