const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_LABELS = { lundi:'Lundi', mardi:'Mardi', mercredi:'Mercredi', jeudi:'Jeudi', vendredi:'Vendredi', samedi:'Samedi', dimanche:'Dimanche' };

// GET /horaires
router.get('/', requireAuth, async (req, res) => {
  const restaurant = await db.restaurants.findOneAsync({ _id: req.session.restaurantId });
  const horaires = restaurant.horaires || {};
  const statut_manuel = restaurant.statut_manuel || 'auto'; // auto | ouvert | ferme | indisponible
  res.render('restaurateur/horaires', {
    horaires, JOURS, JOURS_LABELS, statut_manuel,
    error:   req.flash('error'),
    success: req.flash('success')
  });
});

// POST /horaires/sauvegarder
router.post('/sauvegarder', requireAuth, async (req, res) => {
  const horaires = {};
  JOURS.forEach(jour => {
    const ferme = req.body[`${jour}_ferme`] === 'on';
    horaires[jour] = {
      ferme,
      ouverture: ferme ? null : (req.body[`${jour}_ouverture`] || '08:00'),
      fermeture: ferme ? null : (req.body[`${jour}_fermeture`] || '22:00')
    };
  });
  await db.restaurants.updateAsync(
    { _id: req.session.restaurantId },
    { $set: { horaires, updatedAt: new Date() } }
  );
  req.flash('success', 'Horaires enregistrés !');
  res.redirect('/horaires');
});

// POST /horaires/statut
router.post('/statut', requireAuth, async (req, res) => {
  const { statut_manuel } = req.body;
  const valides = ['auto', 'ouvert', 'ferme', 'indisponible'];
  if (!valides.includes(statut_manuel)) return res.json({ ok: false });
  await db.restaurants.updateAsync(
    { _id: req.session.restaurantId },
    { $set: { statut_manuel } }
  );
  res.json({ ok: true, statut_manuel });
});

// API publique — statut d'ouverture
router.get('/api/statut/:restaurant_id', async (req, res) => {
  const restaurant = await db.restaurants.findOneAsync({ _id: req.params.restaurant_id });
  if (!restaurant) return res.json({ ok: false });
  res.json(calculerStatut(restaurant));
});

/**
 * Calcule si le restaurant est ouvert selon les horaires et le statut manuel.
 */
function calculerStatut(restaurant) {
  const statut_manuel = restaurant.statut_manuel || 'auto';
  if (statut_manuel === 'ouvert')        return { ouvert: true,  message: '✅ Ouvert',                  statut: 'ouvert' };
  if (statut_manuel === 'ferme')         return { ouvert: false, message: '🔴 Fermé',                   statut: 'ferme' };
  if (statut_manuel === 'indisponible')  return { ouvert: false, message: '⏸️ Temporairement indisponible', statut: 'indisponible' };

  // Mode auto — calcul selon l'heure actuelle
  const horaires = restaurant.horaires;
  if (!horaires) return { ouvert: true, message: '✅ Ouvert', statut: 'ouvert' };

  const now = new Date();
  const JOURS_EN = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const jour = JOURS_EN[now.getDay()];
  const h = horaires[jour];

  if (!h || h.ferme) return { ouvert: false, message: '🔴 Fermé aujourd\'hui', statut: 'ferme' };

  const [hOuv, mOuv] = (h.ouverture || '00:00').split(':').map(Number);
  const [hFerm, mFerm] = (h.fermeture || '23:59').split(':').map(Number);
  const minutesNow  = now.getHours() * 60 + now.getMinutes();
  const minutesOuv  = hOuv * 60 + mOuv;
  const minutesFerm = hFerm * 60 + mFerm;

  if (minutesNow >= minutesOuv && minutesNow < minutesFerm) {
    // Ferme dans moins d'1h ?
    const restant = minutesFerm - minutesNow;
    if (restant <= 60) return { ouvert: true, message: `⚠️ Ferme à ${h.fermeture}`, statut: 'ferme_bientot' };
    return { ouvert: true, message: `✅ Ouvert jusqu'à ${h.fermeture}`, statut: 'ouvert' };
  }
  // Donne l'heure d'ouverture
  if (minutesNow < minutesOuv) return { ouvert: false, message: `⏰ Ouvre à ${h.ouverture}`, statut: 'ferme' };
  return { ouvert: false, message: '🔴 Fermé', statut: 'ferme' };
}

module.exports = router;
module.exports.calculerStatut = calculerStatut;
