const toggle  = document.getElementById('navToggle');
const menu    = document.querySelector('.navbar-menu');
const overlay = document.getElementById('navOverlay');

if (toggle) {
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });
}
if (overlay) {
  overlay.addEventListener('click', () => {
    menu.classList.remove('open');
  });
}
