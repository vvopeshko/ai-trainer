# Первые 10 Evidence Questions

**Версия:** 1
**Дата:** 2026-08-02
**Scope:** здоровые взрослые, силовые тренировки; лечение, реабилитация и острые
травмы исключены.

## Приоритизация

| ID | Вопрос | AI | SEO | Риск | Spike 01 |
|---|---|---:|---:|---:|---:|
| `EQ-HYP-001` | Как недельный объём влияет на гипертрофию? | P0 | P0 | medium | Да |
| `EQ-HYP-002` | Нужно ли выполнять подходы до мышечного отказа? | P0 | P0 | medium | Да |
| `EQ-HYP-003` | Как нагрузка и диапазон повторений влияют на гипертрофию и силу? | P0 | P0 | medium | Да |
| `EQ-HYP-004` | Влияет ли частота тренировки мышцы при одинаковом объёме? | P0 | P0 | low | Да |
| `EQ-HYP-005` | Сколько отдыхать между рабочими подходами? | P0 | P0 | low | Да |
| `EQ-PRG-001` | Как прогрессировать вес, повторения и объём? | P0 | P1 | medium | Нет |
| `EQ-HYP-006` | Как амплитуда движения влияет на гипертрофию и силу? | P1 | P0 | medium | Нет |
| `EQ-PRG-002` | Влияет ли порядок упражнений на результат? | P1 | P1 | low | Нет |
| `EQ-PRG-003` | Нужны ли периодизация и плановый deload? | P1 | P0 | medium | Нет |
| `EQ-CON-001` | Когда кардио мешает силе или гипертрофии? | P1 | P0 | medium | Нет |

`P0` — влияет на генерацию почти каждой программы. `P1` — частая корректировка или
сильный SEO-кластер. Risk — цена неверной или чрезмерно категоричной рекомендации.

---

## EQ-HYP-001 — недельный объём

**Вопрос:** как число трудных рабочих подходов на мышечную группу в неделю связано с
гипертрофией и где начинаются diminishing returns?

**PICO:**

- P: здоровые взрослые ≥18 лет, trained и untrained анализируются отдельно;
- I/C: разные недельные set volumes при сопоставимых остальных переменных;
- O: site-specific muscle thickness, CSA или volume; lean mass — secondary;
- срок: преимущественно ≥6 недель.

**Ключевые модераторы:** direct/indirect sets, RIR, per-session volume, training
status, muscle group, baseline volume, adherence.

**PubMed seed query:**

```text
("Resistance Training"[Mesh] OR resistance train*[Title/Abstract])
AND (volume[Title/Abstract] OR weekly sets[Title/Abstract])
AND (hypertroph*[Title/Abstract] OR muscle size[Title/Abstract])
AND (systematic review[Publication Type] OR meta-analysis[Publication Type])
NOT (rehabilitation[Title/Abstract])
```

**Review interval:** 6 месяцев. **Critical:** да — задаёт дозировку программы.

## EQ-HYP-002 — proximity to failure

**Вопрос:** насколько близко к momentary muscular failure следует завершать рабочий
подход для гипертрофии и силы?

**PICO:**

- P: healthy adults; trained/untrained отдельно;
- I/C: failure против non-failure либо разные RIR/velocity-loss thresholds;
- O: site-specific hypertrophy, 1RM/dynamic strength, fatigue/adverse events;
- срок: ≥6 недель для основных исходов.

**Ключевые модераторы:** фактический против предписанного RIR, load, volume equating,
compound/isolation exercise, training status, number of sets.

**PubMed seed query:**

```text
(resistance train*[Title/Abstract])
AND (failure[Title/Abstract] OR repetitions in reserve[Title/Abstract]
     OR proximity to failure[Title/Abstract] OR velocity loss[Title/Abstract])
AND (hypertroph*[Title/Abstract] OR strength[Title/Abstract])
```

**Review interval:** 6 месяцев. **Critical:** да — влияет на fatigue и безопасность.

## EQ-HYP-003 — load и repetition range

**Вопрос:** как relative load и диапазон повторений влияют на гипертрофию и силу при
достаточном усилии?

**PICO:**

- P: healthy adults;
- I/C: low, moderate и high load либо разные RM ranges;
- O: hypertrophy и strength раздельно;
- дополнительные исходы: discomfort, adherence, duration, adverse events.

