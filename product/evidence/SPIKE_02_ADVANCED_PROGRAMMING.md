# Spike 02 — progression, ROM, order, periodization и concurrent training

**Дата поиска:** 2026-08-02
**Search cutoff:** 2026-08-02
**Статус:** все claims и recommendations — `draft`
**Метод:** rapid editorial scan PubMed/PMC, publisher full text и ACSM Position
Stand 2026. Это не systematic review. Численные результаты извлечены из abstract
или доступного full text; supplements и формальный risk-of-bias appraisal ещё не
завершены.

## Source register

| ID | Работа | Тип и прямота | Идентификаторы |
|---|---|---|---|
| `RW-ACSM-2026` | Currier et al. Resistance Training Prescription... | position stand / overview of 137 reviews; общий якорь healthy adults | DOI `10.1249/MSS.0000000000003897`; PMID `41843416`; PMCID `PMC12965823` |
| `RW-PROG-CHAVES-2024` | Chaves et al. Effects of Resistance Training Overload Progression Protocols... | within-subject RCT; 39 untrained adults, 10 недель, leg extension | DOI `10.1055/a-2256-5857`; PMID `38286426` |
| `RW-PROG-PLOTKIN-2022` | Plotkin et al. Progressive overload without progressing load? | RCT; 43 resistance-trained adults, 8 недель | DOI `10.7717/peerj.14142`; PMID `36199287`; PMCID `PMC9528903` |
| `RW-ROM-PALLARES-2021` | Pallarés et al. Effects of range of motion on resistance training adaptations | systematic review/meta-analysis; 16 studies; поиск до 2021-03 | DOI `10.1111/sms.14006`; PMID `34170576` |
| `RW-ROM-KASSIANO-2023` | Kassiano et al. Which ROMs Lead to Rome? | systematic review; 11 longitudinal studies; muscle/site specific | DOI `10.1519/JSC.0000000000004415`; PMID `36662126` |
| `RW-ORDER-NUNES-2021` | Nunes et al. What influence does resistance exercise order have... | systematic review/meta-analysis; 11 studies | DOI `10.1080/17461391.2020.1733672`; PMID `32077380` |
| `RW-PERIOD-MOESGAARD-2022` | Moesgaard et al. Effects of Periodization... | systematic review/meta-analysis; 35 volume-equated studies | DOI `10.1007/s40279-021-01636-1`; PMID `35044672` |
| `RW-DELOAD-COLEMAN-2024` | Coleman et al. Gaining more from doing less? | RCT; 39 trained adults; одна неделя полного прекращения RT | DOI `10.7717/peerj.16777`; PMID `38274324`; PMCID `PMC10809978` |
| `RW-DELOAD-PANCAR-2026` | Pancar et al. Effects of deload periods... | within-subject study; 19 untrained men; reduced volume/frequency | DOI `10.1038/s41598-026-40612-5`; trial `NCT06825052` |
| `RW-CON-SCHUMANN-2022` | Schumann et al. Compatibility of Concurrent Aerobic and Strength Training... | systematic review/meta-analysis; 43 studies | DOI `10.1007/s40279-021-01587-7`; PMID `34757594`; PMCID `PMC8891239` |
| `RW-CON-HELD-2026` | Held et al. Maximizing Adaptations in Concurrent Training | umbrella review; 17 meta-analyses, 144 studies | DOI `10.1007/s40279-026-02401-y`; PMID `41762427` |

Перед `approved` для каждой работы нужны Crossmark/retraction check, license check,
funding/conflicts и полный question-specific appraisal. Отсутствие значимой разницы
ниже не считается доказанной эквивалентностью.

---

## EQ-PRG-001 — как прогрессировать

### Assessment

Два коротких прямых исследования сравнили увеличение нагрузки с увеличением
повторений. В untrained within-subject trial оба протокола улучшили leg-extension
1RM и vastus lateralis CSA без обнаруженной разницы. В trained parallel-group trial
оба способа улучшили большинство outcomes; отдельные различия не образуют надёжного
универсального правила. Это подтверждает несколько допустимых способов overload,
но не отвечает, когда именно добавлять вес, repetitions или sets на длинном горизонте.

