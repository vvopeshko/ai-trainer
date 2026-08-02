/**
 * Idempotent import of the manually reviewed phase-0 evidence corpus.
 *
 * Usage:
 *   npm run evidence:import-pilot:dry  # validate and print counts, no DB writes
 *   npm run evidence:import-pilot      # transactional upsert
 *
 * Approved claim versions, assessments and recommendations are never overwritten by
 * a repeated pilot import. Research-work status verification is never downgraded
 * from current/corrected/retracted back to unknown.
 */
import { PrismaClient } from '@prisma/client'
import { evidencePilotFixtures } from '../src/services/evidence/fixtures.js'
import {
  createDatabaseEvidenceRepository,
  importEvidenceDataset,
} from '../src/services/evidence/persistence.js'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const result = await importEvidenceDataset(prisma, evidencePilotFixtures, { dryRun })
  const prefix = dryRun ? 'Validated' : 'Imported'
  console.log(`${prefix} evidence pilot:`)
  for (const [entity, count] of Object.entries(result.counts)) {
    console.log(`  ${entity}: ${count}`)
  }
  if (!dryRun) {
    console.log(`  protected claim versions: ${result.protectedClaimVersions}`)
    console.log(`  protected recommendations: ${result.protectedRecommendations}`)

    const repository = await createDatabaseEvidenceRepository(prisma)
    if (JSON.stringify(repository.counts) !== JSON.stringify(result.counts)) {
      throw new Error(`Database count mismatch: ${JSON.stringify(repository.counts)}`)
    }

    const runtimeLeaks = evidencePilotFixtures.questions
      .map(({ id }) => repository.getEvidenceGuidance({ questionId: id }))
      .filter(({ answerability, claims, recommendations }) =>
        answerability !== 'unsupported' || claims.length > 0 || recommendations.length > 0,
      )
    if (runtimeLeaks.length > 0) {
      throw new Error(`Fail-closed smoke test failed for ${runtimeLeaks.length} questions`)
    }
    console.log('  fail-closed runtime questions: 10/10')
  }
}

main()
  .catch((error) => {
    console.error('Evidence import failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
