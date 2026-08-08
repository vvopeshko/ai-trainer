# EQ-HYP-006 — PubMed search and screening ledger

**Search date:** 2026-08-08  
**Update window:** 2022-05-01 — 2026-08-08  
**Question:** full, partial and muscle-length-biased resistance training for
hypertrophy and exercise-specific strength in healthy adults.

This ledger records every PubMed result, the deduplication step and the reason a
record was retained or excluded. It is a reproducible editorial search, not yet a
complete systematic review: citation-level deduplication across all older reviews
and independent dual screening are still pending.

## Search queries

### Query A — precise update

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

Result: **37 records**.

### Query B — sensitivity query

```text
(("partial range of motion"[Title/Abstract]
  OR "long muscle length"[Title/Abstract]
  OR "longer muscle length"[Title/Abstract])
 AND (hypertrophy[Title/Abstract]
  OR "muscle thickness"[Title/Abstract]))
AND ("2022/05/01"[Date - Publication] : "2026/08/08"[Date - Publication])
```

Result: **16 records**, of which **8 overlapped** Query A and **8 were new**.
Query B is necessary because relevant abstracts may say `calf training` or
`resistance-trained` without the exact phrases `resistance training` or
`resistance exercise`. It recovered Kassiano 2023 calf, Varovic 2025 and the 2023
arm-curl trial, among other records.

## Flow counts

| Stage | Count |
|---|---:|
| PubMed hits, Query A | 37 |
| PubMed hits, Query B | 16 |
| Raw PubMed hits | 53 |
| Duplicate records across queries | 8 |
| Unique PubMed records screened | 45 |
| Retained: direct longitudinal ROM comparisons | 10 |
| Retained: contextual reviews or indirect muscle-length comparisons | 10 |
| Excluded after title/abstract screening | 25 |

Two records are tracked outside the update-query count: Pallarés 2021 is the
pre-cutoff foundational meta-analysis, and Plotkin 2026 is a non-PubMed bioRxiv
preprint found by supplementary discovery.

## Decisions for all 45 unique PubMed records

`Direct` means the record can inform a specific ROM comparison after appraisal.
`Context` means it helps interpretation or citation chasing but cannot by itself
support a direct full-versus-partial claim. All retained records remain draft until
their required review scope is complete.

