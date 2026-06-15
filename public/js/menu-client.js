// ── État ──────────────────────────────────────────────────────
let panier = {};
let typeLivraison = 'sur_place';
let modePaiement  = 'whatsapp';
let promoAppliquee = null;
let reductionMontant = 0;

// ── Panier ────────────────────────────────────────────────────
function ajouterAuPanier(id, nom, prix) {
  if (panier[id]) panier[id].quantite++;
  else panier[id] = { id, nom, prix, quantite: 1 };
  updateUI(); animerBtn(id);
}

function retirerDuPanier(id) {
  if (!panier[id]) return;
  panier[id].quantite--;
  if (panier[id].quantite <= 0) delete panier[id];
  updateUI(); mettreAJourModal();
}

function animerBtn(id) {
  const btn = document.getElementById(`btn-${id}`);
  if (!btn) return;
  const qty = panier[id]?.quantite || 0;
  btn.textContent = qty > 0 ? qty : '+';
  btn.classList.toggle('in-cart', qty > 0);
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => btn.style.transform = 'scale(1)', 200);
}

function updateUI() {
  const items = Object.values(panier);
  const sous_total = items.reduce((s, i) => s + i.prix * i.quantite, 0);
  const count = items.reduce((s, i) => s + i.quantite, 0);
  const bar = document.getElementById('panierBar');
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('panierCount').textContent = `${count} article${count>1?'s':''}`;
    document.getElementById('panierTotal').textContent = `${(sous_total - reductionMontant).toLocaleString('fr-FR')} FCFA`;
  } else {
    bar.style.display = 'none';
  }
  document.querySelectorAll('.add-btn').forEach(btn => {
    const id = btn.id.replace('btn-', '');
    const qty = panier[id]?.quantite || 0;
    btn.textContent = qty > 0 ? qty : '+';
    btn.classList.toggle('in-cart', qty > 0);
  });
}

