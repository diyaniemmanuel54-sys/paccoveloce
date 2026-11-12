# 📦 PaccoVeloce — Site web d'envoi de colis en Italie

Site vitrine + démos fonctionnelles pour un service de livraison de colis en Italie.
HTML/CSS/JS pur, **aucune dépendance**, aucune compilation : il suffit d'ouvrir
les fichiers ou de servir le dossier avec un simple serveur HTTP.

## Pages

| Page            | Fichier            | Contenu                                                                     |
|-----------------|--------------------|-----------------------------------------------------------------------------|
| Accueil         | `index.html`       | Hero, « comment ça marche », services, témoignages, tracking rapide         |
| Tarifs          | `tarifs.html`      | Calculateur de devis interactif + tableau de prix indicatifs                |
| Suivi de colis  | `suivi.html`       | Tracking (démo + vraies expéditions) avec carte et timeline                 |
| Prenota il ritiro | `reservation.html` | Page d'information : prise de rendez-vous **via WhatsApp uniquement** — **aucun champ, aucune génération de numéro** |
| Mes expéditions | `spedizioni.html`  | « Le mie spedizioni » : historique local, statut, coût, étiquette          |
| Contact         | `contact.html`     | Coordonnées (WhatsApp, e-mail, siège) + référent dédié                      |
| Area riservata  | `admin.html`       | **Accès agence uniquement** (mot de passe) : seul endroit où l'on saisit les coordonnées et génère les numéros S10 |

## Lancer le site en local

```bash
cd PaccoVeloce
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Ou simplement double-cliquer sur `index.html` (les pages fonctionnent en `file://`).

## Génération professionnelle du numéro de consignation — agence uniquement

> 🔒 **Le site public ne génère plus aucun numéro.** La page
> « Prenota il ritiro » n'est qu'une invitation à contacter l'agence via
> WhatsApp. La saisie des coordonnées et la génération des numéros S10 se
> font **exclusivement dans l'Area riservata `admin.html`**, protégée par le
> mot de passe **pacco2026** (clé de session `pv_admin_ok`).

Dans l'Area riservata, après le remplissage du formulaire, un numéro unique
est généré au format **postal S10** (norme UPU utilisée par les opérateurs
postaux), **enregistré dans le registre local** (tracking réel immédiat) et
**envoyé par e-mail à l'agence** (velocepacco653@gmail.com) :

```
PV + NNNNNNNN + C + IT
     └ 8 chiffres ┘│
                   └ chiffre de contrôle
```

- **8 chiffres de données** : jour de l'année (3 chiffres, ex. 258 = 15 sept.)
  + séquence de 5 chiffres aléatoires (`crypto.getRandomValues`, repli
  `Math.random` si indisponible) ;
- **Chiffre de contrôle** : algorithme **S10 (UPU)** — poids `8,6,4,2,3,5,9,7`
  sur les 8 chiffres, `somme mod 11`, puis `11 − reste` avec `10 → 0` et
  `11 → 5` (identique aux numéros de suivi de Poste Italiane, DHL, UPS…) ;
- unicité garantie par re-tirage en cas de collision avec le registre local.

Le code est isolé dans `assets/js/shipments.js` et expose une API publique :

```js
window.PV_Spedizioni.genera(record)    // génère un numéro S10 + record SANS stockage (flux e-mail)
window.PV_Spedizioni.crea(record)      // (historique) crée + enregistre localement
window.PV_Spedizioni.trova(numero)     // retrouve une expédition par numéro
window.PV_Spedizioni.elenco()          // toutes les expéditions (récent d'abord)
window.PV_Spedizioni.validaNumero(n)   // vérifie format + chiffre de contrôle
window.PV_Spedizioni._chiffreControle("25888261") // → "9" (pour les tests)
```

### Envoi à l'agence par e-mail (depuis l'Area riservata)

Au clic sur **« Genera numero e registra »** (bouton unique du formulaire
agence) :

1. le numéro S10 est généré côté navigateur puis **enregistré dans le
   registre local** (`PV_Spedizioni.crea`) : le colis est immédiatement
   traçable sur la page « Tracking » du site public ;
2. **tous les détails** (numéro, expéditeur, destinataire, adresses
   complètes, téléphones, service, poids, créneau, coût estimé, notes) sont
   envoyés à la boîte **velocepacco653@gmail.com** via le service
   **FormSubmit** (`formsubmit.co/ajax/…`, POST JSON, sans backend) ;
