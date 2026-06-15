function requireAuth(req, res, next) {
  if (req.session?.restaurantId) return next();
  req.flash('error', 'Veuillez vous connecter.');
  res.redirect('/auth/connexion');
}
module.exports = { requireAuth };
