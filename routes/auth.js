const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../models/db');
const { slugify } = require('./restaurants');

router.get('/connexion',  (req, res) => res.render('auth/connexion',  { error: req.flash('error') }));
router.get('/inscription',(req, res) => res.render('auth/inscription',{ error: req.flash('error'), success: req.flash('success') }));

router.post('/inscription', async (req, res) => {
  try {
    const { nom, email, telephone, adresse, ville, password, password2, lat, lng, adresse_gps } = req.body;
    if (!nom || !email || !telephone || !password) { req.flash('error', 'Tous les champs obligatoires.'); return res.redirect('/auth/inscription'); }
    if (password !== password2) { req.flash('error', 'Mots de passe différents.'); return res.redirect('/auth/inscription'); }
    if (password.length < 6) { req.flash('error', 'Mot de passe : min 6 caractères.'); return res.redirect('/auth/inscription'); }
    const existing = await db.restaurants.findOneAsync({ email: email.toLowerCase() });
    if (existing) { req.flash('error', 'Email déjà utilisé.'); return res.redirect('/auth/inscription'); }
    
    // Générer slug unique
    let slug = slugify(nom);
    let slugExisting = await db.restaurants.findOneAsync({ slug });
    let suffix = 1;
    while (slugExisting) { slug = `${slugify(nom)}-${suffix++}`; slugExisting = await db.restaurants.findOneAsync({ slug }); }
    
    const hash = await bcrypt.hash(password, 10);
    const resto = await db.restaurants.insertAsync({
      nom, email: email.toLowerCase(), telephone,
      adresse: adresse || adresse_gps || '',
      ville: ville || 'Douala',
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      password: hash, logo: null, description: '',
      actif: true, slug,
      note_moyenne: 0, nb_avis: 0,
      statut_manuel: 'auto',
      createdAt: new Date()
    });
    req.session.restaurantId  = resto._id;
    req.session.restaurantNom = resto.nom;
    res.redirect('/dashboard');
  } catch(err) {
    req.flash('error', err.errorType === 'uniqueViolated' ? 'Email déjà utilisé.' : 'Erreur serveur.');
    res.redirect('/auth/inscription');
  }
});

router.post('/connexion', async (req, res) => {
  try {
    const { email, password } = req.body;
    const resto = await db.restaurants.findOneAsync({ email: email.toLowerCase() });
    if (!resto || !(await bcrypt.compare(password, resto.password))) { req.flash('error', 'Email ou mot de passe incorrect.'); return res.redirect('/auth/connexion'); }
    req.session.restaurantId  = resto._id;
    req.session.restaurantNom = resto.nom;
    res.redirect('/dashboard');
  } catch(err) { req.flash('error', 'Erreur serveur.'); res.redirect('/auth/connexion'); }
});

router.get('/deconnexion', (req, res) => { req.session.destroy(); res.redirect('/'); });
module.exports = router;
