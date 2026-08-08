# EQ-HYP-006 — пакет обновления evidence по амплитуде

**Статус:** draft для scientific review  
**Discovery run:** 2026-08-08
**Full-text availability pass:** 2026-08-08
**Предыдущий synthesis cutoff:** апрель 2022  
**Новый временной диапазон:** 2022-05-01 — 2026-08-08

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

PubMed primary query:

```text
(("range of motion"[Title/Abstract]
  OR "lengthened partial"[Title/Abstract]
  OR "long muscle length"[Title/Abstract])
 AND ("resistance training"[Title/Abstract]
  OR "resistance exercise"[Title/Abstract])
 AND (hypertrophy[Title/Abstract]
  OR "muscle thickness"[Title/Abstract]
  OR "cross-sectional area"[Title/Abstract]))
AND ("2022/05/01"[Date - Publication] : "2026/08/08"[Date - Publication])
```

Чувствительность primary query оказалась недостаточной: он пропускал статьи, где
авторы писали `calf training` или `resistance-trained`, но не точную фразу
`resistance training`. Поэтому добавлен второй целевой запрос:

```text
(("partial range of motion"[Title/Abstract]
  OR "long muscle length"[Title/Abstract]
  OR "longer muscle length"[Title/Abstract])
 AND (hypertrophy[Title/Abstract]
  OR "muscle thickness"[Title/Abstract]))
AND ("2022/05/01"[Date - Publication] : "2026/08/08"[Date - Publication])
```

Два запроса дали 53 raw hits и 45 уникальных записей после удаления 8 пересечений.
После title/abstract screening оставлены 10 прямых исследований и 10 контекстных
работ; 25 записей исключены. Полный список с причиной по каждой записи находится в
[ROM_SEARCH_LEDGER.md](ROM_SEARCH_LEDGER.md).

Дополнительно: backward/forward citation chasing от Kassiano 2023, проверка новых
systematic reviews и DOI/PMID каждого включённого кандидата.

Текущий проход — воспроизводимый single-reviewer search, но ещё не systematic review:
независимый повторный screening и дедупликация primary studies между reviews должны
быть завершены до approval.

## 3. Новые публикации после cutoff

