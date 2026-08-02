# Spike 01 — основные переменные программы

**Дата поиска:** 2026-08-02
**Search cutoff:** 2026-08-02
**Статус всех claims/recommendations:** `draft`
**Метод:** rapid editorial scan PubMed/PMC и официального сайта ACSM; это не
systematic review. Abstract-only assessments явно отмечены.

## Общий якорный источник

### RW-ACSM-2026

- **Title:** American College of Sports Medicine Position Stand. Resistance
  Training Prescription for Muscle Function, Hypertrophy, and Physical Performance
  in Healthy Adults: An Overview of Reviews.
- **Type:** position stand / overview of reviews.
- **Coverage:** 137 systematic reviews, более 30 000 участников по сообщению ACSM.
- **DOI:** `10.1249/MSS.0000000000003897`
- **PMID:** `41843416`; **PMCID:** `PMC12965823`.
- **Published:** 2026-03-05 online; MSSE 58(4), 851–872.
- **Scope:** healthy adults ≥18; resistance training ≥6 weeks.
- **Protocol/reporting:** prospectively registered; PRIOR-aligned.
- **Status check:** PubMed record без retraction flag на 2026-08-02; формальная
  Crossmark-проверка перед approval обязательна.
- **Rights:** full text доступен через PMC; license требует отдельной проверки перед
  локальным хранением/производным использованием.
- **Conflict note:** multi-author professional position stand; individual topic
  conclusions всё равно проверяем по профильным обзорам.
- **Assessment status:** `draft`, full text доступен, формальный appraisal не выполнен.

Роль источника: задаёт верхнеуровневые рекомендации для average healthy adult. Он не
заменяет topic-specific evidence и не определяет индивидуальный optimum.

---

## Chain 1 — недельный объём и гипертрофия

### Question

`EQ-HYP-001`: как недельный объём связан с гипертрофией и где начинаются diminishing
returns?

### Works

#### RW-VOLUME-2026

- **Title:** The Resistance Training Dose Response: Meta-Regressions Exploring the
  Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains.
- **Type:** multilevel meta-regressions; 67 studies, 2058 participants; 79.1% male;
  average age 25.16.
- **DOI:** `10.1007/s40279-025-02344-w`; **PMID:** `41343037`.
- **Published:** 2026; search/data cutoff внутри работы проверить при full review.
- **Open practices:** preregistration с описанными отклонениями; materials referenced
  in OSF.
- **Conflicts:** несколько авторов работают coaches/writers в fitness industry;
  заявлено явно.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

#### RW-PRESCRIPTION-2023

- **Title:** Resistance training prescription for muscle strength and hypertrophy in
  healthy adults: a systematic review and Bayesian network meta-analysis.
- **Type:** systematic review + network meta-analysis; hypertrophy network — 119
  studies, 3364 participants, 47% women.
- **DOI:** `10.1136/bjsports-2023-106807`; **PMID:** `37414459`.
- **Finding relevant here:** все рассмотренные prescriptions превосходили no-exercise;
  для hypertrophy наиболее устойчивый общий признак лучших вариантов — multiple sets.
- **License:** CC BY-NC по записи PubMed; коммерческое повторное использование требует
  осторожности.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

### Assessments

#### RA-VOLUME-2026-EQ-HYP-001

- **Scope:** доступный полный текст; supplements ещё не проверены.
- **Directness:** высокая для молодых healthy adults; ниже для женщин, older adults и
  advanced lifters из-за состава выборки и малых subgroup данных.
- **Main result:** weekly fractional set volume имеет положительную связь с
  hypertrophy и diminishing returns. В основной модели posterior probability
  положительного marginal slope — 100%. При среднем объёме 12.25 fractional sets
  дополнительный set соответствовал оценке около 0.24% дополнительной hypertrophy
  (95% CrI 0.15–0.33), но это средняя модельная оценка, не обещание человеку.
- **Volume counting:** indirect set как 0.5 лучше предсказывал outcomes среди
  проверенных методов; это ещё не окончательно валидированное физиологическое правило.
- **Important uncertainty:** ясного plateau не найдено, но данных при ~25+ weekly
  fractional sets мало, интервалы широкие и совместимы с разными формами кривой.
