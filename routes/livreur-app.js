const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

// ── Middleware auth livreur ───────────────────────────────────
function requireLivreur(req, res, next) {
  if (req.session?.livreurId) return next();
  res.redirect('/livreur/login');
}

// ── GET login livreur ─────────────────────────────────────────
router.get('/login', (req, res) => {
  res.render('livreur/login', { error: req.flash('error') });
});

// ── POST login livreur ────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { telephone, password } = req.body;
    if (!telephone || !password) {
      req.flash('error', 'Téléphone et mot de passe requis.');
      return res.redirect('/livreur/login');
    }
    const livreur = await db.livreurs.findOneAsync({ telephone: telephone.trim() });
    if (!livreur) {
      req.flash('error', 'Téléphone introuvable.');
      return res.redirect('/livreur/login');
    }
    if (!livreur.password) {
      req.flash('error', 'Aucun mot de passe défini. Contactez votre restaurant.');
      return res.redirect('/livreur/login');
    }
    const ok = await bcrypt.compare(password, livreur.password);
    if (!ok) {
      req.flash('error', 'Mot de passe incorrect.');
      return res.redirect('/livreur/login');
    }
    req.session.livreurId  = livreur._id;
    req.session.livreurNom = livreur.nom;
    req.session.restaurantId_livreur = livreur.restaurant_id;
    res.redirect('/livreur/dashboard');
  } catch(err) {
    console.error(err);
    req.flash('error', 'Erreur serveur.');
    res.redirect('/livreur/login');
  }
});

// ── GET déconnexion livreur ───────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.livreurId  = null;
  req.session.livreurNom = null;
  req.session.restaurantId_livreur = null;
  res.redirect('/livreur/login');
});

// ── GET dashboard livreur ─────────────────────────────────────
router.get('/dashboard', requireLivreur, async (req, res) => {
  try {
    const livreur = await db.livreurs.findOneAsync({ _id: req.session.livreurId });
    if (!livreur) return res.redirect('/livreur/login');

    const restaurant = await db.restaurants.findOneAsync({ _id: livreur.restaurant_id });

    // Commandes assignées à ce livreur
    const commandes = await db.commandes.findAsync({
      livreur_id: req.session.livreurId,
      statut: { $in: ['en_preparation', 'en_livraison'] }
    });
    commandes.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Historique livraisons du jour
    const today = new Date(); today.setHours(0,0,0,0);
    const historique = (await db.commandes.findAsync({
      livreur_id: req.session.livreurId,
      statut: { $in: ['livree','servie'] }
    })).filter(c => new Date(c.createdAt) >= today);

    const caJour = historique.reduce((s,c) => s + (c.total||0), 0);

    res.render('livreur/dashboard', {
      livreur, restaurant,
      commandes, historique,
      stats: {
        enCours:    commandes.filter(c => c.statut === 'en_livraison').length,
        enAttente:  commandes.filter(c => c.statut === 'en_preparation').length,
        livreesJour: historique.length,
        caJour,
      }
    });
  } catch(err) {
    console.error(err);
    res.redirect('/livreur/login');
  }
});

// ── POST mettre à jour statut depuis interface livreur ────────
router.post('/commande/:id/statut', requireLivreur, async (req, res) => {
  try {
    const { statut } = req.body;
    const valides = ['en_livraison', 'livree'];
    if (!valides.includes(statut)) return res.json({ ok: false, message: 'Statut invalide' });

    const cmd = await db.commandes.findOneAsync({
      _id: req.params.id,
      livreur_id: req.session.livreurId
    });
    if (!cmd) return res.json({ ok: false, message: 'Commande introuvable' });

    const update = { statut, updatedAt: new Date() };
    if (statut === 'livree') {
      update.expire_at = new Date(Date.now() + 24*60*60*1000);
      // Incrémenter commandes livrées
      await db.livreurs.updateAsync(
        { _id: req.session.livreurId },
        { $inc: { commandes_livrees: 1 }, $set: { statut: 'disponible' } }
      );
    } else if (statut === 'en_livraison') {
      await db.livreurs.updateAsync(
        { _id: req.session.livreurId },
        { $set: { statut: 'occupé' } }
      );
    }

    await db.commandes.updateAsync({ _id: req.params.id }, { $set: update });

    // Émettre Socket.io
    if (req.app.get('io')) {
      req.app.get('io')
        .to(`restaurant_${cmd.restaurant_id}`)
        .emit('statut_commande', { commande_id: req.params.id, statut });
    }

    res.json({ ok: true, statut });
  } catch(err) {
    console.error(err);
    res.json({ ok: false, message: 'Erreur serveur' });
  }
});

// ── GET lien magique (depuis WhatsApp) ────────────────────────
router.get('/acces/:token', async (req, res) => {
  try {
    const livreur = await db.livreurs.findOneAsync({ token_acces: req.params.token });
    if (!livreur) return res.render('livreur/lien-expire');

    // Vérifier expiration token (48h)
    if (livreur.token_expire && new Date() > new Date(livreur.token_expire)) {
      return res.render('livreur/lien-expire');
    }

    req.session.livreurId  = livreur._id;
    req.session.livreurNom = livreur.nom;
    req.session.restaurantId_livreur = livreur.restaurant_id;
    res.redirect('/livreur/dashboard');
  } catch(err) {
    res.redirect('/livreur/login');
  }
});

// ── POST générer lien WhatsApp pour un livreur (restaurateur) ─
router.post('/generer-lien/:id', async (req, res) => {
  try {
    const livreur = await db.livreurs.findOneAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
    if (!livreur) return res.json({ ok: false });

    const token = crypto.randomBytes(24).toString('hex');
    const expire = new Date(Date.now() + 48*60*60*1000); // 48h
    await db.livreurs.updateAsync(
      { _id: req.params.id },
      { $set: { token_acces: token, token_expire: expire } }
    );

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT||3000}`;
    const lien = `${baseUrl}/livreur/acces/${token}`;
    res.json({ ok: true, lien, token });
  } catch(err) {
    res.json({ ok: false });
  }
});

// ── POST définir/changer mot de passe livreur (restaurateur) ──
router.post('/set-password/:id', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) return res.json({ ok: false, message: 'Min 4 caractères' });
    const livreur = await db.livreurs.findOneAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
    if (!livreur) return res.json({ ok: false });
    const hash = await bcrypt.hash(password, 10);
    await db.livreurs.updateAsync({ _id: req.params.id }, { $set: { password: hash } });
    res.json({ ok: true });
  } catch(err) {
    res.json({ ok: false });
  }
});

module.exports = router;
