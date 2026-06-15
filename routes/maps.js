const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

// Coordonnées des quartiers principaux de Douala (fallback si pas de coords GPS)
const QUARTIERS_COORDS = {
  'akwa':          [4.0511,  9.7034],
  'bonanjo':       [4.0469,  9.6975],
  'bonamoussadi':  [4.0789,  9.7345],
  'bonapriso':     [4.0534,  9.7123],
  'deido':         [4.0695,  9.7198],
  'bali':          [4.0621,  9.7267],
  'makepe':        [4.0834,  9.7456],
  'logpom':        [4.0923,  9.7512],
  'ndogbong':      [4.0756,  9.7189],
  'kotto':         [4.0345,  9.7678],
  'village':       [4.0290,  9.7534],
  'new bell':      [4.0612,  9.7289],
  'newbell':       [4.0612,  9.7289],
  'bepanda':       [4.0701,  9.7401],
  'cite sic':      [4.0445,  9.7234],
  'cite des palmiers': [4.0567, 9.7312],
  'pk':            [4.0812,  9.7534],
  'ndokoti':       [4.0678,  9.7423],
  'douala':        [4.0511,  9.7679],
};

function coordsFromQuartier(quartier) {
  if (!quartier) return null;
  const q = quartier.toLowerCase().trim();
  for (const [key, coords] of Object.entries(QUARTIERS_COORDS)) {
    if (q.includes(key)) return coords;
  }
  return QUARTIERS_COORDS['douala']; // fallback centre Douala
}

// GET commandes livraison avec coordonnées (pour les cartes)
router.get('/commandes', requireAuth, async (req, res) => {
  try {
    const commandes = await db.commandes.findAsync({
      restaurant_id: req.session.restaurantId,
      type_livraison: 'livraison',
    });

    const result = commandes
      .filter(c => !['annulee'].includes(c.statut))
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(c => {
        // Utiliser coords GPS si disponibles, sinon quartier
        let lat = c.lat || null;
        let lng = c.lng || null;
        if (!lat && c.client_quartier) {
          const fallback = coordsFromQuartier(c.client_quartier);
          if (fallback) { lat = fallback[0]; lng = fallback[1]; }
        }
        if (!lat && c.client_adresse) {
          const fallback = coordsFromQuartier(c.client_adresse);
          if (fallback) { lat = fallback[0]; lng = fallback[1]; }
        }
        return { ...c, lat, lng };
      });

    res.json(result);
  } catch(err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// POST sauvegarder coords GPS d'une commande
router.post('/commande/:id/coords', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.json({ ok: false });
    await db.commandes.updateAsync(
      { _id: req.params.id },
      { $set: { lat: parseFloat(lat), lng: parseFloat(lng) } }
    );
    res.json({ ok: true });
  } catch(err) {
    res.status(500).json({ ok: false });
  }
});

// GET infos restaurant (coords)
router.get('/restaurant', requireAuth, async (req, res) => {
  const r = await db.restaurants.findOneAsync({ _id: req.session.restaurantId });
  if (!r) return res.json(null);
  res.json({
    _id: r._id, nom: r.nom, adresse: r.adresse, ville: r.ville,
    lat: r.lat || 4.0511, lng: r.lng || 9.7034, // Douala Akwa par défaut
  });
});

module.exports = router;
