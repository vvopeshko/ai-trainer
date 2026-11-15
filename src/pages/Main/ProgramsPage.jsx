/**
 * ProgramsPage — «Мои программы»: активная программа, остальные, переключение
 * и действия (переименовать, дублировать, удалить).
 *
 * Route: /programs. Данные — общий список программ (queryKeys.programs.list)
 * со сводкой плана от сервера.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useProgramList } from '../../hooks/queries.js'
import { useActivateProgram, useRenameProgram, useDuplicateProgram, useDeleteProgram } from '../../hooks/mutations.js'
import { Glass } from '../../components/ui/Glass.jsx'
import { Icon } from '../../components/ui/Icon.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { BottomSheet } from '../../components/ui/BottomSheet.jsx'
import TopBar from '../../components/ui/TopBar.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { topMuscleGroups } from './program/programHelpers.js'

const ACCENT = 'hsl(var(--accent-h,158),55%,72%)'
const sectionTitleStyle = {
  fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 'var(--tracking-caps)',
  textTransform: 'uppercase', color: 'var(--fg-tertiary)', margin: '0 0 var(--space-3)',
}

function ProgramCard({ program, onOpen, onMenu, onActivate, activating }) {
  const { t } = useTranslation()
  const muscles = topMuscleGroups(program.muscleSets)
  const months = t('home.monthsShort').split(',')
  const last = program.lastWorkoutAt ? new Date(program.lastWorkoutAt) : null
  const hasSummary = program.daysCount != null

  return (
    <Glass
      flat={!program.isActive}
      padding={0}
      style={{
        marginBottom: 'var(--space-3)', overflow: 'hidden',
        ...(program.isActive && { background: 'linear-gradient(160deg, hsla(var(--accent-h,158),40%,18%,0.55) 0%, transparent 50%), var(--surface-0)' }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            flex: 1, minWidth: 0, display: 'flex', gap: 'var(--space-3)', textAlign: 'left',
            padding: 'var(--space-4)', paddingRight: 0,
            background: 'none', border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: program.isActive ? 'hsla(var(--accent-h,158),40%,30%,0.4)' : 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: program.isActive ? ACCENT : 'var(--fg-disabled)',
          }}>
            <Icon name="zap" size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--fg-primary)', overflowWrap: 'anywhere' }}>
              {program.name}
            </div>
            {hasSummary && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
                {t('program.nDays', { n: program.daysCount })}
                {' · '}{t('program.nExercises', { n: program.exercisesCount })}
                {' · '}{t('programs.nSets', { n: program.setsCount })}
              </div>
            )}
            {muscles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                {muscles.map(m => (
                  <span key={m.label} style={{
                    padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)',
                    fontSize: 'var(--text-xs)', color: 'var(--fg-secondary)', whiteSpace: 'nowrap',
                  }}>
                    {m.label} <span style={{ color: 'var(--fg-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{m.sets}</span>
                  </span>
                ))}
              </div>
            )}
            {hasSummary && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginTop: 'var(--space-2)' }}>
                {last
                  ? t('programs.lastWorkout', { date: `${last.getDate()} ${months[last.getMonth()]}`, n: program.workoutsCount })
                  : t('programs.noWorkouts')}
              </div>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onMenu}
          aria-label={t('programs.actionsFor', { name: program.name })}
          style={{
            width: 44, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: 'var(--fg-tertiary)', cursor: 'pointer',
          }}
        >
          <Icon name="moreHorizontal" size={18} />
        </button>
      </div>
      {onActivate && (
        <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
          <Button variant="secondary" size="md" onClick={onActivate} disabled={activating} style={{ width: '100%' }}>
            {activating ? t('program.activating') : t('program.activate')}
          </Button>
        </div>
      )}
    </Glass>
  )
}

function MenuRow({ icon, label, danger, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '14px 0',
        background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)',
        font: 'inherit', fontSize: 'var(--text-sm)', textAlign: 'left', cursor: 'pointer',
        color: danger ? 'var(--danger)' : 'var(--fg-primary)',
      }}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  )
}

export default function ProgramsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: programs, isPending, isError } = useProgramList()
  const activate = useActivateProgram()
  const rename = useRenameProgram()
  const duplicate = useDuplicateProgram()
  const remove = useDeleteProgram()

  const [menuFor, setMenuFor] = useState(null) // программа, для которой открыто меню
  const [confirmActivate, setConfirmActivate] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, name }

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  const onError = () => toast.show(t('errors.network'))

  const active = programs?.find(p => p.isActive)
  const others = programs?.filter(p => !p.isActive) ?? []

  const handleActivate = () => {
    const program = confirmActivate
    setConfirmActivate(null)
    activate.mutate(program.id, {
      onSuccess: () => toast.show(t('programs.activated', { name: program.name }), 'success'),
      onError,
    })
  }
  const handleDuplicate = (program) => {
    setMenuFor(null)
    duplicate.mutate({ id: program.id, name: t('programs.copyName', { name: program.name }).slice(0, 100) }, {
      onSuccess: () => toast.show(t('programs.duplicated'), 'success'),
      onError,
    })
  }
  const handleDelete = () => {
    const program = confirmDelete
    setConfirmDelete(null)
    remove.mutate(program.id, { onSuccess: () => toast.show(t('programs.deleted'), 'success'), onError })
  }
  const newName = renaming?.name.trim() ?? ''
  const handleRename = () => {
    if (!newName) return
    rename.mutate({ id: renaming.id, name: newName }, { onSuccess: () => setRenaming(null), onError })
  }

  const card = (program) => (
    <ProgramCard
      key={program.id}
      program={program}
      onOpen={() => navigate('/program/' + program.id)}
      onMenu={() => setMenuFor(program)}
      onActivate={program.isActive ? undefined : () => setConfirmActivate(program)}
      activating={activate.isPending && activate.variables === program.id}
    />
  )

  return (
    <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>
      <TopBar title={t('programs.title')} onBack={goBack} style={{ paddingTop: 'var(--safe-top, 0px)' }} />

      <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
        {isPending && [0, 1, 2].map(i => (
          <Glass key={i} flat style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
            <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={12} />
          </Glass>
        ))}

        {isError && !programs && (
          <div style={{ padding: 'var(--space-8) 0', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)' }}>
            {t('programs.loadError')}
          </div>
        )}

        {programs?.length === 0 && (
          <div style={{ padding: 'var(--space-8) 0', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)' }}>
            {t('programs.empty')}
          </div>
        )}

        {active && (
          <section style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={sectionTitleStyle}>{t('programs.activeSection')}</h2>
            {card(active)}
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 style={sectionTitleStyle}>{t(active ? 'programs.otherSection' : 'programs.allSection')}</h2>
            {others.map(card)}
          </section>
        )}
      </div>

      {/* ── Меню программы ── */}
      <BottomSheet open={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 'var(--space-3)', overflowWrap: 'anywhere' }}>
              {menuFor.name}
            </div>
            <MenuRow icon="chevronRight" label={t('programs.open')} onClick={() => navigate('/program/' + menuFor.id)} />
            <MenuRow icon="pen" label={t('programs.rename')} onClick={() => { setRenaming({ id: menuFor.id, name: menuFor.name }); setMenuFor(null) }} />
            <MenuRow icon="plus" label={t('programs.duplicate')} onClick={() => handleDuplicate(menuFor)} />
            {menuFor.isActive ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', padding: 'var(--space-3) 0 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {t('programs.deleteActiveHint')}
              </div>
            ) : (
              <MenuRow icon="trash" label={t('programs.delete')} danger onClick={() => { setConfirmDelete(menuFor); setMenuFor(null) }} />
            )}
          </>
        )}
      </BottomSheet>

      {/* ── Переименование ── */}
      <BottomSheet open={!!renaming} onClose={() => setRenaming(null)}>
        {renaming && (
          <form onSubmit={e => { e.preventDefault(); handleRename() }}>
            <label htmlFor="program-name" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)', marginBottom: 'var(--space-2)' }}>
              {t('programs.nameLabel')}
            </label>
            <input
              id="program-name"
              type="text"
              value={renaming.name}
              maxLength={100}
              onChange={e => setRenaming({ ...renaming, name: e.target.value })}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px', marginBottom: 'var(--space-4)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                font: 'inherit', fontSize: 'var(--text-base)', color: 'var(--fg-primary)', outline: 'none',
              }}
            />
            <Button type="submit" variant="primary" size="lg" disabled={!newName || rename.isPending} style={{ width: '100%' }}>
              {t('program.save')}
            </Button>
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!confirmActivate}
        title={t('programs.activateTitle', { name: confirmActivate?.name })}
        message={t('programs.activateMessage')}
        confirmLabel={t('program.activate')}
        onConfirm={handleActivate}
        onCancel={() => setConfirmActivate(null)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('programs.deleteTitle', { name: confirmDelete?.name })}
        message={t('programs.deleteMessage')}
        confirmLabel={t('programs.delete')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