3. l'écran de confirmation affiche le numéro + un bouton
   **« ⬇️ Scarica la ricevuta (PDF) »** : le reçu est généré à 100 % dans le
   navigateur (`assets/js/ricevuta.js`, PDF A4 fait main, aucune dépendance,
   fonctionne même hors ligne) et téléchargé sous `ricevuta-<numero>.pdf`.
   Aucun autre bouton (ni WhatsApp, ni étiquette, ni tracking) : la suite
   se gère par e-mail / WhatsApp ;
4. **l'enregistrement est local au navigateur de l'agence** (clé
   `pv_spedizioni_v1`) : c'est ce registre qui alimente le tracking réel ;
   les visiteurs du site ne saisissent rien et ne génèrent rien — ils ne
   font que vérifier/suivre un numéro communiqué par l'agence.

**Activation (une seule fois)** : la toute première soumission déclenche un
e-mail d'activation de FormSubmit vers velocepacco653@gmail.com — l'agence
doit cliquer sur le lien « Activate » pour recevoir les suivantes.

**Repli hors ligne** : si l'envoi automatique échoue (pas de connexion ou
service indisponible), l'écran propose un lien e-mail prérempli (mailto) vers
l'agence, avec toutes les informations déjà rédigées.

## Fonctionnalités démo

- **Menu burger responsive** (téléphones + tablettes) : sous 880 px les
  5 liens de navigation se replient derrière un bouton ☰ à trois barres
  (animé en ✕ quand le menu est ouvert). Le panneau se déroule sous la
  barre, se referme au clic sur un lien, à l'extérieur, avec Échap ou
  au redimensionnement au-dessus de 880 px ; `aria-expanded` mis à jour.
- **Modèle tarifaire partagé** (`assets/js/prezzi.js`, `PV_Prezzi`) :
  source unique du calcul, utilisée par le calculateur de devis
  (`quote.js`), le devis en direct du formulaire de réservation et la
  page « Le mie spedizioni ». Trois services :
  - **Economico** (3–6 giorni) : base 4,20 €, + 0,70 €/kg jusqu'à 5 kg,
    + 0,45 €/kg au-delà ;
  - **Standard** (2–4 giorni) : base 4,90 €, + 0,85 €/kg jusqu'à 5 kg,
    + 0,60 €/kg au-delà ;
  - **Express** (24–48 h) : tarifs Standard **+ 40 %** ;
  puis surcharge dimensions (+ 2,50 € si L+H+P > 100 cm), coefficient de
  zone (Nord ×1,00 / Centro ×1,15 / Sud & Isole ×1,35) et assurance
  (2 % de la valeur déclarée). Le paramètre `servizio` est
  rétrocompatible avec l'ancien flag `express`.
  Exemples (1 kg, IVA inclusa) : Economico 4,90 / 5,63 / 6,62 € ·
  Standard 5,75 / 6,61 / 7,76 € · Express 8,05 / 9,26 / 10,87 €
  (Nord / Centro / Sud).
- **Tracking** (`assets/js/tracking.js`) :
  - expéditions réelles du registre local **ou** état *déterministe* (hash
    du numéro) pour la démo ;
  - coordonnées **expéditeur** et **destinataire** avec adresses complètes
    (via, CAP, ville, province) et téléphones ;
  - **géocodage réel des adresses** via l'API **Nominatim**
    (OpenStreetMap, CORS ouvert, timeout 6 s, mise en cache locale clé
    `pv_geocode_v1`) — carte à l'échelle du trajet réel ;
  - **carte OpenStreetMap** (Leaflet servi en local) avec la position actuelle
    du colis 📦, la destination 📍, le trajet complet et la ligne de la
    **distance restante** en km (formule haversine) ;
  - la position du colis est interpolée selon le temps écoulé depuis la
    création (Express 24 h, Standard 72 h, Economico 120 h) : ville de
    départ → hub de Bologne → en route → ville de destination.
- **Confirmation de réservation** (`assets/js/form.js`) : envoi automatique
  de la réservation **à l'agence par e-mail** (FormSubmit AJAX, destination
  velocepacco653@gmail.com) avec le numéro S10 généré ; écran de
  confirmation avec numéro en grand + récapitulatif expéditeur/destinataire
  + **coût estimé** + bouton **« ⬇️ Scarica la ricevuta (PDF) »**
  (`assets/js/ricevuta.js`) : PDF A4 généré dans le navigateur, sans
  dépendance externe — le seul bouton du formulaire reste
  « Conferma la prenotazione ». Repli : lien e-mail prérempli si l'envoi
  échoue.
- **Anti-spam honeypot** : champ piège invisible (`left:-9999px`,
  `tabindex=-1`) sur les formulaires ; s'il est rempli, l'envoi est
  ignoré silencieusement (aucun message, formulaire réinitialisé).