### Claim 06 — load и repetitions

```yaml
id: ECV-PROGRESSION-METHOD-v1
claimId: EC-PROGRESSION-METHOD
questionId: EQ-PRG-001
status: draft
statement: >
  У молодых healthy adults прогрессия через увеличение нагрузки и прогрессия через
  увеличение повторений обе способны поддерживать прирост силы и мышечного размера;
  устойчивое превосходство одного способа не установлено.
population: young healthy adults; один trial untrained, один resistance-trained
outcome: exercise-specific strength and hypertrophy
certainty: low
limitations: [короткие trials, малые samples, ограниченный набор упражнений и мышц]
evidence: {supports: [RW-PROG-CHAVES-2024, RW-PROG-PLOTKIN-2022]}
searchCutoff: 2026-08-02
```

### Claim 07 — точный алгоритм progression

```yaml
id: ECV-PROGRESSION-ALGORITHM-v1
claimId: EC-PROGRESSION-ALGORITHM
questionId: EQ-PRG-001
status: draft
statement: >
  Текущих прямых сравнений недостаточно, чтобы назвать один точный алгоритм
  последовательного изменения веса, повторений и подходов оптимальным для всех.
population: healthy adults
outcome: long-term strength, hypertrophy, adherence and fatigue
certainty: very_low
effect: insufficient comparative evidence
evidence: {contextualizes: [RW-ACSM-2026, RW-PROG-CHAVES-2024, RW-PROG-PLOTKIN-2022]}
searchCutoff: 2026-08-02
```

### Product recommendation

`ER-PROGRESSION-DOUBLE-v1` — использовать double progression как прозрачную
**продуктовую эвристику**: сначала добавлять повторения внутри выбранного диапазона
при сохранении техники и target RIR, затем немного повышать нагрузку и возвращаться
к нижней части диапазона. Sets менять отдельным решением по объёму и recovery.

- strength: `conditional`;
- allowed: «это один практичный способ прогрессии»;
- forbidden: «исследования доказали, что double progression оптимальна»;
- override: боль, потеря техники, резкое падение performance или длительный перерыв
  блокируют автоматическое увеличение.

---

## EQ-HYP-006 — range of motion

### Assessment

Meta-analysis 2021 сообщил преимущество full ROM над объединёнными partial-ROM
условиями для strength (`ES 0.56`) и lower-limb hypertrophy (`ES 0.88`), но база была
небольшой и partial ROM часто выполнялся не на длинной длине мышцы. Более поздний
systematic review указывает, что full ROM или partial ROM на более длинной длине
мышцы могут превосходить short-length partial для некоторых мышц и участков.
Универсального рейтинга ROM для каждого упражнения нет.

### Claim 08 — full ROM как общий default

```yaml
id: ECV-ROM-FULL-DEFAULT-v1
claimId: EC-ROM-FULL-DEFAULT
questionId: EQ-HYP-006
status: draft
statement: >
  Full ROM в среднем является более надёжной общей стратегией, чем произвольная
  укороченная амплитуда, особенно для силы и гипертрофии нижней части тела.
population: healthy adults
outcome: strength and site-specific hypertrophy
certainty: moderate
limitations: [мало исследований, преимущественно lower body, определения partial ROM различаются]
evidence: {supports: [RW-ROM-PALLARES-2021, RW-ROM-KASSIANO-2023, RW-ACSM-2026]}
searchCutoff: 2026-08-02
```

### Claim 09 — lengthened partials

```yaml
id: ECV-ROM-LENGTHENED-PARTIAL-v1
claimId: EC-ROM-LENGTHENED-PARTIAL
questionId: EQ-HYP-006
status: draft
statement: >
  Работа в partial ROM на длинной длине мышцы может давать сопоставимую или большую
  локальную гипертрофию, чем full ROM, в отдельных упражнениях и мышцах, но это
  emerging и muscle-specific evidence, а не универсальное правило.
population: healthy adults in studied exercise-specific protocols
outcome: regional hypertrophy
certainty: low
limitations: [небольшая база, site-specific outcomes, нельзя переносить между упражнениями]
evidence: {supports: [RW-ROM-KASSIANO-2023], contextualizes: [RW-ROM-PALLARES-2021]}
searchCutoff: 2026-08-02
```

