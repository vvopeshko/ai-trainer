/**
 * Static mesh background — 3 blurred accent blobs.
 * Place at the start of a frame with position: relative; overflow: hidden,
 * then wrap content in position: relative; z-index: 1.
 * Colour follows --accent-h from the parent.
 *
 * Блобы статичны намеренно: бесконечная transform-анимация поверх blur(70px)
 * держала три живых GPU-слоя на каждом таб-экране и жгла батарею в Telegram
 * WebView (заодно это и корректное поведение для prefers-reduced-motion).
 * Визуал — те же цвета/размытие/позиции, что и раньше.
 */

const styles = `
.trainer-glass-mesh { position: absolute; inset: 0; overflow: hidden; z-index: 0; pointer-events: none; }
.trainer-glass-mesh::before, .trainer-glass-mesh::after, .trainer-glass-mesh > span {
  content: ''; position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.42;
}
.trainer-glass-mesh::before {
  width: 280px; height: 280px; left: -80px; top: -90px;
  background: hsla(var(--accent-h, 158), 65%, 38%, 0.7);
}
.trainer-glass-mesh::after {
  width: 240px; height: 240px; right: -100px; top: 240px;
  background: hsla(calc(var(--accent-h, 158) - 60), 60%, 30%, 0.55);
}
.trainer-glass-mesh > span {
  width: 240px; height: 240px; left: 50%; bottom: -120px;
  background: hsla(calc(var(--accent-h, 158) + 20), 50%, 28%, 0.45); display: block;
}
.trainer-glass-mesh-overlay {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background: linear-gradient(180deg, rgba(5,5,7,0.65) 0%, rgba(5,5,7,0.4) 40%, rgba(5,5,7,0.85) 100%);
}
`

export function Mesh() {
  return (
    <>
      <style>{styles}</style>
      <div className="trainer-glass-mesh" aria-hidden="true">
        <span />
      </div>
      <div className="trainer-glass-mesh-overlay" aria-hidden="true" />
    </>
  )
}
