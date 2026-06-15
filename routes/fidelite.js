const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

// GET /fidelite — dashboard fidélité
router.get('/', requireAuth, async (req, res) => {
  const rid = req.session.restaurantId;
  const restaurant = await db.restaurants.findOneAsync({ _id: rid });
  const config = restaurant.fidelite_config || { actif: false, montant_min: 50000, description: '' };

  // Calculer les clients fidèles (montant mensuel)
  const debut_mois = new Date();
  debut_mois.setDate(1); debut_mois.setHours(0, 0, 0, 0);

  const commandes_mois = await db.commandes.findAsync({
    restaurant_id: rid,
    statut: { $nin: ['annulee'] },
    createdAt: { $gte: debut_mois }
  });

  // Agréger par téléphone client
  const clientMap = {};
  commandes_mois.forEach(cmd => {
    const key = cmd.client_telephone || cmd.client_nom;
    if (!clientMap[key]) clientMap[key] = { nom: cmd.client_nom, telephone: cmd.client_telephone || '', total: 0, nb: 0 };
    clientMap[key].total += cmd.total || 0;
    clientMap[key].nb++;
  });

  const clients = Object.values(clientMap).sort((a, b) => b.total - a.total);
  const clients_fideles = config.montant_min > 0 ? clients.filter(c => c.total >= config.montant_min) : [];

  // Historique des récompenses
  const recompenses = await db.fidelite.findAsync({ restaurant_id: rid });
  recompenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('restaurateur/fidelite', {
    config, clients, clients_fideles, recompenses,
    error:   req.flash('error'),
    success: req.flash('success')
  });
});

// POST /fidelite/config — configurer le programme
router.post('/config', requireAuth, async (req, res) => {
  const { actif, montant_min, description } = req.body;
  const config = {
    actif: actif === 'on',
    montant_min: parseFloat(montant_min) || 50000,
    description: description || ''
  };
  await db.restaurants.updateAsync(
    { _id: req.session.restaurantId },
    { $set: { fidelite_config: config } }
  );
  req.flash('success', 'Programme de fidélité mis à jour !');
  res.redirect('/fidelite');
});

// POST /fidelite/offre — créer une offre manuelle
router.post('/offre', requireAuth, async (req, res) => {
  const { client_nom, client_telephone, type_offre, valeur, note } = req.body;
  if (!client_nom || !type_offre) {
    req.flash('error', 'Nom du client et type d\'offre requis.');
    return res.redirect('/fidelite');
  }
  await db.fidelite.insertAsync({
    restaurant_id: req.session.restaurantId,
    client_nom, client_telephone: client_telephone || '',
    type_offre, valeur: valeur || '',
    note: note || '',
    statut: 'envoyee',
    createdAt: new Date()
  });
  req.flash('success', `Offre envoyée à ${client_nom} !`);
  res.redirect('/fidelite');
});

// POST /fidelite/:id/supprimer
router.post('/:id/supprimer', requireAuth, async (req, res) => {
  await db.fidelite.removeAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  req.flash('success', 'Récompense supprimée.');
  res.redirect('/fidelite');
});

// API — vérifier automatiquement les clients fidèles et créer récompenses auto
router.post('/api/check-fidelite', async (req, res) => {
  try {
    const { restaurant_id, client_telephone, client_nom, total_commande } = req.body;
    if (!restaurant_id) return res.json({ ok: false });
    
    const restaurant = await db.restaurants.findOneAsync({ _id: restaurant_id });
    if (!restaurant) return res.json({ ok: false });
    
    const config = restaurant.fidelite_config;
    if (!config || !config.actif || !config.montant_min) return res.json({ ok: false, offre: null });

    // Calculer total mensuel de ce client
    const debut_mois = new Date(); debut_mois.setDate(1); debut_mois.setHours(0, 0, 0, 0);
    const key = client_telephone || client_nom;
    const cmds = await db.commandes.findAsync({
      restaurant_id,
      $or: [{ client_telephone: key }, { client_nom: key }],
      statut: { $nin: ['annulee'] },
      createdAt: { $gte: debut_mois }
    });
    const totalMois = cmds.reduce((s, c) => s + (c.total || 0), 0) + (parseFloat(total_commande) || 0);

    if (totalMois >= config.montant_min) {
      // Vérifier si déjà récompensé ce mois
      const dejaRecompense = await db.fidelite.findOneAsync({
        restaurant_id,
        $or: [{ client_telephone: key }, { client_nom: key }],
        createdAt: { $gte: debut_mois }
      });
      if (!dejaRecompense) {
        await db.fidelite.insertAsync({
          restaurant_id,
          client_nom, client_telephone: client_telephone || '',
          type_offre: 'auto',
          valeur: config.description || '10% de réduction',
          note: `Récompense automatique — ${totalMois.toLocaleString('fr-FR')} FCFA ce mois`,
          statut: 'auto',
          createdAt: new Date()
        });
        return res.json({ ok: true, offre: { message: `🎁 Félicitations ! ${config.description || 'Vous avez gagné une récompense fidélité !'}`, total: totalMois } });
      }
    }
    res.json({ ok: false, offre: null });
  } catch (err) {
    console.error(err);
    res.json({ ok: false });
  }
});

module.exports = router;
