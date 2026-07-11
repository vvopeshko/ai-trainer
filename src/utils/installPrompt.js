// Установка PWA. beforeinstallprompt (Chrome/Android) прилетает один раз и
// рано — модуль импортируется из main.jsx side-effect'ом, чтобы слушатель
// стоял до события. iOS промпта не имеет — там показываем инструкцию.

let deferredPrompt = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // мини-инфобар Chrome не нужен — своя кнопка на /me
    deferredPrompt = e
    listeners.forEach((fn) => fn(true))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((fn) => fn(false))
  })
}

/** Браузер готов показать нативный промпт установки (Chrome/Android/десктоп). */
export function canInstall() {
  return Boolean(deferredPrompt)
}

/** Подписка на изменение доступности установки. Возвращает unsubscribe. */
export function subscribeInstall(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Показать нативный промпт. @returns {Promise<boolean>} установил ли юзер */
export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') deferredPrompt = null
  return outcome === 'accepted'
}

/** Уже запущены как установленное приложение (standalone). */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true // iOS Safari
  )
}

/** iOS-устройство (для инструкции «Поделиться → На экран “Домой”»). */
export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
