// Генерация PWA-иконок из SVG-логотипа → public/icons/.
// Запуск (sharp не в зависимостях — ставится разово):
//   npm i --no-save sharp && node scripts/generateIcons.mjs
//
// Дизайн: гантель в mint-teal (accent-h 158) на тёмном фоне приложения (#050507),
// как splash в index.html. Maskable-вариант — та же гантель с запасом под
// safe zone (масштаб 0.72), фон во весь кадр.

import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/icons/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// Гантель: гриф + внутренние и внешние блины, скруглённые
function dumbbell(scale = 1) {
  const g = (v) => 256 + (v - 256) * scale
  const s = (v) => v * scale
  return `
    <g fill="url(#mint)">
      <rect x="${g(150)}" y="${g(243)}" width="${s(212)}" height="${s(26)}" rx="${s(13)}"/>
      <rect x="${g(120)}" y="${g(168)}" width="${s(44)}" height="${s(176)}" rx="${s(20)}"/>
      <rect x="${g(348)}" y="${g(168)}" width="${s(44)}" height="${s(176)}" rx="${s(20)}"/>
      <rect x="${g(74)}" y="${g(196)}" width="${s(34)}" height="${s(120)}" rx="${s(16)}"/>
      <rect x="${g(404)}" y="${g(196)}" width="${s(34)}" height="${s(120)}" rx="${s(16)}"/>
    </g>`
}

function iconSvg({ maskable = false } = {}) {
  const scale = maskable ? 0.72 : 0.92
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="mint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(158,70%,62%)"/>
      <stop offset="1" stop-color="hsl(172,65%,48%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.65">
      <stop offset="0" stop-color="hsl(158,60%,18%)"/>
      <stop offset="1" stop-color="#050507"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#glow)"/>
  ${dumbbell(scale)}
</svg>`
}

const icon = Buffer.from(iconSvg())
const maskable = Buffer.from(iconSvg({ maskable: true }))

const jobs = [
  [icon, 512, 'icon-512.png'],
  [icon, 192, 'icon-192.png'],
  [maskable, 512, 'icon-maskable-512.png'],
  [icon, 180, 'apple-touch-icon.png'],
  [icon, 64, 'favicon-64.png'],
]

for (const [src, size, name] of jobs) {
  await sharp(src).resize(size, size).png().toFile(OUT + name)
  console.log('✓', name)
}

// SVG-favicon — тот же логотип (браузеры десктопа)
writeFileSync(OUT + 'favicon.svg', iconSvg())
console.log('✓ favicon.svg')