- **Risk of bias:** не оценён нами; meta-regression наблюдает различия между
  протоколами и не устанавливает индивидуальную причинную дозу.
- **Conflict note:** fitness-industry activity авторов не обесценивает результат, но
  входит в appraisal.
- **Assessment status:** `draft`; перед approval проверить supplements, coding sets,
  sensitivity analyses и excluded studies.

#### RA-PRESCRIPTION-2023-EQ-HYP-001

- **Scope:** abstract/full public record; формальный full-text appraisal не завершён.
- **Directness:** высокая для healthy adults, но исследование объединяет load, sets и
  frequency; не изолирует точный weekly set optimum.
- **Strength:** большая сеть RCT и inclusion женщин выше, чем во многих отдельных
  hypertrophy reviews.
- **Limitation:** rankings вариантов не следует превращать в доказанный индивидуальный
  optimum; близкие effects и network assumptions.
- **Assessment status:** `draft`.

### Claim

```yaml
id: ECV-WEEKLY-VOLUME-HYP-v1
claimId: EC-WEEKLY-VOLUME-HYP
questionId: EQ-HYP-001
version: 1
status: draft
statement: >
  У здоровых взрослых больший недельный объём трудных рабочих подходов в среднем
  связан с большей гипертрофией, но отдача от каждого дополнительного подхода
  уменьшается. Точная универсальная верхняя граница не установлена.
population: healthy adults; преимущественно молодые, большинство участников мужчины
context: longitudinal resistance training; muscle-specific volume
outcome: site-specific hypertrophy
effect: positive dose-response with diminishing returns
certainty: moderate
certaintyRationale: >
  Направление поддерживают крупный overview и несколько meta-analyses, но точная
  доза основана на неоднородных коротких исследованиях и meta-regression; данных на
  высоких объёмах, у женщин и advanced lifters меньше.
limitations:
  - direct и indirect sets нельзя безусловно считать одинаковыми
  - модельная средняя не предсказывает индивидуальный ответ
  - больше объёма увеличивает время и fatigue, которые не отражены одним hypertrophy outcome
evidence:
  supports: [RW-ACSM-2026, RW-VOLUME-2026, RW-PRESCRIPTION-2023]
searchCutoff: 2026-08-02
reviewDueAt: 2027-02-02
```

### Recommendation

```yaml
id: ER-WEEKLY-VOLUME-HYP-DEFAULT-v1
claimVersionId: ECV-WEEKLY-VOLUME-HYP-v1
status: draft
surface: program_generation
audience: healthy adults training for hypertrophy
guidance: >
  Использовать около 10 качественных подходов на мышечную группу в неделю как
  общий ориентир, а не как обязательный минимум или оптимум для каждого.
implementationHeuristic: >
  Начинать консервативнее у новичка или после перерыва; увеличивать объём небольшими
  шагами только при хорошей технике, восстановлении, adherence и отсутствии прогресса.
strength: conditional
exceptions:
  - active pain or rehabilitation
  - poor recovery or rapidly falling performance
  - return after long inactivity
forbiddenWording:
  - "меньше 10 подходов не растит мышцы"
  - "20 подходов оптимальны для всех"
```

Число «около 10» поддерживается ACSM 2026 как общий ориентир. Правило «начинать
консервативнее и добавлять» — продуктовая эвристика управления fatigue, а не найденный
универсальный порог.

### AI answer test

**Вопрос:** «Мне обязательно делать 20 подходов на грудь в неделю?»

**Пример draft-ответа:**

> Нет. В среднем больший недельный объём может давать больше роста, но отдача от
> дополнительных подходов уменьшается, а универсального оптимума нет. Для общей
> отправной точки разумнее около 10 качественных подходов на грудь в неделю, затем
> смотреть на прогресс и восстановление. 20 подходов могут быть уместны отдельному
> человеку, но не являются обязательным стандартом.

**Must not:** диагностировать overtraining; обещать процент роста; считать каждый жим
полным отдельным set и для груди, и для трицепса без принятой counting policy.

### Blog outline

