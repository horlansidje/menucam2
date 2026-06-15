const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');

// ──────────────────────────────────────────────────────────
//  Railway : le système de fichiers est ÉPHÉMÈRE
//  → On utilise /tmp pour les données NeDB en production
//  → En local, on utilise ./data (persistant)
//  → Pour une persistance Railway réelle, migrer vers MongoDB Atlas (gratuit)
// ──────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

let dbPath;
if (process.env.DB_PATH) {
  dbPath = process.env.DB_PATH;
} else if (isProduction) {
  dbPath = '/tmp/menucam-data';
  console.log('⚠️  Railway : données NeDB dans /tmp (éphémères). Configurez MONGODB_URI pour persister.');
} else {
  dbPath = path.join(__dirname, '../data');
}

if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

const db = {
  restaurants: new Datastore({ filename: path.join(dbPath, 'restaurants.db'), autoload: true }),
  plats:       new Datastore({ filename: path.join(dbPath, 'plats.db'),       autoload: true }),
  commandes:   new Datastore({ filename: path.join(dbPath, 'commandes.db'),   autoload: true }),
  livreurs:    new Datastore({ filename: path.join(dbPath, 'livreurs.db'),    autoload: true }),
  promos:      new Datastore({ filename: path.join(dbPath, 'promos.db'),      autoload: true }),
  avis:        new Datastore({ filename: path.join(dbPath, 'avis.db'),        autoload: true }),
  categories:  new Datastore({ filename: path.join(dbPath, 'categories.db'),  autoload: true }),
  fidelite:    new Datastore({ filename: path.join(dbPath, 'fidelite.db'),    autoload: true }),
};

db.restaurants.ensureIndex({ fieldName: 'email', unique: true });
db.restaurants.ensureIndex({ fieldName: 'slug' });
db.plats.ensureIndex({ fieldName: 'restaurant_id' });
db.commandes.ensureIndex({ fieldName: 'restaurant_id' });
db.commandes.ensureIndex({ fieldName: 'num_commande' });
db.categories.ensureIndex({ fieldName: 'restaurant_id' });
db.fidelite.ensureIndex({ fieldName: 'restaurant_id' });

module.exports = db;
