const express = require('express');
const router = express.Router();
const db = require('../models/db');

// ── Appel API Groq (gratuit, compatible OpenAI) ──────────────
async function appellerGroq(messages, systemPrompt) {
  const fetch = require('node-fetch');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 512,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// ── Construire le contexte restaurant ───────────────────────
async function getContexteRestaurant(restaurantId) {
  try {
    const restaurant = await db.restaurants.findOneAsync({ _id: restaurantId });
    if (!restaurant) return null;

    const plats = await db.plats.findAsync({ restaurant_id: restaurantId, disponible: true });
    const categories = await db.categories.findAsync({ restaurant_id: restaurantId });
    const promos = await db.promos.findAsync({
      restaurant_id: restaurantId,
      active: true,
      date_fin: { $gt: new Date() },
    });
    const horaires = restaurant.horaires || {};

    const catMap = {};
    categories.forEach(c => { catMap[c._id] = c.nom; });

    const menuResume = plats.slice(0, 30).map(p =>
      `- ${p.nom} (${catMap[p.categorie_id] || 'Sans catégorie'}) : ${p.prix} FCFA${p.description ? ' — ' + p.description.substring(0, 60) : ''}`
    ).join('\n');

    const promosResume = promos.map(p =>
      `- ${p.nom} : ${p.type === 'pourcentage' ? p.valeur + '% de réduction' : p.valeur + ' FCFA de réduction'}${p.code ? ' (code: ' + p.code + ')' : ''}`
    ).join('\n');

    const joursOuverts = Object.entries(horaires)
      .filter(([, h]) => h && h.ouvert)
      .map(([jour, h]) => `${jour}: ${h.ouverture || '?'}–${h.fermeture || '?'}`)
      .join(', ');

    return { restaurant, menuResume, promosResume, joursOuverts, nbPlats: plats.length };
  } catch (e) {
    console.error('[Chatbot] Erreur contexte:', e.message);
    return null;
  }
}

// ── Construire le system prompt ──────────────────────────────
function buildSystemPrompt(contexte, restaurantNom) {
  const nom = contexte?.restaurant?.nom || restaurantNom || 'ce restaurant';
  const ville = contexte?.restaurant?.ville || 'Cameroun';
  const tel = contexte?.restaurant?.telephone || '';
  const adresse = contexte?.restaurant?.adresse || '';

  let prompt = `Tu es l'assistant virtuel intelligent du restaurant "${nom}" situé à ${ville}${adresse ? ', ' + adresse : ''}.
Tu aides les clients avec toutes leurs questions concernant le restaurant : menu, commandes, horaires, livraison, paiements, promotions, fidélité, allergènes, et tout autre problème.

RÈGLES IMPORTANTES :
- Réponds TOUJOURS en français, de manière chaleureuse, professionnelle et concise (max 3 phrases sauf si liste nécessaire).
- Tu représentes "${nom}" — parle au nom du restaurant (ex: "Chez nous", "Notre menu...").
- Si tu ne connais pas une information précise, propose d'appeler le restaurant${tel ? ' au ' + tel : ''} ou de passer par la plateforme.
- Ne génère jamais de fausses informations sur les prix ou disponibilités.
- Pour les problèmes de commande (retard, erreur, annulation), montre de l'empathie et guide vers la solution.
- Montre de l'empathie pour tout problème et propose des solutions concrètes.
`;

  if (contexte) {
    if (contexte.menuResume) {
      prompt += `\nMENU DISPONIBLE (${contexte.nbPlats} plats) :\n${contexte.menuResume}\n`;
    }
    if (contexte.joursOuverts) {
      prompt += `\nHORAIRES D'OUVERTURE : ${contexte.joursOuverts}\n`;
    }
    if (contexte.promosResume) {
      prompt += `\nPROMOTIONS EN COURS :\n${contexte.promosResume}\n`;
    }
    if (contexte.restaurant.livraison) {
      prompt += `\nLIVRAISON : disponible${contexte.restaurant.frais_livraison ? ' — frais : ' + contexte.restaurant.frais_livraison + ' FCFA' : ''}\n`;
    }
  }

  prompt += `\nMODE PAIEMENT ACCEPTÉS : Mobile Money (MTN, Orange, Wave), carte bancaire.\n`;
  prompt += `\nSi le client a un problème grave (commande non reçue, double débit, problème de paiement sérieux), dis-lui qu'un responsable va le contacter et de laisser son numéro.`;

  return prompt;
}

// ── Route principale POST /chatbot/message ──────────────────
router.post('/message', async (req, res) => {
  try {
    const { messages, restaurantId, restaurantNom } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages invalides' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'Service indisponible',
        reponse: "Je suis temporairement indisponible. Veuillez contacter le restaurant directement.",
      });
    }

    // Limiter l'historique à 10 messages pour contrôler les coûts
    const historique = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).substring(0, 500),
    }));

    // Récupérer le contexte du restaurant si ID fourni
    let contexte = null;
    if (restaurantId) {
      contexte = await getContexteRestaurant(restaurantId);
    }

    const systemPrompt = buildSystemPrompt(contexte, restaurantNom);
    const reponse = await appellerGroq(historique, systemPrompt);

    res.json({ reponse });
  } catch (err) {
    console.error('[Chatbot] Erreur:', err.message);
    res.status(500).json({
      reponse: "Désolé, une erreur s'est produite. Veuillez réessayer ou contacter le restaurant directement.",
    });
  }
});

// ── Route GET /chatbot/statut ────────────────────────────────
router.get('/statut', (req, res) => {
  res.json({
    actif: !!process.env.GROQ_API_KEY,
    version: '1.0',
    provider: 'Groq (llama-3.3-70b)',
  });
});

module.exports = router;
