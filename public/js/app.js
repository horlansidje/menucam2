// ── Sidebar toggle ────────────────────────────────────────────
const sidebar  = document.getElementById('sidebar');
const overlay  = document.getElementById('sidebarOverlay');
const toggleBtn= document.getElementById('sidebarToggle');

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('show');
  });
}
if (overlay) {
  overlay.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  });
}

// ── Toast system ──────────────────────────────────────────────
function showToast(msg, type = 'default', duration = 5000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '<i class="bi bi-check-circle-fill"></i>' :
               type === 'danger'  ? '<i class="bi bi-exclamation-triangle-fill"></i>' :
               '<i class="bi bi-bell-fill"></i>';
  toast.innerHTML = `${icon}<span style="flex:1">${msg}</span><span class="toast-close" onclick="this.parentElement.remove()">×</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, duration);
}

// ── Photo upload preview ──────────────────────────────────────
document.querySelectorAll('.photo-upload-zone').forEach(zone => {
  const input = zone.querySelector('input[type=file]');
  if (!input) return;
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      let img = zone.querySelector('img.preview');
      if (!img) { img = document.createElement('img'); img.className = 'preview'; zone.appendChild(img); }
      img.src = ev.target.result;
      zone.classList.add('has-image');
      const placeholder = zone.querySelector('.upload-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--brand)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); }
  });
});

// ── Toggle disponibilité plat ─────────────────────────────────
async function toggleDispo(id, btn) {
  btn.style.opacity = '0.5';
  try {
    const res = await fetch(`/plats/${id}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      const card = btn.closest('.plat-card');
      card?.classList.toggle('unavailable', !data.disponible);
      const badge = card?.querySelector('.dispo-badge');
      if (badge) {
        badge.className = `badge dispo-badge ${data.disponible ? 'badge-success' : 'badge-gray'}`;
        badge.textContent = data.disponible ? 'Disponible' : 'Indisponible';
      }
      btn.innerHTML = data.disponible
        ? '<i class="bi bi-eye"></i>'
        : '<i class="bi bi-eye-slash"></i>';
      btn.title = data.disponible ? 'Rendre indisponible' : 'Rendre disponible';
    }
  } catch(e) { console.error(e); }
  btn.style.opacity = '1';
}

// ── Filter bar ────────────────────────────────────────────────
document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const group = pill.dataset.group || 'default';
    document.querySelectorAll(`.filter-pill[data-group="${group}"]`).forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const cat = pill.dataset.cat;
    document.querySelectorAll('[data-cat-item]').forEach(item => {
      item.style.display = (cat === 'tous' || item.dataset.catItem === cat) ? '' : 'none';
    });
  });
});