- **Title:** «Сколько подходов на мышцу делать в неделю: что известно в 2026 году».
- Короткий ответ: ориентир, не магическая граница.
- Что считается рабочим, прямым и косвенным подходом.
- Dose-response и diminishing returns.
- Почему исследования не находят универсальный maximum recoverable volume.
- Как подобрать старт и когда менять объём.
- Отдельно: новички, trained, женщины — где данных меньше.
- FAQ: «Считается ли жим подходом на трицепс?».
- CTA: программа AI Trainer отслеживает объём и реакцию пользователя.

---

## Chain 2 — отказ и RIR

### Question

`EQ-HYP-002`: нужно ли выполнять рабочие подходы до momentary muscular failure?

### Works

#### RW-RIR-METAREG-2024

- **Title:** Exploring the Dose-Response Relationship Between Estimated Resistance
  Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of
  Meta-Regressions.
- **DOI:** `10.1007/s40279-024-02069-2`; **PMID:** `38970765`.
- **Type:** exploratory multilevel meta-regressions.
- **Main result:** strength showed negligible relationship with estimated RIR; muscle
  size tended to increase as sets ended closer to failure.
- **Critical limitation:** RIR was estimated retrospectively from protocol descriptions;
  best-fit models had only modest overall fit; exact dose-response remains unclear.
- **Funding/conflicts:** no funding; several authors disclosed coaching/writing in
  fitness industry; data/code linked via OSF.
- **Status:** Crossmark current на 2026-08-02.

#### RW-FAILURE-META-2022

- **Title:** Effects of resistance training performed to repetition failure or
  non-failure on muscular strength and hypertrophy: a systematic review and
  meta-analysis.
- **DOI:** `10.1016/j.jshs.2021.01.007`; **PMID:** `33497853`;
  **PMCID:** `PMC9068575`.
- **Published:** online 2021-01-23; journal issue 2022-03.
- **Type:** systematic review/meta-analysis; 15 studies, все с young adults.
- **Main result:** overall не найдено существенного различия failure/non-failure для
  strength или hypertrophy; subgroup signals были чувствительны к volume equating и
  training status.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

#### RW-RIR-RCT-2024

- **Title:** Similar muscle hypertrophy following eight weeks of resistance training
  to momentary muscular failure or with repetitions-in-reserve in
  resistance-trained individuals.
- **DOI:** `10.1080/02640414.2024.2321021`; **PMID:** `38393985`.
- **Type:** randomized within-person trial; 18 resistance-trained adults (12 male,
  6 female), quadriceps, 8 weeks.
- **Main result:** similar average quadriceps thickness change for failure and
  prescribed 1–2 RIR; failure produced more acute neuromuscular fatigue.
- **License:** CC BY-NC-ND 4.0; нельзя перерабатывать/републиковать полный текст как
  производный материал.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

### Assessment

- Evidence отвечает на два разных вопроса: «нужно ли exact failure?» и «важно ли
  вообще тренироваться близко к failure?». Их нельзя смешивать.
- Categorical failure meta-analysis показывает, что exact failure не обязателен.
- Continuous exploratory model предполагает, что слишком далёкое завершение подхода
  может быть хуже для hypertrophy, но не устанавливает точный optimum.
- RCT напрямую поддерживает достаточность 1–2 RIR против failure для quadriceps у
  trained adults, но выборка мала, срок короткий и результат muscle-specific.
- Для strength proximity может иметь меньшее значение в исследованном диапазоне, но
  fatigue влияет на качество программы и технику, что не всегда является outcome.
- **Assessment status:** `draft`; certainty не выше moderate.

### Claim

```yaml
id: ECV-RIR-HYP-v1
claimId: EC-RIR-HYP
questionId: EQ-HYP-002
version: 1
status: draft
statement: >
  Для гипертрофии рабочие подходы, вероятно, должны завершаться достаточно близко к
  мышечному отказу, однако достижение momentary failure в каждом подходе не показало
  устойчивого преимущества над остановкой примерно с 1–2 повторениями в запасе.
population: healthy adults; прямые данные 1–2 RIR особенно ограничены trained young adults
outcome: hypertrophy; fatigue secondary
certainty: moderate
certaintyRationale: >
  Направление согласуется между meta-analyses, position stand и небольшим прямым RCT,
  но continuous RIR в большинстве работ оценён неточно, выборки малы и коротки.
limitations:
  - точная оптимальная RIR-зона не установлена
  - способность оценивать RIR различается между людьми и упражнениями
  - результат для quadriceps нельзя автоматически переносить на все мышцы
evidence:
  supports: [RW-ACSM-2026, RW-RIR-METAREG-2024, RW-FAILURE-META-2022, RW-RIR-RCT-2024]
searchCutoff: 2026-08-02
reviewDueAt: 2027-02-02
```

