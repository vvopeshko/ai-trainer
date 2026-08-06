import { createContext, useContext, useMemo, useState } from 'react'

const STORAGE_KEY = 'evidenceLanguage'

const ui = {
  ru: {
    knowledgeBase: 'База знаний AI Trainer', toApp: 'В приложение', loading: 'Загружаем базу доказательств…',
    accessDenied: 'Нет доступа к Evidence Console', loadFailed: 'Не удалось загрузить данные',
    accessHint: 'Добавьте UUID пользователя или tg:<telegramId> в EVIDENCE_REVIEWER_IDS / EVIDENCE_APPROVER_IDS на сервере.',
    connectionHint: 'Проверьте соединение с API и попробуйте ещё раз.', retry: 'Повторить', decisionComment: 'Комментарий к решению',
    decisionWhy: 'Почему принимаем это решение?', cancel: 'Отмена', editorialWorkspace: 'Редакционная рабочая область',
    evidenceBase: 'База доказательств', evidenceFlow: 'Исследования → оценки → научные тезисы → рекомендации для AI-тренера и контента.',
    claimsVisible: 'тезисов в выборке', sources: 'источников', overdue: 'просрочено', claims: 'Тезисы', questions: 'Вопросы',
    allQuestions: 'Все исследовательские вопросы', all: 'Все', noClaims: 'В этой выборке тезисов пока нет.',
    certainty: 'достоверность', sourceCount: '{{count}} источн.', reviewDate: 'пересмотр {{date}}', critical: 'критический',
    claimCount: '{{count}} тезисов', assessmentCount: '{{count}} оценок', reviewEvery: 'Пересмотр каждые {{count}} мес.',
    backQueue: '← Назад к очереди', synthesis: 'Синтез доказательств', population: 'Популяция', effect: 'Эффект',
    certaintyRationale: 'Обоснование достоверности', searchCutoff: 'Дата окончания поиска', limitations: 'Ограничения', unknowns: 'Неизвестно',
    studiesAssessments: 'Исследования и оценки', recommendations: 'Рекомендации', noRecommendations: 'К этому тезису пока нет рекомендаций.',
    auditTrail: 'История изменений', eventCount: '{{count}} событий', noComment: 'Без комментария', noAudit: 'Событий ревью ещё нет.',
    approvalReadiness: 'Готовность к одобрению', ready: 'Все проверки пройдены. Тезис готов к одобрению.', runtimeCheck: 'Проверка runtime',
    runtimeHint: 'Проверяет, что именно получит AI-тренер из опубликованного слоя.', runCheck: 'Запустить fail-closed проверку',
    reviewMetadata: 'Метаданные ревью', reviewDue: 'Пересмотреть до', createdBy: 'Создал', reviewedBy: 'Проверил', version: 'Версия',
    submitReview: 'Отправить на ревью', approve: 'Одобрить', dispute: 'Оспорить', edit: 'Редактировать', submit: 'Отправить',
    markCurrent: 'Подтвердить актуальность', sourceState: '{{id}} · источник: {{status}} · корректировки: {{correction}}',
    assessmentMissing: 'Оценка исследования не найдена', reviewScope: 'Объём проверки', directness: 'Применимость', riskOfBias: 'Риск систематической ошибки',
    reviewLabel: 'пересмотр {{date}}', eligibleSummary: '{{claims}} допущенных тезисов · {{recommendations}} рекомендаций',
    editAssessment: 'Редактировать оценку исследования', outcomesLines: 'Исходы — по одному на строку',
    mainResultsLines: 'Основные результаты — по одному на строку', cannotSupport: 'Что исследование не подтверждает', changeComment: 'Комментарий к изменению',
    save: 'Сохранить', assessmentUpdated: 'Оценка исследования обновлена',
    claimSubmitTitle: 'Отправить тезис на ревью?', claimSubmitSuccess: 'Тезис отправлен на ревью', claimApproveTitle: 'Одобрить тезис?',
    claimApproveDesc: 'После одобрения он сможет участвовать в runtime-рекомендациях.', claimApproveSuccess: 'Тезис одобрен', claimDisputeTitle: 'Оспорить тезис?',
    claimDisputeDesc: 'Связанные рекомендации перестанут быть доступны в runtime.', claimDisputeSuccess: 'Тезис помечен как оспоренный',
    assessmentSubmitTitle: 'Отправить оценку исследования на ревью?', assessmentSubmitSuccess: 'Оценка отправлена на ревью',
    assessmentApproveTitle: 'Одобрить оценку исследования?', assessmentApproveSuccess: 'Оценка исследования одобрена',
    recommendationSubmitTitle: 'Отправить рекомендацию на ревью?', recommendationSubmitSuccess: 'Рекомендация отправлена на ревью',
    recommendationApproveTitle: 'Одобрить рекомендацию?', recommendationApproveSuccess: 'Рекомендация одобрена',
    workCurrentTitle: 'Подтвердить актуальность источника?', workCurrentConfirm: 'Отметить актуальным', workCurrentSuccess: 'Статус источника обновлён',
    openQuestion: 'Открыть материалы', scientificWording: 'Точная научная формулировка', applicability: 'Где применим вывод',
    muscles: 'Мышцы', muscleRegions: 'Участки мышцы', exercises: 'Упражнения', romSegments: 'Часть амплитуды',
    measurementMethods: 'Методы измерения', applicabilityNotes: 'Границы переноса результата', notSpecified: 'Не указано',
    backQuestions: '← Назад к вопросам', researchCoverage: 'Покрытие исследований', linkedPublications: 'связанных публикаций',
    decisionPublications: 'влияют на вывод', assessedPublications: 'имеют оценку', fullTextReviewed: 'проверено полностью',
    collectionMethod: 'Как собирали материалы', searchDate: 'Дата поиска', databases: 'Базы и источники', searchQueries: 'Поисковые формулировки',
    coverageCaveat: 'Почему число нельзя считать полным', coverageCaveatText: 'Это быстрый редакционный поиск, а не систематический обзор. Число найденных записей и уникальных первичных исследований после удаления дублей на первом этапе не фиксировалось.',
    works: 'Публикации', includedStudies: '{{count}} исследований внутри обзора', primaryStudy: 'первичное исследование',
    synthesisType: 'обзорный источник', usages: 'Использование знаний', aiTests: 'AI-сценарии', blogOutlines: 'Материалы блога',
    noItems: 'Пока ничего нет', scientificQuestion: 'Точная исследовательская формулировка', reportedReviewStudies: 'исследований заявлено внутри обзоров',
    notDeduplicated: 'не удалены пересечения между обзорами', currentVerified: 'источников с проверенным статусом',
  },
  en: {
    knowledgeBase: 'AI Trainer knowledge base', toApp: 'Back to app', loading: 'Loading evidence base…',
    accessDenied: 'No access to Evidence Console', loadFailed: 'Could not load data',
    accessHint: 'Add the user UUID or tg:<telegramId> to EVIDENCE_REVIEWER_IDS / EVIDENCE_APPROVER_IDS on the server.',
    connectionHint: 'Check the API connection and try again.', retry: 'Retry', decisionComment: 'Decision comment',
    decisionWhy: 'Why are you making this decision?', cancel: 'Cancel', editorialWorkspace: 'Editorial workspace',
    evidenceBase: 'Evidence base', evidenceFlow: 'Research → assessments → scientific claims → recommendations for the AI trainer and content.',
    claimsVisible: 'claims in view', sources: 'sources', overdue: 'overdue', claims: 'Claims', questions: 'Questions',
    allQuestions: 'All research questions', all: 'All', noClaims: 'There are no claims in this view yet.',
    certainty: 'certainty', sourceCount: '{{count}} sources', reviewDate: 'review {{date}}', critical: 'critical',
    claimCount: '{{count}} claims', assessmentCount: '{{count}} assessments', reviewEvery: 'Review every {{count}} months',
    backQueue: '← Back to review queue', synthesis: 'Evidence synthesis', population: 'Population', effect: 'Effect',
    certaintyRationale: 'Certainty rationale', searchCutoff: 'Search cutoff', limitations: 'Limitations', unknowns: 'Unknowns',
    studiesAssessments: 'Studies and assessments', recommendations: 'Recommendations', noRecommendations: 'No recommendations are linked to this claim yet.',
    auditTrail: 'Audit trail', eventCount: '{{count}} events', noComment: 'No comment', noAudit: 'No review events yet.',
    approvalReadiness: 'Approval readiness', ready: 'All checks passed. The claim is ready for approval.', runtimeCheck: 'Runtime check',
    runtimeHint: 'Checks exactly what the AI trainer receives from the published layer.', runCheck: 'Run fail-closed check',
    reviewMetadata: 'Review metadata', reviewDue: 'Review due', createdBy: 'Created by', reviewedBy: 'Reviewed by', version: 'Version',
    submitReview: 'Submit for review', approve: 'Approve', dispute: 'Dispute', edit: 'Edit', submit: 'Submit', markCurrent: 'Mark current',
    sourceState: '{{id}} · source: {{status}} · correction: {{correction}}', assessmentMissing: 'Assessment not found',
    reviewScope: 'Review scope', directness: 'Directness', riskOfBias: 'Risk of bias', reviewLabel: 'review {{date}}',
    eligibleSummary: '{{claims}} eligible claims · {{recommendations}} recommendations', editAssessment: 'Edit assessment',
    outcomesLines: 'Outcomes — one per line', mainResultsLines: 'Main results — one per line', cannotSupport: 'Cannot support',
    changeComment: 'Change comment', save: 'Save', assessmentUpdated: 'Assessment updated',
    claimSubmitTitle: 'Submit claim for review?', claimSubmitSuccess: 'Claim submitted for review', claimApproveTitle: 'Approve claim?',
    claimApproveDesc: 'Once approved, it can participate in runtime guidance.', claimApproveSuccess: 'Claim approved', claimDisputeTitle: 'Dispute claim?',
    claimDisputeDesc: 'Linked recommendations will no longer be available at runtime.', claimDisputeSuccess: 'Claim marked as disputed',
    assessmentSubmitTitle: 'Submit assessment for review?', assessmentSubmitSuccess: 'Assessment submitted for review',
    assessmentApproveTitle: 'Approve assessment?', assessmentApproveSuccess: 'Assessment approved',
    recommendationSubmitTitle: 'Submit recommendation for review?', recommendationSubmitSuccess: 'Recommendation submitted for review',
    recommendationApproveTitle: 'Approve recommendation?', recommendationApproveSuccess: 'Recommendation approved',
    workCurrentTitle: 'Confirm this source is current?', workCurrentConfirm: 'Mark current', workCurrentSuccess: 'Source status updated',
    openQuestion: 'Open workspace', scientificWording: 'Exact scientific wording', applicability: 'Where the claim applies',
    muscles: 'Muscles', muscleRegions: 'Muscle regions', exercises: 'Exercises', romSegments: 'ROM segment',
    measurementMethods: 'Measurement methods', applicabilityNotes: 'Generalization limits', notSpecified: 'Not specified',
    backQuestions: '← Back to questions', researchCoverage: 'Research coverage', linkedPublications: 'linked publications',
    decisionPublications: 'inform the conclusion', assessedPublications: 'have an assessment', fullTextReviewed: 'reviewed in full',
    collectionMethod: 'How materials were collected', searchDate: 'Search date', databases: 'Databases and sources', searchQueries: 'Search queries',
    coverageCaveat: 'Why this is not a complete count', coverageCaveatText: 'This was a rapid editorial search, not a systematic review. Phase 0 did not record all screened records or the deduplicated number of primary studies.',
    works: 'Publications', includedStudies: '{{count}} studies inside this review', primaryStudy: 'primary study', synthesisType: 'evidence synthesis',
    usages: 'Knowledge usages', aiTests: 'AI scenarios', blogOutlines: 'Blog materials', noItems: 'Nothing yet',
    scientificQuestion: 'Exact research wording', reportedReviewStudies: 'studies reported inside reviews', notDeduplicated: 'overlap between reviews not removed',
    currentVerified: 'sources with verified status',
  },
}

