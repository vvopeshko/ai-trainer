import { useEffect, useRef } from 'react'

// Официальный Telegram Login Widget (вход/привязка в web-версии).
// Скрипт встраивается динамически и рисует свою кнопку внутри контейнера.
// Требует /setdomain в BotFather на домен фронтенда — иначе кнопка молчит.
// https://core.telegram.org/widgets/login

let cbCounter = 0

export function TelegramLoginWidget({ botUsername, onAuth, size = 'large' }) {
  const containerRef = useRef(null)
  const onAuthRef = useRef(onAuth)
  onAuthRef.current = onAuth

  useEffect(() => {
    const el = containerRef.current
    if (!botUsername || !el) return

    // Уникальный глобальный колбэк: data-onauth зовёт функцию по имени
    const cbName = `__tgLoginCb${cbCounter++}`
    window[cbName] = (user) => onAuthRef.current?.(user)

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', size)
    script.setAttribute('data-radius', '10')
    script.setAttribute('data-onauth', `${cbName}(user)`)
    script.setAttribute('data-request-access', 'write')
    el.appendChild(script)

    return () => {
      delete window[cbName]
      el.replaceChildren()
    }
  }, [botUsername, size])

  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }} />
}
