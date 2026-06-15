const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

router.post('/nouveau', async (req, res) => {
  const { restaurant_id, note, texte, client_nom } = req.body;
  if (!restaurant_id || !note) return res.json({ ok:false });
  await db.avis.insertAsync({ restaurant_id, note: parseInt(note), texte: texte||'', client_nom: client_nom||'Client anonyme', reponse:null, createdAt:new Date() });
  const tousAvis = await db.avis.findAsync({ restaurant_id });
  const moy = tousAvis.reduce((s,a)=>s+a.note,0)/tousAvis.length;
  await db.restaurants.updateAsync({ _id: restaurant_id }, { $set: { note_moyenne: Math.round(moy*10)/10, nb_avis: tousAvis.length } });
  res.json({ ok:true });
});
router.get('/', requireAuth, async (req, res) => {
  const avis = await db.avis.findAsync({ restaurant_id: req.session.restaurantId });
  avis.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const moy = avis.length ? (avis.reduce((s,a)=>s+a.note,0)/avis.length).toFixed(1) : 0;
  const distrib = [5,4,3,2,1].map(n=>({ note:n, count:avis.filter(a=>a.note===n).length }));
  res.render('restaurateur/avis', { avis, moyenne:moy, distrib, total:avis.length, error:req.flash('error'), success:req.flash('success') });
});
router.post('/:id/repondre', requireAuth, async (req, res) => {
  await db.avis.updateAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId }, { $set: { reponse: req.body.reponse, repondu_le: new Date() } });
  req.flash('success','Réponse publiée !');
  res.redirect('/avis');
});
module.exports = router;
