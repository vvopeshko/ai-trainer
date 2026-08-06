# Evidence editorial workspace

Рабочие материалы фазы 0 из
[EVIDENCE_KNOWLEDGE_BASE.md](../EVIDENCE_KNOWLEDGE_BASE.md#26-этапы-реализации).

Здесь проверяется редакционная модель
`question → work → assessment → claim → recommendation → AI answer → blog outline`
до проектирования Prisma schema и ingestion pipeline.

## Статус материалов

Все карточки в этой папке — **редакционные черновики**, а не медицинские или
официальные научные рекомендации.

| Статус | Значение | Разрешено использовать в runtime |
|---|---|---|
| `draft` | Извлечено и синтезировано, но не проверено scientific reviewer | Нет |
| `in_review` | Передано reviewer | Нет |
| `approved` | Проверено reviewer с зафиксированным решением | Да |
| `disputed` | Есть существенное противоречие или проблема источника | Нет |
| `superseded` | Заменено новой версией | Нет |
| `withdrawn` | Отозвано | Нет |

В текущем spike все claims и recommendations имеют статус `draft`.

## Файлы

- [QUESTIONS.md](QUESTIONS.md) — первые 10 Evidence Questions и поисковые стратегии.
- [INPUT_SOURCES.md](INPUT_SOURCES.md) — source funnel: откуда приходят исследования,
  какие данные берём и как обновляем корпус.
- [TEMPLATES.md](TEMPLATES.md) — карточки для ручного workflow.
- [PLAIN_LANGUAGE_GLOSSARY.md](PLAIN_LANGUAGE_GLOSSARY.md) — единый словарь
  научных и понятных пользовательских формулировок.
- [SPIKE_01_CORE_PROGRAMMING.md](SPIKE_01_CORE_PROGRAMMING.md) — пять полных
  evidence-цепочек по основным переменным программы.
- [SPIKE_02_ADVANCED_PROGRAMMING.md](SPIKE_02_ADVANCED_PROGRAMMING.md) — ещё десять
  outcome-specific claims по пяти вопросам.
- [ROM_REVIEW_PACKET.md](ROM_REVIEW_PACKET.md) — обновлённый поиск, evidence matrix
  и muscle-specific draft claims по полной и частичной амплитуде.
- [AI_REGRESSION_SET.md](AI_REGRESSION_SET.md) — 50 тестовых вопросов для AI.
- [BLOG_BRIEFS.md](BLOG_BRIEFS.md) — шесть evidence-backed content briefs.
- [SPIKE_01_FINDINGS.md](SPIKE_01_FINDINGS.md) — что spike изменил в будущей
  продуктовой и data model.
- [PHASE_0_FINDINGS.md](PHASE_0_FINDINGS.md) — итог пилота и gate к data foundation.
- [DATA_FOUNDATION_ROLLOUT.md](DATA_FOUNDATION_ROLLOUT.md) — безопасный rollout
  Prisma schema и pilot import.

## Правила редактирования

1. Один claim содержит одно проверяемое утверждение.
2. Scientific claim не содержит продуктовых эвристик.
3. Эвристика всегда маркируется отдельно и ссылается на claim.
4. Отсутствие различий не формулируется как доказанная эквивалентность.
5. `p > 0.05` не означает, что эффекта точно нет.
6. Certainty не выводится только из типа публикации.
7. Применимость к женщинам, older adults и advanced lifters проверяется отдельно.
8. Каждая численная величина должна иметь source locator.
9. DOI/PMID и correction/retraction status проверяются перед approval.
10. AI не может самостоятельно перевести сущность в `approved`.
11. Claim о гипертрофии или иной мышечно-специфичной адаптации явно указывает
    исследованную мышцу, а если результат измерен локально — также участок мышцы и
    точку/метод измерения.
12. Результат для одной мышцы или одного её участка нельзя переносить на всю мышцу,
    другие мышцы или упражнения без отдельных прямых данных. Если мышца и область
    применимости не установлены, claim не может стать основанием для product
    recommendation.
13. Для ключевого научного термина используется утверждённая понятная формулировка
    из словаря. В пользовательских поверхностях она показывается основной, а
    научный термин сохраняется для точности, поиска и review.

## Дата среза

Первый поиск выполнен 2026-08-02; вопрос об амплитуде обновлён 2026-08-06. Для
каждой цепочки отдельно указаны дата поиска, охват и ограничения. Это rapid
editorial scan, а не systematic review.

## Готовность фазы 0

Два research spikes закрывают редакционную часть фазы 0:

- ✅ выбраны 10 вопросов;
- ✅ созданы 15 outcome-specific draft claims по всем вопросам;
- ✅ подготовлены 50 AI regression cases;
- ✅ подготовлены шесть blog briefs;
- ⏳ нужен human scientific review всех draft claims;
- ⏳ после review нужно реально прогнать AI regression set.

После фазы 0 вопрос об амплитуде расширен до 18 draft claims и 56 AI regression
cases. Исторические counts выше сохранены как результат исходного пилота.

## Data foundation v0

Редакционные сущности перенесены в исполняемый backend-прототип:

- Zod schemas с проверкой связей и approval invariants;
- fixtures всего phase-0 корпуса;
- fail-closed retrieval по question/outcome/applicability;
- отдельный gate для scientific claim и product recommendation;
- regression tests, не допускающие `draft`, просроченные claims и источники с
  непроверенным/retracted status.

Реализация: [`server/src/services/evidence`](../../server/src/services/evidence/README.md).
Prisma persistence, database-backed loader и review API готовы. Внутренняя админка
доступна по `/admin/evidence`: очередь claims, research questions, readiness blockers,
assessment/recommendation transitions, audit trail и fail-closed runtime check.

Для включения review-действий нужно применить
[`2026-08-02-evidence-review-audit.sql`](../../server/prisma/manual/2026-08-02-evidence-review-audit.sql)
и заполнить `EVIDENCE_REVIEWER_IDS` / `EVIDENCE_APPROVER_IDS`. Значения — User UUID
или `tg:<telegramId>`, через запятую; пустой allowlist закрывает доступ.