### Product recommendation

`ER-ROM-COMFORTABLE-FULL-v1` — начинать с максимально полной **комфортной и
контролируемой** амплитуды, которую допускают техника и конкретное упражнение.
Lengthened partial предлагать только как exercise-specific вариант, а не замену всей
программе. Боль не является сигналом «углубить растяжение»; провоцирующее движение
останавливается и выходит за scope этой базы.

---

## EQ-PRG-002 — порядок упражнений

### Assessment

Meta-analysis 11 исследований не нашёл общей разницы между orders по всем strength
tests, но exercise-specific gains были больше, когда соответствующее упражнение
выполнялось раньше: для multi-joint `ES 0.32`, для single-joint `ES -0.58`. Для
hypertrophy обнаруженной разницы не было (`ES 0.03`), но база мала и объединяет
site-specific и indirect measures.

### Claim 10 — strength priority

```yaml
id: ECV-ORDER-STRENGTH-PRIORITY-v1
claimId: EC-ORDER-STRENGTH-PRIORITY
questionId: EQ-PRG-002
status: draft
statement: >
  Если цель — увеличить силу в конкретном упражнении, его размещение ближе к началу
  сессии в среднем благоприятствует exercise-specific strength gain.
population: healthy adults
outcome: exercise-specific dynamic strength
certainty: moderate
evidence: {supports: [RW-ORDER-NUNES-2021]}
searchCutoff: 2026-08-02
```

### Claim 11 — hypertrophy order

```yaml
id: ECV-ORDER-HYPERTROPHY-v1
claimId: EC-ORDER-HYPERTROPHY
questionId: EQ-PRG-002
status: draft
statement: >
  Для общей гипертрофии не показано устойчивого преимущества порядка multi-joint
  → single-joint над обратным порядком; уверенность ограничена малым числом данных.
population: healthy adults
outcome: hypertrophy
certainty: low
effect: no clear detected difference
evidence: {supports: [RW-ORDER-NUNES-2021]}
searchCutoff: 2026-08-02
```

### Product recommendation

`ER-ORDER-PRIORITY-FIRST-v1` — ставить первой главную цель пользователя или наиболее
технически требовательное движение; «compound всегда первым» не является жёстким
правилом. При нескольких равных целях порядок можно выбирать по безопасности,
оборудованию, preferences и adherence.

---

## EQ-PRG-003 — periodization и deload

### Assessment

В 35 volume-equated studies periodized training дал небольшой средний advantage по
1RM strength (`ES 0.31`, 95% CI `0.04–0.57`), но не по hypertrophy (`ES 0.13`, CI
`-0.10–0.36`). Undulating против linear также дал небольшой strength advantage,
выраженнее в trained subgroup, однако intervals и heterogeneity требуют проверки.

Deload — другой intervention. В trained trial неделя полного прекращения в середине
9-недельной программы не улучшила hypertrophy/power/endurance и дала меньшие gains
lower-body strength. В untrained within-subject trial 2026 две недели сниженных
volume/frequency дали схожие hypertrophy и 10RM changes при примерно на 18% меньшем
общем числе sets. Эти studies не доказывают ни необходимость, ни бесполезность
индивидуально вызванного deload.

### Claim 12 — periodization

```yaml
id: ECV-PERIODIZATION-OUTCOMES-v1
claimId: EC-PERIODIZATION-OUTCOMES
questionId: EQ-PRG-003
status: draft
statement: >
  При сопоставимом объёме периодизация нагрузки и объёма может давать небольшой
  средний выигрыш в 1RM strength, особенно у trained lifters, но явного преимущества
  для hypertrophy не установлено.
population: healthy adults; trained subgroup potentially more responsive
outcome: maximal strength and hypertrophy, kept separate
certainty: moderate
evidence: {supports: [RW-PERIOD-MOESGAARD-2022], contextualizes: [RW-ACSM-2026]}
searchCutoff: 2026-08-02
```

