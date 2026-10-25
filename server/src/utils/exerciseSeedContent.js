/** JSON enrichment uses descriptionRu; the API and Prisma use description.
 * Omit empty source fields so re-seeding preserves existing editorial content.
 */
export function exerciseSeedContent(exercise) {
  const content = {}
  for (const [source, target] of [
    ['descriptionRu', 'description'],
    ['typicalMistakes', 'typicalMistakes'],
  ]) {
    const value = exercise[source]
    if (typeof value === 'string' && value.trim()) content[target] = value.trim()
  }
  return content
}
