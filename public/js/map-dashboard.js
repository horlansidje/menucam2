/**
 * map-dashboard.js — Carte Leaflet pour le dashboard restaurateur
 * Affiche les commandes de livraison sur une carte
 */

// ── Icônes par statut ─────────────────────────────────────────
const ICONS = {
  en_attente:     { bg:'#F59E0B', emoji:'⏳' },
  en_preparation: { bg:'#3B82F6', emoji:'👨‍🍳' },
  en_livraison:   { bg:'#8B5CF6', emoji:'🛵' },
  livree:         { bg:'#10B981', emoji:'✅' },
  servie:         { bg:'#10B981', emoji:'✅' },
  annulee:        { bg:'#EF4444', emoji:'❌' },
};

function makeStatutIcon(statut) {
  const c = ICONS[statut] || { bg:'#9CA3AF', emoji:'📦' };
  return L.divIcon({
    className: '',
    html: `<div style="
      width:38px;height:38px;border-radius:50%;
      background:${c.bg};border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:15px;box-shadow:0 4px 14px rgba(0,0,0,0.25);
    ">${c.emoji}</div>`,
    iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22],
  });
}

function makeRestoIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:44px;height:44px;border-radius:12px;
      background:linear-gradient(135deg,#1B4332,#2D6A4F);
      border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:20px;box-shadow:0 4px 14px rgba(27,67,50,0.5);
    ">🍽️</div>`,
    iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -25],
  });
}

// ── Initialiser carte commandes (dashboard) ───────────────────
function initCommandesMap(commandes, restaurantInfo) {
  const mapEl = document.getElementById('commandesMap');
  if (!mapEl) return;

  const map = L.map('commandesMap', { scrollWheelZoom: false })
    .setView([4.0511, 9.7679], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const bounds = [];

  // Marqueur du restaurant
  if (restaurantInfo && restaurantInfo.lat && restaurantInfo.lng) {
    const pos = [restaurantInfo.lat, restaurantInfo.lng];
    L.marker(pos, { icon: makeRestoIcon() })
      .addTo(map)
      .bindPopup(`<div class="map-popup"><div class="map-popup-title">🍽️ ${restaurantInfo.nom}</div><div class="map-popup-row">${restaurantInfo.adresse || 'Votre restaurant'}</div></div>`);
    bounds.push(pos);
  }

  // Marqueurs commandes livraison
  commandes.forEach(cmd => {
    if (!cmd.lat || !cmd.lng) return;
    const pos = [cmd.lat, cmd.lng];
    bounds.push(pos);

    const statutLabel = {
      en_attente:'⏳ En attente', en_preparation:'👨‍🍳 Préparation',
      en_livraison:'🛵 En route', livree:'✅ Livrée', annulee:'❌ Annulée'
    }[cmd.statut] || cmd.statut;

    const payLabel = cmd.paiement === 'mtn' ? '📱 MTN' : cmd.paiement === 'orange' ? '🟠 Orange' : '💬 WA';
    const statusColors = { en_attente:'#FEF3C7', en_preparation:'#DBEAFE', en_livraison:'#EDE9FE', livree:'#D1FAE5', annulee:'#FEE2E2' };
    const statusTextColors = { en_attente:'#92400E', en_preparation:'#1E40AF', en_livraison:'#6D28D9', livree:'#065F46', annulee:'#B91C1C' };

    L.marker(pos, { icon: makeStatutIcon(cmd.statut) })
      .addTo(map)
      .bindPopup(`
        <div class="map-popup">
          <div class="map-popup-title">${cmd.num_commande || 'Commande'}</div>
          <div class="map-popup-row"><strong>${cmd.client_nom}</strong></div>
          ${cmd.client_telephone ? `<div class="map-popup-row"><i class="bi bi-telephone"></i> ${cmd.client_telephone}</div>` : ''}
          <div class="map-popup-row"><i class="bi bi-geo-alt"></i> ${cmd.client_adresse || ''}${cmd.client_quartier ? ', ' + cmd.client_quartier : ''}</div>
          <div class="map-popup-row">${payLabel}</div>
          <span class="map-popup-status" style="background:${statusColors[cmd.statut]||'#F3F4F6'};color:${statusTextColors[cmd.statut]||'#6B7280'}">${statutLabel}</span>
          <div class="map-popup-total">${(cmd.total||0).toLocaleString('fr-FR')} FCFA</div>
          ${cmd._id ? `<div style="margin-top:10px"><a href="/commandes" style="font-size:12px;color:#F59E0B;font-weight:600">Voir la commande →</a></div>` : ''}
        </div>`);

    // Trajet restaurant → client
    if (restaurantInfo && restaurantInfo.lat && restaurantInfo.lng) {
      const lcolor = cmd.statut === 'en_livraison' ? '#8B5CF6' : cmd.statut === 'livree' ? '#10B981' : '#F59E0B';
      L.polyline([[restaurantInfo.lat, restaurantInfo.lng], pos], {
        color: lcolor, weight: 2.5, opacity: 0.6,
        dashArray: cmd.statut === 'livree' ? null : '6,6',
      }).addTo(map);
    }
  });

  // Ajuster le zoom sur tous les marqueurs
  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  // Contrôle de rafraîchissement
  const refreshBtn = document.getElementById('refreshMap');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => location.reload());
  }

  return map;
}

