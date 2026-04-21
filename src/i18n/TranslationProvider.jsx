import { createContext, useMemo, useState } from 'react'
import { translations, defaultLanguage } from './translations.js'

// Приоритет выбора языка: localStorage → Telegram language_code → navigator.language → ru.
function pickInitialLanguage() {
  if (typeof window === 'undefined') return defaultLanguage
  const stored = window.localStorage?.getItem('appLanguage')
  if (stored && translations[stored]) return stored

  const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  if (tgLang && translations[tgLang]) return tgLang

  const navLang = navigator.language?.split('-')[0]
  if (navLang && translations[navLang]) return navLang

  return defaultLanguage
}

export const TranslationContext = createContext({
  language: defaultLanguage,
  setLanguage: () => {},
  t: (key) => key,
})

export function TranslationProvider({ children }) {
  const [language, setLanguageState] = useState(pickInitialLanguage)

  const value = useMemo(() => {
    const dict = translations[language] ?? translations[defaultLanguage]

    function t(key, params) {
      const raw = dict[key] ?? translations[defaultLanguage][key] ?? key
      if (!params) return raw
      return Object.entries(params).reduce(
        (s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)),
        raw,
      )
    }

    function setLanguage(lang) {
      if (!translations[lang]) return
      setLanguageState(lang)
      try {
        window.localStorage.setItem('appLanguage', lang)
      } catch {
        /* ignore — например, приватный режим */
      }
    }

    return { language, setLanguage, t }
  }, [language])

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}