| PMID | Query | Short title | Decision | Reason |
|---|---|---|---|---|
| [41992745](https://pubmed.ncbi.nlm.nih.gov/41992745/) | A | EPA/MCT intake and muscle performance | Exclude | Nutrition comparator; ROM and thickness are post-exercise outcomes, not the training variable. |
| [42349518](https://pubmed.ncbi.nlm.nih.gov/42349518/) | A | NMES after ACL reconstruction | Exclude | Rehabilitation population and NMES comparator; no ROM manipulation. |
| [42392615](https://pubmed.ncbi.nlm.nih.gov/42392615/) | A+B | McMahon knee extension | Direct | Eight-week full, lengthened-partial and shortened-partial comparison with vastus-lateralis outcomes. |
| [42220023](https://pubmed.ncbi.nlm.nih.gov/42220023/) | A | Stretching or hamstring exercise | Exclude | Hamstring tightness and stretching comparison; no training-ROM contrast. |
| [42162434](https://pubmed.ncbi.nlm.nih.gov/42162434/) | A | Robot rehabilitation in SMA | Exclude | Clinical rehabilitation population and no ROM comparator. |
| [42092903](https://pubmed.ncbi.nlm.nih.gov/42092903/) | A | BFR after ACL reconstruction | Exclude | Rehabilitation and BFR comparator; ROM is an outcome. |
| [41843416](https://pubmed.ncbi.nlm.nih.gov/41843416/) | A | ACSM position stand | Context | Overview of reviews; useful product context but not a direct ROM trial. |
| [41988507](https://pubmed.ncbi.nlm.nih.gov/41988507/) | A | Shoulder angle in cable curl | Context | Elbow ROM was matched; shoulder position and resistance profile changed muscle length. |
| [42006449](https://pubmed.ncbi.nlm.nih.gov/42006449/) | A+B | Partials beyond failure in calf raise | Direct | Longitudinal calf study; comparator changes set structure as well as use of partials. |
| [41646176](https://pubmed.ncbi.nlm.nih.gov/41646176/) | A+B | Longer-length longitudinal-growth review | Context | Systematic review of longer- versus shorter-length training; not full versus partial alone. |
| [41247250](https://pubmed.ncbi.nlm.nih.gov/41247250/) | A+B | Havers preacher curl | Direct | Eight-week full versus lengthened-partial within-participant comparison. |
| [41055237](https://pubmed.ncbi.nlm.nih.gov/41055237/) | A+B | Gschneidner multisite trial | Direct | Twelve-week full versus lengthened-partial comparison; hypertrophy uses anthropometric estimates. |
| [40570881](https://pubmed.ncbi.nlm.nih.gov/40570881/) | A | Regional hypertrophy meta-analysis | Context | Pooled ROM and exercise-selection manipulations by mean muscle length. |
| [41283547](https://pubmed.ncbi.nlm.nih.gov/41283547/) | A | Full versus half squats in tennis | Exclude | Mean age below adult scope; adolescent athletic population. |
| [41169885](https://pubmed.ncbi.nlm.nih.gov/41169885/) | A | Stretching versus plantar-flexor RT | Exclude | No between-condition ROM manipulation. |
| [40850937](https://pubmed.ncbi.nlm.nih.gov/40850937/) | A | Initial versus past-failure calf partials | Direct | Longitudinal partial-ROM strategy comparison; full-ROM-only control is absent. |
| [40229595](https://pubmed.ncbi.nlm.nih.gov/40229595/) | A | Concentric-eccentric plantar flexion | Exclude | Contraction-type comparison, not ROM or training-length comparison. |
| [39449136](https://pubmed.ncbi.nlm.nih.gov/39449136/) | A+B | BFR elbow flexion at short/long length | Context | Shoulder position plus vascular occlusion; indirect to ordinary dynamic ROM training. |
| [40692697](https://pubmed.ncbi.nlm.nih.gov/40692697/) | A | Dumbbell versus cable lateral raise | Exclude | Equipment/resistance-profile comparison with ROM explicitly matched. |
| [40113586](https://pubmed.ncbi.nlm.nih.gov/40113586/) | A | Leg-press knee-flexion ROM | Direct | Eight-week comparison of fixed versus individualized deeper knee flexion in trained adults. |
| [40276368](https://pubmed.ncbi.nlm.nih.gov/40276368/) | A | Gluteus-maximus meta-analysis | Context | Useful citation source, but the review question is exercise choice rather than ROM. |
| [39959841](https://pubmed.ncbi.nlm.nih.gov/39959841/) | A | Wolf upper-body trial | Direct | Eight-week full versus lengthened-partial within-participant comparison. |
| [39825474](https://pubmed.ncbi.nlm.nih.gov/39825474/) | A | Stretching plus RT case study | Exclude | Single case and no isolated ROM comparison. |
| [38240811](https://pubmed.ncbi.nlm.nih.gov/38240811/) | A | Pectoral stretching versus RT | Exclude | Stretching-modality comparison, not ROM manipulation. |
| [38516212](https://pubmed.ncbi.nlm.nih.gov/38516212/) | A | Eccentric shoulder training | Exclude | Contraction-mode intervention; ROM is an outcome. |
| [38443932](https://pubmed.ncbi.nlm.nih.gov/38443932/) | A | Breast-cancer shoulder rehabilitation | Exclude | Treatment/rehabilitation population and no ROM comparator. |
| [37964694](https://pubmed.ncbi.nlm.nih.gov/37964694/) | A | BFR in ACL rehabilitation case | Exclude | Single rehabilitation case; no ROM comparator. |
| [38249086](https://pubmed.ncbi.nlm.nih.gov/38249086/) | A | Technique narrative review | Context | Terminology and citation chasing only; not systematic effect evidence. |
| [38162828](https://pubmed.ncbi.nlm.nih.gov/38162828/) | A | Acute BFR venous response | Exclude | Acute crossover experiment, not longitudinal adaptation. |
| [37029826](https://pubmed.ncbi.nlm.nih.gov/37029826/) | A | Long-duration stretch versus calf RT | Exclude | Stretching-modality comparison; no ROM manipulation within RT. |
| [37559762](https://pubmed.ncbi.nlm.nih.gov/37559762/) | A | Incline versus preacher curl | Context | Exercise and resistance profile differ; indirect muscle-length evidence. |
| [36662126](https://pubmed.ncbi.nlm.nih.gov/36662126/) | A+B | Which ROMs Lead to Rome? | Context | Systematic review and source of older primary studies. |
| [36685189](https://pubmed.ncbi.nlm.nih.gov/36685189/) | A | Sex differences after stretching | Exclude | Static-stretch intervention and no resistance-training ROM comparator. |
| [36107233](https://pubmed.ncbi.nlm.nih.gov/36107233/) | A | Concentric versus eccentric elbow RT | Exclude | Contraction-type comparator rather than ROM comparator. |
| [36174033](https://pubmed.ncbi.nlm.nih.gov/36174033/) | A | Acute muscle-damage protocol | Exclude | Protocol for an acute load comparison; no longitudinal ROM intervention. |
| [33306588](https://pubmed.ncbi.nlm.nih.gov/33306588/) | A | Muscle-action duration and hypertrophy | Exclude | Tempo comparator with matched ROM. |
| [33977835](https://pubmed.ncbi.nlm.nih.gov/33977835/) | A+B | Pedrosa knee extension | Direct | Full, lengthened-, shortened- and varied-partial comparison with regional MRI outcomes. |
| [42112996](https://pubmed.ncbi.nlm.nih.gov/42112996/) | B | Recovery after long-length isometrics | Exclude | Acute recovery study, not longitudinal adaptation. |
| [40944751](https://pubmed.ncbi.nlm.nih.gov/40944751/) | B | Recovery after long/short isometrics | Exclude | Acute crossover recovery study. |
| [41131693](https://pubmed.ncbi.nlm.nih.gov/41131693/) | B | Muscle damage at long length | Exclude | Acute muscle-damage study. |
| [41078269](https://pubmed.ncbi.nlm.nih.gov/41078269/) | B | Fatigue and biceps-femoris fascicles | Exclude | Acute biomechanics/fatigue study. |
| [40911904](https://pubmed.ncbi.nlm.nih.gov/40911904/) | B | Varovic quadriceps isometric versus isotonic | Context | Long-length isometric versus full-ROM isotonic; contraction mode is confounded with ROM. |
| [37202880](https://pubmed.ncbi.nlm.nih.gov/37202880/) | B | Acute biceps-femoris fascicle behavior | Exclude | Acute biomechanics study, not training adaptation. |
| [37015016](https://pubmed.ncbi.nlm.nih.gov/37015016/) | B | Kassiano calf raise | Direct | Eight-week full, lengthened-partial and shortened-partial comparison. |
| [36828324](https://pubmed.ncbi.nlm.nih.gov/36828324/) | B | Initial versus final preacher-curl ROM | Direct | Eight-week comparison of lengthened- and shortened-position partials. |

## Supplementary records outside the update-query count

| Work | Why outside PubMed query count | Use |
|---|---|---|
| [Pallarés 2021](https://pubmed.ncbi.nlm.nih.gov/34170576/) | Published before the update window | Foundational pre-cutoff meta-analysis. |
| [Plotkin 2026 preprint](https://doi.org/10.64898/2026.06.04.730150) | Not indexed in PubMed at search time | Context only until peer review and version-of-record comparison. |

## Open-access availability check

On 2026-08-08, OpenAlex and Europe PMC reported no open full text for Kassiano calf
2023, Varovic quadriceps 2025 or McMahon 2026. Crossref exposed publisher links but
no related accepted manuscript or preprint; the Varovic publisher endpoint returned
an access challenge rather than readable full text. No paywall was bypassed.

## Remaining screening gate

- independently repeat title/abstract decisions;
- deduplicate the primary studies included across the four systematic reviews;
- appraise newly found PMC full texts and then the remaining abstract-only trials;
- compare registries, protocols, supplements and final publications;
- update claims only after muscle, region, exercise and comparator-specific review.