// ── Initialiser carte livreurs ────────────────────────────────
function initLivreursMap(commandes, livreurs, restaurantInfo) {
  const mapEl = document.getElementById('livreursMap');
  if (!mapEl) return;

  const map = L.map('livreursMap', { scrollWheelZoom: false })
    .setView([4.0511, 9.7679], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const bounds = [];
  const livreursColors = ['#F59E0B','#3B82F6','#10B981','#EF4444','#8B5CF6','#F97316','#14B8A6'];

  // Marqueur restaurant
  if (restaurantInfo && restaurantInfo.lat && restaurantInfo.lng) {
    const rPos = [restaurantInfo.lat, restaurantInfo.lng];
    L.marker(rPos, { icon: makeRestoIcon() })
      .addTo(map)
      .bindPopup(`<div class="map-popup"><div class="map-popup-title">🍽️ ${restaurantInfo.nom}</div><div class="map-popup-row">Point de départ des livraisons</div></div>`);
    bounds.push(rPos);
  }

  // Un cluster de marqueurs par livreur
  livreurs.forEach((livreur, li) => {
    const color = livreursColors[li % livreursColors.length];
    const livIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:40px;height:40px;border-radius:50%;
        background:${color};border:3px solid #fff;
        display:flex;align-items:center;justify-content:center;
        font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.25);
        font-weight:800;color:#fff;font-family:sans-serif;font-size:12px;
      ">🛵</div>`,
      iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22],
    });

    // Commandes assignées à ce livreur
    const sesCmds = commandes.filter(c => c.livreur_id === livreur._id && c.lat && c.lng);

    sesCmds.forEach(cmd => {
      const pos = [cmd.lat, cmd.lng];
      bounds.push(pos);

      L.marker(pos, { icon: livIcon })
        .addTo(map)
        .bindPopup(`
          <div class="map-popup">
            <div class="map-popup-title">${cmd.num_commande || 'Livraison'}</div>
            <div class="map-popup-row" style="color:${color}"><strong>🛵 ${livreur.nom}</strong></div>
            <div class="map-popup-row"><strong>${cmd.client_nom}</strong></div>
            ${cmd.client_telephone ? `<div class="map-popup-row">📞 ${cmd.client_telephone}</div>` : ''}
            <div class="map-popup-row">📍 ${cmd.client_adresse || ''}${cmd.client_quartier ? ', ' + cmd.client_quartier : ''}</div>
            <div class="map-popup-total">${(cmd.total||0).toLocaleString('fr-FR')} FCFA</div>
          </div>`);

      // Ligne restaurant → destination
      if (restaurantInfo && restaurantInfo.lat && restaurantInfo.lng) {
        L.polyline([[restaurantInfo.lat, restaurantInfo.lng], pos], {
          color, weight: 3, opacity: 0.7,
          dashArray: cmd.statut === 'livree' ? null : '8,5',
        }).addTo(map);
      }
    });
  });

  // Commandes sans livreur assigné
  commandes.filter(c => !c.livreur_id && c.lat && c.lng && c.statut === 'en_attente').forEach(cmd => {
    const pos = [cmd.lat, cmd.lng];
    bounds.push(pos);
    L.marker(pos, { icon: makeStatutIcon('en_attente') })
      .addTo(map)
      .bindPopup(`<div class="map-popup"><div class="map-popup-title">${cmd.num_commande}</div><div class="map-popup-row"><strong>${cmd.client_nom}</strong></div><div class="map-popup-row">⚠️ Pas encore assignée</div><div class="map-popup-total">${(cmd.total||0).toLocaleString('fr-FR')} FCFA</div></div>`);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  return map;
}