const ruContent = {
  'EQ-HYP-001': { question: 'Как недельный объём подходов влияет на гипертрофию?' },
  'EQ-HYP-002': { question: 'Нужно ли доводить рабочие подходы до мышечного отказа?' },
  'EQ-HYP-003': { question: 'Как нагрузка и диапазон повторений влияют на гипертрофию и силу?' },
  'EQ-HYP-004': { question: 'Имеет ли значение частота тренировки мышцы при равном объёме?' },
  'EQ-HYP-005': { question: 'Сколько отдыхать между рабочими подходами?' },
  'EQ-PRG-001': { question: 'Как прогрессировать нагрузку, повторения и объём?' },
  'EQ-HYP-006': { question: 'Как полная и частичная амплитуда влияют на адаптацию?' },
  'EQ-PRG-002': { question: 'Как порядок упражнений влияет на силу и гипертрофию?' },
  'EQ-PRG-003': { question: 'Улучшают ли периодизация и плановые разгрузки результаты?' },
  'EQ-CON-001': { question: 'Когда аэробная нагрузка мешает адаптации к силовым тренировкам?' },
  'ECV-WEEKLY-VOLUME-HYP-v1': { statement: 'Больший недельный объём тяжёлых подходов в среднем связан с большей гипертрофией, но отдача снижается, а универсальной верхней границы нет.', effect: 'Положительная дозозависимость с убывающей отдачей.' },
  'ECV-RIR-HYP-v1': { statement: 'Для гипертрофии не обязательно доходить до точного мышечного отказа, однако постоянная остановка очень далеко от отказа может быть менее эффективной.', effect: 'Работа близко к отказу эффективна без обязательного отказа в каждом подходе.' },
  'ECV-LOAD-GOAL-v1': { statement: 'Широкий диапазон нагрузок при достаточном усилии может поддерживать гипертрофию, а тяжёлая специфичная практика лучше способствует максимальной силе.', effect: 'Эффект нагрузки зависит от целевого результата.' },
  'ECV-FREQUENCY-HYP-v1': { statement: 'При равном недельном объёме частота тренировок не оказывает явно выраженного самостоятельного влияния на гипертрофию.', effect: 'Явного независимого влияния на гипертрофию не обнаружено.' },
  'ECV-REST-HYP-v1': { statement: 'Отдых дольше совсем коротких интервалов может немного способствовать гипертрофии за счёт сохранения качества следующих подходов, но универсального оптимума не установлено.', effect: 'Возможное небольшое преимущество перед очень коротким отдыхом.' },
  'ECV-PROGRESSION-METHOD-v1': { statement: 'Увеличение веса и увеличение повторений могут поддерживать рост силы и мышц; универсальное превосходство одного метода не установлено.', effect: 'Оба сравниваемых способа прогрессии дали адаптацию.' },
  'ECV-PROGRESSION-ALGORITHM-v1': { statement: 'Доказательств недостаточно, чтобы назвать одну точную последовательность изменения веса, повторений и подходов оптимальной для всех.', effect: 'Недостаточно сравнительных данных.' },
  'ECV-ROM-FULL-DEFAULT-v1': { statement: 'Полная амплитуда — более надёжная общая стратегия, чем произвольно сокращённая, особенно для силы и гипертрофии нижней части тела.', effect: 'Полная амплитуда в целом превосходила объединённые условия частичной амплитуды.' },
  'ECV-ROM-LENGTHENED-PARTIAL-v1': { statement: 'Частичная амплитуда в удлинённом положении может не уступать или превосходить полную для локальной гипертрофии отдельных мышц и упражнений, но это не универсальное правило.', effect: 'Возможное преимущество, зависящее от упражнения и участка мышцы.' },
  'ECV-ORDER-STRENGTH-PRIORITY-v1': { statement: 'Размещение приоритетного упражнения в начале тренировки обычно способствует большему приросту силы именно в нём.', effect: 'Более раннее выполнение способствует специфичной для упражнения силе.' },
  'ECV-ORDER-HYPERTROPHY-v1': { statement: 'Явного преимущества для гипертрофии у порядка «многосуставные сначала» по сравнению с «односуставные сначала» не показано.', effect: 'Явных различий не обнаружено.' },
  'ECV-PERIODIZATION-OUTCOMES-v1': { statement: 'При равном объёме периодизация может немного улучшать силу в 1ПМ, особенно у тренированных, но явного преимущества для гипертрофии нет.', effect: 'Небольшое преимущество для силы; явного преимущества для гипертрофии нет.' },
  'ECV-DELOAD-PLANNED-v1': { statement: 'Доказательств недостаточно, чтобы считать разгрузки по фиксированному графику необходимыми или лучшими для всех.', effect: 'Недостаточно данных для универсального правила плановой разгрузки.' },
  'ECV-CONCURRENT-STRENGTH-HYP-v1': { statement: 'Совмещение аэробных и силовых тренировок в среднем не показывает значимого ухудшения гипертрофии или максимальной силы у здоровых взрослых.', effect: 'Значимого среднего ухудшения не обнаружено.' },
  'ECV-CONCURRENT-POWER-SCHEDULE-v1': { statement: 'Развитие взрывной силы может ослабляться, когда выносливость и силовая работа выполняются в одной сессии; разнесение на несколько часов может снизить риск.', effect: 'Возможное ослабление, особенно в рамках одной сессии.' },
  'ER-WEEKLY-VOLUME-HYP-DEFAULT-v1': { guidance: 'Используйте недельный объём как регулируемую дозу, а не обязательное универсальное число.', implementationHeuristic: 'Начинайте консервативно и увеличивайте объём, только если техника, восстановление и регулярность остаются хорошими.' },
  'ER-RIR-HYP-DEFAULT-v1': { guidance: 'Большинство рабочих подходов можно заканчивать близко к отказу, не доходя до точного отказа.', implementationHeuristic: 'Используйте широкий ориентир 1–3 RIR и обучайте калибровке без ложной точности.' },
  'ER-LOAD-GOAL-DEFAULT-v1': { guidance: 'Выбирайте диапазон нагрузки с учётом цели и ограничений упражнения.', implementationHeuristic: 'Для удобства используйте умеренное число повторений; для максимальной силы добавляйте более тяжёлую практику.' },
  'ER-FREQUENCY-HYP-DEFAULT-v1': { guidance: 'Используйте частоту прежде всего для распределения недельного объёма и сохранения качества тренировки.', implementationHeuristic: 'Выбирайте самый простой график, который поддерживает качество и регулярность.' },
  'ER-REST-DEFAULT-v1': { guidance: 'Отдыхайте достаточно, чтобы сохранять безопасную технику и требуемое качество подхода.', implementationHeuristic: 'Начните примерно с 2–3 минут для базовых и 1–2 минут для изолирующих упражнений, затем корректируйте.' },
  'ER-PROGRESSION-DOUBLE-v1': { guidance: 'Прогрессировать можно за счёт повторений или веса.', implementationHeuristic: 'Используйте двойную прогрессию как понятный вариант по умолчанию; число подходов меняйте отдельно.' },
  'ER-ROM-COMFORTABLE-FULL-v1': { guidance: 'Используйте контролируемую полную амплитуду как общий вариант по умолчанию.', implementationHeuristic: 'Частичную амплитуду в удлинённом положении предлагайте только как опцию для конкретного упражнения.' },
  'ER-ORDER-PRIORITY-FIRST-v1': { guidance: 'Ставьте наиболее приоритетное упражнение раньше.', implementationHeuristic: 'При равном приоритете учитывайте безопасность, оборудование и предпочтения.' },
  'ER-PERIODIZATION-DELOAD-v1': { guidance: 'Для силовых целей используйте простую вариативность, не заявляя преимущества для гипертрофии.', implementationHeuristic: 'Принимайте решение о разгрузке по устойчивым сигналам пользователя, а не по обязательному календарю.' },
  'ER-CONCURRENT-SCHEDULE-v1': { guidance: 'Не исключайте кардио из силовых программ или программ на гипертрофию по умолчанию.', implementationHeuristic: 'Если приоритет — мощность, сначала выполняйте силовую работу и разносите тяжёлые сессии на часы или дни.' },
}

