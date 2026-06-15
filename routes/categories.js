const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../models/db');
const { requireAuth } = require('../middleware/auth');

// Upload icône catégorie
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const d = path.join(__dirname, '../public/uploads/categories');
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      cb(null, d);
    },
    filename: (req, file, cb) => cb(null, `cat_${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Image requise'))
});

// GET /categories — liste
router.get('/', requireAuth, async (req, res) => {
  const cats = await db.categories.findAsync({ restaurant_id: req.session.restaurantId });
  cats.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  res.render('restaurateur/categories', {
    cats,
    error:   req.flash('error'),
    success: req.flash('success')
  });
});

// POST /categories/nouvelle
router.post('/nouvelle', requireAuth, upload.single('icone'), async (req, res) => {
  const { nom, description, emoji } = req.body;
  if (!nom || !nom.trim()) {
    req.flash('error', 'Le nom de la catégorie est requis.');
    return res.redirect('/categories');
  }
  const nomTrim = nom.trim();
  // Vérifier doublon
  const existing = await db.categories.findOneAsync({
    restaurant_id: req.session.restaurantId,
    nom: { $regex: new RegExp(`^${nomTrim}$`, 'i') }
  });
  if (existing) {
    req.flash('error', `La catégorie "${nomTrim}" existe déjà.`);
    return res.redirect('/categories');
  }
  const count = await db.categories.countAsync({ restaurant_id: req.session.restaurantId });
  await db.categories.insertAsync({
    restaurant_id: req.session.restaurantId,
    nom: nomTrim,
    description: description || '',
    emoji: emoji || '🍽️',
    icone: req.file ? '/uploads/categories/' + req.file.filename : null,
    actif: true,
    ordre: count,
    createdAt: new Date()
  });
  req.flash('success', `Catégorie "${nomTrim}" créée !`);
  res.redirect('/categories');
});

// POST /categories/:id/modifier
router.post('/:id/modifier', requireAuth, upload.single('icone'), async (req, res) => {
  const { nom, description, emoji } = req.body;
  if (!nom || !nom.trim()) {
    req.flash('error', 'Le nom est requis.');
    return res.redirect('/categories');
  }
  const nomTrim = nom.trim();
  // Vérifier doublon (hors lui-même)
  const existing = await db.categories.findOneAsync({
    restaurant_id: req.session.restaurantId,
    nom: { $regex: new RegExp(`^${nomTrim}$`, 'i') },
    _id: { $ne: req.params.id }
  });
  if (existing) {
    req.flash('error', `La catégorie "${nomTrim}" existe déjà.`);
    return res.redirect('/categories');
  }
  const update = { nom: nomTrim, description: description || '', emoji: emoji || '🍽️', updatedAt: new Date() };
  if (req.file) update.icone = '/uploads/categories/' + req.file.filename;
  await db.categories.updateAsync(
    { _id: req.params.id, restaurant_id: req.session.restaurantId },
    { $set: update }
  );
  req.flash('success', 'Catégorie mise à jour !');
  res.redirect('/categories');
});

// POST /categories/:id/toggle
router.post('/:id/toggle', requireAuth, async (req, res) => {
  const cat = await db.categories.findOneAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  if (!cat) return res.json({ ok: false });
  await db.categories.updateAsync({ _id: cat._id }, { $set: { actif: !cat.actif } });
  res.json({ ok: true, actif: !cat.actif });
});

// POST /categories/reorder
router.post('/reorder', requireAuth, async (req, res) => {
  const { ordre } = req.body; // tableau d'ids dans l'ordre souhaité
  if (!Array.isArray(ordre)) return res.json({ ok: false });
  for (let i = 0; i < ordre.length; i++) {
    await db.categories.updateAsync(
      { _id: ordre[i], restaurant_id: req.session.restaurantId },
      { $set: { ordre: i } }
    );
  }
  res.json({ ok: true });
});

// POST /categories/:id/supprimer
router.post('/:id/supprimer', requireAuth, async (req, res) => {
  const cat = await db.categories.findOneAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  if (!cat) { req.flash('error', 'Catégorie introuvable.'); return res.redirect('/categories'); }
  // Vérifier si des plats utilisent cette catégorie
  const platsCount = await db.plats.countAsync({ restaurant_id: req.session.restaurantId, categorie: cat.nom });
  if (platsCount > 0) {
    req.flash('error', `Impossible de supprimer : ${platsCount} plat(s) utilisent cette catégorie. Modifiez d'abord les plats.`);
    return res.redirect('/categories');
  }
  await db.categories.removeAsync({ _id: req.params.id, restaurant_id: req.session.restaurantId });
  req.flash('success', 'Catégorie supprimée.');
  res.redirect('/categories');
});

// API — liste pour les formulaires de plats
router.get('/api/list', requireAuth, async (req, res) => {
  const cats = await db.categories.findAsync({ restaurant_id: req.session.restaurantId, actif: true });
  cats.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  res.json(cats);
});

module.exports = router;
