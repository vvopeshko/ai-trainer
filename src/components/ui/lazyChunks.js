// Загрузчики ленивых чанков UI: общие для React.lazy и для idle-прогрева в App
// (отдельный файл — компонентные модули экспортируют только компоненты, fast refresh).
export const loadBodyMap = () => import('./BodyMap.jsx')
export const loadExerciseDetailSheet = () => import('./ExerciseDetailSheet.jsx')