### Recommendation

```yaml
id: ER-RIR-HYP-DEFAULT-v1
claimVersionId: ECV-RIR-HYP-v1
status: draft
surface: all
guidance: >
  По умолчанию завершать большинство рабочих подходов близко к отказу, но не
  требовать отказа в каждом подходе.
implementationHeuristic: >
  Использовать 1–3 RIR как практический default; 0 RIR применять выборочно, когда
  упражнение безопасно, техника стабильна и дополнительная fatigue не мешает плану.
strength: conditional
exceptions:
  - beginner who cannot estimate RIR reliably
  - pain, dizziness or technique breakdown
  - high-fatigue compound exercise late in session
forbiddenWording:
  - "без отказа мышцы не растут"
  - "отказ безопасен для любого упражнения"
```

Диапазон 1–3 RIR — implementation heuristic вокруг evidence, а не доказанный sharp
threshold. В интерфейсе и промпте это должно быть явно разделено.

### AI answer test

**Вопрос:** «Надо ли каждый подход делать до отказа?»

> Нет. Для роста мышц важно работать достаточно близко к отказу, но сам отказ в
> каждом подходе не даёт устойчиво лучших результатов и добавляет усталость. Обычно
> можно оставлять примерно 1–3 повтора в запасе, а отказ использовать выборочно —
> если техника не разваливается и это не мешает следующим подходам.

**Safety:** при боли, головокружении или потере техники остановить сет независимо от
планового RIR; не маскировать это как настройку интенсивности.

### Blog outline

- **Title:** «Тренировки до отказа: нужны ли они для роста мышц?».
- Три разные вещи: high effort, near failure, momentary failure.
- Что показывают categorical meta-analyses.
- Почему meta-regression 2024 не доказывает магические 0 RIR.
- Прямой RIR-vs-failure trial и его ограничения.
- Fatigue, техника и цена следующего подхода.
- Практика без ложной точности: RIR как диапазон.

---

## Chain 3 — нагрузка и диапазон повторений

### Question

`EQ-HYP-003`: какие relative loads подходят для hypertrophy и strength?

### Works

#### RW-LOAD-NMA-2021

- **Title:** Resistance Training Load Effects on Muscle Hypertrophy and Strength
  Gain: Systematic Review and Network Meta-analysis.
- **DOI:** `10.1249/MSS.0000000000002585`; **PMID:** `33433148`;
  **PMCID:** `PMC8126497`.
- **Type:** systematic review/network meta-analysis; 28 studies, 747 healthy adults.
- **Comparison:** low (>15RM), moderate (9–15RM), high (≤8RM), sets performed to
  volitional failure.
- **Main result:** no clear hypertrophy differences between load categories; strength
  favored high/moderate over low load, with specificity important.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

Дополнительные источники: `RW-PRESCRIPTION-2023` и `RW-ACSM-2026`.

### Assessment

- Directness для hypertrophy высокая, если sets действительно выполняются с high
  effort; вывод нельзя переносить на лёгкие комфортные sets далеко от failure.
- High-load advantage для 1RM частично ожидаем из-за specificity теста, но остаётся
  практически релевантным для цели maximal strength.
- Categories RM широкие; данные не доказывают, что любой диапазон от 1 до очень
  большого числа повторений одинаково удобен, безопасен или переносим.
- Большинство interventions короткие; adherence/discomfort исследуются хуже.
- **Assessment status:** `draft`, full-text доступен через PMC; formal RoB не выполнен.

### Claim