### Claim 13 — planned deload

```yaml
id: ECV-DELOAD-PLANNED-v1
claimId: EC-DELOAD-PLANNED
questionId: EQ-PRG-003
status: draft
statement: >
  Данных недостаточно, чтобы считать плановый deload через фиксированное число недель
  необходимым или улучшающим долгосрочные результаты у всех; короткое снижение
  нагрузки может сохранить часть адаптаций, но лучший trigger и protocol неизвестны.
population: healthy adults; evidence split between trained mixed-sex and untrained men
outcome: strength, hypertrophy, recovery and adherence
certainty: very_low
evidence: {contextualizes: [RW-DELOAD-COLEMAN-2024, RW-DELOAD-PANCAR-2026]}
searchCutoff: 2026-08-02
```

### Product recommendation

`ER-PERIODIZATION-DELOAD-v1` — для strength goal разрешать простую variation по
нагрузке/повторениям. Deload запускать условно по накопленным данным пользователя
(необычное устойчивое падение performance, recovery/adherence constraints), а не
обязательным календарём. Конкретное снижение sets/load — product policy и требует
отдельной валидации; симптомы болезни или травмы не маскируются как «нужен deload».

---

## EQ-CON-001 — силовые и кардио

### Assessment

Meta-analysis 43 studies сравнил concurrent training с тем же resistance training
без аэробной части. Обнаруженной разницы не было для maximal strength (`SMD -0.06`)
и hypertrophy (`SMD -0.01`); explosive strength был ниже (`SMD -0.28`). Attenuation
power была заметнее в одной сессии, но не обнаруживалась при разделении минимум на
три часа. Umbrella review 2026 по 17 meta-analyses в целом подтверждает comparable
strength/power/hypertrophy при concurrent training, но агрегирование обзоров не
устраняет overlap и неоднородность dose, mode и training status.

### Claim 14 — maximal strength и hypertrophy

```yaml
id: ECV-CONCURRENT-STRENGTH-HYP-v1
claimId: EC-CONCURRENT-STRENGTH-HYP
questionId: EQ-CON-001
status: draft
statement: >
  У healthy adults добавление аэробной работы к силовой в среднем не показывает
  существенного ухудшения гипертрофии или maximal strength по сравнению с одной
  силовой программой, хотя индивидуальный результат зависит от общего dose и recovery.
population: healthy adults across mixed training status
outcome: muscle hypertrophy and maximal strength
certainty: moderate
evidence: {supports: [RW-CON-SCHUMANN-2022, RW-CON-HELD-2026]}
searchCutoff: 2026-08-02
```

### Claim 15 — power и scheduling

```yaml
id: ECV-CONCURRENT-POWER-SCHEDULE-v1
claimId: EC-CONCURRENT-POWER-SCHEDULE
questionId: EQ-CON-001
status: draft
statement: >
  Explosive-strength adaptations могут быть меньше при concurrent training,
  особенно когда endurance и resistance work выполняются в одной сессии; разделение
  сессий минимум на несколько часов может уменьшать этот риск.
population: healthy adults; direct evidence for elite athletes remains limited
outcome: explosive strength / power
certainty: low
evidence: {supports: [RW-CON-SCHUMANN-2022], contextualizes: [RW-CON-HELD-2026]}
searchCutoff: 2026-08-02
```

### Product recommendation

`ER-CONCURRENT-SCHEDULE-v1` — не убирать cardio из hypertrophy/strength программы по
умолчанию. Если приоритет — strength/power, ставить силовую работу первой и по
возможности разделять demanding endurance и lower-body strength минимум на несколько
часов или разные дни. Порог `≥3 h` — практический ориентир из subgroup evidence, не
гарантия отсутствия interference. Учитывать суммарную fatigue и energy availability.

---

## Gate перед использованием

Все десять claims дают полные 15 draft claims вместе со Spike 01, но production gate
остаётся закрытым. Scientific reviewer должен проверить full text, supplements,
source locators, overlap reviews, bias/precision, conflicts, correction status и
формулировки certainty. До статуса `approved` runtime retrieval обязан игнорировать
эти сущности.