const commonRu = {
  scope: 'Здоровые взрослые; лечение, реабилитация и острые травмы не входят в область рассмотрения.',
  population: 'Здоровые взрослые.',
  certaintyRationale: 'Быстрый редакционный синтез; перед использованием в runtime требуется научное ревью.',
  limitations: ['Данные неоднородны и не определяют индивидуальный оптимум.'],
  unknowns: ['Индивидуальная реакция и долгосрочные эффекты остаются неопределёнными.'],
}

const termsRu = {
  supports: 'поддерживает', contradicts: 'противоречит', contextualizes: 'контекст', current: 'актуален', unknown: 'не проверен', corrected: 'исправлен', retracted: 'отозван',
  screened_in: 'включён', discovered: 'найден', abstract_only: 'только аннотация', full_text: 'полный текст', full_text_and_supplements: 'полный текст и приложения',
  low: 'низкий', moderate: 'средний', high: 'высокий', very_low: 'очень низкий', some_concerns: 'есть замечания', not_assessed: 'не оценён',
  conditional: 'условная', strong: 'сильная', insufficient: 'недостаточно данных', supported: 'поддерживается', evidence_only: 'только доказательства', unsupported: 'не поддерживается',
  ai_trainer: 'AI-тренер', program_generation: 'генерация программ', blog: 'блог', weekly_volume: 'недельный объём', proximity_to_failure: 'близость к отказу',
  position_stand: 'позиционный документ', meta_analysis: 'метаанализ', systematic_review: 'систематический обзор', umbrella_review: 'зонтичный обзор', rct: 'РКИ',
  load_and_repetitions: 'нагрузка и повторения', frequency: 'частота', inter_set_rest: 'отдых между подходами', progression: 'прогрессия',
  range_of_motion: 'амплитуда движения', exercise_order: 'порядок упражнений', periodization_and_deload: 'периодизация и разгрузка', concurrent_training: 'совмещённые тренировки',
  full: 'полное движение', lengthened_partial: 'растянутая часть движения', shortened_partial: 'сокращённая часть движения', middle_partial: 'средняя часть движения',
}

