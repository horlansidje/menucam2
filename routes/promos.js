const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const promos = await db.promos.findAsync({ restaurant_id: req.session.restaurantId });
  res.render('restaurateur/promos', { promos: promos.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)), error: req.flash('error'), success: req.flash('success') });
});
router.post('/nouvelle', requireAuth, async (req, res) => {
  const { code, type, valeur, min_commande, max_utilisations, date_fin, description } = req.body;
  if (!code || !type || !valeur) { req.flash('error','Code, type et valeur requis.'); return res.redirect('/promos'); }
  const existing = await db.promos.findOneAsync({ restaurant_id: req.session.restaurantId, code: code.toUpperCase() });
  if (existing) { req.flash('error','Ce code existe déjà.'); return res.redirect('/promos'); }
  await db.promos.insertAsync({ restaurant_id: req.session.restaurantId, code: code.toUpperCase(), type, valeur: parseFloat(valeur), min_commande: parseFloat(min_commande)||0, max_utilisations: parseInt(max_utilisations)||999, utilisations:0, date_fin: date_fin?new Date(date_fin):null, description:description||'', actif:true, createdAt:new Date() });
  req.flash('success',`Code ${code.toUpperCase()} créé !`);
  res.redirect('/promos');
});
router.post('/:id/toggle', requireAuth, async (req, res) => {
  const p = await db.promos.findOneAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  if (p) await db.promos.updateAsync({ _id: p._id }, { $set: { actif: !p.actif } });
  res.json({ ok:true, actif: !p?.actif });
});
router.post('/:id/supprimer', requireAuth, async (req, res) => {
  await db.promos.removeAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  req.flash('success','Promo supprimée.');
  res.redirect('/promos');
});
router.post('/verifier', async (req, res) => {
  const { code, restaurant_id, total } = req.body;
  const promo = await db.promos.findOneAsync({ restaurant_id, code: code.toUpperCase(), actif: true });
  if (!promo) return res.json({ ok:false, message:'Code invalide.' });
  if (promo.date_fin && new Date() > new Date(promo.date_fin)) return res.json({ ok:false, message:'Code expiré.' });
  if (promo.utilisations >= promo.max_utilisations) return res.json({ ok:false, message:'Code épuisé.' });
  if (total < promo.min_commande) return res.json({ ok:false, message:`Min : ${promo.min_commande.toLocaleString('fr-FR')} FCFA` });
  const reduction = promo.type === 'pourcentage' ? Math.round(total * promo.valeur / 100) : promo.valeur;
  res.json({ ok:true, promo, reduction, message:`✅ -${promo.type==='pourcentage'?promo.valeur+'%':promo.valeur.toLocaleString('fr-FR')+' FCFA'}` });
});
module.exports = router;
