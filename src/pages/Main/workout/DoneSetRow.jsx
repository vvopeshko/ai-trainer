import { useTranslation } from '../../../i18n/useTranslation.js'
import { Icon } from '../../../components/ui/Icon.jsx'
import { SwipeRow } from '../../../components/ui/SwipeRow.jsx'

// ─── DoneSetRow (compact done set inside active card) ────────────────────

export function DoneSetRow({ index, weight, reps, onDelete }) {
  const { t } = useTranslation()
  const content = (
    <div style={{
      padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'hsl(var(--accent-h,158),55%,55%)', color: '#0a1815',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="check" size={11} strokeWidth={3} />
      </div>
      <div style={{
        fontSize: 9, fontWeight: 600, color: 'rgba(236,234,239,0.4)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {t('units.set')} {index + 1}
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13.5, flex: 1,
        fontWeight: 600, color: '#ECEAEF', textAlign: 'right',
      }}>
        {weight} × {reps}
      </span>
    </div>
  )

  if (!onDelete) return content

  return (
    <SwipeRow deleteWidth={56} onDelete={onDelete}>
      {content}
    </SwipeRow>
  )
}
