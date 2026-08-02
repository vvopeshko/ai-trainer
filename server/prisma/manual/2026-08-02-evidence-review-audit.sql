-- Evidence review workflow — append-only audit table.
-- Safe to paste into Neon SQL Editor. Creates one isolated table and two indexes.

BEGIN;

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

CREATE INDEX IF NOT EXISTS "EvidenceAuditEvent_entityType_entityId_createdAt_idx"
  ON "EvidenceAuditEvent"("entityType", "entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "EvidenceAuditEvent_actorId_createdAt_idx"
  ON "EvidenceAuditEvent"("actorId", "createdAt");

COMMIT;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'EvidenceAuditEvent';
