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
    'workout.setOf': 'Подход {{n}} / {{total}}',
    'workout.addSet': '+ Добавить подход',
    'workout.nextExercise': 'К следующему',
    'workout.finishWorkout': 'Завершить тренировку',
    'workout.starting': 'Начинаем...',
    'workout.exercises': 'упр.',
    'workout.sets': 'подх.',
    'workout.completed': 'Выполнено',
    'workout.cancel': 'Отменить',
    'workout.addOther': '+ Добавить другое',
    'workout.setsScheme': '{{sets}}×{{reps}}',
    'workout.now': 'сейчас',
    'workout.exerciseOf': 'упр {{n}}/{{total}}',
    'workout.setsProgress': '{{done}}/{{total}} подх',
    'workout.ready': 'ГОТОВО',
    'workout.upcoming': 'далее',
    'workout.addSetExtra': '+ добавить подход',
    'workout.targetReps': 'цель {{reps}}',
    'workout.rest': 'отдых',
    'workout.skipRest': 'Пропустить отдых',
    'workout.breathe': 'Вдох носом 4с → выдох 6с. Расслабь плечи.',
    'workout.doneLabel': 'сделано',

    // Home screen (BRD §12.1)
    'home.yearGoal': '{{done}} / {{target}} тренировок',
    'home.startWorkout': 'Начать тренировку',
    'home.continueWorkout': 'Продолжить',
    'home.workoutActive': 'ИДЁТ ТРЕНИРОВКА',
    'home.thisMonth': 'Этот месяц',
    'home.workouts': 'Тренировок',
    'home.tonnage': 'Тоннаж',
    'home.streak': 'Серия',
    'home.records': 'Рекорды',
    'home.recent': 'Недавно',
    'home.today': 'Сегодня',
    'home.yesterday': 'Вчера',
    'home.daysAgo': '{{n}} дн. назад',
    'home.exercises': '{{n}} упр.',
    'home.sets': '{{n}} подх.',
    'home.next': 'СЛЕДУЮЩАЯ',
    'home.nExercises': '{{n}} упр.',
    'home.nDays': '{{n}} дн.',

    // Nav
    'nav.home': 'Главная',
    'nav.progress': 'Прогресс',
    'nav.library': 'Каталог',
    'nav.me': 'Профиль',

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