**Ключевые модераторы:** proximity to failure, test specificity, training status,
volume definition, очень низкие нагрузки.

**PubMed seed query:**

```text
(resistance train*[Title/Abstract])
AND (load[Title/Abstract] OR repetition range[Title/Abstract]
     OR low load[Title/Abstract] OR high load[Title/Abstract])
AND (hypertroph*[Title/Abstract] OR strength[Title/Abstract])
AND (meta-analysis[Publication Type] OR systematic review[Publication Type])
```

**Review interval:** 12 месяцев. **Critical:** да.

## EQ-HYP-004 — frequency

**Вопрос:** даёт ли большее число тренировок одной мышцы в неделю независимый эффект
при одинаковом недельном объёме?

**PICO:**

- P: healthy adults;
- I/C: разные weekly frequencies с volume-equated анализом как основным;
- O: hypertrophy и strength;
- secondary: adherence, session duration, soreness.

**Ключевые модераторы:** per-session volume, exercise practice specificity,
direct/indirect frequency, training status.

**PubMed seed query:**

```text
(resistance train*[Title/Abstract])
AND (frequen*[Title/Abstract] OR once weekly[Title/Abstract]
     OR twice weekly[Title/Abstract])
AND (hypertroph*[Title/Abstract] OR strength[Title/Abstract])
AND (meta-analysis[Publication Type] OR systematic review[Publication Type])
```

**Review interval:** 12 месяцев. **Critical:** нет.

## EQ-HYP-005 — inter-set rest

**Вопрос:** как длительность отдыха между рабочими подходами влияет на гипертрофию,
силу и качество последующих подходов?

**PICO:**

- P: healthy adults;
- I/C: разные fixed или individualized rest intervals;
- O: hypertrophy и strength; volume/repetitions — secondary;
- исключить circuit training, если rest нельзя изолировать.

**Ключевые модераторы:** exercise, load, RIR, training status, fixed sets против
volume-equated protocols.

**PubMed seed query:**

```text
(resistance train*[Title/Abstract])
AND (rest interval*[Title/Abstract] OR inter-set rest[Title/Abstract])
AND (hypertroph*[Title/Abstract] OR strength[Title/Abstract]
     OR volume load[Title/Abstract])
```

**Review interval:** 12 месяцев. **Critical:** нет.

## EQ-PRG-001 — progression

**Вопрос:** какие стратегии progression дают устойчивый рост силы/мышц при
контролируемой fatigue?

**PICO:** load, repetitions, sets и autoregulation strategies; сравнивать новичков и
trained; исходы — strength, hypertrophy, adherence и adverse events.

**Review interval:** 12 месяцев. **Critical:** да.

## EQ-HYP-006 — range of motion

**Вопрос:** как full, partial и lengthened-partial ROM влияют на региональную
гипертрофию и силу?

**PICO:** анализировать упражнения и длину мышцы отдельно; не переносить результат
одного сустава на всё тело.

**Review interval:** 6 месяцев из-за быстро меняющейся базы. **Critical:** нет.

## EQ-PRG-002 — exercise order

**Вопрос:** влияет ли положение упражнения в тренировке на его strength/hypertrophy
outcome и как выбирать порядок под приоритет пользователя?

**Review interval:** 18 месяцев. **Critical:** нет.

## EQ-PRG-003 — periodization и deload

**Вопрос:** даёт ли planned variation/deload преимущество над непериодизированной или
autoregulated программой?

Periodization и deload изначально ведутся как два связанных subquestions: данных по
periodization нельзя автоматически считать данными по плановому deload.

**Review interval:** 12 месяцев. **Critical:** нет.

## EQ-CON-001 — concurrent cardio

**Вопрос:** при каких mode, dose и schedule аэробная работа снижает strength,
hypertrophy или power adaptations?

**Ключевые модераторы:** cycling/running, HIIT/continuous, same-session separation,
total dose, energy availability, trained status.

**Review interval:** 12 месяцев. **Critical:** да для endurance goals.

---

## Общие exclusion criteria

- animal/in-vitro studies для прямых product recommendations;
- acute hormonal/MPS outcomes как замена longitudinal hypertrophy;
- rehabilitation или disease population без отдельного вопроса;
- uncontrolled case reports;
- preprints как основание approved recommendation;
- studies, где сравниваются сразу несколько неразделимых переменных;
- retracted publications.
