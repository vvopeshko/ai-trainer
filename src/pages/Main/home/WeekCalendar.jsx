import { useMemo } from 'react'
import { Icon } from '../../../components/ui/Icon.jsx'

const WEEKDAYS_RU = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

function getWeekDates() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isToday(d) {
  const now = new Date()
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
}

/**
 * WeekCalendar — 7 day cells on hero gradient.
 *
 * Types: today (white circle, accent dumbbell), done (glass circle, white dumbbell),
 * planned (glass circle + border, faded dumbbell), rest (just date number).
 */
export function WeekCalendar({ doneDates = [], plannedDayIndices = [] }) {
  const weekDates = useMemo(() => getWeekDates(), [])
  const doneSet = useMemo(() => new Set(doneDates), [doneDates])

  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 18 }}>
      {weekDates.map((date, i) => {
        const dateStr = fmt(date)
        const today = isToday(date)
        const done = doneSet.has(dateStr)

        // Determine cell type
        let type = 'rest'
        if (done) type = 'done'
        else if (today) type = 'today'

        const dayNum = date.getDate()
        const isRest = type === 'rest'

        return (
          <div key={i} style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            {/* Weekday label */}
            <span style={{
              fontSize: 9.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: today ? '#fff' : 'rgba(255,255,255,0.55)',
              whiteSpace: 'nowrap',
            }}>
              {today ? 'СЕГОДНЯ' : WEEKDAYS_RU[i]}
            </span>

            {isRest ? (
              /* Rest day — just a number, no circle */
              <div style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1,
                }}>
                  {dayNum}
                </span>
              </div>
            ) : (
              /* Workout day circle */
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...(type === 'today' && {
                  background: '#fff',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                }),
                ...(type === 'done' && {
                  background: 'rgba(255,255,255,0.26)',
                }),
              }}>
                <Icon
                  name="dumbbell"
                  size={15}
                  strokeWidth={2.2}
                  style={{
                    color: type === 'today' ? '#0C9268' : '#fff',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
