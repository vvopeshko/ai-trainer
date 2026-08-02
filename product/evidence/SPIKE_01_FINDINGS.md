# Spike 01 — выводы для продукта и data model

**Дата:** 2026-08-02
**Основание:** пять цепочек в
[SPIKE_01_CORE_PROGRAMMING.md](SPIKE_01_CORE_PROGRAMMING.md).

## 1. Что подтвердилось

### Claim-centric модель работает

Одна публикация одновременно влияет на несколько вопросов: meta-regression объёма и
частоты поддерживает два claims, а ACSM position stand контекстуализирует почти все.
Document-centric RAG дублировал бы выводы и не управлял противоречиями.

### Claim и recommendation должны быть разными объектами

Исследования редко дают точный product default. Например:

- claim по отдыху поддерживает «не делать паузы слишком короткими»;
- default `2–3 минуты compound / 1–2 isolation` — удобная эвристика;
- эвристика совместима с evidence, но не должна маскироваться под найденный threshold.

Поле `implementationHeuristic` нужно сохранить как отдельное от `guidance`.

### Один вопрос может требовать нескольких outcomes

Load, frequency и proximity-to-failure ведут себя по-разному для hypertrophy и
strength. Нельзя хранить claim «лучший диапазон повторений» без поля outcome.

### Assessment действительно question-specific

Position stand высоко релевантен для population-level ответа, но недостаточен для
точного вопроса о RIR. RIR trial прям для quadriceps hypertrophy, но почти непрям для
общей strength prescription. Связь `QuestionWork` обязательна.

### Applicability должна быть структурной

Фразы «healthy adults», «resistance-trained», «young», пол и muscle group регулярно
меняют переносимость вывода. Одного массива tags мало: нужны хотя бы structured
population, trainingStatus, ageBand, sexBalance и bodyRegion/muscleGroup.

## 2. Новые обязательные поля

В будущую data model добавить или явно сохранить в JSON schema:

### `ResearchWork`

- `openScienceJson`: preregistration, data, code;
- `conflictsJson` и `fundingText`;
- `statusCheckedAt` отдельно от `updatedAt`;
- `licenseCheckedAt`;
- `sampleSummaryJson` даже для review-level works;
- `evidenceLevel`: primary, review, overview, guideline/position.

### `ResearchAssessment`

- `reviewScope`: abstract/full text/supplements;
- `directnessByOutcome`;
- `populationApplicabilityJson`;
- `modelDependence`: direct comparison / subgroup / meta-regression;
- `sourceLocatorsJson` для чисел;
- `cannotSupportJson`: список выводов, которые работа не позволяет делать.

### `EvidenceClaimVersion`

- `outcome` обязателен;
- `effectDirection` отдельно от свободного текста;
- `precisionQualifier`;
- `applicabilityJson`;
- `unknownsJson`;
- `searchCutoff` отдельно от created/reviewed date.

### `EvidenceRecommendation`

- `guidance` — только прямое следствие claim;
- `implementationHeuristic` — product default;
- `heuristicRationale`;
- `allowedWording` / `forbiddenWording` для prompt tests;
- `safetyOverridesJson`;
- `answerabilityPolicy`.

## 3. Controlled vocabulary v0

Без словаря retrieval быстро станет ненадёжным.

```text
population: healthy_adult | older_adult | adolescent | clinical
training_status: untrained | novice | trained | advanced | mixed | unclear
goal/outcome: hypertrophy | maximal_strength | power | endurance | adherence | fatigue
body_scope: whole_body | upper_body | lower_body | muscle_specific
evidence_relation: supports | contradicts | contextualizes
certainty: high | moderate | low | very_low
recommendation_strength: strong | conditional | insufficient
answerability: supported | uncertain | out_of_scope
```

`advanced` нельзя автоматически считать синонимом `trained`: текущая литература часто
называет trained участника по минимальному стажу, который не отражает высокий уровень.

## 4. Изменение retrieval contract

Одного `question + goal + experienceLevel` мало. Минимальный runtime запрос:

```js
getEvidenceGuidance({
  question,
  outcome,
  goal,
  trainingStatus,
  bodyScope,
  constraints,
  availableTime,
})
```

`availableTime` не меняет scientific claim, но помогает выбрать implementation
heuristic: например, более короткий rest или меньшая frequency могут быть приемлемым
trade-off ради adherence.

## 5. Нужен слой compatibility между recommendations

Рекомендации нельзя независимо складывать в программу:

- высокий weekly volume + каждый set до failure + короткий rest создают общий fatigue,
  который не отражён в каждом отдельном claim;
- high-rep sets требуют иной интерпретации RIR;
- frequency выбирается после volume и session constraints.

Нужен `GuidelineBundle` с validation rules:

```text
goal → volume envelope → frequency distribution → load/reps → RIR → rest
```

Bundle хранит версии claims/recommendations и product policy version.

## 6. Изменение порядка будущей реализации

До внешнего ingestion полезнее реализовать:

1. schemas и validators для ручных карточек;
2. claim/recommendation versioning;
3. retrieval + regression tests;
4. только затем PubMed adapter и LLM extraction.

Причина: главный риск — не найти публикацию, а неправильно превратить её в
продуктовое правило.

## 7. Что требует scientific review

Перед присвоением `approved` reviewer должен особенно проверить:

1. volume: coding fractional sets и практическую допустимость ориентира ~10;
2. RIR: не превращён ли exploratory meta-regression в слишком точную рекомендацию;
3. load: границы «широкого диапазона» и обязательное условие effort;
4. frequency: различие population guideline «2 days» и per-muscle independent effect;
5. rest: не выдаются ли product defaults 2–3/1–2 минуты за прямые thresholds;
6. licenses и разрешённый объём локального хранения full text/abstract;
7. correction/retraction status всех работ непосредственно перед approval.

## 8. Решение по фазе 0

Редакционная модель пригодна для продолжения. Пять цепочек заполнились без изменения
основных сущностей архитектуры, но выявили необходимость outcome-specific claims,
отдельных implementation heuristics, structured applicability и compatibility layer.

Следующий инкремент фазы 0:

- провести human scientific review этих пяти цепочек;
- прогнать 40 подготовленных AI regression questions;
- заполнить ещё пять вопросов из списка;
- после этого зафиксировать JSON/Zod schemas и перейти к фазе 1 data foundation.
