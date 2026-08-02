# Evidence service foundation

Pure, database-independent contracts for the Evidence Knowledge Base.

## Runtime boundary

```js
const repository = createEvidenceRepository(dataset)
const result = repository.getEvidenceGuidance({
  questionId: 'EQ-CON-001',
  outcome: 'power',
})
```

`getEvidenceGuidance` is fail-closed. A claim is invisible unless:

- its status is `approved` and reviewer metadata is present;
- its review date has not expired;
- every linked research work has a verified `current` correction status;
- it matches the requested question, outcome and optional applicability filters.

A product recommendation additionally requires its own approval and every primary or
supporting claim to pass the same gate. Draft fixtures therefore return
`answerability: unsupported` by design.

## Files

- `schemas.js` — Zod contracts and referential-integrity validation;
- `fixtures.js` — the complete phase-0 pilot: 10 questions, 19 works, 15 claims,
  10 recommendations, 50 AI tests and 6 blog outlines;
- `repository.js` — deterministic read-only retrieval and eligibility explanations;
- `persistence.js` — Prisma mapping, transactional import and database-backed loader;
- `reviewService.js` — reviewer/approver state machine, blockers and append-only audit;
- `*.test.js` — contract, status-gate and applicability regression tests.

This module intentionally does not parse Markdown at runtime. The fixtures are an
executable bridge from the editorial pilot to future Prisma storage and import APIs.

Use `npm run evidence:import-pilot:dry` to validate the complete import without a DB
write. Production rollout instructions live in
`product/evidence/DATA_FOUNDATION_ROLLOUT.md`.

## Review API

Internal endpoints are mounted at `/api/v1/admin/evidence/*`. Unlike legacy admin
diagnostics, they do not accept `ANALYTICS_SECRET`; they require normal user auth and
an explicit allowlist:

```text
EVIDENCE_REVIEWER_IDS=<user UUID>,tg:<telegram id>
EVIDENCE_APPROVER_IDS=<user UUID>,tg:<telegram id>
```

Approvers imply reviewer access. Empty variables deny everyone. Every transition
requires a comment and creates an `EvidenceAuditEvent`.
