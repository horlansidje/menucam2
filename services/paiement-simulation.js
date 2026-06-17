/**
 * ══════════════════════════════════════════════════════════
 *  MenuCam — Service de Paiement SIMULATION
 *  Simule : MTN MoMo, Orange Money, CinetPay
 *
 *  Activé automatiquement si PAYMENT_SIMULATION=true dans .env
 *  OU si les clés API réelles ne sont pas configurées.
 * ══════════════════════════════════════════════════════════
 */

// Stockage en mémoire des transactions simulées
const transactions = new Map();

/**
 * Génère un état initial pour une transaction simulée.
 */
function creerTransaction({ reference_id, methode, montant, telephone, description }) {
  const tx = {
    reference_id,
    methode,
    montant,
    telephone: telephone || '',
    description: description || '',
    statut: 'PENDING',    // PENDING → SUCCESSFUL | FAILED
    created_at: Date.now(),
    confirmed_at: null,
  };
  transactions.set(reference_id, tx);
  return tx;
}

/**
 * Confirme (succès) ou refuse une transaction simulée.
 * Appelé par la route de simulation POST /paiement/simulation/confirmer
 */
function confirmerTransaction(reference_id, succes = true) {
  const tx = transactions.get(reference_id);
  if (!tx) return null;
  tx.statut = succes ? 'SUCCESSFUL' : 'FAILED';
  tx.confirmed_at = Date.now();
  return tx;
}

/**
 * Retourne l'état actuel d'une transaction.
 */
function lireTransaction(reference_id) {
  return transactions.get(reference_id) || null;
}

// ── Adaptateurs compatibles avec services/paiement.js ─────

const mtnSim = {
  async requestToPay({ reference_id, montant, telephone, description }) {
    creerTransaction({ reference_id, methode: 'mtn', montant, telephone, description });
    return { ok: true, reference_id };
  },
  async verifierPaiement(reference_id) {
    const tx = lireTransaction(reference_id);
    if (!tx) return { ok: false, statut: 'NOT_FOUND' };
    return {
      ok:     tx.statut === 'SUCCESSFUL',
      statut: tx.statut,
      data:   tx,
    };
  },
};

const orangeSim = {
  async initierPaiement({ order_id, montant, telephone, description }) {
    creerTransaction({ reference_id: order_id, methode: 'orange', montant, telephone, description });
    // Pas de redirection réelle — on renvoie ok sans payment_url
    return { ok: true, simulated: true };
  },
  async verifierPaiement(order_id) {
    const tx = lireTransaction(order_id);
    if (!tx) return { ok: false, statut: 'NOT_FOUND' };
    return {
      ok:     tx.statut === 'SUCCESSFUL',
      statut: tx.statut,
      data:   tx,
    };
  },
};

const cinetpaySim = {
  async initierPaiement({ transaction_id, montant, description, client_nom, client_telephone }) {
    creerTransaction({
      reference_id: transaction_id,
      methode: 'cinetpay',
      montant,
      telephone: client_telephone || '',
      description,
    });
    // Pas de redirection réelle
    return { ok: true, simulated: true };
  },
  async verifierPaiement(transaction_id) {
    const tx = lireTransaction(transaction_id);
    if (!tx) return { ok: false, statut: 'UNKNOWN' };
    return {
      ok:     tx.statut === 'SUCCESSFUL',
      statut: tx.statut === 'SUCCESSFUL' ? 'ACCEPTED' : tx.statut === 'FAILED' ? 'REFUSED' : 'PENDING',
      data:   tx,
    };
  },
};

module.exports = {
  mtnSim,
  orangeSim,
  cinetpaySim,
  creerTransaction,
  confirmerTransaction,
  lireTransaction,
  transactions,

  /**
   * Vérifie si le mode simulation est actif.
   * Actif si PAYMENT_SIMULATION=true OU si les clés ne sont pas définies.
   */
  estActif() {
    if (process.env.PAYMENT_SIMULATION === 'true') return true;
    // Auto-activation si aucune clé réelle n'est configurée
    const aucuneMtn    = !process.env.MTN_SUBSCRIPTION_KEY;
    const aucuneOrange = !process.env.ORANGE_CLIENT_ID;
    const aucuneCinet  = !process.env.CINETPAY_APIKEY;
    return aucuneMtn && aucuneOrange && aucuneCinet;
  },
};
