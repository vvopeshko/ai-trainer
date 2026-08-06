-- Additive migration for plain-language questions/claims, transparent search
-- coverage and muscle-specific claim applicability. Safe to run more than once.

ALTER TABLE "EvidenceQuestion"
  ADD COLUMN IF NOT EXISTS "questionRu" TEXT,
  ADD COLUMN IF NOT EXISTS "plainQuestion" TEXT,
  ADD COLUMN IF NOT EXISTS "plainQuestionRu" TEXT,
  ADD COLUMN IF NOT EXISTS "scopeRu" TEXT,
  ADD COLUMN IF NOT EXISTS "searchStrategy" JSONB,
  ADD COLUMN IF NOT EXISTS "searchDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "searchNotes" TEXT;

UPDATE "EvidenceQuestion"
SET
  "questionRu" = COALESCE("questionRu", "question"),
  "plainQuestion" = COALESCE("plainQuestion", "question"),
  "plainQuestionRu" = COALESCE("plainQuestionRu", "questionRu", "question"),
  "scopeRu" = COALESCE("scopeRu", "scope"),
  "searchStrategy" = COALESCE("searchStrategy", '{"databases":[],"queries":[],"supplementaryMethods":[]}'::jsonb);

ALTER TABLE "EvidenceQuestion"
  ALTER COLUMN "questionRu" SET NOT NULL,
  ALTER COLUMN "plainQuestion" SET NOT NULL,
  ALTER COLUMN "plainQuestionRu" SET NOT NULL,
  ALTER COLUMN "scopeRu" SET NOT NULL,
  ALTER COLUMN "searchStrategy" SET NOT NULL;

ALTER TABLE "ResearchWork"
  ADD COLUMN IF NOT EXISTS "includedStudiesCount" INTEGER;

ALTER TABLE "EvidenceClaimVersion"
  ADD COLUMN IF NOT EXISTS "statementRu" TEXT,
  ADD COLUMN IF NOT EXISTS "plainStatement" TEXT,
  ADD COLUMN IF NOT EXISTS "plainStatementRu" TEXT,
  ADD COLUMN IF NOT EXISTS "muscles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "muscleRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "exercises" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "romSegments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "measurementMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "applicabilityNotes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "EvidenceClaimVersion"
SET
  "statementRu" = COALESCE("statementRu", "statement"),
  "plainStatement" = COALESCE("plainStatement", "statement"),
  "plainStatementRu" = COALESCE("plainStatementRu", "statementRu", "statement");

ALTER TABLE "EvidenceClaimVersion"
  ALTER COLUMN "statementRu" SET NOT NULL,
  ALTER COLUMN "plainStatement" SET NOT NULL,
  ALTER COLUMN "plainStatementRu" SET NOT NULL;

SELECT
  (SELECT count(*) FROM "EvidenceQuestion" WHERE "plainQuestion" IS NOT NULL) AS questions_ready,
  (SELECT count(*) FROM "EvidenceClaimVersion" WHERE "plainStatement" IS NOT NULL) AS claims_ready;
