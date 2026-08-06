# EQ-HYP-006 — пакет обновления evidence по амплитуде

**Статус:** draft для scientific review  
**Discovery run:** 2026-08-06  
**Предыдущий synthesis cutoff:** апрель 2022  
**Новый временной диапазон:** 2022-05-01 — 2026-08-06

## 1. Что именно проверяем

Основной вопрос: когда полная амплитуда, частичные повторения в растянутой части и
частичные повторения в сокращённой части движения различаются по гипертрофии и
специфичной силе?

Не объединяем в один результат:

- разные мышцы и головки мышцы;
- разные участки измерения одной мышцы;
- full ROM, lengthened partial, shortened partial и middle partial;
- динамическую partial ROM и изометрию на длинной длине мышцы;
- гипертрофию, fascicle length и специфичную силу;
- отдельное упражнение и перенос результата на другие упражнения.

Scope: здоровые взрослые; longitudinal resistance-training interventions не короче
4 недель. Реабилитация, лечение боли, острые эффекты и исследования без тренировочного
вмешательства не используются для продуктовой рекомендации.

## 2. Воспроизводимый update query

PubMed candidate query:

```text
(("range of motion"[Title/Abstract]
  OR "lengthened partial"[Title/Abstract]
  OR "long muscle length"[Title/Abstract])
 AND ("resistance training"[Title/Abstract]
  OR "resistance exercise"[Title/Abstract])
 AND (hypertrophy[Title/Abstract]
  OR "muscle thickness"[Title/Abstract]
  OR "cross-sectional area"[Title/Abstract]))
AND ("2022/05/01"[Date - Publication] : "2026/08/06"[Date - Publication])
```

Дополнительно: backward/forward citation chasing от Kassiano 2023, проверка новых
systematic reviews и DOI/PMID каждого включённого кандидата.

Текущий проход — расширенный discovery, но ещё не systematic review: полный PubMed
export, PRISMA counts, причины исключения и дедупликация primary studies должны быть
зафиксированы до approval.

## 3. Новые публикации после cutoff

| Work | Популяция и протокол | Мышца / измерение | Сравнение | Что добавляет | Scope review |
|---|---|---|---|---|---|
| [Kassiano 2023](https://pubmed.ncbi.nlm.nih.gov/37015016/) | 42 молодые женщины, 8 недель, leg-press calf raise | medial/lateral gastrocnemius, ultrasound thickness | full vs lengthened vs shortened partial | Прямой muscle-head-specific сигнал в пользу lengthened partial для medial gastrocnemius; lateral vs full неопределён | abstract only |
| [Wolf 2025](https://pubmed.ncbi.nlm.nih.gov/39959841/) | 30 тренированных взрослых, within-participant, 8 недель, upper-body program | elbow flexors/extensors, 45% и 55% humeral length | full vs lengthened partial | В целом сходная гипертрофия и 10RM strength-endurance | abstract only |
| [Havers 2025](https://pubmed.ncbi.nlm.nih.gov/41247250/) | 13 тренированных, within-subject, 8 недель, preacher curl | elbow flexors, 50% и 70% | full vs initial/lengthened partial | Сходный mid-site; trivial-to-small преимущество partial в distal site; небольшие strength-сигналы в пользу full | abstract only |
| [Gschneidner 2025](https://pubmed.ncbi.nlm.nih.gov/41055237/) | 297 участников, 15 площадок, 12 недель | estimated arm/thigh CSA | full vs lengthened partial | Не установил ясного общего преимущества; строгий тест equivalence не пройден | abstract only |
| [Varovic 2025](https://pubmed.ncbi.nlm.nih.gov/40911904/) | тренированные, within-subject knee extension | regional quadriceps thickness | long-length isometric vs full-ROM isotonic | Контекст по длине мышцы; не прямое сравнение partial ROM | abstract only |
| [Wolf 2025 review](https://pubmed.ncbi.nlm.nih.gov/41646176/) | 8 исследований, n=120 | muscle size + fascicle length | longer vs shorter muscle length | Longer-length выглядит лучше shorter-length, но structural interpretation смешанная | abstract only |
| [Larsen 2025 meta-analysis](https://pubmed.ncbi.nlm.nih.gov/40570881/) | 12 исследований молодых взрослых | proximal/mid/distal regional hypertrophy | longer vs shorter mean muscle length | Различия по регионам малы; есть тренд к distal site, но не доказательство LP > full | abstract only |
| [McMahon 2026](https://pubmed.ncbi.nlm.nih.gov/42392615/) | 45 участников, 8 недель, knee extension | vastus lateralis at 25/50/75% femur length | full 80% 1RM vs lengthened partial 55% vs shortened partial 80% | LP и full сходны во всех точках; обе лучше shortened partial в отдельных точках | abstract only |

## 4. Что теперь можно утверждать

### Общий уровень

Работа там, где мышца длиннее, выглядит важнее противопоставления «полная против
частичной амплитуды». Full ROM и lengthened partial чаще выглядят лучше
shortened partial, но данные не показывают универсальное преимущество lengthened
partial над full ROM.

### Икроножные

Есть один прямой положительный trial для medial gastrocnemius у молодых женщин.
Результат lateral gastrocnemius нельзя формулировать так же: lengthened partial была
лучше shortened partial, но различие с full ROM осталось неопределённым.

### Сгибатели и разгибатели локтя

Два новых исследования тренированных взрослых в целом поддерживают сходный рост при
full ROM и lengthened partial. Небольшой distal-site эффект в маленьком preacher-curl
trial не позволяет утверждать преимущество для всего бицепса или всех упражнений на
руки.

### Vastus lateralis

Новый knee-extension trial поддерживает сходную гипертрофию full ROM и lengthened
partial во всех измеренных точках. Shortened partial уступала одной или другой
long-length стратегии в отдельных точках. Различия в нагрузке между условиями мешают
изолировать чистый эффект ROM.

## 5. Draft claims для review

1. `ECV-ROM-LENGTHENED-PARTIAL-v1` — общий synthesis: long-length против
   shortened-position partial; не использовать как LP > full.
2. `ECV-ROM-CALF-LENGTHENED-v1` — medial и lateral gastrocnemius отдельно.
3. `ECV-ROM-ARMS-LENGTHENED-v1` — elbow flexors/extensors и региональные измерения.
4. `ECV-ROM-QUAD-LENGTHENED-v1` — vastus lateralis в knee extension.
5. `ECV-ROM-FULL-DEFAULT-v1` — product-safe default, отдельно от claims о
   конкретных мышцах.

## 6. Что блокирует scientific approval

- полный воспроизводимый PubMed run с экспортом результатов и PRISMA counts;
- дедупликация первичных исследований между четырьмя reviews;
- full-text и supplement extraction для восьми новых works;
- RoB 2 для прямых trials и оценка методов reviews;
- проверка correction/retraction status;
- точные exercise ROM, load matching, volume и proximity-to-failure;
- проверка, какие анатомические структуры включались в агрегаты elbow flexors,
  elbow extensors, anterior thigh и arm/thigh CSA;
- независимый scientific reviewer и новая версия claim при существенной правке.

До закрытия этих пунктов все новые assessments и claims остаются `draft` и не
попадают в runtime.
