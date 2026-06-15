/**
 * map-client.js — Carte Leaflet côté menu client
 * Détecte la position GPS et pré-remplit l'adresse de livraison
 */

let clientMap = null;
let clientMarker = null;
let clientCoords = null;

function initClientMap() {
  if (clientMap) return; // déjà initialisé

  // Centré sur Douala par défaut
  clientMap = L.map('clientMap', { zoomControl: true, scrollWheelZoom: false })
    .setView([4.0511, 9.7679], 13);

  // Tile OSM
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(clientMap);

  // Icône personnalisée client
  const clientIcon = L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:#F59E0B;border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;box-shadow:0 4px 12px rgba(245,158,11,0.5);
    " class="pulse-marker">📍</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });

  // Marqueur du restaurant
  const restoIcon = L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;border-radius:10px;
      background:linear-gradient(135deg,#1B4332,#2D6A4F);
      border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;box-shadow:0 4px 12px rgba(27,67,50,0.4);
    ">🍽️</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });

  // Marqueur restaurant (si coordonnées disponibles)
  if (typeof RESTAURANT_LAT !== 'undefined' && typeof RESTAURANT_LNG !== 'undefined') {
    L.marker([RESTAURANT_LAT, RESTAURANT_LNG], { icon: restoIcon })
      .addTo(clientMap)
      .bindPopup(`<div class="map-popup"><div class="map-popup-title">🍽️ ${RESTAURANT_NOM}</div><div class="map-popup-row">📍 ${RESTAURANT_ADRESSE || 'Douala, Cameroun'}</div></div>`);
  }

  // Détecter la position GPS
  detecterPosition(clientIcon);
}

function detecterPosition(icon) {
  const badge = document.getElementById('gpsBadge');
  if (badge) {
    badge.className = 'gps-badge loading';
    badge.innerHTML = '<i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite"></i> Détection en cours...';
  }

  if (!navigator.geolocation) {
    if (badge) { badge.className = 'gps-badge error'; badge.innerHTML = '❌ GPS non disponible'; }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude, accuracy } = position.coords;
      clientCoords = { lat: latitude, lng: longitude };

      // Placer le marqueur
      const icon2 = icon || L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;border-radius:50%;background:#F59E0B;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(245,158,11,0.5)" class="pulse-marker">📍</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
      });

      if (clientMarker) clientMap.removeLayer(clientMarker);
      clientMarker = L.marker([latitude, longitude], { icon: icon2 })
        .addTo(clientMap)
        .bindPopup(`<div class="map-popup"><div class="map-popup-title">📍 Votre position</div><div class="map-popup-row">Précision : ~${Math.round(accuracy)} m</div></div>`)
        .openPopup();

      // Centrer la carte sur la position
      clientMap.setView([latitude, longitude], 16);

      // Cercle de précision
      L.circle([latitude, longitude], { radius: accuracy, color: '#F59E0B', fillColor: '#FEF3C7', fillOpacity: 0.15, weight: 1.5 }).addTo(clientMap);

      // Géocodage inverse pour l'adresse textuelle
      reverseGeocode(latitude, longitude);

      if (badge) {
        badge.className = 'gps-badge';
        badge.innerHTML = `✅ Position détectée (±${Math.round(accuracy)}m)`;
      }
    },
    error => {
      const msgs = { 1: 'Accès refusé', 2: 'Position indisponible', 3: 'Délai dépassé' };
      if (badge) { badge.className = 'gps-badge error'; badge.innerHTML = `❌ ${msgs[error.code] || 'Erreur GPS'}`; }
      console.warn('Erreur géolocalisation:', error.message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
      { headers: { 'Accept-Language': 'fr' } }
    );
    const data = await res.json();
    if (data && data.address) {
      const addr = data.address;
      // Construire adresse lisible
      const rue = addr.road || addr.pedestrian || addr.footway || '';
      const num = addr.house_number || '';
      const quartier = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
      const ville = addr.city || addr.town || addr.village || 'Douala';

      const adresseComplete = [num, rue].filter(Boolean).join(' ');
      const adresseFormatee = adresseComplete || quartier || 'Position détectée';

      // Pré-remplir les champs du formulaire
      const champAdresse  = document.getElementById('clientAdresse');
      const champQuartier = document.getElementById('clientQuartier');
      if (champAdresse  && !champAdresse.value)  champAdresse.value  = adresseFormatee;
      if (champQuartier && !champQuartier.value) champQuartier.value = quartier || '';

      // Mettre à jour le popup
      if (clientMarker) {
        clientMarker.setPopupContent(`
          <div class="map-popup">
            <div class="map-popup-title">📍 Votre position</div>
            <div class="map-popup-row"><strong>${adresseFormatee}</strong></div>
            ${quartier ? `<div class="map-popup-row">${quartier}</div>` : ''}
            <div class="map-popup-row">${ville}</div>
          </div>`);
      }
    }
  } catch (e) {
    console.warn('Géocodage inverse échoué:', e.message);
  }
}

function recentrerPosition() {
  if (clientCoords && clientMap) {
    clientMap.setView([clientCoords.lat, clientCoords.lng], 16);
  } else {
    detecterPosition();
  }
}

// CSS spin animation
const style = document.createElement('style');
style.textContent = '@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }';
document.head.appendChild(style);
