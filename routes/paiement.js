/**
 * Routes de paiement — MenuCam
 * Gère : CinetPay, MTN MoMo, Orange Money, Stripe, WhatsApp
 * + Mode SIMULATION pour démonstration sans API réelles
 */
const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const paiement = require('../services/paiement');
const sim      = require('../services/paiement-simulation');

// ── Helpers ──────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const estSimulation = () => sim.estActif();

// ─────────────────────────────────────────────────────────
//  PAGE CAISSE — affichée après validation du panier
//  GET /paiement/:num_commande
// ─────────────────────────────────────────────────────────
router.get('/:num', async (req, res) => {
  try {
    const commande   = await db.commandes.findOneAsync({ num_commande: req.params.num });
    if (!commande)   return res.redirect('/');
    const restaurant = await db.restaurants.findOneAsync({ _id: commande.restaurant_id });
    if (!restaurant) return res.redirect('/');

    // Déjà payée ?
    if (commande.paiement_statut === 'success') {
      return res.redirect(`/commandes/suivi/${commande.num_commande}`);
    }

    res.render('client/paiement', {
      commande, restaurant,
      stripe_pk: paiement.stripe.publishableKey(),
      APP_URL:   process.env.APP_URL || '',
      sim_mode:  estSimulation(),
    });
  } catch (err) { console.error(err); res.redirect('/'); }
});

// ─────────────────────────────────────────────────────────
//  INITIER UN PAIEMENT
//  POST /paiement/initier
// ─────────────────────────────────────────────────────────
router.post('/initier', async (req, res) => {
  try {
    const { num_commande, methode } = req.body;
    const commande   = await db.commandes.findOneAsync({ num_commande });
    if (!commande)   return res.json({ ok: false, message: 'Commande introuvable.' });
    const restaurant = await db.restaurants.findOneAsync({ _id: commande.restaurant_id });

    const ref_id = `MC-${num_commande}-${genId()}`;

    let result;

    switch (methode) {

      // ── CinetPay (MTN, Orange, Wave, Moov via CinetPay) ──
      case 'cinetpay':
        if (estSimulation()) {
          result = await sim.cinetpaySim.initierPaiement({
            transaction_id:   ref_id,
            montant:          commande.total,
            description:      `Commande ${num_commande} — ${restaurant.nom}`,
            client_nom:       commande.client_nom,
            client_email:     commande.client_email || '',
            client_telephone: commande.client_telephone || '',
            metadata: { num_commande, restaurant_id: commande.restaurant_id },
          });
          result.simulation = true;
        } else {
          result = await paiement.cinetpay.initierPaiement({
            transaction_id:   ref_id,
            montant:          commande.total,
            description:      `Commande ${num_commande} — ${restaurant.nom}`,
            client_nom:       commande.client_nom,
            client_email:     commande.client_email || '',
            client_telephone: commande.client_telephone || '',
            metadata: { num_commande, restaurant_id: commande.restaurant_id },
          });
        }
        break;

      // ── MTN MoMo direct (ou simulation) ──────────────────
      case 'mtn': {
        const tel = (req.body.telephone || commande.client_telephone || '').replace(/[^0-9]/g, '');
        if (estSimulation()) {
          result = await sim.mtnSim.requestToPay({
            reference_id: ref_id,
            montant:      commande.total,
            telephone:    tel,
            description:  `Commande ${num_commande}`,
          });
          result.simulation = true;
        } else {
          result = await paiement.mtn.requestToPay({
            reference_id: ref_id,
            montant:      commande.total,
            telephone:    tel,
            description:  `Commande ${num_commande}`,
          });
        }
        break;
      }

      // ── Orange Money direct (ou simulation) ───────────────
      case 'orange': {
        const tel = (req.body.telephone || commande.client_telephone || '').replace(/[^0-9]/g, '');
        if (estSimulation()) {
          result = await sim.orangeSim.initierPaiement({
            order_id:    ref_id,
            montant:     commande.total,
            telephone:   tel,
            description: `Commande ${num_commande}`,
          });
          result.simulation = true;
        } else {
          result = await paiement.orange.initierPaiement({
            order_id:    ref_id,
            montant:     commande.total,
            telephone:   commande.client_telephone || '',
            description: `Commande ${num_commande}`,
          });
        }
        break;
      }

      // ── Stripe (cartes Visa/Mastercard) ──────────────────
      case 'stripe':
        result = await paiement.stripe.creerSession({
          commande_id:  num_commande,
          items:        commande.items,
          client_email: commande.client_email || '',
        });
        break;

      // ── WhatsApp (paiement manuel) ────────────────────────
      case 'whatsapp': {
        const msg  = paiement.whatsapp.genererMessage({
          num_commande, client_nom: commande.client_nom,
          items: commande.items, total: commande.total,
          type_livraison: commande.type_livraison,
          adresse: commande.client_adresse,
        });
        const lien = paiement.whatsapp.genererLien({ telephone_restaurant: restaurant.telephone, message: msg });
        result = { ok: true, lien };
        break;
      }

      default:
        return res.json({ ok: false, message: `Méthode "${methode}" non supportée.` });
    }

    // Enregistrer la référence de paiement en base
    await db.commandes.updateAsync(
      { _id: commande._id },
      { $set: { paiement_ref: ref_id, paiement_methode: methode, paiement_statut: 'pending', updatedAt: new Date() } }
    );

    res.json({ ok: true, methode, paiement_ref: ref_id, ...result });
  } catch (err) {
    console.error('Erreur paiement:', err.message);
    res.json({ ok: false, message: err.message || 'Erreur lors de l\'initiation du paiement.' });
  }
});

