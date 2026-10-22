import { useTranslation } from '../../../i18n/useTranslation.js'

const WEEKDAY_KEYS = ['home.wdMon', 'home.wdTue', 'home.wdWed', 'home.wdThu', 'home.wdFri', 'home.wdSat', 'home.wdSun']
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function WeekCalendar({ doneDates = [] }) {
  const { t } = useTranslation()
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
  monday.setHours(0, 0, 0, 0)
  const done = new Set(doneDates)

  return <div className="home-week" aria-label={t('home.weekCalendar')}>
    {WEEKDAY_KEYS.map((key, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const iso = dateKey(date)
      const today = iso === dateKey(now)
      const completed = done.has(iso)
      return <div key={iso} className={`home-week__day${today ? ' home-week__day--today' : ''}`} aria-current={today ? 'date' : undefined}>
        <span className="home-week__weekday">{t(key)}</span>
        <time dateTime={iso} className="home-week__date">{date.getDate()}</time>
        <span className={`home-week__dot${completed ? ' home-week__dot--done' : ''}`} aria-label={completed ? t('home.workoutCompleted') : undefined} />
      </div>
    })}
  </div>
}
