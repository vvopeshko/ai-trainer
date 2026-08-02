# Phase 0 — итог ручного evidence pilot

**Дата:** 2026-08-02
**Scope:** 10 вопросов о resistance/concurrent training для healthy adults
**Результат:** 15 draft claims, 10 групп recommendations, 50 AI cases, 6 blog briefs.

## Что пилот доказал для продукта

Один научный вопрос почти всегда распадается по outcomes. Порядок упражнений влияет
на exercise-specific strength иначе, чем на hypertrophy; concurrent training — на
power иначе, чем на maximal strength; periodization нельзя использовать как proxy для
deload. Поэтому единицей retrieval остаётся версионированный claim, а не статья или
общий «ответ на вопрос».

Вторая граница проходит между evidence и policy. Double progression, comfortable
full ROM, priority-first order, trigger-based deload и разнесение cardio/strength —
полезные product defaults. Но исследования редко проверяют их как цельный алгоритм.
Runtime должен показывать происхождение каждого слоя:

```text
evidence claim → ограничения/certainty → product heuristic → пользовательский контекст
```

## Compatibility rules v0

Из двух spikes следуют первые правила сборки программы:

1. `goal/outcome` выбирается до load, order и concurrent schedule.
2. Weekly volume задаётся до frequency; frequency распределяет dose, а не заменяет её.
3. Load/reps, RIR и rest валидируются вместе, потому что они меняют качество и fatigue.
4. Priority exercise размещается раньше; правило «compound first» не глобальное.
5. Full comfortable ROM — default; lengthened partial требует exercise-specific flag.
6. Progression меняет один управляемый stimulus за раз и имеет safety/recovery override.
7. Periodization и deload — разные entities и не наследуют evidence друг друга.
8. Concurrent schedule хранит outcome priority; power получает более строгий spacing.

## Дополнения к data model после Spike 02

К полям из [SPIKE_01_FINDINGS.md](SPIKE_01_FINDINGS.md) добавить:

- `interventionVariant`: например `full_rom`, `short_length_partial`,
  `lengthened_partial`, `cessation_deload`, `reduced_dose_deload`;
- `outcomePriority` и `exercisePriority` для order/scheduling rules;
- `sessionRelation`: `same_session`, `separated_hours`, `different_days`;
- `evidenceBoundary`: явная запись, почему evidence одного subquestion нельзя
  переносить на другой;
- `heuristicTriggerJson`: наблюдаемые product signals отдельно от научного claim;
- `minimumSeparationMinutes` только как versioned heuristic, а не свойство claim;
- `sourceOverlapJson` для umbrella review и входящих meta-analyses.

## Gate review

Переход к production knowledge base пока заблокирован, но data-foundation phase можно
начинать параллельно. Перед `approved` scientific reviewer должен для всех 15 claims:

1. проверить full text и supplements, а не только abstract;
2. проставить risk of bias, directness, precision, consistency и publication bias;
3. проверить DOI, correction/retraction status, funding, conflicts и license;
4. подтвердить каждое число source locator;
5. проверить, что `no detected difference` не превратилось в equivalence;
6. оценить applicability к women, older adults, trained/advanced и конкретным мышцам;
7. утвердить allowed/forbidden wording и review interval.

До прохождения gate все сущности остаются `draft`, а production retrieval возвращает
только ранее независимо одобренные материалы — в текущем pilot таких нет.

## Следующий технический инкремент

Зафиксировать JSON Schema/Zod contracts для `ResearchWork`, `Assessment`,
`ClaimVersion`, `Recommendation`, `AITest` и `BlogOutline`; загрузить эти ручные
карточки как fixtures; реализовать status gate и deterministic regression runner.
PubMed ingestion имеет смысл подключать после этого, чтобы автоматизация наполняла уже
проверенную модель, а не определяла её случайно.

### Статус на 2026-08-02

Zod contracts, полные pilot fixtures, status gate и deterministic retrieval находятся
в `server/src/services/evidence`. Prisma persistence, transactional pilot import и
database-backed loader также реализованы без изменения публичного retrieval contract.
Следующий шаг — внешний schema rollout по отдельному checklist и admin/review API.
