const express = require('express');
const router  = express.Router();
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

router.get('/', requireAuth, async (req, res) => {
  const { statut, date, type } = req.query;
  let query = { restaurant_id: req.session.restaurantId };
  if (statut && statut !== 'toutes') query.statut = statut;
  if (type   && type   !== 'tous')   query.type_livraison = type;
  let commandes = await db.commandes.findAsync(query);
  if (date) {
    const d = new Date(date); d.setHours(0,0,0,0);
    const fin = new Date(date); fin.setHours(23,59,59,999);
    commandes = commandes.filter(c => { const cd = new Date(c.createdAt); return cd>=d && cd<=fin; });
  }
  commandes.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const livreurs = await db.livreurs.findAsync({ restaurant_id: req.session.restaurantId, statut: 'disponible' });
  const all = await db.commandes.findAsync({ restaurant_id: req.session.restaurantId });
  const today = new Date(); today.setHours(0,0,0,0);
  const todayC = all.filter(c => new Date(c.createdAt) >= today);
  res.render('restaurateur/commandes', {
    commandes, livreurs,
    filtreStatut: statut||'toutes', filtreDate: date||'', filtreType: type||'tous',
    stats: { enAttente: all.filter(c=>c.statut==='en_attente').length, enPreparation: all.filter(c=>c.statut==='en_preparation').length, enLivraison: all.filter(c=>c.statut==='en_livraison').length, servies: all.filter(c=>['servie','livree'].includes(c.statut)).length, caToday: todayC.filter(c=>c.statut!=='annulee').reduce((s,c)=>s+(c.total||0),0) },
    error: req.flash('error'), success: req.flash('success')
  });
});

router.post('/nouvelle', async (req, res) => {
  try {
    const { restaurant_id, items, client_nom, client_telephone, client_adresse, client_quartier, client_table, note, type_livraison, paiement, promo_code, total_avant_promo, reduction, total } = req.body;
    if (!restaurant_id || !items?.length) return res.status(400).json({ ok:false });
    const restaurant = await db.restaurants.findOneAsync({ _id: restaurant_id });
    if (!restaurant) return res.status(404).json({ ok:false });
    const { lat, lng } = req.body;
    const num = 'CMD-' + Date.now().toString(36).toUpperCase().slice(-6);
    const commande = await db.commandes.insertAsync({
      restaurant_id, num_commande: num, items,
      client_nom: client_nom||'Client', client_telephone: client_telephone||'',
      client_adresse: client_adresse||'', client_quartier: client_quartier||'',
      client_table: client_table||'', note: note||'',
      type_livraison: type_livraison||'sur_place', paiement: paiement||'whatsapp',
      promo_code: promo_code||null, total_avant_promo: parseFloat(total_avant_promo)||0,
      reduction: parseFloat(reduction)||0,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null, total: parseFloat(total)||0,
      statut: 'en_attente', livreur_id: null, expire_at: null,
      createdAt: new Date()
    });
    if (promo_code) await db.promos.updateAsync({ restaurant_id, code: promo_code }, { $inc: { utilisations: 1 } });
    if (req.app.get('io')) req.app.get('io').to(`restaurant_${restaurant_id}`).emit('nouvelle_commande', { commande: { ...commande, restaurant_nom: restaurant.nom } });
    res.json({ ok: true, commande_id: commande._id, num_commande: num });
  } catch(err) { console.error(err); res.status(500).json({ ok:false }); }
});

router.post('/:id/statut', requireAuth, async (req, res) => {
  const { statut, livreur_id } = req.body;
  const valides = ['en_attente','en_preparation','en_livraison','servie','livree','annulee'];
  if (!valides.includes(statut)) return res.status(400).json({ ok:false });
  const update = { statut, updatedAt: new Date() };
  // Set expiry for delivered orders (24h after delivery)
  if (statut === 'livree' || statut === 'servie') {
    update.expire_at = new Date(Date.now() + 24*60*60*1000);
  }
  if (livreur_id) { update.livreur_id = livreur_id; await db.livreurs.updateAsync({ _id: livreur_id }, { $set: { statut: 'occupé' } }); }
  if (statut === 'livree') {
    const cmd = await db.commandes.findOneAsync({ _id: req.params.id });
    if (cmd?.livreur_id) await db.livreurs.updateAsync({ _id: cmd.livreur_id }, { $set: { statut: 'disponible' }, $inc: { commandes_livrees: 1 } });
  }
  await db.commandes.updateAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId }, { $set: update });
  if (req.app.get('io')) req.app.get('io').to(`restaurant_${req.session.restaurantId}`).emit('statut_commande', { commande_id: req.params.id, statut });
  res.json({ ok: true });
});

router.post('/:id/supprimer', requireAuth, async (req, res) => {
  await db.commandes.removeAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  req.flash('success','Commande supprimée.');
  res.redirect('/commandes');
});

