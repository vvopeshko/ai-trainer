import { useContext } from 'react'
import { TranslationContext } from './TranslationProvider.jsx'

export function useTranslation() {
  return useContext(TranslationContext)
}
