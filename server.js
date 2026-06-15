require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const flash      = require('connect-flash');
const path       = require('path');
const http       = require('http');
const fs         = require('fs');
const { Server } = require('socket.io');

// ── Logs structurés pour Railway ────────────────────────
const log = {
  info:  (...args) => console.log(`[${new Date().toISOString()}] INFO`, ...args),
  ok:    (...args) => console.log(`[${new Date().toISOString()}] OK`, ...args),
  warn:  (...args) => console.warn(`[${new Date().toISOString()}] WARN`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] ERROR`, ...args),
};

const app    = express();
const server = http.createServer(app);

// ── PORT dynamique Railway ───────────────────────────────
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ── Socket.io avec CORS Railway ─────────────────────────
const allowedOrigins = process.env.APP_URL
  ? [process.env.APP_URL, 'http://localhost:3000']
  : '*';

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ── Upload path ──────────────────────────────────────────
const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── View engine ─────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Trust proxy Railway (pour HTTPS) ────────────────────
app.set('trust proxy', 1);

// ── Fichiers statiques ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Body parsers ─────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// ── Session ──────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'menucam_v3_secret_change_en_prod',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProduction ? 'auto' : false,
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
  },
}));

app.use(flash());

// ── Variables globales templates ─────────────────────────
app.use((req, res, next) => {
  res.locals.session       = req.session;
  res.locals.restaurantNom = req.session.restaurantNom || null;
  res.locals.restaurantId  = req.session.restaurantId  || null;
  res.locals.APP_URL       = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  next();
});

// ── Socket.io ────────────────────────────────────────────
app.set('io', io);
io.on('connection', socket => {
  log.info('Socket connecté:', socket.id);
  socket.on('rejoindre_restaurant', id => {
    socket.join(`restaurant_${id}`);
    log.info(`Socket ${socket.id} rejoint restaurant_${id}`);
  });
  socket.on('disconnect', () => log.info('Socket déconnecté:', socket.id));
});

// ── Health check Railway ─────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'MenuCam V3',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ── Routes ───────────────────────────────────────────────
app.use('/auth',       require('./routes/auth'));
app.use('/dashboard',  require('./routes/dashboard'));
app.use('/plats',      require('./routes/plats'));
app.use('/commandes',  require('./routes/commandes'));
app.use('/menu',       require('./routes/menu'));
app.use('/livreurs',   require('./routes/livreurs'));
app.use('/promos',     require('./routes/promos'));
app.use('/avis',       require('./routes/avis'));
app.use('/analytics',  require('./routes/analytics'));
app.use('/maps',       require('./routes/maps'));
app.use('/livreur',    require('./routes/livreur-app'));
app.use('/categories', require('./routes/categories'));
app.use('/horaires',   require('./routes/horaires'));
app.use('/fidelite',   require('./routes/fidelite'));
app.use('/restaurants',require('./routes/restaurants'));
app.use('/paiement',   require('./routes/paiement'));
app.use('/chatbot',    require('./routes/chatbot'));

// ── Page d'accueil ───────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session.restaurantId) return res.redirect('/dashboard');
  res.render('index');
});

// ── 404 ──────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('404'));

// ── Erreur globale ───────────────────────────────────────
app.use((err, req, res, next) => {
  log.error('Erreur Express:', err.message);
  log.error(err.stack);
  if (res.headersSent) return next(err);
  res.status(500).send('Erreur serveur interne');
});

// ── Auto-seed + slugs ────────────────────────────────────
const db = require('./models/db');
const { slugify } = require('./routes/restaurants');

setTimeout(async () => {
  try {
    const count = await db.restaurants.countAsync({});
    if (count === 0) {
      log.info('Base vide — lancement du seed...');
      const seed = require('./seed');
      await seed();
    }
    const restos = await db.restaurants.findAsync({ slug: { $exists: false } });
    for (const r of restos) {
      let slug = slugify(r.nom);
      let existing = await db.restaurants.findOneAsync({ slug, _id: { $ne: r._id } });
      let suffix = 1;
      while (existing) {
        slug = `${slugify(r.nom)}-${suffix++}`;
        existing = await db.restaurants.findOneAsync({ slug, _id: { $ne: r._id } });
      }
      await db.restaurants.updateAsync({ _id: r._id }, { $set: { slug } });
    }
    log.ok('Initialisation base de données terminée');
  } catch (err) {
    log.error('Erreur initialisation DB:', err.message);
  }
}, 1500);

// ── Gestion crash propre ─────────────────────────────────
process.on('uncaughtException', (err) => {
  log.error('uncaughtException:', err.message);
  log.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection:', reason);
});

process.on('SIGTERM', () => {
  log.info('SIGTERM reçu — arrêt propre...');
  server.close(() => {
    log.ok('Serveur arrêté proprement');
    process.exit(0);
  });
});

// ── Démarrage ────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  log.ok(`MenuCam V3 démarré sur le port ${PORT}`);
  log.info(`ENV: ${process.env.NODE_ENV || 'development'}`);
  log.info(`APP_URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
});