// Suivi public commande
router.get('/suivi/:num', async (req, res) => {
  const commande = await db.commandes.findOneAsync({ num_commande: req.params.num });
  if (!commande) return res.render('client/suivi-404');
  // Check expiry
  if (commande.expire_at && new Date() > new Date(commande.expire_at)) return res.render('client/suivi-expire');
  const restaurant = await db.restaurants.findOneAsync({ _id: commande.restaurant_id });
  let livreur = null;
  if (commande.livreur_id) livreur = await db.livreurs.findOneAsync({ _id: commande.livreur_id });
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT||3000}`;
  res.render('client/suivi', { commande, restaurant, livreur, baseUrl });
});

// Reçu PDF
router.get('/:id/recu', requireAuth, async (req, res) => {
  try {
    const commande = await db.commandes.findOneAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
    if (!commande) return res.status(404).send('Commande introuvable');
    const restaurant = await db.restaurants.findOneAsync({ _id: req.session.restaurantId });
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT||3000}`;
    const suiviUrl = `${baseUrl}/commandes/suivi/${commande.num_commande}`;
    const qrBuffer = await QRCode.toBuffer(suiviUrl, { width: 120, margin: 1 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recu-${commande.num_commande}.pdf"`);

    const doc = new PDFDocument({ size: 'A5', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
    doc.pipe(res);

    // Header gradient background
    doc.rect(0, 0, doc.page.width, 120).fill('#111827');

    // Restaurant name
    doc.fillColor('#F59E0B').font('Helvetica-Bold').fontSize(22)
       .text(restaurant.nom, 50, 28, { align: 'center', width: doc.page.width - 100 });

    // Subtitle
    doc.fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(10)
       .text('Reçu de commande', 50, 56, { align: 'center', width: doc.page.width - 100 });

    if (restaurant.adresse || restaurant.ville) {
      doc.fillColor('rgba(255,255,255,0.5)').fontSize(9)
         .text([restaurant.adresse, restaurant.ville].filter(Boolean).join(', '), 50, 72, { align: 'center', width: doc.page.width - 100 });
    }
    if (restaurant.telephone) {
      doc.fillColor('rgba(255,255,255,0.5)').fontSize(9)
         .text(`📞 ${restaurant.telephone}`, 50, 87, { align: 'center', width: doc.page.width - 100 });
    }

    // Order number badge
    doc.roundedRect(doc.page.width/2 - 80, 100, 160, 28, 14).fill('#F59E0B');
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12)
       .text(commande.num_commande, doc.page.width/2 - 80, 108, { align: 'center', width: 160 });

    let y = 148;

    // QR Code
    doc.image(qrBuffer, doc.page.width/2 - 50, y, { width: 100, height: 100 });
    doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
       .text('Scanner pour suivre votre commande', 50, y + 104, { align: 'center', width: doc.page.width - 100 });
    y += 125;

    // Divider
    doc.moveTo(50, y).lineTo(doc.page.width-50, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 14;

    // Client info section
    const infoItems = [
      ['Date', new Date(commande.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })],
      ['Client', commande.client_nom],
    ];
    if (commande.client_telephone) infoItems.push(['Téléphone', commande.client_telephone]);
    if (commande.type_livraison === 'livraison' && commande.client_adresse) infoItems.push(['Livraison', `${commande.client_adresse}${commande.client_quartier ? ', ' + commande.client_quartier : ''}`]);
    if (commande.type_livraison === 'sur_place' && commande.client_table) infoItems.push(['Table', commande.client_table]);
    infoItems.push(['Paiement', commande.paiement === 'mtn' ? 'MTN Mobile Money' : commande.paiement === 'orange' ? 'Orange Money' : 'WhatsApp']);

    infoItems.forEach(([label, val]) => {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9).text(label, 50, y);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(val, 160, y, { width: doc.page.width - 210 });
      y += 16;
    });

    y += 6;
    doc.moveTo(50, y).lineTo(doc.page.width-50, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 12;

    // Items header
    doc.fillColor('#9CA3AF').font('Helvetica-Bold').fontSize(8).text('ARTICLE', 50, y).text('QTÉ', 200, y).text('PRIX', 240, y, { width: doc.page.width-290, align: 'right' });
    y += 10;
    doc.moveTo(50, y).lineTo(doc.page.width-50, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    y += 8;

    // Items
    commande.items.forEach(item => {
      doc.fillColor('#111827').font('Helvetica').fontSize(10).text(item.nom, 50, y, { width: 145 });
      doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(10).text(`${item.quantite}×`, 200, y);
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text(`${(item.prix * item.quantite).toLocaleString('fr-FR')} F`, 240, y, { width: doc.page.width-290, align: 'right' });
      y += 18;
    });

    doc.moveTo(50, y).lineTo(doc.page.width-50, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 10;

    // Totals
    if (commande.reduction > 0) {
      doc.fillColor('#059669').font('Helvetica-Bold').fontSize(10).text(`Promo ${commande.promo_code}`, 50, y);
      doc.text(`-${commande.reduction.toLocaleString('fr-FR')} FCFA`, 240, y, { width: doc.page.width-290, align: 'right' });
      y += 18;
    }

    // Total final — colored background
    doc.rect(40, y-4, doc.page.width-80, 28).fill('#F59E0B');
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text('TOTAL', 50, y + 2);
    doc.fontSize(13).text(`${commande.total.toLocaleString('fr-FR')} FCFA`, 50, y + 2, { width: doc.page.width-100, align: 'right' });
    y += 38;

    // Note
    if (commande.note) {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9).text(`Note : ${commande.note}`, 50, y);
      y += 16;
    }

    // Status
    const statusLabels = { en_attente:'En attente', en_preparation:'En préparation', en_livraison:'En route', servie:'Servie', livree:'Livrée', annulee:'Annulée' };
    doc.roundedRect(50, y, 110, 20, 4).fill(commande.statut === 'servie' || commande.statut === 'livree' ? '#D1FAE5' : '#FEF3C7');
    doc.fillColor(commande.statut === 'servie' || commande.statut === 'livree' ? '#059669' : '#92400E').font('Helvetica-Bold').fontSize(9)
       .text(`Statut : ${statusLabels[commande.statut] || commande.statut}`, 55, y + 5, { width: 100 });
    y += 30;

    // Footer
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(8)
       .text('Merci pour votre commande ! — MenuCam · menucam-production.up.railway.app', 50, y, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  } catch(err) { console.error(err); res.status(500).send('Erreur génération PDF'); }
});

// API stats
router.get('/api/stats', requireAuth, async (req, res) => {
  const { periode } = req.query;
  const commandes = await db.commandes.findAsync({ restaurant_id: req.session.restaurantId });
  const jours = parseInt(periode) || 7;
  const data = [];
  for (let i=jours-1; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const fin = new Date(d); fin.setHours(23,59,59,999);
    const dayCmds = commandes.filter(c => { const cd=new Date(c.createdAt); return cd>=d&&cd<=fin&&c.statut!=='annulee'; });
    data.push({ label: d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}), ca: dayCmds.reduce((s,c)=>s+(c.total||0),0), nb: dayCmds.length });
  }
  res.json(data);
});

module.exports = router;

// ============================================================
// ANNULATION AVEC DÉLAI LIMITÉ (côté client)
// ============================================================

/**
 * POST /commandes/:num/annuler-client
 * Permet au client d'annuler sa commande dans le délai autorisé.
 * Vérification côté serveur : délai + statut.
 */
router.post('/:num/annuler-client', async (req, res) => {
  try {
    const commande = await db.commandes.findOneAsync({ num_commande: req.params.num });
    if (!commande) return res.json({ ok: false, message: 'Commande introuvable.' });

    // Vérifier statut — pas annulable si déjà avancé
    if (['en_preparation', 'en_livraison', 'servie', 'livree', 'annulee'].includes(commande.statut)) {
      return res.json({ ok: false, message: 'Impossible d\'annuler : votre commande est déjà en cours de traitement.' });
    }

    // Vérifier délai — 5 minutes après création
    const DELAI_ANNULATION_MS = (parseInt(process.env.DELAI_ANNULATION_MIN) || 5) * 60 * 1000;
    const createdAt = new Date(commande.createdAt);
    if (Date.now() - createdAt.getTime() > DELAI_ANNULATION_MS) {
      return res.json({ ok: false, message: 'Le délai d\'annulation est expiré.' });
    }

    await db.commandes.updateAsync(
      { _id: commande._id },
      { $set: { statut: 'annulee', annulee_par: 'client', updatedAt: new Date() } }
    );

    // Notifier le restaurant
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant_${commande.restaurant_id}`).emit('commande_annulee_client', {
        num_commande: commande.num_commande,
        client_nom: commande.client_nom
      });
    }

    res.json({ ok: true, message: 'Commande annulée avec succès.' });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, message: 'Erreur serveur.' });
  }
});

/**
 * GET /commandes/:num/delai-annulation
 * Retourne le temps restant pour annuler (en secondes).
 */
router.get('/:num/delai-annulation', async (req, res) => {
  const commande = await db.commandes.findOneAsync({ num_commande: req.params.num });
  if (!commande) return res.json({ ok: false });
  const DELAI_MS = (parseInt(process.env.DELAI_ANNULATION_MIN) || 5) * 60 * 1000;
  const elapsed  = Date.now() - new Date(commande.createdAt).getTime();
  const restant  = Math.max(0, DELAI_MS - elapsed);
  const annulable = restant > 0 && commande.statut === 'en_attente';
  res.json({ ok: true, restant_ms: restant, annulable, statut: commande.statut });
});
