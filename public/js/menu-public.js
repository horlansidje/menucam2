// ── State ─────────────────────────────────────────────────────
let cart = {};
let deliveryType = 'sur_place';
let payMethod = 'whatsapp';
let promoApplied = null;
let promoReduction = 0;

// ── Cart operations ───────────────────────────────────────────
function addToCart(id, nom, prix) {
  if (cart[id]) cart[id].qty++;
  else cart[id] = { id, nom, prix, qty: 1 };
  updateCartUI();
  animateAddBtn(id);
}

function removeFromCart(id) {
  if (!cart[id]) return;
  cart[id].qty--;
  if (cart[id].qty <= 0) delete cart[id];
  updateCartUI();
  renderCartItems();
}

function animateAddBtn(id) {
  const btn = document.getElementById(`add-${id}`);
  if (!btn) return;
  const qty = cart[id]?.qty || 0;
  btn.textContent = qty > 0 ? qty : '+';
  btn.classList.toggle('in-cart', qty > 0);
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => btn.style.transform = 'scale(1)', 200);
}

function getSubtotal() {
  return Object.values(cart).reduce((s, i) => s + i.prix * i.qty, 0);
}

function getTotalCount() {
  return Object.values(cart).reduce((s, i) => s + i.qty, 0);
}

function updateCartUI() {
  const items = Object.values(cart);
  const count = getTotalCount();
  const subtotal = getSubtotal();
  const total = Math.max(0, subtotal - promoReduction) + (deliveryType === 'livraison' ? 500 : 0);
  const bar = document.getElementById('cartBar');
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('cartCount').textContent = `${count} article${count > 1 ? 's' : ''}`;
    document.getElementById('cartTotal').textContent = `${total.toLocaleString('fr-FR')} FCFA`;
  } else {
    bar.style.display = 'none';
  }
  document.querySelectorAll('.add-btn').forEach(btn => {
    const id = btn.id.replace('add-', '');
    const qty = cart[id]?.qty || 0;
    btn.textContent = qty > 0 ? qty : '+';
    btn.classList.toggle('in-cart', qty > 0);
  });
}

// ── Drawer ────────────────────────────────────────────────────
function openCart() {
  document.getElementById('drawerOverlay').style.display = 'block';
  document.getElementById('cartDrawer').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('drawerOverlay').style.display = 'none';
  document.getElementById('cartDrawer').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('drawerOverlay')?.addEventListener('click', closeCart);
document.getElementById('drawerHandle')?.addEventListener('click', closeCart);

function renderCartItems() {
  const container = document.getElementById('cartItemsList');
  const items = Object.values(cart);
  if (!container) return;
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-2)">
      <div style="font-size:2.5rem;margin-bottom:0.75rem">🛒</div>
      <p>Votre panier est vide</p></div>`;
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="cart-item">
      <div style="flex:1">
        <div class="cart-item-name">${item.nom}</div>
        <div class="cart-item-sub">${item.prix.toLocaleString('fr-FR')} FCFA × ${item.qty} = <strong>${(item.prix * item.qty).toLocaleString('fr-FR')} FCFA</strong></div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="removeFromCart('${item.id}')">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="addToCart('${item.id}','${item.nom.replace(/'/g,"\\'")}',${item.prix})">+</button>
      </div>
    </div>`).join('');
  renderPriceRecap();
  updateCommanderBtn();
}

function renderPriceRecap() {
  const subtotal = getSubtotal();
  const fraisLiv = deliveryType === 'livraison' ? 500 : 0;
  const total = Math.max(0, subtotal - promoReduction) + fraisLiv;
  const recap = document.getElementById('priceRecap');
  if (!recap) return;
  recap.innerHTML = `
    <div class="price-line"><span>Sous-total</span><span>${subtotal.toLocaleString('fr-FR')} FCFA</span></div>
    ${fraisLiv > 0 ? `<div class="price-line"><span>🛵 Frais livraison</span><span>${fraisLiv.toLocaleString('fr-FR')} FCFA</span></div>` : ''}
    ${promoReduction > 0 ? `<div class="price-line promo"><span>🎁 Promo ${promoApplied?.code}</span><span>-${promoReduction.toLocaleString('fr-FR')} FCFA</span></div>` : ''}
    <div class="price-line total"><span>Total</span><span>${total.toLocaleString('fr-FR')} FCFA</span></div>`;
}

