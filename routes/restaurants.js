const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { calculerStatut } = require('./horaires');

/**
 * Génère un slug URL-friendly depuis un nom de restaurant.
 */
function slugify(nom) {
  return nom.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlever accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// GET /restaurants — page de recherche publique
router.get('/', async (req, res) => {
  const { q, ville } = req.query;
  let query = { actif: true };
  let restaurants = await db.restaurants.findAsync(query);

  if (q && q.trim()) {
    const re = new RegExp(q.trim(), 'i');
    restaurants = restaurants.filter(r => re.test(r.nom) || re.test(r.description || '') || re.test(r.ville || ''));
  }
  if (ville && ville.trim()) {
    restaurants = restaurants.filter(r => (r.ville || '').toLowerCase().includes(ville.toLowerCase()));
  }

  // Calculer statut ouverture pour chaque restaurant
  restaurants = restaurants.map(r => ({ ...r, statut_ouverture: calculerStatut(r) }));

  // Liste des villes disponibles
  const villes = [...new Set((await db.restaurants.findAsync({ actif: true })).map(r => r.ville).filter(Boolean))].sort();

  res.render('public/restaurants', { restaurants, villes, q: q || '', ville: ville || '' });
});

// GET /restaurants/:slug — menu public via slug
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    // Chercher par slug d'abord, sinon par _id (rétrocompatibilité)
    let restaurant = await db.restaurants.findOneAsync({ slug, actif: true });
    if (!restaurant) restaurant = await db.restaurants.findOneAsync({ _id: slug, actif: true });
    if (!restaurant) return res.render('client/menu-404');

    const plats = await db.plats.findAsync({ restaurant_id: restaurant._id, disponible: true });
    const promos = await db.promos.findAsync({ restaurant_id: restaurant._id, actif: true });
    promos.forEach(p => {
      if (p.plat_id) {
        const plat = plats.find(pl => pl._id === p.plat_id);
        if (plat) plat.promo_prix = p.type === 'pourcentage' ? Math.round(plat.prix * (1 - p.valeur / 100)) : plat.prix - p.valeur;
      }
    });
    const categories = {};
    plats.forEach(p => { if (!categories[p.categorie]) categories[p.categorie] = []; categories[p.categorie].push(p); });
    const avis = (await db.avis.findAsync({ restaurant_id: restaurant._id }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

    const statut_ouverture = calculerStatut(restaurant);

    res.render('client/menu', { restaurant, categories, plats, avis, statut_ouverture });
  } catch (err) {
    console.error(err);
    res.render('client/menu-404');
  }
});

module.exports = router;
module.exports.slugify = slugify;
