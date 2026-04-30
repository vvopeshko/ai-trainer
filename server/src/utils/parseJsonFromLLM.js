/**
 * Парсинг JSON из ответа LLM.
 *
 * Даже с инструкцией "отвечай только JSON", LLM иногда добавляет
 * markdown-обёртку ```json ... ``` или текст до/после.
 * Эта функция пытается извлечь JSON в любом случае.
 *
 * @param {string} text — текстовый ответ от LLM
 * @returns {object|null} — распарсенный JSON или null
 */
export function parseJsonFromLLM(text) {
  // Попытка 1: весь текст — валидный JSON
  try {
    return JSON.parse(text)
  } catch {
    // продолжаем
  }

  // Попытка 2: JSON обёрнут в ```json ... ``` или ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // продолжаем
    }
  }

  // Попытка 3: ищем первый { ... } в тексте
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0])
    } catch {
      // ничего не помогло
    }
  }

  return null
}