// ── Delivery type ─────────────────────────────────────────────
function selectDelivery(el, type) {
  document.querySelectorAll('.del-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  deliveryType = type;
  document.getElementById('tableRow').style.display    = type === 'sur_place'  ? '' : 'none';
  document.getElementById('adresseRows').style.display = type === 'livraison'  ? '' : 'none';
  renderPriceRecap();
  updateCommanderBtn();
}

// ── Payment method ────────────────────────────────────────────
function selectPay(el, method) {
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
  payMethod = method;
  updateCommanderBtn();
}

function updateCommanderBtn() {
  const btn = document.getElementById('btnCommander');
  if (!btn) return;
  const labels = {
    whatsapp:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Commander via WhatsApp`,
    mtn:       '📱 Payer avec MTN Mobile Money',
    orange:    '🟠 Payer avec Orange Money',
    cinetpay:  '🌍 Payer avec Mobile Money (CinetPay)',
    stripe:    '💳 Payer par carte bancaire (Stripe)'
  };
  // Afficher notice paiement en ligne
  const notice = document.getElementById('paymentOnlineNotice');
  if (notice) notice.style.display = ['cinetpay','stripe'].includes(payMethod) ? 'block' : 'none';
  btn.className = `btn-commander btn-${payMethod === 'whatsapp' ? 'wa' : (payMethod === 'cinetpay' || payMethod === 'stripe' ? 'primary' : payMethod)}`;
  btn.innerHTML = labels[payMethod];
}

// ── Promo code ────────────────────────────────────────────────
async function applyPromo() {
  const code = document.getElementById('promoInput')?.value.trim();
  const msg  = document.getElementById('promoMsg');
  if (!code) return;
  try {
    const res = await fetch('/promos/verifier', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, restaurant_id: RESTAURANT_ID, total: getSubtotal() })
    });
    const data = await res.json();
    msg.className = `promo-msg ${data.ok ? 'ok' : 'err'}`;
    msg.textContent = data.message;
    if (data.ok) { promoApplied = data.promo; promoReduction = data.reduction; }
    else          { promoApplied = null; promoReduction = 0; }
    renderPriceRecap();
  } catch(e) { msg.className = 'promo-msg err'; msg.textContent = 'Erreur réseau.'; }
}

// ── Commander ─────────────────────────────────────────────────
async function commander() {
  const items = Object.values(cart);
  if (items.length === 0) return;
  const nom     = document.getElementById('clientNom')?.value.trim()     || 'Client';
  const tel     = document.getElementById('clientTel')?.value.trim()     || '';
  const table   = document.getElementById('clientTable')?.value.trim()   || '';
  const adresse = document.getElementById('clientAdresse')?.value.trim() || '';
  const quartier= document.getElementById('clientQuartier')?.value.trim()|| '';
  const note    = document.getElementById('clientNote')?.value.trim()    || '';
  const subtotal= getSubtotal();
  const frais   = deliveryType === 'livraison' ? 500 : 0;
  const total   = Math.max(0, subtotal - promoReduction) + frais;

  const payload = {
    restaurant_id: RESTAURANT_ID, items: items.map(i => ({ id: i.id, nom: i.nom, prix: i.prix, quantite: i.qty })),
    client_nom: nom, client_telephone: tel, client_adresse: adresse,
    client_quartier: quartier, client_table: table, note,
    type_livraison: deliveryType, paiement: payMethod,
    promo_code: promoApplied?.code || null,
    total_avant_promo: subtotal, reduction: promoReduction, total,
    lat: (typeof clientCoords !== "undefined" && clientCoords) ? clientCoords.lat : null,
    lng: (typeof clientCoords !== "undefined" && clientCoords) ? clientCoords.lng : null,
  };

  let numCommande = '';
  try {
    const res = await fetch('/commandes/nouvelle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.ok) numCommande = data.num_commande;
  } catch(e) { console.error(e); }

  // Vérification fidélité — récompense automatique
  try {
    const fidRes = await fetch('/fidelite/api/check-fidelite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: RESTAURANT_ID, client_nom: nom, client_telephone: tel, total_commande: total })
    });
    const fidData = await fidRes.json();
    if (fidData.ok && fidData.offre) {
      setTimeout(() => showToast('🎁 ' + fidData.offre.message, 'success', 6000), 2000);
    }
  } catch(e) { /* silencieux */ }

  closeCart();

  if (!numCommande) {
    showToast('❌ Erreur lors de la création de la commande.', 'error');
    return;
  }

  // ── WhatsApp ──────────────────────────────────────────────
  if (payMethod === 'whatsapp') {
    let msg = `🍽️ *Nouvelle commande — ${RESTAURANT_NOM}*\n📋 Réf : *${numCommande}*\n👤 ${nom}`;
    if (tel) msg += ` · 📞 ${tel}`;
    msg += `\n🏷️ ${deliveryType === 'sur_place' ? '🪑 Sur place' : deliveryType === 'a_emporter' ? '🛍️ À emporter' : '🛵 Livraison'}`;
    if (table) msg += ` · Table ${table}`;
    if (adresse) msg += `\n📍 ${adresse}${quartier ? ', ' + quartier : ''}`;
    msg += `\n\n📦 *Commande :*\n`;
    items.forEach(i => { msg += `• ${i.qty}× ${i.nom} — ${(i.prix * i.qty).toLocaleString('fr-FR')} FCFA\n`; });
    if (promoReduction > 0) msg += `\n🎁 Promo *${promoApplied?.code}* : -${promoReduction.toLocaleString('fr-FR')} FCFA`;
    msg += `\n💰 *Total : ${total.toLocaleString('fr-FR')} FCFA*`;
    if (note) msg += `\n📝 ${note}`;
    const phone = RESTAURANT_TEL.replace(/\D/g, '');
    window.open(`https://wa.me/${phone.startsWith('237') ? phone : '237' + phone}?text=${encodeURIComponent(msg)}`, '_blank');
    cart = {}; promoApplied = null; promoReduction = 0;
    updateCartUI();
    showConfirmModal(numCommande, false);

  // ── CinetPay / Stripe → Redirection page paiement ────────
  } else if (payMethod === 'cinetpay' || payMethod === 'stripe') {
    cart = {}; promoApplied = null; promoReduction = 0;
    updateCartUI();
    showToast('⏳ Redirection vers le paiement…', '', 2000);
    setTimeout(() => { window.location.href = `/paiement/${numCommande}`; }, 800);

  // ── MTN / Orange → page paiement avec instructions ───────
  } else if (payMethod === 'mtn' || payMethod === 'orange') {
    cart = {}; promoApplied = null; promoReduction = 0;
    updateCartUI();
    // Rediriger vers la page paiement dédiée (gestion polling + instructions)
    showToast('⏳ Redirection vers le paiement…', '', 2000);
    setTimeout(() => { window.location.href = `/paiement/${numCommande}`; }, 800);

  } else {
    // Fallback générique
    cart = {}; promoApplied = null; promoReduction = 0;
    updateCartUI();
    showConfirmModal(numCommande, false);
  }
}

// ── Mobile Money modal ────────────────────────────────────────
function showMobileMoneyModal(type, total, numCommande) {
  const isMTN = type === 'mtn';
  const color = isMTN ? '#FFCC00' : '#FF6B00';
  const textColor = isMTN ? '#1a1a1a' : '#fff';
  const name = isMTN ? 'MTN Mobile Money' : 'Orange Money';
  const ussd = isMTN ? '*126#' : '*150#';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="width:64px;height:64px;border-radius:50%;background:${color};color:${textColor};display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 1rem">📱</div>
      <h2>${name}</h2>
      <div class="order-num-display">${numCommande}</div>
      <div class="mm-instructions">
        <strong>Instructions :</strong><br/>
        1. Composez <strong>${ussd}</strong><br/>
        2. Sélectionnez "Paiement marchand"<br/>
        3. Numéro marchand : <strong>${RESTAURANT_TEL || 'Contactez le restaurant'}</strong><br/>
        4. Montant : <strong>${total.toLocaleString('fr-FR')} FCFA</strong><br/>
        5. Référence : <strong>${numCommande}</strong>
      </div>
      <button onclick="confirmMM(this, '${numCommande}')" style="width:100%;padding:13px;background:${color};color:${textColor};border:none;border-radius:var(--r-sm);font-weight:700;font-size:15px;cursor:pointer;margin-top:1.25rem;font-family:inherit">✅ J'ai effectué le paiement</button>
      <button onclick="this.closest('.modal-overlay').remove()" style="width:100%;padding:10px;background:transparent;border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text-2);cursor:pointer;font-size:14px;margin-top:8px;font-family:inherit">Annuler</button>
    </div>`;
  document.body.appendChild(overlay);
}

function confirmMM(btn, numCommande) {
  btn.textContent = '⏳ Vérification...';
  btn.disabled = true;
  setTimeout(() => {
    btn.closest('.modal-overlay').remove();
    cart = {}; promoApplied = null; promoReduction = 0;
    updateCartUI();
    showConfirmModal(numCommande, true);
  }, 2000);
}

// ── Confirmation modal ────────────────────────────────────────
function showConfirmModal(numCommande, isMM = false) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">🎉</div>
      <h2>Commande envoyée !</h2>
      ${numCommande ? `<div class="order-num-display">N° ${numCommande}</div>` : ''}
      <p>${isMM ? 'Votre paiement a été transmis. Le restaurant va préparer votre commande.' : 'Votre commande a bien été transmise via WhatsApp.'}</p>
      ${numCommande ? `<a href="/commandes/suivi/${numCommande}" class="track-link">📦 Suivre ma commande en temps réel</a>` : ''}
      <p style="font-size:13px;color:var(--text-2);margin-bottom:0.75rem">Notez votre expérience :</p>
      <div class="rating-stars-input" id="ratingStars">
        ${[1,2,3,4,5].map(i => `<span class="rs" onclick="rateExp(${i})" data-v="${i}">★</span>`).join('')}
      </div>
      <button onclick="this.closest('.modal-overlay').remove()" style="width:100%;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text-2);cursor:pointer;font-size:14px;margin-top:1.25rem;font-family:inherit">Fermer</button>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 30000);
}

let selectedRating = 0;
function rateExp(n) {
  selectedRating = n;
  document.querySelectorAll('.rs').forEach((s, i) => s.classList.toggle('active', i < n));
  setTimeout(submitRating, 600);
}

async function submitRating() {
  const nom = document.getElementById('clientNom')?.value || 'Client anonyme';
  const text = prompt('Laissez un commentaire (optionnel) :') || '';
  try {
    await fetch('/avis/nouveau', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: RESTAURANT_ID, note: selectedRating, texte: text, client_nom: nom })
    });
    const stars = document.getElementById('ratingStars');
    if (stars) stars.innerHTML = '<p style="color:var(--accent-dark);font-weight:600">✅ Merci pour votre avis !</p>';
  } catch(e) {}
}

// ── Search & Filter ───────────────────────────────────────────
document.getElementById('searchInput')?.addEventListener('input', function() {
  const q = this.value.toLowerCase().trim();
  document.querySelectorAll('.plat-row').forEach(row => {
    const name = row.dataset.name || '';
    const desc = row.dataset.desc || '';
    row.style.display = (name.includes(q) || desc.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.menu-section').forEach(sec => {
    const visible = [...sec.querySelectorAll('.plat-row')].some(r => r.style.display !== 'none');
    sec.style.display = visible ? '' : 'none';
  });
  const noResults = document.getElementById('noResults');
  const anyVisible = [...document.querySelectorAll('.plat-row')].some(r => r.style.display !== 'none');
  if (noResults) noResults.style.display = anyVisible ? 'none' : 'block';
});

// Category filter
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const cat = pill.dataset.cat;
    // Clear search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.menu-section').forEach(sec => {
      sec.style.display = (cat === 'tous' || sec.dataset.cat === cat) ? '' : 'none';
      sec.querySelectorAll('.plat-row').forEach(r => r.style.display = '');
    });
    if (cat !== 'tous') {
      const el = document.querySelector(`.menu-section[data-cat="${cat}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Scroll spy
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const cat = e.target.dataset.cat;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.toggle('active', p.dataset.cat === cat));
      const active = document.querySelector(`.cat-pill[data-cat="${cat}"]`);
      active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
}, { rootMargin: '-25% 0px -65% 0px' });
document.querySelectorAll('.menu-section').forEach(s => observer.observe(s));

// ── Init ──────────────────────────────────────────────────────
updateCommanderBtn();

// ── Géolocalisation — override selectDelivery ─────────────────
const _origSelectDelivery = selectDelivery;
selectDelivery = function(el, type) {
  _origSelectDelivery(el, type);
  if (type === 'livraison') {
    // Initialiser la carte avec un petit délai pour que le DOM soit visible
    setTimeout(() => {
      if (typeof initClientMap === 'function') initClientMap();
    }, 150);
  }
};

// Sauvegarder les coords GPS avec la commande
const _origCommander = commander;
commander = async function() {
  // Si on a des coordonnées GPS, les inclure dans la commande
  if (typeof clientCoords !== 'undefined' && clientCoords) {
    window._gpsCoords = clientCoords;
  }
  await _origCommander();
};