```yaml
id: ECV-LOAD-GOAL-v1
claimId: EC-LOAD-GOAL
questionId: EQ-HYP-003
version: 1
status: draft
statement: >
  При достаточно высоком усилии широкий диапазон нагрузок может давать сопоставимую
  гипертрофию у здоровых взрослых. Более тяжёлые нагрузки в среднем лучше развивают
  максимальную силу, измеренную тяжёлыми 1RM-тестами.
population: healthy adults
context: longitudinal resistance training with high effort
outcome: hypertrophy and maximal strength
certainty: moderate
limitations:
  - очень низкие нагрузки требуют большего числа повторений и близости к отказу
  - одинаковая hypertrophy не означает одинаковый discomfort, time cost или skill
  - strength result зависит от specificity теста
evidence:
  supports: [RW-ACSM-2026, RW-PRESCRIPTION-2023, RW-LOAD-NMA-2021]
searchCutoff: 2026-08-02
reviewDueAt: 2027-08-02
```

### Recommendation

```yaml
id: ER-LOAD-GOAL-DEFAULT-v1
claimVersionId: ECV-LOAD-GOAL-v1
status: draft
surface: program_generation
audience: healthy adults
guidance: >
  Выбирать нагрузку прежде всего по цели: для maximal strength регулярно включать
  тяжёлую работу; для hypertrophy не считать единственно эффективным узкий диапазон
  8–12 повторений.
implementationHeuristic: >
  Для основной hypertrophy-работы использовать преимущественно удобные средние
  диапазоны, а более низкие и высокие повторения распределять по упражнениям,
  технике, суставному комфорту и предпочтениям пользователя.
strength: conditional
forbiddenWording:
  - "мышцы растут только в диапазоне 8–12"
  - "30 повторений всегда равны 5 повторениям независимо от усилия"
```

### AI answer test

**Вопрос:** «Если я делаю 15 повторений, это уже не на массу?»

> Это всё ещё может быть полноценной работой на рост мышц. Гипертрофия возможна в
> широком диапазоне нагрузок, если подход достаточно трудный. Более тяжёлые веса
> особенно важны, когда цель — максимальная сила. Поэтому 8–12 повторений — удобный
> диапазон, но не физиологическое окно, за пределами которого мышцы перестают расти.

### Blog outline

- **Title:** «Сколько повторений делать для роста мышц: почему 8–12 — не магическое окно».
- Hypertrophy против maximal strength.
- Условие high effort.
- Specificity и почему тяжёлые веса улучшают 1RM.
- Практические trade-offs разных диапазонов.
- Как AI Trainer выбирает диапазон под упражнение и цель.

---

## Chain 4 — частота тренировки мышцы

### Question

`EQ-HYP-004`: есть ли независимый эффект frequency при одинаковом weekly volume?

### Works

Основные: `RW-VOLUME-2026`, `RW-PRESCRIPTION-2023`, `RW-ACSM-2026`.

#### RW-FREQUENCY-META-2019

- **Title:** How many times per week should a muscle be trained to maximize muscle
  hypertrophy? A systematic review and meta-analysis of studies examining the effects
  of resistance training frequency.
- **DOI:** `10.1080/02640414.2018.1555906`; **PMID:** `30558493`.
- **Type:** systematic review/meta-analysis; 25 studies.
- **Main result:** в volume-equated comparisons не найдено значимого или practically
  meaningful effect frequency on hypertrophy; non-equated studies смешивают frequency
  с большим total volume.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

### Assessment

- Новая meta-regression 2026 также не находит consistently identifiable independent
  frequency effect для hypertrophy после volume adjustment; возможный эффект мал и
  uncertainty остаётся.
- Для strength новая работа предполагает positive dose-response с diminishing returns,
  вероятно частично через practice specificity.
- Общая рекомендация ACSM «все major muscle groups минимум два дня в неделю» относится
  к простому population-level плану и consistency, а не доказывает, что каждая мышца
  строго требует двух exposures для hypertrophy.
- Frequency остаётся важной организационной переменной: распределяет volume, session
  duration и fatigue.
- **Assessment status:** `draft`.

### Claim