- **Carte** (`assets/js/tracking.js`, `assets/vendor/leaflet/`)
  - **Leaflet est servi par le projet** (`assets/vendor/leaflet/`), plus par
    un CDN : un réseau qui bloque unpkg ne casse plus la carte ;
  - tuiles OpenStreetMap + géocodage Nominatim (2 requêtes **séquentielles**,
    espacées de 1,2 s, pour respecter la limite d'1 req/s) avec cache
    `pv_geocode_v1` et repli sur les coordonnées de la ville ;
  - **carte schématique de secours 100 % locale** (SVG) : si Leaflet ne
    charge pas ou si aucune tuile ne s'affiche (filtrage, hors ligne),
    le trajet, les villes et la distance restent visibles ;
  - `map.invalidateSize()` + re-cadrage après affichage, pour éviter la
    carte vide quand le conteneur était encore masqué (mobile, routeur
    du fichier unique).
- **Formulaires** : validation en temps réel, messages d'erreur, champs
  structurés (via / città / CAP / provincia) pour expéditeur et destinataire.
- **Illustrations** (`assets/img/`) : visuels SVG vectoriels maison aux
  couleurs de la marque (camion dans le hero, galerie « Dentro
  PaccoVeloce » avec entrepôt / flotta / colis livrés, photo de profil
  du fondateur dans « Chi siamo » et sur la page Contatti, avatars
  illustrés des témoignages). 100 % hors ligne, aucune photo externe.

## Arborescence

```
PaccoVeloce/
├── index.html
├── tarifs.html
├── suivi.html
├── reservation.html
├── spedizioni.html
├── contact.html
├── admin.html
├── assets/
│   ├── css/style.css
│   ├── img/
│   │   ├── profile.svg       # photo de profil illustrée (fondateur/assistenza)
│   │   ├── camion.svg        # camion de livraison (hero + galerie)
│   │   ├── entrepot.svg      # entrepôt avec rayonnages et chariot élévateur
│   │   ├── colis-livres.svg  # colis livrés devant une porte (badge « Consegnato »)
│   │   └── avatar-*.svg      # avatars illustrés des témoignages (3)
│   ├── vendor/
│   │   └── leaflet/      # Leaflet 1.9.4 servi en local (js, css, images)
│   └── js/
│       ├── prezzi.js     # modèle tarifaire partagé (API PV_Prezzi)
│       ├── form.js       # validation, confirmation, devis en direct, honeypot
│       ├── quote.js      # calculateur de devis (page Tariffe)
│       ├── shipments.js  # numéros S10 + registre local (API PV_Spedizioni)
│       ├── spedizioni.js # page « Le mie spedizioni » (statut, rimuovi, etichetta)
│       ├── label.js      # étiquette A4 imprimable + code-barres Code 128
│       ├── ricevuta.js   # reçu de réservation en PDF (généré dans le navigateur)
│       ├── admin.js      # Area riservata : verrou mot de passe + panneau agence
│       ├── api-config.js # URL du registre public (PV_STORE_URL, déjà remplie)
│       ├── api.js        # PV_API : empreinte du numéro + lecture/écriture du registre
│       └── tracking.js   # suivi de colis (local + registre partagé) + carte
├── google-apps-script/
│   └── Code.gs           # variante privée facultative : Apps Script + Google Sheet
├── GUIDE-BACKEND.md      # guide de la variante privée (facultatif)
└── README.md
```

## Registre partagé — suivi depuis n'importe quel appareil

**Problème corrigé** : jusqu'ici le numéro généré dans l'Area riservata était
écrit uniquement dans le `localStorage` du navigateur de l'agence. Le suivi
fonctionnait donc **seulement sur ce navigateur** ; ailleurs, `tracking.js`
bascule sur un rendu de démonstration (données fictives issues d'un hash du
numéro) — d'où l'impression que « le code ne fonctionne pas pour les autres ».

**Solution (active, zéro configuration)** : un espace de stockage JSON public
et gratuit (`extendsclass.com/api/json-storage`) sert de registre central.
Son identifiant est déclaré dans `assets/js/api-config.js` :

```js
window.PV_STORE_URL = "https://extendsclass.com/api/json-storage/bin/ffaccce";
```

Aucune inscription, aucune clé d'API, aucun réglage : la publication part
automatiquement à chaque numéro généré dans l'Area riservata, puis elle est
vérifiée par relecture avant d'afficher « 🌐 Online ».

| Fichier | Rôle |
|---|---|
| `assets/js/api-config.js` | URL du registre public (`PV_STORE_URL`) et, facultatif, `PV_API_URL` |
| `assets/js/api.js` | `PV_API` : empreinte SHA-256 du numéro, lecture/écriture JSON, vérification par relecture |
| `google-apps-script/Code.gs` + `GUIDE-BACKEND.md` | Variante privée **facultative** (Google Sheet), utilisée seulement si `PV_API_URL` est renseignée |

**Comportement du tracking** (`tracking.js`) :

1. registre local (agence, même appareil) → affichage immédiat ;
2. sinon, si un registre est configuré (`PV_STORE_URL`, actif par défaut)
   → recherche dans le registre partagé ;
3. si le numéro est inconnu → **« Spedizione non trovata »** (plus de faux suivi) ;
4. si le service est injoignable → message d'erreur réseau + WhatsApp de l'agence ;
5. le mode démo ne s'affiche plus que sur demande explicite (`PV12345678IT`
   ou `?demo=1`), et il est traité **avant** tout appel réseau.

