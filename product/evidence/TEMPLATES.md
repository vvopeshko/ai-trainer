# Редакционные шаблоны Evidence Knowledge Base

Шаблоны предназначены для ручного spike. Поля, которые окажутся полезными минимум в
трёх цепочках, — кандидаты в Prisma schema. Остальные могут остаться JSON или частью
редакторского интерфейса.

## 0. Evidence Question

```yaml
id: EQ-...
topic:
question: # точная исследовательская формулировка EN
questionRu: # точная исследовательская формулировка RU
plainQuestion: # основная понятная формулировка EN
plainQuestionRu: # основная понятная формулировка RU
outcomes: []
scope:
scopeRu:
searchStrategy:
  databases: []
  queries: []
  supplementaryMethods: []
searchDate:
searchNotes:
```

## 1. Research Work

```yaml
id: RW-000
status: discovered # discovered|screened_in|screened_out|retracted
title:
authors:
year:
workType: # position_stand|systematic_review|meta_analysis|rct|other
studyDesign:
journal:
doi:
pmid:
pmcid:
url:
openAccess:
license:
licenseCheckedAt:
correctionStatus: current # current|corrected|retracted|unknown
statusCheckedAt:
funding:
conflicts:
sourceNotes:
```

## 2. Question-specific assessment

```yaml
id: RA-000
questionId: EQ-...
workId: RW-...
status: draft # draft|in_review|approved|rejected
reviewScope: abstract_only # abstract_only|full_text|full_text_and_supplements
population:
intervention:
comparator:
outcomes:
duration:
sample:
mainResults:
  - result:
    locator:
directness: # high|some_concerns|low
riskOfBias: # low|some_concerns|high|not_assessed
precision:
consistency:
publicationBias:
fundingConflicts:
strengths:
limitations:
reviewerNotes:
assessedBy:
assessedAt:
```

`reviewScope: abstract_only` запрещает использовать assessment для финального
approval. Для систематического обзора итоговый review должен включать хотя бы full
text, search date, eligibility, risk-of-bias method, included studies и sensitivity
analyses.

## 3. Claim version

```yaml
id: ECV-000-v1
claimId: EC-000
questionId: EQ-...
version: 1
status: draft # draft|in_review|approved|disputed|superseded|withdrawn
statement:
statementRu:
plainStatement: # понятный основной вывод без потери условий и certainty
plainStatementRu:
population:
context:
outcome:
muscles: [] # обязательны для muscle-specific outcomes
muscleRegions: [] # обязательны, если измерялся отдельный участок мышцы
exercises: [] # упражнения, непосредственно исследованные в evidence
romSegments: [] # full|lengthened_partial|shortened_partial|middle_partial
measurementMethods: [] # например MRI, ultrasound; с measurement site при наличии
applicabilityNotes: []
effect:
certainty: # high|moderate|low|very_low
certaintyRationale:
limitations:
unknowns:
evidence:
  supports: [RW-...]
  contradicts: []
  contextualizes: []
searchCutoff:
reviewDueAt:
createdBy:
reviewedBy:
reviewedAt:
glossaryTerms: [] # идентификаторы использованных утверждённых терминов
```

Для claim о гипертрофии недостаточно формулировки «для отдельных мышц». Нужно
перечислить мышцы, исследованные упражнения и, если применимо, участки мышцы и точки
измерения. Локальное измерение нельзя формулировать как эффект для всей мышцы. Claim
с неизвестной мышцей или областью применимости может оставаться исследовательским
черновиком, но не проходит approval как основание для product recommendation.

## 4. Product recommendation

```yaml
id: ER-000
claimVersionId: ECV-000-v1
status: draft
surface: # ai_trainer|program_generation|blog|all
audience:
preconditions:
guidance:
implementationHeuristic:
strength: # strong|conditional|insufficient
exceptions:
safetyNotes:
allowedWording:
forbiddenWording:
reviewDueAt:
```

`guidance` следует напрямую из claim. `implementationHeuristic` может добавлять
удобные значения по умолчанию, но обязана быть обозначена как продуктовый выбор,
если конкретное число не установлено исследованиями.

## 5. AI answer test

```yaml
id: AIT-000
question:
userContext:
expectedAnswerability: supported # supported|uncertain|out_of_scope
requiredClaims: [ECV-...]
mustInclude:
mustNotInclude:
exampleAnswer:
reviewResult:
```

## 6. Blog outline

```yaml
id: BO-000
primaryQuestionId: EQ-...
workingTitle:
searchIntent:
reader:
primaryClaimVersions: [ECV-...]
sections:
  - heading:
    purpose:
originalValue:
mandatoryLimitations:
cta:
reviewerRequired: true
```

## 7. Decision record

```yaml
decision:
entityType:
entityId:
actor:
date:
result:
rationale:
affectedUsages:
```