function mettreAJourModal() {
  const items = Object.values(panier);
  const sous_total = items.reduce((s, i) => s + i.prix * i.quantite, 0);
  const container = document.getElementById('panierItems');
  if (items.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--gris);padding:2rem">Votre panier est vide.</p>';
  } else {
    container.innerHTML = items.map(item => `
      <div class="panier-item">
        <div style="flex:1">
          <div class="pi-nom">${item.nom}</div>
          <div class="pi-prix">${item.prix.toLocaleString('fr-FR')} FCFA × ${item.quantite} = <strong>${(item.prix*item.quantite).toLocaleString('fr-FR')} FCFA</strong></div>
        </div>
        <div class="pi-controls">
          <button class="pi-btn" onclick="retirerDuPanier('${item.id}')">−</button>
          <span class="pi-qty">${item.quantite}</span>
          <button class="pi-btn" onclick="ajouterAuPanier('${item.id}','${item.nom.replace(/'/g,"\\'")}',${item.prix})">+</button>
        </div>
      </div>`).join('');
  }
  // Récap prix
  const total_final = Math.max(0, sous_total - reductionMontant);
  const frais_livraison = typeLivraison === 'livraison' ? 500 : 0;
  document.getElementById('panierRecap').innerHTML = `
    <div class="recap-line"><span>Sous-total</span><span>${sous_total.toLocaleString('fr-FR')} FCFA</span></div>
    ${frais_livraison > 0 ? `<div class="recap-line"><span>🛵 Frais livraison</span><span>${frais_livraison.toLocaleString('fr-FR')} FCFA</span></div>` : ''}
    ${reductionMontant > 0 ? `<div class="recap-line recap-promo"><span>🎁 Promo ${promoAppliquee?.code||''}</span><span>-${reductionMontant.toLocaleString('fr-FR')} FCFA</span></div>` : ''}
    <div class="recap-line total"><span>Total</span><span>${(total_final + frais_livraison).toLocaleString('fr-FR')} FCFA</span></div>
  `;
  // Bouton commander selon paiement
  const btn = document.getElementById('btnCommander');
  if (btn) {
    btn.className = `btn-commander ${modePaiement}`;
    btn.innerHTML = modePaiement === 'whatsapp'
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Commander via WhatsApp`
      : modePaiement === 'mtn'
      ? '📱 Payer avec MTN Mobile Money'
      : '🟠 Payer avec Orange Money';
  }
}

function ouvrirPanier() {
  document.getElementById('panierOverlay').style.display = 'flex';
  mettreAJourModal();
  document.body.style.overflow = 'hidden';
}

function fermerPanier() {
  document.getElementById('panierOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('panierOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) fermerPanier(); });

// ── Livraison ─────────────────────────────────────────────────
function selectDelivery(el, type) {
  document.querySelectorAll('.delivery-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  typeLivraison = type;
  document.getElementById('tableRow').style.display   = type === 'sur_place'  ? '' : 'none';
  document.getElementById('adresseRow').style.display = type === 'livraison'  ? '' : 'none';
  document.getElementById('quartierRow').style.display= type === 'livraison'  ? '' : 'none';
  mettreAJourModal();
}

// ── Paiement ──────────────────────────────────────────────────
function selectPay(el, pay) {
  document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  modePaiement = pay;
  mettreAJourModal();
}

// ── Promo ─────────────────────────────────────────────────────
async function verifierPromo() {
  const code = document.getElementById('promoCode').value.trim();
  const items = Object.values(panier);
  const sous_total = items.reduce((s, i) => s + i.prix * i.quantite, 0);
  const msg = document.getElementById('promoMsg');
  if (!code) return;
  try {
    const res = await fetch('/promos/verifier', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, restaurant_id: RESTAURANT_ID, total: sous_total })
    });
    const data = await res.json();
    msg.style.color = data.ok ? 'var(--vert2)' : 'var(--rouge)';
    msg.textContent = data.message;
    if (data.ok) { promoAppliquee = data.promo; reductionMontant = data.reduction; }
    else          { promoAppliquee = null; reductionMontant = 0; }
    mettreAJourModal();
  } catch(e) { msg.textContent = 'Erreur réseau.'; }
}

// ── Commander ─────────────────────────────────────────────────
async function commander() {
  const items = Object.values(panier);
  if (items.length === 0) return;
  const nom    = document.getElementById('clientNom').value.trim()    || 'Client';
  const tel    = document.getElementById('clientTel').value.trim()    || '';
  const table  = document.getElementById('clientTable').value.trim()  || '';
  const adresse= document.getElementById('clientAdresse')?.value.trim()|| '';
  const quartier=document.getElementById('clientQuartier')?.value.trim()||'';
  const note   = document.getElementById('clientNote').value.trim()   || '';
  const sous_total = items.reduce((s,i) => s+i.prix*i.quantite, 0);
  const frais  = typeLivraison === 'livraison' ? 500 : 0;
  const total  = Math.max(0, sous_total - reductionMontant) + frais;

  // Enregistrer commande
  const payload = {
    restaurant_id: RESTAURANT_ID, items,
    client_nom: nom, client_telephone: tel,
    client_adresse: adresse, client_quartier: quartier,
    client_table: table, note,
    type_livraison: typeLivraison, paiement: modePaiement,
    promo_code: promoAppliquee?.code || null,
    total_avant_promo: sous_total, reduction: reductionMontant, total
  };

  let numCommande = '';
  try {
    const res = await fetch('/commandes/nouvelle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.ok) numCommande = data.num_commande;
  } catch(e) { console.error(e); }

  fermerPanier();

  if (modePaiement === 'whatsapp') {
    // Message WhatsApp
    let msg = `🍽️ *Commande — ${RESTAURANT_NOM}*\n`;
    msg += `📋 *N°* ${numCommande}\n`;
    msg += `👤 *Client :* ${nom}`;
    if (tel) msg += ` · 📞 ${tel}`;
    msg += `\n*Type :* ${typeLivraison === 'sur_place' ? '🪑 Sur place' : typeLivraison === 'a_emporter' ? '🛍️ À emporter' : '🛵 Livraison'}\n`;
    if (table) msg += `*Table :* ${table}\n`;
    if (adresse) msg += `*Adresse :* ${adresse}${quartier ? ', ' + quartier : ''}\n`;
    msg += `\n*Commande :*\n`;
    items.forEach(i => { msg += `• ${i.quantite}× ${i.nom} — ${(i.prix*i.quantite).toLocaleString('fr-FR')} FCFA\n`; });
    if (reductionMontant > 0) msg += `\n🎁 *Promo ${promoAppliquee?.code} :* -${reductionMontant.toLocaleString('fr-FR')} FCFA\n`;
    msg += `\n💰 *Total : ${total.toLocaleString('fr-FR')} FCFA*`;
    if (note) msg += `\n📝 ${note}`;
    const tel2 = RESTAURANT_TEL.replace(/\D/g,'');
    window.open(`https://wa.me/${tel2.startsWith('237')?tel2:'237'+tel2}?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    // Paiement Mobile Money
    afficherModalMobileMoney(modePaiement, total, nom, numCommande);
    return;
  }

  panier = {}; promoAppliquee = null; reductionMontant = 0;
  updateUI();
  afficherConfirmation(numCommande);
}