| Work | Популяция и протокол | Мышца / измерение | Сравнение | Что добавляет | Scope review |
|---|---|---|---|---|---|
| [Kassiano 2023](https://pubmed.ncbi.nlm.nih.gov/37015016/) | 42 молодые женщины, 8 недель, leg-press calf raise | medial/lateral gastrocnemius, ultrasound thickness | full vs lengthened vs shortened partial | Прямой muscle-head-specific сигнал в пользу lengthened partial для medial gastrocnemius; lateral vs full неопределён | abstract only |
| [Wolf 2025](https://pubmed.ncbi.nlm.nih.gov/39959841/) | 25 из 30 тренированных взрослых завершили within-participant программу, 8 недель | aggregate elbow flexors/extensors, 45% и 55% humeral length | full vs lengthened partial | В целом сходная гипертрофия и 10RM strength-endurance | published full text |
| [Havers 2025](https://pubmed.ncbi.nlm.nih.gov/41247250/) | 13 тренированных, within-subject, 8 недель, preacher curl | aggregate elbow flexors, 50% и 70% | full vs initial/lengthened partial | Сходный mid-site; небольшой неопределённый distal-site сигнал partial; небольшие strength-сигналы в пользу full | published full text |
| [Gschneidner 2025](https://pubmed.ncbi.nlm.nih.gov/41055237/) | 297 участников, 15 площадок, 12 недель | anthropometric estimated arm/thigh CSA | full vs lengthened partial | Не установил ясного общего преимущества; строгий тест equivalence не пройден | published abstract + full preprint |
| [Varovic 2025](https://pubmed.ncbi.nlm.nih.gov/40911904/) | тренированные, within-subject knee extension | regional quadriceps thickness | long-length isometric vs full-ROM isotonic | Контекст по длине мышцы; не прямое сравнение partial ROM | abstract only |
| [Wolf 2025 review](https://pubmed.ncbi.nlm.nih.gov/41646176/) | 8 исследований, n=120 | muscle size + fascicle length | longer vs shorter muscle length | Longer-length выглядит лучше shorter-length, но structural interpretation смешанная; ни одно исследование не имело good-quality rating | published full text |
| [Varovic 2025 meta-analysis](https://pubmed.ncbi.nlm.nih.gov/40570881/) | 12 исследований молодых взрослых | proximal/mid/distal regional hypertrophy | longer vs shorter mean muscle length | Опубликованные оценки малы: SMD 0.05 proximal, 0.07 mid, 0.09 distal; это не доказательство LP > full | published abstract + full preprint |
| [McMahon 2026](https://pubmed.ncbi.nlm.nih.gov/42392615/) | 45 участников, 8 недель, knee extension | vastus lateralis at 25/50/75% femur length | full 80% 1RM vs lengthened partial 55% vs shortened partial 80% | LP и full сходны во всех точках; обе лучше shortened partial в отдельных точках | abstract only |
| [Plotkin 2026 preprint](https://doi.org/10.64898/2026.06.04.730150) | 16 тренированных мужчин, within-subject, 8 недель, leg press/extension/curl | vastus lateralis MRI across 5 slices; secondary thigh/hip muscles | full vs lengthened partial | VL сходно; secondary semitendinosus signal в пользу LP требует репликации | full preprint, not peer reviewed |

Поиск также вернул пять прямых trials, которых не было в первой короткой карте:
Pedrosa knee extension 2022, initial-versus-final arm curl 2023, deeper leg press
2025, calf initial-versus-past-failure partials 2025 и volume-matched calf partials
beyond failure 2026. Они добавлены как `abstract_only` и пока только расширяют карту,
не повышая certainty claims.

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
full ROM и lengthened partial. Измерения агрегировали сгибатели или разгибатели локтя и
не позволяют присвоить эффект отдельно бицепсу, brachialis или конкретной головке
трицепса. Небольшой distal-site сигнал в маленьком preacher-curl trial не подтверждает
преимущество для всей мышечной группы или всех упражнений на руки.

### Vastus lateralis

Новый knee-extension trial поддерживает сходную гипертрофию full ROM и lengthened
partial во всех измеренных точках. Shortened partial уступала одной или другой
long-length стратегии в отдельных точках. Различия в нагрузке между условиями мешают
изолировать чистый эффект ROM. Новый препринт с MRI пяти срезов у тренированных мужчин
также не обнаружил ясной разницы для vastus lateralis, но пока используется только как
контекст.

## 5. Draft claims для review

1. `ECV-ROM-LENGTHENED-PARTIAL-v1` — общий synthesis: long-length против
   shortened-position partial; не использовать как LP > full.
2. `ECV-ROM-CALF-LENGTHENED-v1` — medial и lateral gastrocnemius отдельно.
3. `ECV-ROM-ARMS-LENGTHENED-v1` — elbow flexors/extensors и региональные измерения.
4. `ECV-ROM-QUAD-LENGTHENED-v1` — vastus lateralis в knee extension.
5. `ECV-ROM-FULL-DEFAULT-v1` — product-safe default, отдельно от claims о
   конкретных мышцах.

## 6. Что блокирует scientific approval

- независимый повторный screening 45 PubMed records и сверка причин исключения;
- дедупликация первичных исследований между четырьмя reviews;
- опубликованный full text для Kassiano calf 2023, Varovic 2025 и McMahon 2026;
- сверка version of record с полными препринтами Gschneidner и Varovic meta-analysis;
- supplement/OSF extraction для полнотекстовых works;
- RoB 2 для прямых trials и оценка методов reviews;
- проверка correction/retraction status;
- точные exercise ROM, load matching, volume и proximity-to-failure;
- проверка, какие анатомические структуры включались в агрегаты elbow flexors,
  elbow extensors, anterior thigh и arm/thigh CSA;
- независимый scientific reviewer и новая версия claim при существенной правке.

До закрытия этих пунктов все новые assessments и claims остаются `draft` и не
попадают в runtime.

## 7. Full-text audit 2026-08-08

| Work | Проверенный материал | Предварительный risk of bias | Главные замечания |
|---|---|---|---|
| Wolf upper-body 2025 | published full text | some concerns | preregistered, randomized, blinded outcome assessor; 5/30 withdrawals, ROM не измерялся точно, разные failure endpoints, cross-education |
| Havers 2025 | published full text | some concerns | external randomization и blinded ultrasound; n=13, partial condition имела больший volume load, aggregate elbow-flexor measure |
| Wolf longitudinal review 2025 | published full text | some concerns | preregistered dual review; 8 studies, narrative synthesis, search только до Feb 2024, 4 poor + 4 fair SMART-LD |
| Gschneidner 2025 | final abstract + corresponding full preprint | some concerns | large preregistered trial, но anthropometric proxy вместо imaging, missing observations, equivalence criterion не пройден, industry relationships |
| Varovic regional meta-analysis 2025 | final abstract + corresponding full preprint | some concerns | dual review и open code; imprecise preregistration with deviations, 6 poor + 6 fair studies, ROM pooled with exercise selection |
| Plotkin 2026 | full preprint | some concerns | randomized supervised MRI study, но n=16, men only, no a priori sample-size calculation, secondary hamstring results, no peer review |
| Kassiano calf 2023 | published abstract | not assessed | full text unavailable |
| Varovic quadriceps 2025 | published abstract | not assessed | full text unavailable; isometric vs isotonic comparison changes more than ROM |
| McMahon 2026 | published abstract | not assessed | full text unavailable; unequal loads between ROM conditions |

`preprint_full_text` — отдельный технический статус. Он разрешает извлечь методы и
увидеть ограничения, но не проходит assessment approval, пока не проверен опубликованный
version of record.

## 8. Решение после полнотекстового прохода

- certainty существующих ROM claims не повышаем;
- отдельный hamstring claim по препринту не создаём;
- arm claim говорит только об агрегированных elbow-flexor/elbow-extensor measurements;
- Plotkin 2026 добавляется как contextual evidence к vastus lateralis, не как primary support;
- published correction/retraction links проверены 2026-08-08 для 18 PubMed works;
  Pallarés 2021, обзор «Which ROMs Lead to Rome?» и ACSM position stand остаются
  `unknown`, препринт Plotkin не индексируется в PubMed и проверяется отдельно;
- полный PubMed screening ledger теперь фиксирует 53 raw hits, 45 unique records,
  10 direct, 10 contextual и 25 excluded;
- OpenAlex, Europe PMC и Crossref не нашли легальную открытую версию трёх закрытых
  published full texts; publisher endpoints не обходились;
- ни один assessment не переводится в `approved` автоматически.
