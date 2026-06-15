/**
 * ══════════════════════════════════════════════════════════
 *  MenuCam — Service de Paiement Unifié
 *  Supporte : CinetPay, MTN MoMo, Orange Money, Stripe, WhatsApp
 * ══════════════════════════════════════════════════════════
 */

require('dotenv').config();
const axios = require('axios');

// ─────────────────────────────────────────────────────────
//  CONFIGURATION (à remplir dans .env)
// ─────────────────────────────────────────────────────────
const CONFIG = {
  // CinetPay (MTN, Orange, Wave, Moov — Afrique)
  cinetpay: {
    apikey:      process.env.CINETPAY_APIKEY      || '',
    site_id:     process.env.CINETPAY_SITE_ID     || '',
    secret_key:  process.env.CINETPAY_SECRET_KEY  || '',
    base_url:    'https://api-checkout.cinetpay.com/v2',
    notify_url:  process.env.APP_URL ? `${process.env.APP_URL}/paiement/webhook/cinetpay` : '',
    return_url:  process.env.APP_URL ? `${process.env.APP_URL}/paiement/retour` : '',
    cancel_url:  process.env.APP_URL ? `${process.env.APP_URL}/paiement/annule` : '',
    currency:    'XAF', // Franc CFA
  },

  // MTN MoMo API directe (Cameroun)
  mtn: {
    subscription_key: process.env.MTN_SUBSCRIPTION_KEY || '',
    api_user:         process.env.MTN_API_USER         || '',
    api_key:          process.env.MTN_API_KEY          || '',
    base_url:         process.env.MTN_ENV === 'prod'
                        ? 'https://proxy.momoapi.mtn.com'
                        : 'https://sandbox.momodeveloper.mtn.com',
    env:              process.env.MTN_ENV || 'sandbox',
    currency:         'XAF',
    target_env:       process.env.MTN_ENV === 'prod' ? 'mtnghana' : 'sandbox', // adapter selon pays
  },

  // Orange Money (API Orange Developer)
  orange: {
    client_id:     process.env.ORANGE_CLIENT_ID     || '',
    client_secret: process.env.ORANGE_CLIENT_SECRET || '',
    merchant_key:  process.env.ORANGE_MERCHANT_KEY  || '',
    base_url:      'https://api.orange.com',
    currency:      'XAF',
  },

  // Stripe (cartes internationales)
  stripe: {
    secret_key:      process.env.STRIPE_SECRET_KEY      || '',
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhook_secret:  process.env.STRIPE_WEBHOOK_SECRET  || '',
  },
};

// ─────────────────────────────────────────────────────────
//  1. CINETPAY  (recommandé pour l'Afrique)
//     Couvre : MTN, Orange, Wave, Moov, Airtel, Flooz…
// ─────────────────────────────────────────────────────────
const cinetpay = {
  /**
   * Initie un paiement CinetPay.
   * Retourne l'URL de paiement à rediriger le client.
   */
  async initierPaiement({ transaction_id, montant, description, client_nom, client_email, client_telephone, metadata = {} }) {
    const payload = {
      apikey:         CONFIG.cinetpay.apikey,
      site_id:        CONFIG.cinetpay.site_id,
      transaction_id: String(transaction_id),
      amount:         montant,
      currency:       CONFIG.cinetpay.currency,
      description,
      customer_name:  client_nom        || 'Client',
      customer_email: client_email      || 'client@menucam.cm',
      customer_phone_number: client_telephone || '',
      notify_url:     CONFIG.cinetpay.notify_url,
      return_url:     CONFIG.cinetpay.return_url,
      cancel_url:     CONFIG.cinetpay.cancel_url,
      channels:       'ALL',  // Tous les canaux disponibles
      metadata:       JSON.stringify(metadata),
      lang:           'fr',
    };
    const { data } = await axios.post(`${CONFIG.cinetpay.base_url}/payment`, payload);
    if (data.code !== '201') throw new Error(data.message || 'Erreur CinetPay');
    return { ok: true, payment_url: data.data.payment_url, payment_token: data.data.payment_token };
  },

  /**
   * Vérifie le statut d'un paiement CinetPay.
   */
  async verifierPaiement(transaction_id) {
    const payload = {
      apikey:         CONFIG.cinetpay.apikey,
      site_id:        CONFIG.cinetpay.site_id,
      transaction_id: String(transaction_id),
    };
    const { data } = await axios.post(`${CONFIG.cinetpay.base_url}/payment/check`, payload);
    return {
      ok:      data.code === '00',
      statut:  data.data?.status || 'UNKNOWN', // ACCEPTED | REFUSED | PENDING
      message: data.message,
      data:    data.data,
    };
  },

  /**
   * Traitement du webhook CinetPay (notification serveur).
   * Retourne les infos transaction ou null si invalide.
   */
  async traiterWebhook(body) {
    const cpm_trans_id  = body.cpm_trans_id;
    const cpm_site_id   = body.cpm_site_id;
    const cpm_amount    = body.cpm_amount;
    const statut        = body.cpm_result;    // '00' = succès
    const payment_method= body.payment_method;
    return {
      transaction_id:  cpm_trans_id,
      montant:         cpm_amount,
      statut:          statut === '00' ? 'success' : 'failed',
      methode:         payment_method,
      raw:             body,
    };
  },
};

