const socket = io();
socket.emit('rejoindre_restaurant', restaurantId);

socket.on('nouvelle_commande', data => {
  const c = data.commande;
  showToast(`🛒 Nouvelle commande ! ${c.client_nom} — ${c.total.toLocaleString('fr-FR')} FCFA`, 'default');
  const list = document.getElementById('commandesList');
  if (!list) return;
  list.querySelector('.empty-state')?.remove();
  const icon = c.type_livraison === 'livraison' ? '🛵' : c.type_livraison === 'a_emporter' ? '🛍️' : '🪑';
  const card = document.createElement('div');
  card.className = 'cmd-card'; card.id = `cmd-${c._id}`;
  card.innerHTML = buildCmdCardHTML(c, icon);
  list.insertBefore(card, list.firstChild);
  const badge = document.querySelector('.nav-badge');
  if (badge) badge.textContent = parseInt(badge.textContent || 0) + 1;
});

socket.on('statut_commande', data => {
  const badge = document.getElementById(`statut-${data.commande_id}`);
  if (!badge) return;
  const map = { en_attente: ['warning','⏳ En attente'], en_preparation: ['info','👨‍🍳 Préparation'], en_livraison: ['purple','🛵 En route'], servie: ['success','✅ Servie'], livree: ['success','✅ Livrée'], annulee: ['danger','❌ Annulée'] };
  const [type, label] = map[data.statut] || ['gray', data.statut];
  badge.className = `badge badge-${type}`;
  badge.textContent = label;
});

function buildCmdCardHTML(c, icon) {
  const payLabel = c.paiement === 'mtn' ? '📱 MTN' : c.paiement === 'orange' ? '🟠 Orange' : '💬 WA';
  const map = { en_attente: ['warning','⏳ En attente'], en_preparation: ['info','👨‍🍳 Préparation'], en_livraison: ['purple','🛵 En route'], servie: ['success','✅ Servie'], livree: ['success','✅ Livrée'], annulee: ['danger','❌ Annulée'] };
  const [type, label] = map[c.statut] || ['gray', c.statut];
  return `
    <div class="cmd-card-header">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.5rem">${icon}</span>
        <div>
          <div class="cmd-num">${c.num_commande || ''}</div>
          <div class="cmd-client-name">${c.client_nom}</div>
          ${c.client_telephone ? `<div style="font-size:12px;color:var(--text-secondary)">📞 ${c.client_telephone}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="badge badge-gray">${payLabel}</span>
        <span class="badge badge-${type}" id="statut-${c._id}">${label}</span>
        <span style="font-size:12px;color:var(--text-secondary)">🕐 À l'instant</span>
      </div>
    </div>
    <div class="cmd-card-body">
      <div class="cmd-items-list">${(c.items || []).map(i => `<div class="cmd-item-row"><span class="cmd-qty">${i.quantite}×</span><span class="cmd-item-name">${i.nom}</span><span class="cmd-item-price">${(i.prix * i.quantite).toLocaleString('fr-FR')} F</span></div>`).join('')}</div>
      ${c.note ? `<div style="font-size:13px;color:var(--text-secondary);background:var(--warn-light);padding:8px 12px;border-radius:var(--r-xs);margin-top:8px">📝 ${c.note}</div>` : ''}
    </div>
    <div class="cmd-card-footer">
      <span class="cmd-total">${c.total.toLocaleString('fr-FR')} FCFA</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap" id="actions-${c._id}">
        <button class="btn btn-sm btn-primary" onclick="changerStatut('${c._id}','en_preparation',this)">👨‍🍳 Préparer</button>
        <button class="btn btn-sm btn-secondary" onclick="changerStatut('${c._id}','annulee',this)">❌ Annuler</button>
      </div>
    </div>`;
}

async function changerStatut(id, statut, btn, livreur_id = null) {
  btn.disabled = true; btn.style.opacity = '0.6';
  try {
    const body = { statut };
    if (livreur_id) body.livreur_id = livreur_id;
    const res = await fetch(`/commandes/${id}/statut`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) {
      const badge = document.getElementById(`statut-${id}`);
      const map = { en_attente: ['warning','⏳ En attente'], en_preparation: ['info','👨‍🍳 Préparation'], en_livraison: ['purple','🛵 En route'], servie: ['success','✅ Servie'], livree: ['success','✅ Livrée'], annulee: ['danger','❌ Annulée'] };
      if (badge) { const [type, label] = map[statut] || ['gray', statut]; badge.className = `badge badge-${type}`; badge.textContent = label; }
      const actions = document.getElementById(`actions-${id}`);
      if (actions) {
        if (statut === 'en_preparation') {
          actions.innerHTML = `<button class="btn btn-sm btn-success" onclick="changerStatut('${id}','servie',this)">✅ Servir</button>`;
        } else if (statut === 'servie' || statut === 'livree' || statut === 'annulee') {
          actions.innerHTML = `<a href="/commandes/${id}/recu" target="_blank" class="btn btn-sm btn-secondary"><i class="bi bi-file-earmark-pdf"></i> Reçu</a>`;
        }
      }
    }
  } catch(e) { console.error(e); }
  btn.disabled = false; btn.style.opacity = '1';
}

async function assignerLivreur(cmdId) {
  const sel = document.getElementById(`livreur-sel-${cmdId}`);
  if (!sel || !sel.value) return alert('Choisissez un livreur.');
  await changerStatut(cmdId, 'en_livraison', sel, sel.value);
  const actions = document.getElementById(`actions-${cmdId}`);
  if (actions) actions.innerHTML = `<button class="btn btn-sm btn-success" onclick="changerStatut('${cmdId}','livree',this)">✅ Livrée</button><a href="/commandes/${cmdId}/recu" target="_blank" class="btn btn-sm btn-secondary"><i class="bi bi-file-earmark-pdf"></i> Reçu</a>`;
}