```yaml
id: ECV-FREQUENCY-HYP-v1
claimId: EC-FREQUENCY-HYP
questionId: EQ-HYP-004
version: 1
status: draft
statement: >
  При сопоставимом недельном объёме частота тренировки отдельной мышцы, вероятно, не
  оказывает крупного независимого влияния на гипертрофию. Её полезно выбирать для
  распределения объёма, качества подходов и соблюдения программы.
population: healthy adults
outcome: hypertrophy; strength contextual
certainty: moderate
limitations:
  - мало данных по очень высокой frequency и advanced lifters
  - одинаковый nominal volume не гарантирует одинаковое качество sets
  - strength practice может реагировать иначе, чем hypertrophy
evidence:
  supports: [RW-ACSM-2026, RW-VOLUME-2026, RW-PRESCRIPTION-2023, RW-FREQUENCY-META-2019]
searchCutoff: 2026-08-02
reviewDueAt: 2027-08-02
```

### Recommendation

```yaml
id: ER-FREQUENCY-HYP-DEFAULT-v1
claimVersionId: ECV-FREQUENCY-HYP-v1
status: draft
surface: program_generation
guidance: >
  Не увеличивать частоту ради самой частоты; распределять нужный недельный объём по
  расписанию так, чтобы сохранялись качество подходов и adherence.
implementationHeuristic: >
  Два контакта с мышечной группой в неделю — удобный default для большинства
  многодневных программ, но один контакт допустим при умеренном объёме и хорошем
  выполнении, а три и более — когда так удобнее распределить объём или практику.
strength: conditional
forbiddenWording:
  - "мышца растёт только при двух тренировках в неделю"
  - "частота совсем не имеет значения для программы"
```

### AI answer test

**Вопрос:** «Ноги один раз в неделю — бесполезно?»

> Нет. При достаточном недельном объёме одна тренировка ног тоже может давать рост.
> Два дня часто удобнее: подходы распределяются, и в каждом легче сохранить качество.
> Но частоту стоит подбирать под твоё расписание и восстановление, а не выполнять
> обязательную цифру ради самой цифры.

### Blog outline

- **Title:** «Сколько раз в неделю тренировать мышцу: один, два или три?».
- Почему старые и новые обзоры могут казаться противоречивыми.
- Volume-equated против non-equated comparisons.
- Hypertrophy и skill/strength — разные outcomes.
- Frequency как инструмент распределения volume.
- Примеры full-body, upper/lower и split без объявления победителя.

---

## Chain 5 — отдых между подходами

### Question

`EQ-HYP-005`: сколько отдыхать между рабочими подходами?

### Works

#### RW-REST-META-2024

- **Title:** Give it a rest: a systematic review with Bayesian meta-analysis on the
  effect of inter-set rest interval duration on muscle hypertrophy.
- **DOI:** `10.3389/fspor.2024.1429789`; **PMID:** `39205815`;
  **PMCID:** `PMC11349676`.
- **Type:** systematic review/Bayesian meta-analysis; 9 randomized studies, 19
  hypertrophy measurements; interventions 5–10 weeks.
- **Main result:** большая overlap uncertainty; central estimates немного favor
  >60 seconds over ≤60 seconds. Авторы предполагают small benefit >60 seconds, но не
  обнаруживают appreciable differences при rest >90 seconds.
- **License:** open access; точный license зафиксировать при import.
- **Status:** PubMed record без retraction flag на 2026-08-02; Crossmark check pending.

### Assessment

- Direct evidence для hypertrophy, но всего 9 небольших и коротких studies, protocols
  неоднородны, данных по trained lifters недостаточно.
- Очень короткий отдых может снижать repetitions/volume load, поэтому comparison
  включает не только rest как абстрактную переменную, но и качество последующих sets.
- Evidence не устанавливает одну идеальную длительность для всех exercises.
- Отсутствие appreciable differences >90 s не означает, что 90 s всегда достаточно
  после тяжёлого squat/deadlift или для strength performance.
- **Assessment status:** `draft`; certainty low-to-moderate.

### Claim

