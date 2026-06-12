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
  exercises: {
    catalog:  ['exercises', 'catalog'],
    detail:   (id) => ['exercises', 'detail', id],
    settings: ['exercises', 'settings'],
  },
}
