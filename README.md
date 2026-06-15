# 🍽️ MenuCam V3 — Plateforme SaaS de Gestion Restaurant

MenuCam est une plateforme web complète permettant aux restaurateurs de gérer leurs menus, commandes, livraisons et paiements mobiles (CinetPay, MTN MoMo, Orange Money, Stripe).

---

## 🚀 Démarrage rapide (local)

### Prérequis
- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

```bash
# 1. Cloner le projet
git clone https://github.com/votre-username/menucam.git
cd menucam

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditez .env avec vos vraies valeurs

# 4. Lancer le serveur de développement
npm run dev

# Le projet tourne sur http://localhost:3000
# Compte démo : demo@menucam.cm / demo1234
```

---

## ⚙️ Configuration — Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `PORT` | Port du serveur (Railway le gère automatiquement) | Non |
| `NODE_ENV` | `production` ou `development` | Oui en prod |
| `APP_URL` | URL publique Railway (ex: `https://menucam.up.railway.app`) | Oui en prod |
| `SESSION_SECRET` | Clé secrète sessions (min 32 chars) | Oui |
| `CINETPAY_APIKEY` | Clé API CinetPay (paiements Afrique) | Optionnel |
| `CINETPAY_SITE_ID` | ID Site CinetPay | Optionnel |
| `MTN_SUBSCRIPTION_KEY` | Clé MTN MoMo API | Optionnel |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe | Optionnel |

> Consultez `.env.example` pour la liste complète.

---

## 🚂 Déploiement Railway (100% gratuit)

### Étape 1 — Créer un compte Railway

1. Allez sur [railway.app](https://railway.app)
2. Cliquez **"Start a New Project"**
3. Connectez-vous avec **GitHub** (recommandé)
4. Vérifiez votre compte (email de confirmation)

> 💡 Railway offre **500h gratuites/mois** + **512MB RAM** — suffisant pour MenuCam.

---

### Étape 2 — Préparer le projet Git

```bash
# Dans le dossier du projet
cd menucam

# Initialiser Git (si pas encore fait)
git init

# Ajouter tous les fichiers (node_modules et .env sont exclus par .gitignore)
git add .

# Premier commit
git commit -m "feat: MenuCam V3 — deploy ready"
```

---

### Étape 3 — Créer le repo GitHub

```bash
# Créez un repo sur https://github.com/new (nommez-le "menucam")
# Puis liez le repo local :

git remote add origin https://github.com/VOTRE_USERNAME/menucam.git
git branch -M main
git push -u origin main
```

---

### Étape 4 — Déployer sur Railway

1. Sur [railway.app](https://railway.app), cliquez **"New Project"**
2. Choisissez **"Deploy from GitHub repo"**
3. Sélectionnez votre repo **menucam**
4. Railway détecte automatiquement Node.js et lance le build

---

### Étape 5 — Configurer les variables d'environnement

1. Dans Railway, cliquez sur votre service **menucam**
2. Onglet **"Variables"**
3. Cliquez **"Add Variable"** et ajoutez :

```
NODE_ENV          = production
SESSION_SECRET    = une_cle_tres_longue_et_aleatoire_generee_ici
APP_URL           = https://votre-app.up.railway.app   ← à mettre APRÈS déploiement
DELAI_ANNULATION_MIN = 5
```

> 🔑 Générez une SESSION_SECRET sécurisée : [passwordsgenerator.net](https://passwordsgenerator.net) — 64 caractères.

---

### Étape 6 — Récupérer l'URL publique

1. Onglet **"Settings"** de votre service
2. Section **"Domains"** → cliquez **"Generate Domain"**
3. Copiez l'URL (ex: `https://menucam-production.up.railway.app`)
4. Retournez dans **Variables** et mettez à jour `APP_URL` avec cette URL

---

### Étape 7 — Vérifier le déploiement

1. Onglet **"Deployments"** → vous voyez les logs en temps réel
2. Attendez le message : `✅ MenuCam V3 démarré sur le port XXXX`
3. Visitez votre URL publique
4. Testez : `https://votre-app.up.railway.app/health`

---

## ⚠️ Avertissement important : Persistance des données

MenuCam utilise **NeDB** (base de données fichier). Sur Railway :

- ✅ **Fonctionne** : le projet démarre et tourne correctement
- ⚠️ **Données éphémères** : les données sont perdues à chaque redéploiement
- ✅ **Auto-seed** : un restaurant démo est recréé automatiquement au démarrage

### Solution recommandée pour la production : MongoDB Atlas (gratuit)

1. Créez un compte sur [mongodb.com/atlas](https://www.mongodb.com/atlas/database)
2. Créez un cluster gratuit (M0 — 512MB)
3. Obtenez votre URI de connexion
4. Ajoutez `MONGODB_URI` dans les variables Railway

---

## 🔧 Commandes Git utiles

```bash
# Mettre à jour après modifications
git add .
git commit -m "fix: correction bug paiement"
git push

# Railway redéploie automatiquement après chaque push !

# Voir les logs Railway depuis le terminal
npx railway logs

# Variables d'environnement Railway depuis le terminal
npx railway variables
```

---

## 🏗️ Architecture du projet

```
menucam/
├── server.js           # Point d'entrée principal
├── package.json        # Dépendances et scripts
├── railway.json        # Configuration Railway
├── nixpacks.toml       # Build Railway optimisé
├── .env.example        # Template variables d'environnement
├── models/
│   └── db.js           # Base de données NeDB
├── routes/             # Routes Express
│   ├── auth.js         # Authentification
│   ├── dashboard.js    # Tableau de bord restaurateur
│   ├── plats.js        # Gestion des plats
│   ├── commandes.js    # Gestion des commandes
│   ├── menu.js         # Menu public client
│   ├── paiement.js     # Paiements (CinetPay, MTN, Stripe)
│   └── ...
├── services/
│   └── paiement.js     # Service paiement unifié
├── middleware/
│   └── auth.js         # Middleware authentification
├── views/              # Templates EJS
│   ├── restaurateur/   # Interface restaurateur
│   ├── client/         # Interface client
│   ├── livreur/        # Interface livreur
│   └── public/         # Pages publiques
└── public/             # Assets statiques
    ├── css/
    ├── js/
    └── uploads/        # Images uploadées
```

---

## 🐛 Erreurs Railway fréquentes et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Cannot find module` | Dépendance manquante | Vérifiez `package.json`, relancez le déploiement |
| `Port already in use` | PORT mal configuré | Utilisez `process.env.PORT` (déjà fait) |
| `ENOENT: no such file` | Dossier `data/` manquant | Géré automatiquement par `db.js` |
| `Session cookie secure` | HTTPS requis | `trust proxy` activé dans server.js |
| Build timeout | `node_modules` dans le repo | Vérifiez `.gitignore` |
| App crashe au boot | Erreur dans les routes | Consultez les logs onglet "Deployments" |

---

## 📞 Compte démo

Après le premier démarrage (base vide), un restaurant démo est créé :

- **Email** : demo@menucam.cm
- **Mot de passe** : demo1234

---

## 📝 Licence

MenuCam V3 — Développé au Cameroun 🇨🇲