// ── Mobile Money ──────────────────────────────────────────────
function afficherModalMobileMoney(type, total, nom, numCommande) {
  const isMTN = type === 'mtn';
  const couleur = isMTN ? '#FFCC00' : '#FF6B00';
  const textColor = isMTN ? '#1A1209' : '#fff';
  const nom_service = isMTN ? 'MTN Mobile Money' : 'Orange Money';
  const code_ussd   = isMTN ? '#126#' : '#150#';

  const div = document.createElement('div');
  div.className = 'confirm-overlay';
  div.innerHTML = `
    <div class="confirm-modal">
      <div style="background:${couleur};color:${textColor};border-radius:50%;width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 1rem">📱</div>
      <h2 style="margin-bottom:0.5rem">${nom_service}</h2>
      <div class="order-num">${numCommande}</div>
      <div style="background:#f5f5f5;border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:left;font-size:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Montant</span><strong style="color:${isMTN?'#b8860b':'#cc5500'}">${total.toLocaleString('fr-FR')} FCFA</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Bénéficiaire</span><strong>${RESTAURANT_NOM}</strong></div>
        <div style="display:flex;justify-content:space-between"><span>Référence</span><strong>${numCommande}</strong></div>
      </div>
      <div style="background:${couleur}22;border-radius:10px;padding:12px;margin-bottom:1rem;font-size:13px;color:var(--gris)">
        <strong>Instructions :</strong><br/>
        1. Composez <strong>${code_ussd}</strong> sur votre téléphone<br/>
        2. Sélectionnez "Payer" ou "Transfert"<br/>
        3. Entrez le numéro : <strong>${RESTAURANT_TEL||'Contactez le restaurant'}</strong><br/>
        4. Montant : <strong>${total.toLocaleString('fr-FR')} FCFA</strong><br/>
        5. Référence : <strong>${numCommande}</strong>
      </div>
      <button onclick="confirmerPaiementMM(this,${isMTN?'true':'false'})" style="width:100%;padding:13px;background:${couleur};color:${textColor};border:none;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;margin-bottom:10px">✅ J'ai effectué le paiement</button>
      <button onclick="this.closest('.confirm-overlay').remove()" style="width:100%;padding:10px;background:transparent;border:1px solid var(--border);border-radius:12px;color:var(--gris);cursor:pointer;font-size:14px">Annuler</button>
    </div>`;
  document.body.appendChild(div);
}

function confirmerPaiementMM(btn, isMTN) {
  btn.textContent = '⏳ Vérification en cours...';
  btn.disabled = true;
  setTimeout(() => {
    btn.closest('.confirm-overlay').remove();
    panier = {}; promoAppliquee = null; reductionMontant = 0;
    updateUI();
    afficherConfirmation('', isMTN);
  }, 2000);
}

// ── Confirmation ──────────────────────────────────────────────
function afficherConfirmation(numCommande, isMM = false) {
  const div = document.createElement('div');
  div.className = 'confirm-overlay';
  div.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-icon">🎉</div>
      <h2>Commande envoyée !</h2>
      ${numCommande ? `<div class="order-num">N° ${numCommande}</div>` : ''}
      <p>${isMM ? 'Paiement enregistré. Le restaurant a été notifié.' : 'Votre commande a été transmise. Le restaurant va la prendre en charge.'}</p>
      ${numCommande ? `
        <a href="/commandes/suivi/${numCommande}" style="display:block;background:var(--or);color:#fff;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;margin-bottom:10px">📦 Suivre ma commande</a>
      ` : ''}
      <p style="font-size:13px;color:var(--gris);margin-bottom:1.25rem">Notez votre expérience</p>
      <div class="rating-ask">
        <div class="rating-stars" id="ratingStars">
          ${[1,2,3,4,5].map(i=>`<span class="rating-star" onclick="noterExperience(${i})" data-val="${i}">★</span>`).join('')}
        </div>
      </div>
      <button onclick="this.closest('.confirm-overlay').remove()" style="width:100%;padding:12px;background:var(--gris-light);border:none;border-radius:12px;color:var(--gris);cursor:pointer;font-size:14px;margin-top:1rem">Fermer</button>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 30000);
}

let noteSelectionnee = 0;
function noterExperience(note) {
  noteSelectionnee = note;
  document.querySelectorAll('.rating-star').forEach((s,i) => s.classList.toggle('active', i < note));
  setTimeout(() => soumettreAvis(), 500);
}

async function soumettreAvis() {
  const avisTexte = prompt('Laissez un commentaire (optionnel) :') || '';
  const clientNom = document.getElementById('clientNom')?.value || 'Client anonyme';
  try {
    await fetch('/avis/nouveau', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: RESTAURANT_ID, note: noteSelectionnee, texte: avisTexte, client_nom: clientNom })
    });
    document.querySelector('.rating-ask').innerHTML = '<p style="color:var(--vert2);font-weight:600">✅ Merci pour votre avis !</p>';
  } catch(e) {}
}

// ── Navigation catégories ─────────────────────────────────────
function scrollTocat(cat) {
  const el = document.getElementById(`cat-${cat.replace(/\s/g, '-')}`);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
}

const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const cat = e.target.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      const ab = [...document.querySelectorAll('.cat-btn')].find(b => b.textContent.trim() === cat);
      if (ab) { ab.classList.add('active'); ab.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' }); }
    }
  });
}, { rootMargin: '-30% 0px -60% 0px' });
document.querySelectorAll('.menu-section').forEach(s => obs.observe(s));