**Après génération** (Area riservata), la confirmation affiche l'état réel de
la publication : « 🌐 Online — consultabile da qualsiasi dispositivo » ou un
avertissement si le registre n'est pas configuré / injoignable.

**Données publiées (vie privée)** : l'espace est lisible publiquement, donc
seules des données **non nominatives** y sont écrites : villes, CAP et
province de départ/arrivée, service, poids, date. Aucun nom, aucune rue,
aucun téléphone, aucun e-mail. Les clés sont l'empreinte SHA-256 du numéro
(`paccoveloce::PV…`) : les colis ne peuvent pas être énumérés. La page de
suivi affiche alors une note « 🔒 Per motivi di privacy… » et masque le
bouton « Stampa etichetta ». L'agence continue de voir les données complètes
sur son propre appareil (registre local).

**Ripubblicazione** : le panneau `admin.html` contient un bouton
« Ripubblica registro online » qui renvoie **toutes** les expéditions locales
vers le registre public — utile si un ancien numéro n'y figure pas encore ou
si l'espace public a été vidé.

**Limites assumées** : la lecture d'un numéro est publique (principe même du
tracking) ; l'écriture est protégée par un jeton partagé visible dans le code
source — protection anti-abus, pas une authentification forte. La page « Le
mie spedizioni » reste locale (elle ne liste que les entrées de l'appareil).

## Feuille de route (prochaines étapes possibles)

1. **Backend** (Node.js/Express ou Flask) : remplacer le `localStorage` par
   un appel `POST /api/spedizioni` dans `PV_Spedizioni.crea()` et
   `GET /api/spedizioni/:numero` dans `trova()` — la structure du record
   (mittente, destinatario, servizio, peso, numero, creatoIl) est déjà prête.
2. **Base de données** : table `spedizioni` (numero S10 unique, statuts,
   étapes datées) pour un tracking multi-appareils :
   `SELECT ... WHERE numero = ?`.
3. **Paiement en ligne** : Stripe / PayPal pour payer la réservation à la
   commande.
4. **Espace client** : inscription/connexion, historique des colis, adresses
   enregistrées.
5. **Géocodage côté serveur** : passer par un service dédié (Nominatim
   auto-hébergé ou fournisseur commercial) avec quota et clé d'API.
6. **Multilingue** : it/fr/en (le contenu actuel est en italien, marché cible
   Italie).
7. **Admin** : ✅ fait (Area riservata `admin.html`, mot de passe `pacco2026`) —
   à faire évoluer : tableau de bord des colis, changement de statut,
   modification du mot de passe.
8. **SEO** : sitemap.xml, robots.txt, balises Open Graph, Google Business.

## Points à adapter pour la mise en production

- Les prix actuels sont des **exemples** : à calibrer selon votre grille.
- Les coordonnées du site sont renseignées (WhatsApp +39 350 870 7243,
  e-mail velocepacco653@gmail.com, siège Via del Fontanile Arenato, 180) :
  à reprendre telles quelles sur Google Business et les mentions légales.
- Le registre des expéditions utilise par défaut **l'espace JSON public**
  (`PV_STORE_URL`) : le suivi fonctionne sur tous les appareils sans aucun
  réglage. Le `localStorage` ne sert plus que de cache local pour l'agence.
  La variante **Apps Script + Google Sheet** (`GUIDE-BACKEND.md`) reste
  disponible comme upgrade privé (données complètes côté serveur).
- Le service public Nominatim a une politique d'usage (1 req/s) : prévoir
  un géocodeur en propre pour la production.
- Les formulaires ne font pas de traitement serveur : à brancher sur votre
  API quand le backend sera en place.