// Splash из index.html (чистый HTML/CSS, виден до гидрации React).
export function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash || splash.classList.contains('hidden')) return
  splash.classList.add('hidden')
  setTimeout(() => splash.remove(), 400)
}
