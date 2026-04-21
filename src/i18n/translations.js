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
  },
}

export const defaultLanguage = 'ru'
