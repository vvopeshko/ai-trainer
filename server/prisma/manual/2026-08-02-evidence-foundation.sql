-- ═══════════════════════════════════════════════════════════════════════
-- Evidence Knowledge Base — data foundation
-- Date: 2026-08-02
-- Source of truth: server/prisma/schema.prisma
--
-- Creates ONLY new evidence tables, indexes and foreign keys.
-- Does not alter or delete User, Program, Workout, billing or other product data.
-- Safe to paste into Neon SQL Editor as one transaction.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS "EvidenceQuestion" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "outcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "critical" BOOLEAN NOT NULL DEFAULT false,
  "reviewIntervalMonths" INTEGER NOT NULL,
  "scope" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResearchWork" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'discovered',
  "title" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "workType" TEXT NOT NULL,
  "identifiers" JSONB NOT NULL,
  "doi" TEXT,
  "pmid" TEXT,
  "pmcid" TEXT,
  "trialId" TEXT,
  "url" TEXT,
  "correctionStatus" TEXT NOT NULL DEFAULT 'unknown',
  "statusCheckedAt" TIMESTAMP(3),
  "reviewScope" TEXT NOT NULL DEFAULT 'abstract_only',
  "sourceNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchWork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResearchAssessment" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "reviewScope" TEXT NOT NULL DEFAULT 'abstract_only',
  "population" TEXT NOT NULL,
  "outcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "mainResults" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "directness" TEXT NOT NULL,
  "riskOfBias" TEXT NOT NULL,
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cannotSupport" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "assessedBy" TEXT,
  "assessedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceClaim" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceClaimVersion" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "statement" TEXT NOT NULL,
  "population" TEXT NOT NULL,
  "trainingStatuses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "bodyScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "outcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "effect" TEXT NOT NULL,
  "certainty" TEXT NOT NULL,
  "certaintyRationale" TEXT NOT NULL,
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "unknowns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "searchCutoff" TIMESTAMP(3) NOT NULL,
  "reviewDueAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceClaimVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClaimEvidence" (
  "id" TEXT NOT NULL,
  "claimVersionId" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "relation" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceRecommendation" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "surfaces" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "audience" TEXT NOT NULL,
  "guidance" TEXT NOT NULL,
  "implementationHeuristic" TEXT NOT NULL,
  "strength" TEXT NOT NULL,
  "exceptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "safetyNotes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedWording" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "forbiddenWording" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reviewDueAt" TIMESTAMP(3) NOT NULL,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceRecommendationClaim" (
  "id" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "claimVersionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "EvidenceRecommendationClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceAiTest" (
  "id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceAiTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceBlogOutline" (
  "id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceBlogOutline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceAuditEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResearchWork_doi_key" ON "ResearchWork"("doi");
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchWork_pmid_key" ON "ResearchWork"("pmid");
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchWork_pmcid_key" ON "ResearchWork"("pmcid");
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchWork_trialId_key" ON "ResearchWork"("trialId");
CREATE INDEX IF NOT EXISTS "ResearchWork_status_correctionStatus_idx" ON "ResearchWork"("status", "correctionStatus");
CREATE INDEX IF NOT EXISTS "ResearchWork_year_workType_idx" ON "ResearchWork"("year", "workType");
CREATE INDEX IF NOT EXISTS "EvidenceQuestion_topic_idx" ON "EvidenceQuestion"("topic");
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchAssessment_questionId_workId_version_key" ON "ResearchAssessment"("questionId", "workId", "version");
CREATE INDEX IF NOT EXISTS "ResearchAssessment_status_idx" ON "ResearchAssessment"("status");
CREATE INDEX IF NOT EXISTS "EvidenceClaim_questionId_status_idx" ON "EvidenceClaim"("questionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceClaimVersion_claimId_version_key" ON "EvidenceClaimVersion"("claimId", "version");
CREATE INDEX IF NOT EXISTS "EvidenceClaimVersion_status_reviewDueAt_idx" ON "EvidenceClaimVersion"("status", "reviewDueAt");
CREATE INDEX IF NOT EXISTS "EvidenceClaimVersion_outcomes_idx" ON "EvidenceClaimVersion" USING GIN ("outcomes");
CREATE UNIQUE INDEX IF NOT EXISTS "ClaimEvidence_claimVersionId_workId_key" ON "ClaimEvidence"("claimVersionId", "workId");
CREATE INDEX IF NOT EXISTS "ClaimEvidence_workId_idx" ON "ClaimEvidence"("workId");
CREATE INDEX IF NOT EXISTS "EvidenceRecommendation_status_reviewDueAt_idx" ON "EvidenceRecommendation"("status", "reviewDueAt");
CREATE INDEX IF NOT EXISTS "EvidenceRecommendation_surfaces_idx" ON "EvidenceRecommendation" USING GIN ("surfaces");
CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceRecommendationClaim_recommendationId_claimVersionId_key" ON "EvidenceRecommendationClaim"("recommendationId", "claimVersionId");
CREATE INDEX IF NOT EXISTS "EvidenceRecommendationClaim_claimVersionId_idx" ON "EvidenceRecommendationClaim"("claimVersionId");
CREATE INDEX IF NOT EXISTS "EvidenceAuditEvent_entityType_entityId_createdAt_idx" ON "EvidenceAuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "EvidenceAuditEvent_actorId_createdAt_idx" ON "EvidenceAuditEvent"("actorId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResearchAssessment_questionId_fkey') THEN
    ALTER TABLE "ResearchAssessment"
      ADD CONSTRAINT "ResearchAssessment_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "EvidenceQuestion"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResearchAssessment_workId_fkey') THEN
    ALTER TABLE "ResearchAssessment"
      ADD CONSTRAINT "ResearchAssessment_workId_fkey"
      FOREIGN KEY ("workId") REFERENCES "ResearchWork"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceClaim_questionId_fkey') THEN
    ALTER TABLE "EvidenceClaim"
      ADD CONSTRAINT "EvidenceClaim_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "EvidenceQuestion"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceClaimVersion_claimId_fkey') THEN
    ALTER TABLE "EvidenceClaimVersion"
      ADD CONSTRAINT "EvidenceClaimVersion_claimId_fkey"
      FOREIGN KEY ("claimId") REFERENCES "EvidenceClaim"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClaimEvidence_claimVersionId_fkey') THEN
    ALTER TABLE "ClaimEvidence"
      ADD CONSTRAINT "ClaimEvidence_claimVersionId_fkey"
      FOREIGN KEY ("claimVersionId") REFERENCES "EvidenceClaimVersion"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClaimEvidence_workId_fkey') THEN
    ALTER TABLE "ClaimEvidence"
      ADD CONSTRAINT "ClaimEvidence_workId_fkey"
      FOREIGN KEY ("workId") REFERENCES "ResearchWork"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceRecommendationClaim_recommendationId_fkey') THEN
    ALTER TABLE "EvidenceRecommendationClaim"
      ADD CONSTRAINT "EvidenceRecommendationClaim_recommendationId_fkey"
      FOREIGN KEY ("recommendationId") REFERENCES "EvidenceRecommendation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceRecommendationClaim_claimVersionId_fkey') THEN
    ALTER TABLE "EvidenceRecommendationClaim"
      ADD CONSTRAINT "EvidenceRecommendationClaim_claimVersionId_fkey"
      FOREIGN KEY ("claimVersionId") REFERENCES "EvidenceClaimVersion"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Verification: should return 11 rows, one per evidence table.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'EvidenceQuestion',
    'ResearchWork',
    'ResearchAssessment',
    'EvidenceClaim',
    'EvidenceClaimVersion',
    'ClaimEvidence',
    'EvidenceRecommendation',
    'EvidenceRecommendationClaim',
    'EvidenceAiTest',
    'EvidenceBlogOutline',
    'EvidenceAuditEvent'
  )
ORDER BY table_name;
