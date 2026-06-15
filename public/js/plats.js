// Filtres par catégorie
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    document.querySelectorAll('.plat-card').forEach(card => {
      card.style.display = (cat === 'tous' || card.dataset.cat === cat) ? '' : 'none';
    });
  });
});

// Toggle disponibilité
async function toggleDispo(id, btn) {
  btn.style.opacity = '0.5';
  try {
    const res  = await fetch(`/plats/${id}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = data.disponible ? '✅' : '🔴';
      btn.className = `btn-toggle-dispo ${data.disponible ? 'dispo' : 'indispo'}`;
      const card = btn.closest('.plat-card');
      if (card) card.classList.toggle('indisponible', !data.disponible);
    }
  } catch (e) { console.error(e); }
  btn.style.opacity = '1';
}
