// Все UI-строки живут здесь. Никаких хардкодов в JSX.
// Паттерн: t('namespace.key'). Для параметров — t('key', { name: 'Vik' }) с {{name}}.
// В MVP поддерживаем только ru. Добавим en одной веткой, когда понадобится.

export const translations = {
  ru: {
    'app.title': 'AI Trainer',
    'app.tagline': 'Твой AI-тренер в Telegram',

    'workout.title': 'Тренировка',
    'workout.empty': 'Пока нет записанных подходов.',
    'workout.helloUser': 'Привет, {{name}}!',
    'workout.placeholder': 'Скоро здесь будет логирование подходов.',

    // Workout screen (BRD §12.2)
    'workout.finish': 'Завершить',
    'workout.done': 'Сделал',
    'workout.weightKg': 'Вес, кг',
    'workout.reps': 'Повторы',
    'workout.selectExercise': 'Выберите упражнение',
    'workout.search': 'Поиск упражнения...',
    'workout.noExercises': 'Упражнения не найдены',
    'workout.set': 'Подход {{n}}',
    'workout.addSet': '+ Добавить подход',
    'workout.nextExercise': 'К следующему',
    'workout.finishWorkout': 'Завершить тренировку',
    'workout.starting': 'Начинаем...',
    'workout.exercises': 'упр.',
    'workout.sets': 'подх.',
    'workout.completed': 'Выполнено',

    // Summary screen (BRD §12.3)
    'summary.title': 'Готово!',
    'summary.subtitle': 'Тренировка записана.',
    'summary.sets': 'Подходов',
    'summary.time': 'Время',
    'summary.tonnage': 'Тоннаж',
    'summary.backHome': 'К программе',
  },
}

export const defaultLanguage = 'ru'