// ─────────────────────────────────────────────────────────
//  VÉRIFIER STATUT (polling depuis le frontend)
//  GET /paiement/verifier/:ref
// ─────────────────────────────────────────────────────────
router.get('/verifier/:ref', async (req, res) => {
  try {
    const commande = await db.commandes.findOneAsync({ paiement_ref: req.params.ref });
    if (!commande) return res.json({ ok: false, message: 'Référence inconnue.' });

    // Si déjà marquée comme success en BDD, retourner directement
    if (commande.paiement_statut === 'success') {
      return res.json({ ok: true, statut: 'success', num_commande: commande.num_commande });
    }

    const check = estSimulation() && ['mtn','orange','cinetpay'].includes(commande.paiement_methode)
      ? await (() => {
          switch (commande.paiement_methode) {
            case 'mtn':      return sim.mtnSim.verifierPaiement(req.params.ref);
            case 'orange':   return sim.orangeSim.verifierPaiement(req.params.ref);
            case 'cinetpay': return sim.cinetpaySim.verifierPaiement(req.params.ref);
          }
        })()
      : await paiement.verifier(commande.paiement_methode, req.params.ref);

    if (check.ok) {
      // Paiement confirmé → mettre à jour commande
      await db.commandes.updateAsync(
        { _id: commande._id },
        { $set: { paiement_statut: 'success', paiement_confirme_at: new Date(), updatedAt: new Date() } }
      );
      // Notifier le restaurant via Socket.io
      const io = req.app.get('io');
      if (io) io.to(`restaurant_${commande.restaurant_id}`).emit('paiement_confirme', { num_commande: commande.num_commande, methode: commande.paiement_methode });
    }

    res.json({ ok: check.ok, statut: check.statut, num_commande: commande.num_commande });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, message: 'Erreur vérification.' });
  }
});

// ─────────────────────────────────────────────────────────
//  SIMULATION — Confirmer manuellement un paiement
//  POST /paiement/simulation/confirmer
//  Accessible uniquement quand le mode simulation est actif
// ─────────────────────────────────────────────────────────
router.post('/simulation/confirmer', async (req, res) => {
  if (!estSimulation()) return res.json({ ok: false, message: 'Mode simulation inactif.' });
  try {
    const { reference, succes } = req.body;
    const tx = sim.confirmerTransaction(reference, succes !== false);
    if (!tx) return res.json({ ok: false, message: 'Transaction introuvable.' });

    if (tx.statut === 'SUCCESSFUL') {
      const commande = await db.commandes.findOneAsync({ paiement_ref: reference });
      if (commande) {
        await db.commandes.updateAsync(
          { _id: commande._id },
          { $set: { paiement_statut: 'success', paiement_confirme_at: new Date(), updatedAt: new Date() } }
        );
        const io = req.app.get('io');
        if (io) io.to(`restaurant_${commande.restaurant_id}`).emit('paiement_confirme', {
          num_commande: commande.num_commande,
          methode: commande.paiement_methode,
        });
      }
    }
    res.json({ ok: true, statut: tx.statut });
  } catch (err) {
    console.error('Simulation confirmer:', err);
    res.json({ ok: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────
//  WEBHOOKS
// ─────────────────────────────────────────────────────────

// CinetPay webhook
router.post('/webhook/cinetpay', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const info = await paiement.cinetpay.traiterWebhook(req.body);
    if (info.statut === 'success') {
      const commande = await db.commandes.findOneAsync({ paiement_ref: info.transaction_id });
      if (commande) {
        await db.commandes.updateAsync(
          { _id: commande._id },
          { $set: { paiement_statut: 'success', paiement_confirme_at: new Date() } }
        );
        const io = req.app.get('io');
        if (io) io.to(`restaurant_${commande.restaurant_id}`).emit('paiement_confirme', { num_commande: commande.num_commande, methode: 'cinetpay' });
      }
    }
    res.send('OK');
  } catch (err) { console.error('Webhook CinetPay:', err); res.send('OK'); }
});

// Stripe webhook
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig   = req.headers['stripe-signature'];
    const event = await paiement.stripe.traiterWebhook(req.body, sig);
    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object;
      const cmd_id     = session.metadata?.commande_id;
      if (cmd_id) {
        const commande = await db.commandes.findOneAsync({ num_commande: cmd_id });
        if (commande) {
          await db.commandes.updateAsync(
            { _id: commande._id },
            { $set: { paiement_statut: 'success', paiement_confirme_at: new Date() } }
          );
          const io = req.app.get('io');
          if (io) io.to(`restaurant_${commande.restaurant_id}`).emit('paiement_confirme', { num_commande: cmd_id, methode: 'stripe' });
        }
      }
    }
    res.json({ received: true });
  } catch (err) { console.error('Webhook Stripe:', err); res.status(400).send(`Webhook Error: ${err.message}`); }
});

// ─────────────────────────────────────────────────────────
//  PAGES RETOUR APRÈS PAIEMENT
// ─────────────────────────────────────────────────────────
router.get('/retour', async (req, res) => {
  const { session_id, commande } = req.query;
  let num = commande;

  // Stripe: vérifier session
  if (session_id) {
    try {
      const check = await paiement.stripe.verifierSession(session_id);
      if (check.ok && check.data.metadata?.commande_id) {
        num = check.data.metadata.commande_id;
        await db.commandes.updateAsync(
          { num_commande: num },
          { $set: { paiement_statut: 'success', paiement_confirme_at: new Date() } }
        );
      }
    } catch(e) {}
  }

  if (num) return res.redirect(`/commandes/suivi/${num}`);
  res.render('client/paiement-retour', { statut: 'success' });
});

router.get('/annule', (req, res) => {
  const { commande } = req.query;
  if (commande) return res.redirect(`/commandes/suivi/${commande}?annule=1`);
  res.render('client/paiement-retour', { statut: 'annule' });
});

module.exports = router;
