# 🔧 Variante privée du registre partagé (facultative)

> ℹ️ **Le suivi multi-appareils fonctionne déjà, sans rien installer.**
> `assets/js/api-config.js` pointe vers un espace JSON public
> (`PV_STORE_URL`) : chaque numéro généré dans l'Area riservata y est publié
> automatiquement, et les clients le consultent depuis n'importe quel
> appareil. Ce guide n'est utile que si tu veux **en plus** une copie privée
> dans un Google Sheet (données complètes, y compris noms et adresses).

## Pourquoi ce guide ?

Le site est **statique** : jusqu'ici, quand tu générais un numéro dans l'Area
riservata, il était enregistré dans le **navigateur de ton ordinateur**
(`localStorage`). Résultat : le numéro s'affichait pour toi, mais **pas** pour
le client, ni depuis ton téléphone, ni depuis un autre PC.

Ce guide met en place un **registre unique et partagé**, hébergé chez Google,
**gratuit et sans serveur à payer** : Google Apps Script + Google Sheet.

Une fois installé :

- chaque numéro généré est **publié en ligne** ;
- le client le saisit sur la page Tracking depuis **n'importe quel appareil** ;
- tu retrouves toutes tes expéditions dans une **feuille Google Sheets** ;
- tu peux même **ajouter ou corriger une ligne directement dans la feuille** et
  le tracking du site est mis à jour immédiatement.

Durée : environ **5 minutes**, une seule fois.

---

## Étape 1 — Créer le script

1. Va sur **https://script.google.com** (connecte-toi avec
   **velocepacco653@gmail.com**).
2. Clique sur **« Nouveau projet »**.
3. Renomme le projet : *PaccoVeloce — Registre*.
4. Supprime le contenu par défaut de `Code.gs`.
5. Ouvre le fichier **`google-apps-script/Code.gs`** du projet PaccoVeloce,
   copie **tout** son contenu et colle-le dans l'éditeur.
6. Clique sur 💾 **Enregistrer**.

## Étape 2 — Initialiser la feuille

1. En haut de l'éditeur, dans la liste des fonctions, choisis **`setup`**.
2. Clique sur ▶ **Exécuter**.
3. Google demande l'autorisation : **Autoriser** → choisis ton compte →
   *Paramètres avancés* → **Accéder à « PaccoVeloce — Registre » (non vérifié)**
   → **Continuer** → **Autoriser**.
4. La feuille **« PaccoVeloce — Registro spedizioni »** est créée dans ton
   Google Drive, avec l'onglet `Spedizioni` et ses colonnes.

> C'est normal que Google affiche un avertissement : le script est le tien,
> il n'est pas publié sur la place publique.

## Étape 3 — Publier l'application web

1. En haut à droite : **Déployer** → **Nouveau déploiement**.
2. Roue crantée ⚙️ → type **Application web**.
3. Renseigne :
   - **Description** : `Registre PaccoVeloce`
   - **Exécuter en tant que** : **Moi (velocepacco653@gmail.com)**
   - **Qui a accès** : **Tous** *(indispensable : le site doit pouvoir lire
     les numéros sans connexion Google)*
4. **Déployer** → **Autoriser l'accès** si demandé.
5. Copie l'**URL de l'application web** : elle ressemble à
   ```
   https://script.google.com/macros/s/AKfycb..................../exec
   ```

## Étape 4 — Brancher le site

1. Ouvre le fichier **`assets/js/api-config.js`**.
2. Colle l'URL entre les guillemets :

   ```js
   window.PV_API_URL = "https://script.google.com/macros/s/AKfycb..../exec";
   ```

3. Enregistre, puis publie le site (commit + push sur GitHub, ou renvoie-moi
   l'URL et je le fais).

## Étape 5 — Vérifier

1. Ouvre **`admin.html`**, entre le mot de passe, génère une livraison.
2. Sous le numéro, un message doit apparaître :
   **« 🌐 Online — questo numero è ora consultabile da qualsiasi dispositivo »**.
3. Ouvre la feuille Google : la ligne doit y être.
4. Ouvre `suivi.html` **depuis ton téléphone** (en 4G, pas en Wi-Fi), saisis le
   numéro : le suivi doit s'afficher.

---

## Questions fréquentes

**Le site affiche « Registro condiviso non configurato »**
→ `api-config.js` est vide : reprends l'étape 4.

**Le site affiche « Pubblicazione online non riuscita »**
→ Vérifie que le déploiement est bien réglé sur **Qui a accès : Tous**, et que
l'URL se termine par `/exec` (pas `/dev`).

**J'ai modifié `Code.gs`, faut-il redéployer ?**
→ Oui : **Déployer → Gérer les déploiements → ✏️ → Version : Nouvelle version
→ Déployer**. L'URL reste la même.

**Les données sont-elles protégées ?**
→ La **lecture** d'un numéro est publique (comme tout service de tracking :
c'est le principe même du suivi). Les **téléphones** ne sont pas renvoyés au
public (`NASCONDI_TELEFONI = true`). L'**écriture** est protégée par un jeton
partagé (`TOKEN`) : garde-le privé, mais sache qu'il est visible dans le code
source du site — c'est une protection anti-abus, pas une authentification
forte. Pour aller plus loin : backend avec compte + base de données.

**Combien ça coûte ?**
→ Rien. Le quota gratuit d'Apps Script (20 000 requêtes/jour) est très
largement suffisant.

**Et si je veux changer le mot de passe admin ?**
→ Il est dans `assets/js/admin.js` (`var PASSWORD = "pacco2026";`).
