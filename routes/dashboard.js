const express = require('express');
const router  = express.Router();
const QRCode  = require('qrcode');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(__dirname,'../public/uploads'); if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); cb(null,d); },
    filename: (req, file, cb) => cb(null, `logo_${req.session.restaurantId}_${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 3*1024*1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null,true) : cb(new Error('Image requise'))
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const rid = req.session.restaurantId;
    const restaurant = await db.restaurants.findOneAsync({ _id: rid });
    const plats      = await db.plats.findAsync({ restaurant_id: rid });
    const commandes  = await db.commandes.findAsync({ restaurant_id: rid });
    const avis       = await db.avis.findAsync({ restaurant_id: rid });
    const today = new Date(); today.setHours(0,0,0,0);
    const todayC = commandes.filter(c => new Date(c.createdAt) >= today);
    const recentes = commandes.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
    const baseUrl = process.env.APP_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const menuUrl = `${baseUrl}/menu/${rid}`;
    const qrDataUrl = await QRCode.toDataURL(menuUrl, { width: 280, margin: 2, color: { dark: '#111827', light: '#ffffff' } });
    const caWeek = [];
    for (let i=6;i>=0;i--) {
      const d=new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      const fin=new Date(d); fin.setHours(23,59,59,999);
      const dayCmds=commandes.filter(c=>{const cd=new Date(c.createdAt);return cd>=d&&cd<=fin&&c.statut!=='annulee';});
      caWeek.push({ label: d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}), ca: dayCmds.reduce((s,c)=>s+(c.total||0),0), nb: dayCmds.length });
    }
    res.render('restaurateur/dashboard', {
      restaurant, plats, qrDataUrl, menuUrl, recentes,
      stats: {
        totalPlats: plats.length,
        commandesAujourdhui: todayC.length,
        caAujourdhui: todayC.filter(c=>c.statut!=='annulee').reduce((s,c)=>s+(c.total||0),0),
        enAttente: commandes.filter(c=>c.statut==='en_attente').length,
        noteMoyenne: restaurant.note_moyenne || 0,
        nbAvis: avis.length,
        caTotal: commandes.filter(c=>c.statut!=='annulee').reduce((s,c)=>s+(c.total||0),0),
        paiementsConfirmes: commandes.filter(c=>c.paiement_statut==='success').length,
        paiementsEnAttente: commandes.filter(c=>['mtn','orange','cinetpay','stripe'].includes(c.paiement)&&c.paiement_statut!=='success'&&c.statut!=='annulee').length,
        caPaye: commandes.filter(c=>c.paiement_statut==='success').reduce((s,c)=>s+(c.total||0),0),
      },
      caWeek, error: req.flash('error'), success: req.flash('success')
    });
  } catch(err) { console.error(err); res.redirect('/auth/connexion'); }
});

router.get('/profil', requireAuth, async (req, res) => {
  const restaurant = await db.restaurants.findOneAsync({ _id: req.session.restaurantId });
  res.render('restaurateur/profil', { restaurant, error: req.flash('error'), success: req.flash('success') });
});

router.post('/profil', requireAuth, upload.single('logo'), async (req, res) => {
  const { nom, telephone, adresse, ville, description } = req.body;
  const update = { nom, telephone, adresse: adresse||'', ville: ville||'Douala', description: description||'' };
  if (req.file) update.logo = '/uploads/' + req.file.filename;
  await db.restaurants.updateAsync({ _id: req.session.restaurantId }, { $set: update });
  req.session.restaurantNom = nom;
  req.flash('success', 'Profil mis à jour !');
  res.redirect('/dashboard/profil');
});

module.exports = router;

// ── Page paiements restaurateur ──────────────────────────────
router.get('/paiements', requireAuth, async (req, res) => {
  const { methode: filtre, statut: filtreStatut } = req.query;
  const rid = req.session.restaurantId;
  let query = { restaurant_id: rid };
  if (filtre)       query.paiement        = filtre;
  if (filtreStatut) query.paiement_statut = filtreStatut;
  const commandes = (await db.commandes.findAsync(query)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const all = await db.commandes.findAsync({ restaurant_id: rid });
  res.render('restaurateur/paiements', {
    commandes, filtre: filtre||'', filtreStatut: filtreStatut||'',
    confirmes:     all.filter(c=>c.paiement_statut==='success').length,
    en_attente:    all.filter(c=>['mtn','orange','cinetpay','stripe'].includes(c.paiement)&&c.paiement_statut!=='success'&&c.statut!=='annulee').length,
    ca_paye:       all.filter(c=>c.paiement_statut==='success').reduce((s,c)=>s+(c.total||0),0),
    whatsapp_count:all.filter(c=>c.paiement==='whatsapp').length,
    error: req.flash('error'), success: req.flash('success')
  });
});
