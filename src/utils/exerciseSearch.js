/**
 * Exercise text search: «жим лежа» finds «Жим гантелей лёжа». Case and ё/е
 * are ignored, every word of the query must occur in the name, English name or
 * aliases. Results are ranked — the same order as GET /exercises/search
 * (server/src/controllers/exerciseController.js):
 *   0 exact name or alias · 1 name starts with the query · 2 query at a word
 *   start in the name · 3 query inside the name · 4 all words in the name ·
 *   5 matched only via English name / aliases;
 * ties: shorter name first, then alphabetical.
 */

export const normalizeSearch = s => (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/** Rank of an exercise for the query, or null when it does not match. */
export function searchRank(ex, query) {
  const q = normalizeSearch(query)
  if (!q) return null
  const ru = normalizeSearch(ex.nameRu)
  const en = normalizeSearch(ex.nameEn)
  const aliases = (ex.aliases ?? []).map(normalizeSearch)
  const haystack = [ru, en, ...aliases].join(' | ')
  const words = q.split(' ')
  if (!words.every(w => haystack.includes(w))) return null
  if (ru === q || en === q || aliases.includes(q)) return 0
  if (ru.startsWith(q)) return 1
  if ((' ' + ru).includes(' ' + q)) return 2
  if (ru.includes(q)) return 3
  if (words.every(w => ru.includes(w))) return 4
  return 5
}

/** Matching exercises, best first. */
export function searchExercises(exercises, query) {
  return exercises
    .map(ex => ({ ex, rank: searchRank(ex, query) }))
    .filter(r => r.rank !== null)
    .sort((a, b) => a.rank - b.rank
      || (a.ex.nameRu?.length ?? 0) - (b.ex.nameRu?.length ?? 0)
      || (a.ex.nameRu ?? '').localeCompare(b.ex.nameRu ?? '', 'ru'))
    .map(r => r.ex)
}