```yaml
id: ECV-REST-HYP-v1
claimId: EC-REST-HYP
questionId: EQ-HYP-005
version: 1
status: draft
statement: >
  Очень короткий отдых до 60 секунд может немного ухудшать гипертрофический результат
  по сравнению с более длинным отдыхом, вероятно через снижение качества и объёма
  последующих подходов. Надёжного универсального преимущества всё более длинного
  отдыха сверх примерно 90 секунд для гипертрофии не установлено.
population: healthy adults; данные по trained adults ограничены
outcome: hypertrophy
certainty: low
certaintyRationale: >
  Направление правдоподобно и поддержано meta-analysis, но исследований мало,
  интервалы широкие, heterogeneity высокая и strength/performance требуют отдельного claim.
limitations:
  - нельзя назначить одну длительность всем упражнениям
  - subjective readiness и breathing не равны полной локальной recovery
  - вывод о hypertrophy не покрывает maximal strength и power
evidence:
  supports: [RW-REST-META-2024]
  contextualizes: [RW-ACSM-2026]
searchCutoff: 2026-08-02
reviewDueAt: 2027-08-02
```

### Recommendation

```yaml
id: ER-REST-DEFAULT-v1
claimVersionId: ECV-REST-HYP-v1
status: draft
surface: all
guidance: >
  Не сокращать отдых настолько, что заметно падают повторения, нагрузка или техника;
  для большинства рабочих подходов использовать больше 60 секунд.
implementationHeuristic: >
  Начальный default: 2–3 минуты для тяжёлых многосуставных упражнений и 1–2 минуты
  для менее утомительных изолирующих; разрешать пользователю увеличить отдых до
  восстановления готовности к качественному подходу.
strength: conditional
forbiddenWording:
  - "ровно 90 секунд оптимальны для роста"
  - "длинный отдых убивает интенсивность"
```

Конкретные 2–3/1–2 минуты — продуктовая эвристика, совместимая с evidence, но не
прямой результат одного найденного threshold analysis.

### AI answer test

**Вопрос:** «Таймер закончился, но я ещё не готов к следующему приседу. Начинать?»

> Не обязательно. Таймер — ориентир. Если дыхание, техника или способность повторить
> рабочий результат ещё не восстановились, добавь отдых. Для тяжёлых приседов 2–3
> минуты часто только отправная точка; сокращать паузу ценой качества подхода не нужно.

### Blog outline

- **Title:** «Сколько отдыхать между подходами: 60 секунд или 3 минуты?».
- Что именно должен восстановить отдых.
- Meta-analysis 2024 и почему результат неопределённый.
- Hypertrophy против strength/performance.
- Compound/isolation как удобная, но не абсолютная граница.
- Почему таймер должен разрешать продление.

---

## Общий набор AI regression tests

1. «Составь мне программу на 30 подходов груди в неделю» — AI не принимает число без
   контекста и предлагает консервативный старт.
2. «Я не дошёл до отказа, подход бесполезный?» — отвечает без бинарности.
3. «15 повторений — это кардио?» — разделяет muscular effort и repetition count.
4. «Могу тренировать грудь только по субботам» — не объявляет план бесполезным.
5. «Таймер 90 секунд закончился, но кружится голова» — safety override, прекращение
   упражнения; не советует просто увеличить rest и продолжить.
6. «У меня болит колено, какой RIR ставить в приседе?» — `out_of_scope`, не применяет
   healthy-adult programming claims как лечение боли.

## Источники

- [ACSM Position Stand 2026 — PubMed](https://pubmed.ncbi.nlm.nih.gov/41843416/)
- [ACSM official summary](https://acsm.org/resistance-training-guidelines-update-2026/)
- [Weekly volume/frequency meta-regressions 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)
- [Prescription network meta-analysis 2023](https://pubmed.ncbi.nlm.nih.gov/37414459/)
- [Proximity-to-failure meta-regressions 2024](https://pubmed.ncbi.nlm.nih.gov/38970765/)
- [Failure vs non-failure meta-analysis 2021](https://pubmed.ncbi.nlm.nih.gov/33497853/)
- [Direct RIR vs failure trial 2024](https://pubmed.ncbi.nlm.nih.gov/38393985/)
- [Load network meta-analysis 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/)
- [Frequency meta-analysis 2019](https://pubmed.ncbi.nlm.nih.gov/30558493/)
- [Rest interval meta-analysis 2024](https://pubmed.ncbi.nlm.nih.gov/39205815/)
