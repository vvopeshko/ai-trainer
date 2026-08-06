export const queryKeys = {
  stats: {
    year:  ['stats', 'year'],
    month: ['stats', 'month'],
  },
  workouts: {
    recent: ['workouts', 'recent'],
    active: ['workouts', 'active'],
    detail: (id) => ['workouts', 'detail', id],
  },
  programs: {
    active: ['programs', 'active'],
    next:   ['programs', 'next'],
    list:   ['programs', 'list'],
    detail: (id) => ['programs', 'detail', id],
  },
  progress:  ['progress'],
  insights: {
    today:    ['insights', 'today'],
    progress: ['insights', 'progress'],
  },
  exercises: {
    catalog:  ['exercises', 'catalog'],
    detail:   (id) => ['exercises', 'detail', id],
    settings: ['exercises', 'settings'],
  },
  billing: {
    status: ['billing', 'status'],
    plans:  ['billing', 'plans'],
  },
  evidence: {
    all: ['evidence'],
    access: ['evidence', 'access'],
    questions: ['evidence', 'questions'],
    question: (id) => ['evidence', 'question', id],
    claims: (filters = {}) => ['evidence', 'claims', filters],
    claim: (id) => ['evidence', 'claim', id],
    runtime: (questionId, outcome = '') => ['evidence', 'runtime', questionId, outcome],
  },
}