const EvidenceLocaleContext = createContext(null)

export function evidenceUiText(key, language = 'ru', params) {
  const raw = ui[language]?.[key] ?? ui.en[key] ?? key
  return Object.entries(params || {}).reduce((text, [name, val]) => text.replaceAll(`{{${name}}}`, String(val)), raw)
}

export function evidenceContent(entity, field, language = 'ru') {
  if (!entity) return ''
  if (language === 'en') return entity[field]
  const storedRu = entity[`${field}Ru`]
  if (storedRu != null) return storedRu
  const localized = ruContent[entity.id]
  if (!localized) return entity[field]
  return localized[field] ?? commonRu[field] ?? entity[field]
}

function initialLanguage() {
  if (typeof window === 'undefined') return 'ru'
  const stored = window.localStorage?.getItem(STORAGE_KEY) || window.localStorage?.getItem('appLanguage')
  return stored === 'en' ? 'en' : 'ru'
}

export function EvidenceLocaleProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage)
  const value = useMemo(() => ({
    language,
    setLanguage(next) {
      if (!ui[next]) return
      setLanguageState(next)
      try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* private mode */ }
    },
    t(key, params) {
      return evidenceUiText(key, language, params)
    },
    content(entity, field) {
      return evidenceContent(entity, field, language)
    },
    term(value) {
      if (value == null) return '—'
      if (language === 'ru' && termsRu[value]) return termsRu[value]
      return String(value).replaceAll('_', ' ')
    },
  }), [language])
  return <EvidenceLocaleContext.Provider value={value}>{children}</EvidenceLocaleContext.Provider>
}

export function useEvidenceLocale() {
  const context = useContext(EvidenceLocaleContext)
  if (!context) throw new Error('useEvidenceLocale requires EvidenceLocaleProvider')
  return context
}
