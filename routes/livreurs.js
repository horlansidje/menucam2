const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const livreurs = await db.livreurs.findAsync({ restaurant_id: req.session.restaurantId });
  res.render('restaurateur/livreurs', { livreurs, error: req.flash('error'), success: req.flash('success') });
});
router.post('/nouveau', requireAuth, async (req, res) => {
  const { nom, telephone, moto, zone } = req.body;
  if (!nom || !telephone) { req.flash('error','Nom et téléphone requis.'); return res.redirect('/livreurs'); }
  await db.livreurs.insertAsync({ restaurant_id: req.session.restaurantId, nom, telephone, moto:moto||'', zone:zone||'', statut:'disponible', commandes_livrees:0, createdAt:new Date() });
  req.flash('success',`Livreur ${nom} ajouté !`);
  res.redirect('/livreurs');
});
router.post('/:id/statut', requireAuth, async (req, res) => {
  await db.livreurs.updateAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId }, { $set: { statut: req.body.statut } });
  res.json({ ok:true });
});
router.post('/:id/supprimer', requireAuth, async (req, res) => {
  await db.livreurs.removeAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  req.flash('success','Livreur supprimé.');
  res.redirect('/livreurs');
});
module.exports = router;