// ─────────────────────────────────────────────────────────
//  2. MTN MOBILE MONEY  (API MoMo officielle)
// ─────────────────────────────────────────────────────────
const mtn = {
  _token: null,
  _tokenExpiry: 0,

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;
    const credentials = Buffer.from(`${CONFIG.mtn.api_user}:${CONFIG.mtn.api_key}`).toString('base64');
    const { data } = await axios.post(
      `${CONFIG.mtn.base_url}/collection/token/`,
      {},
      { headers: {
          'Authorization': `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': CONFIG.mtn.subscription_key,
        }
      }
    );
    this._token = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._token;
  },

  /**
   * Demande de paiement MTN MoMo (Request to Pay).
   * Le client reçoit une notification USSD sur son téléphone.
   */
  async requestToPay({ reference_id, montant, telephone, description }) {
    const token = await this._getToken();
    await axios.post(
      `${CONFIG.mtn.base_url}/collection/v1_0/requesttopay`,
      {
        amount:   String(montant),
        currency: CONFIG.mtn.currency,
        externalId: reference_id,
        payer: { partyIdType: 'MSISDN', partyId: telephone },
        payerMessage: description || 'Paiement MenuCam',
        payeeNote:    description || 'Paiement MenuCam',
      },
      { headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Reference-Id':            reference_id,
          'X-Target-Environment':      CONFIG.mtn.target_env,
          'Ocp-Apim-Subscription-Key': CONFIG.mtn.subscription_key,
          'Content-Type':              'application/json',
        }
      }
    );
    return { ok: true, reference_id };
  },

  /**
   * Vérifie le statut d'une demande de paiement MTN.
   */
  async verifierPaiement(reference_id) {
    const token = await this._getToken();
    const { data } = await axios.get(
      `${CONFIG.mtn.base_url}/collection/v1_0/requesttopay/${reference_id}`,
      { headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Target-Environment':      CONFIG.mtn.target_env,
          'Ocp-Apim-Subscription-Key': CONFIG.mtn.subscription_key,
        }
      }
    );
    return {
      ok:     data.status === 'SUCCESSFUL',
      statut: data.status, // SUCCESSFUL | FAILED | PENDING
      data,
    };
  },
};

// ─────────────────────────────────────────────────────────
//  3. ORANGE MONEY  (API Orange Developer)
// ─────────────────────────────────────────────────────────
const orange = {
  _token: null,
  _tokenExpiry: 0,

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;
    const credentials = Buffer.from(`${CONFIG.orange.client_id}:${CONFIG.orange.client_secret}`).toString('base64');
    const { data } = await axios.post(
      `${CONFIG.orange.base_url}/oauth/v3/token`,
      'grant_type=client_credentials',
      { headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type':  'application/x-www-form-urlencoded',
        }
      }
    );
    this._token = data.access_token;
    this._tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this._token;
  },

  /**
   * Initie un paiement Orange Money.
   */
  async initierPaiement({ order_id, montant, telephone, description }) {
    const token = await this._getToken();
    const { data } = await axios.post(
      `${CONFIG.orange.base_url}/orange-money-webpay/cm/v1/webpayment`,
      {
        merchant_key: CONFIG.orange.merchant_key,
        currency:     CONFIG.orange.currency,
        order_id:     String(order_id),
        amount:       montant,
        return_url:   process.env.APP_URL ? `${process.env.APP_URL}/paiement/retour` : '',
        cancel_url:   process.env.APP_URL ? `${process.env.APP_URL}/paiement/annule` : '',
        notif_url:    process.env.APP_URL ? `${process.env.APP_URL}/paiement/webhook/orange` : '',
        lang:         'fr',
        reference:    String(order_id),
        customer_phone: telephone,
      },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return { ok: true, payment_url: data.payment_url, pay_token: data.pay_token };
  },

  /**
   * Vérifie le statut d'un paiement Orange Money.
   */
  async verifierPaiement(order_id) {
    const token = await this._getToken();
    const { data } = await axios.get(
      `${CONFIG.orange.base_url}/orange-money-webpay/cm/v1/transactionstatus`,
      {
        params: { order_id },
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    return {
      ok:     data.status === 'SUCCESS',
      statut: data.status,
      data,
    };
  },
};

// ─────────────────────────────────────────────────────────
//  4. STRIPE  (cartes internationales Visa/Mastercard)
// ─────────────────────────────────────────────────────────
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const Stripe = require('stripe');
    _stripe = new Stripe(CONFIG.stripe.secret_key);
  }
  return _stripe;
}

const stripe = {
  /**
   * Crée une session de paiement Stripe Checkout.
   * Retourne l'URL de paiement.
   */
  async creerSession({ commande_id, items, client_email, currency = 'xaf' }) {
    const stripe = getStripe();
    const line_items = items.map(item => ({
      price_data: {
        currency,
        product_data: { name: item.nom },
        unit_amount: Math.round(item.prix * 100), // Stripe en centimes (XAF: *1)
      },
      quantity: item.quantite,
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      customer_email: client_email || undefined,
      success_url: process.env.APP_URL
        ? `${process.env.APP_URL}/paiement/retour?session_id={CHECKOUT_SESSION_ID}&commande=${commande_id}`
        : '/paiement/retour',
      cancel_url: process.env.APP_URL
        ? `${process.env.APP_URL}/paiement/annule?commande=${commande_id}`
        : '/paiement/annule',
      metadata: { commande_id: String(commande_id) },
    });
    return { ok: true, payment_url: session.url, session_id: session.id };
  },

  /**
   * Vérifie le statut d'une session Stripe.
   */
  async verifierSession(session_id) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    return {
      ok:     session.payment_status === 'paid',
      statut: session.payment_status, // paid | unpaid | no_payment_required
      data:   session,
    };
  },

  /**
   * Traite un webhook Stripe (vérification signature).
   */
  async traiterWebhook(rawBody, signature) {
    const stripe = getStripe();
    const event  = stripe.webhooks.constructEvent(rawBody, signature, CONFIG.stripe.webhook_secret);
    return event;
  },

  /** Clé publique pour le frontend */
  publishableKey: () => CONFIG.stripe.publishable_key,
};

// ─────────────────────────────────────────────────────────
//  5. WHATSAPP / Manuel  (pas d'API tiers, simple redirect)
// ─────────────────────────────────────────────────────────
const whatsapp = {
  /**
   * Génère un lien WhatsApp pour finaliser la commande manuellement.
   */
  genererLien({ telephone_restaurant, message }) {
    const tel = telephone_restaurant.replace(/[^0-9+]/g, '');
    const msg = encodeURIComponent(message);
    return `https://wa.me/${tel}?text=${msg}`;
  },

  genererMessage({ num_commande, client_nom, items, total, type_livraison, adresse }) {
    let txt = `🍽️ *Nouvelle commande MenuCam*\n`;
    txt += `📋 N° ${num_commande}\n`;
    txt += `👤 ${client_nom}\n`;
    txt += `📦 ${type_livraison === 'livraison' ? 'Livraison' : type_livraison === 'a_emporter' ? 'À emporter' : 'Sur place'}\n`;
    if (adresse) txt += `📍 ${adresse}\n`;
    txt += `\n*Articles :*\n`;
    items.forEach(i => { txt += `• ${i.quantite}× ${i.nom} — ${(i.prix * i.quantite).toLocaleString('fr-FR')} FCFA\n`; });
    txt += `\n💰 *Total : ${total.toLocaleString('fr-FR')} FCFA*`;
    return txt;
  },
};

// ─────────────────────────────────────────────────────────
//  MODULE UNIFIÉ — point d'entrée unique
// ─────────────────────────────────────────────────────────
module.exports = {
  cinetpay,
  mtn,
  orange,
  stripe,
  whatsapp,
  CONFIG,

  /**
   * Initier un paiement selon la méthode choisie.
   * @param {string} methode — 'cinetpay' | 'mtn' | 'orange' | 'stripe' | 'whatsapp'
   */
  async initier(methode, options) {
    switch (methode) {
      case 'cinetpay': return cinetpay.initierPaiement(options);
      case 'mtn':      return mtn.requestToPay(options);
      case 'orange':   return orange.initierPaiement(options);
      case 'stripe':   return stripe.creerSession(options);
      case 'whatsapp': return { ok: true, lien: whatsapp.genererLien(options) };
      default: throw new Error(`Méthode de paiement inconnue : ${methode}`);
    }
  },

  /**
   * Vérifier le statut d'un paiement.
   */
  async verifier(methode, reference) {
    switch (methode) {
      case 'cinetpay': return cinetpay.verifierPaiement(reference);
      case 'mtn':      return mtn.verifierPaiement(reference);
      case 'orange':   return orange.verifierPaiement(reference);
      case 'stripe':   return stripe.verifierSession(reference);
      default: return { ok: false, message: 'Méthode inconnue' };
    }
  },
};
