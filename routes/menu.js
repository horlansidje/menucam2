const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { calculerStatut } = require('./horaires');

router.get('/:restaurant_id', async (req, res) => {
  try {
    const restaurant = await db.restaurants.findOneAsync({ _id: req.params.restaurant_id });
    if (!restaurant || !restaurant.actif) return res.render('client/menu-404');
    const plats  = await db.plats.findAsync({ restaurant_id: req.params.restaurant_id, disponible: true });
    const promos = await db.promos.findAsync({ restaurant_id: req.params.restaurant_id, actif: true });
    promos.forEach(p => {
      if (p.plat_id) {
        const plat = plats.find(pl => pl._id === p.plat_id);
        if (plat) plat.promo_prix = p.type === 'pourcentage' ? Math.round(plat.prix * (1 - p.valeur/100)) : plat.prix - p.valeur;
      }
    });
    
    // Récupérer ordre des catégories depuis la collection categories
    const catsDef = await db.categories.findAsync({ restaurant_id: req.params.restaurant_id, actif: true });
    catsDef.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    const catOrder = catsDef.map(c => c.nom);
    
    // Construire categories dans l'ordre
    const categories = {};
    // D'abord les catégories définies dans l'ordre
    catOrder.forEach(nom => {
      const ps = plats.filter(p => p.categorie === nom);
      if (ps.length > 0) categories[nom] = ps;
    });
    // Puis les plats avec catégories non définies
    plats.forEach(p => {
      if (!categories[p.categorie]) {
        categories[p.categorie] = [];
      }
      if (!catOrder.includes(p.categorie)) {
        categories[p.categorie].push(p);
      }
    });

    const avis = (await db.avis.findAsync({ restaurant_id: req.params.restaurant_id }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

    const statut_ouverture = calculerStatut(restaurant);

    res.render('client/menu', { restaurant, categories, plats, avis, statut_ouverture });
  } catch(err) { console.error(err); res.render('client/menu-404'); }
});

module.exports = router;
