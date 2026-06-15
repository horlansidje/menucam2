require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./models/db');

const RESTAURANT = { nom:"Chez Maman Biya", email:"demo@menucam.cm", password:"demo1234", telephone:"699000000", adresse:"Quartier Akwa, Rue de la Joie", ville:"Douala", description:"Spécialités camerounaises authentiques — Ndolé, Poulet DG, Eru et bien plus. Cuisine faite maison.", logo:null, actif:true };

const PLATS = [
  {nom:"Beignets haricots",description:"Beignets croustillants servis avec poivre et piment.",prix:500,categorie:"Entrées & Collations",disponible:true},
  {nom:"Accra banane",description:"Beignets de banane plantain mûre, dorés à la perfection.",prix:500,categorie:"Entrées & Collations",disponible:true},
  {nom:"Miondo (bâton de manioc)",description:"Bâtons de manioc fermenté enveloppés dans des feuilles de bananier.",prix:300,categorie:"Entrées & Collations",disponible:true},
  {nom:"Ndolé spécial",description:"Le plat national camerounais ! Feuilles de ndolé avec crevettes, arachides et viande de bœuf.",prix:4500,categorie:"Plats principaux",disponible:true},
  {nom:"Poulet DG",description:"Poulet braisé sauté avec plantain mûr, carottes et poivrons. Le plat des directeurs généraux !",prix:5500,categorie:"Plats principaux",disponible:true},
  {nom:"Eru et Water fufu",description:"Feuilles d'eru cuisinées avec huile de palme, crayfish et viande fumée. Spécialité du Sud-Ouest.",prix:4000,categorie:"Plats principaux",disponible:true},
  {nom:"Koki maïs",description:"Gâteau de maïs cuit à la vapeur dans des feuilles de bananier.",prix:2500,categorie:"Plats principaux",disponible:true},
  {nom:"Mbongo tchobi",description:"Poulet mijoté dans une sauce noire à base de njansa. Spécialité Bassa.",prix:5000,categorie:"Plats principaux",disponible:true},
  {nom:"Achu soupe jaune",description:"Taro pilé servi avec soupe jaune à base d'huile de palme et épices.",prix:4500,categorie:"Plats principaux",disponible:true},
  {nom:"Soya bœuf (brochettes)",description:"Brochettes de bœuf marinées aux épices camerounaises et grillées au feu de bois.",prix:2000,categorie:"Grillades & Brochettes",disponible:true},
  {nom:"Poulet braisé entier",description:"Poulet entier mariné et grillé lentement sur braise. Servi avec plantain et sauce pimentée.",prix:8000,categorie:"Grillades & Brochettes",disponible:true},
  {nom:"Poisson braisé capitaine",description:"Capitaine frais mariné aux épices locales et grillé sur braise.",prix:6000,categorie:"Grillades & Brochettes",disponible:true},
  {nom:"Soya porc",description:"Brochettes de porc grillées au charbon avec épices pimentées.",prix:2500,categorie:"Grillades & Brochettes",disponible:true},
  {nom:"Plantain braisé",description:"Bananes plantain mûres grillées sur braise.",prix:500,categorie:"Accompagnements",disponible:true},
  {nom:"Plantain frit",description:"Tranches de plantain frites dorées et croustillantes.",prix:500,categorie:"Accompagnements",disponible:true},
  {nom:"Riz sauté",description:"Riz blanc sauté avec légumes, oignons et épices locales.",prix:1000,categorie:"Accompagnements",disponible:true},
  {nom:"Jus de bissap (hibiscus)",description:"Boisson naturelle à base de fleurs d'hibiscus. Rafraîchissante et acidulée.",prix:500,categorie:"Jus naturels",disponible:true},
  {nom:"Jus de gingembre",description:"Boisson au gingembre frais avec citron et sucre de canne.",prix:500,categorie:"Jus naturels",disponible:true},
  {nom:"Jus de tamarin",description:"Boisson à base de tamarin naturel, sucrée et acidulée.",prix:500,categorie:"Jus naturels",disponible:true},
  {nom:"Jus de maracuja",description:"Jus frais de fruit de la passion pressé, non filtré.",prix:600,categorie:"Jus naturels",disponible:true},
  {nom:"Eau minérale Supermont",description:"Eau minérale naturelle camerounaise 1,5L.",prix:300,categorie:"Boissons",disponible:true},
  {nom:"Coca-Cola 33cl",description:"Coca-Cola bien frais.",prix:400,categorie:"Boissons",disponible:true},
  {nom:"33 Export bière",description:"Bière camerounaise blonde, légère et fraîche. 65cl.",prix:1000,categorie:"Bières",disponible:true},
  {nom:"Castel bière",description:"Castel bière bien fraîche. 65cl.",prix:900,categorie:"Bières",disponible:true},
  {nom:"Beignets sucrés au miel",description:"Beignets moelleux nappés de miel local et noix de coco râpée.",prix:700,categorie:"Desserts",disponible:true},
  {nom:"Ananas frais tranché",description:"Ananas frais du pays tranché avec sel et piment (optionnel).",prix:500,categorie:"Desserts",disponible:true},
  {nom:"Salade de fruits tropicaux",description:"Mangue, papaye, ananas, banane et maracuja. Servi frais.",prix:800,categorie:"Desserts",disponible:true},
];

async function seed() {
  console.log('\n🌱  Seed MenuCam V3...\n');
  try {
    const existing = await db.restaurants.findOneAsync({ email: RESTAURANT.email });
    if (existing) {
      await db.restaurants.removeAsync({ _id: existing._id });
      await db.plats.removeAsync({ restaurant_id: existing._id }, { multi: true });
    }
    const hash = await bcrypt.hash(RESTAURANT.password, 10);
    const resto = await db.restaurants.insertAsync({ ...RESTAURANT, password: hash, note_moyenne: 0, nb_avis: 0, createdAt: new Date() });
    console.log(`✅  Restaurant : ${resto.nom} (${RESTAURANT.email} / ${RESTAURANT.password})`);
    let n = 0;
    for (const p of PLATS) {
      await db.plats.insertAsync({ ...p, restaurant_id: resto._id, photo: null, createdAt: new Date() });
      process.stdout.write(`\r🍽️  Plats : ${++n}/${PLATS.length}`);
    }
    console.log(`\n✅  ${n} plats ajoutés\n`);
    console.log('─'.repeat(50));
    console.log('🌐  http://localhost:3000');
    console.log(`📧  ${RESTAURANT.email}  |  🔑  ${RESTAURANT.password}`);
    console.log('─'.repeat(50)+'\n');
  } catch(e) {
    console.error('Erreur seed:', e.message);
  }
  // PAS de process.exit() — le serveur doit continuer à tourner
}

// Si lancé directement (node seed.js), on peut quitter après
if (require.main === module) {
  seed().then(() => setTimeout(() => process.exit(0), 500));
} else {
  // Appelé depuis server.js via require('./seed') — on exporte juste la fonction
  module.exports = seed;
}
