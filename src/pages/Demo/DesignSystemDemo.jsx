import { useState } from 'react'
import {
  Glass, Mesh, Button, Icon, StatTile,
  ActivePill, GlassNav, GlassAINote, RestCard,
} from '../../components/ui/index.js'

// ─── Mock data (from BRD §12.1) ─────────────────────────────────────

const mockProgram = {
  name: 'PPL + Arms',
  split: 'Push/Pull/Legs/Arms',
  daysPerWeek: 4,
  difficulty: 'Intermediate',
  nextWorkout: {
    name: 'Day 4 · Shoulders, Arms',
    exerciseCount: 9,
    estimatedMin: 72,
    lastInfo: 'Last — Day 3 · yesterday',
  },
}

const mockMonthStats = {
  workouts: '12',
  tonnage: '202t',
  streak: '16',
  records: '1',
  recentRecord: 'Lat Pulldown Wide · 64→68 kg',
}

const mockRecent = [
  { day: 4, name: 'Shoulders, Arms', when: 'Today' },
  { day: 3, name: 'Legs', when: '2 days ago' },
  { day: 2, name: 'Pull (back, biceps)', when: '3 days ago' },
  { day: 1, name: 'Push (chest, triceps)', when: '5 days ago' },
]

// ─── Phone frame ─────────────────────────────────────────────────────

function PhoneFrame({ label, children }) {
  return (
    <div style={{ flex: '0 0 auto' }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--fg-disabled)', textAlign: 'center', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        width: 380, height: 780,
        background: 'var(--bg-base)',
        borderRadius: 36,
        overflow: 'hidden',
        boxShadow: '0 0 0 6px rgba(22,22,28,0.8), 0 0 0 8px rgba(46,46,58,0.5), 0 24px 80px hsla(var(--accent-h),60%,40%,0.15)',
        position: 'relative',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Programme strip (BRD §12.1 item 2) ──────────────────────────────

function ProgrammeStrip() {
  return (
    <Glass padding="10px 12px" radius={12} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--accent-color-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-color)',
        }}>
          <Icon name="zap" size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{mockProgram.name}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', marginTop: 1 }}>
            {mockProgram.split} · {mockProgram.daysPerWeek} days/week · {mockProgram.difficulty}
          </div>
        </div>
        <Icon name="chevronRight" size={16} style={{ color: 'var(--fg-disabled)' }} />
      </div>
    </Glass>
  )
}

// ─── Hero card — default state (BRD §12.1, default) ──────────────────

function HeroDefault({ onStart }) {
  const nw = mockProgram.nextWorkout
  return (
    <Glass variant="tint" specular padding={16} radius={14}>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 'var(--tracking-caps)',
        textTransform: 'uppercase', color: 'var(--fg-tertiary)', marginBottom: 6,
      }}>NEXT</div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{nw.name}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)', marginTop: 4 }}>{nw.lastInfo}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
        {nw.exerciseCount} exercises · ~{nw.estimatedMin} min
      </div>
      <Button variant="primary" block icon="play" style={{ marginTop: 14 }} onClick={onStart}>
        Start workout
      </Button>
      <div style={{
        textAlign: 'center', marginTop: 8,
        fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', cursor: 'pointer',
      }}>
        Do a different one instead
      </div>
    </Glass>
  )
}

// ─── Hero card — active state (BRD §12.1, active) ────────────────────

function HeroActive({ elapsed, onContinue }) {
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return (
    <Glass variant="tint" specular padding={16} radius={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--success)',
          boxShadow: '0 0 8px var(--success)',
          animation: 'trainerGlassPulse 3.4s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--success)',
        }}>WORKOUT IN PROGRESS</span>
      </div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
        {mockProgram.nextWorkout.name}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)', marginTop: 4 }}>
        Started just now
      </div>
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '12px 0',
        textAlign: 'center', marginTop: 12,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 38, fontWeight: 700,
          color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: 2,
        }}>{mm}:{ss}</div>
      </div>
      <Button variant="accent" block icon="play" style={{ marginTop: 12 }} onClick={onContinue}>
        Continue workout
      </Button>
      <div style={{
        textAlign: 'center', marginTop: 8,
        fontSize: 'var(--text-sm)', color: 'var(--danger)', cursor: 'pointer', opacity: 0.7,
      }}>
        Abort
      </div>
    </Glass>
  )
}

// ─── Year counter header (BRD §12.1 item 1) ─────────────────────────

function YearHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'var(--accent-color-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--accent-color)',
      }}>V</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>47 / 208 workouts</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>2026 goal</div>
        <div style={{
          marginTop: 4, height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: '22.6%', borderRadius: 2,
            background: 'var(--accent-color)',
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── Recent workouts (BRD §12.1 item 5) ──────────────────────────────

function RecentList() {
  return (
    <div>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
        textTransform: 'uppercase', color: 'var(--fg-tertiary)', marginBottom: 8,
      }}>Recent</div>
      <Glass padding={0} radius={12}>
        {mockRecent.map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            borderBottom: i < mockRecent.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg-secondary)',
            }}>{w.day}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{w.name}</div>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)' }}>{w.when}</div>
          </div>
        ))}
      </Glass>
    </div>
  )
}

// ─── Home screen composite ───────────────────────────────────────────

function HomeScreen({ isActive, elapsed }) {
  const [activeNav, setActiveNav] = useState('home')

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Mesh />
      <div style={{
        position: 'relative', zIndex: 1,
        height: '100%', overflowY: 'auto',
        padding: '48px 14px 80px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <YearHeader />
        <ProgrammeStrip />

        {isActive
          ? <HeroActive elapsed={elapsed} onContinue={() => {}} />
          : <HeroDefault onStart={() => {}} />
        }

        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--fg-tertiary)',
        }}>This month</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatTile label="Workouts" value={mockMonthStats.workouts} icon="calendar" />
          <StatTile label="Tonnage" value={mockMonthStats.tonnage} icon="trendingUp" />
          <StatTile label="Streak" value={mockMonthStats.streak} icon="flame" />
          <StatTile label="Records" value={mockMonthStats.records} sub={mockMonthStats.recentRecord} icon="trophy" />
        </div>

        <GlassAINote kind="warning" cta="Rebalance">
          Chest volume 3rd week above limit (22 vs 18 sets). Back is lagging — add 2 sets of rows.
        </GlassAINote>

        <RecentList />
      </div>

      <GlassNav active={activeNav} onNav={setActiveNav} />
    </div>
  )
}

// ─── Rest timer demo ─────────────────────────────────────────────────

function RestTimerDemo() {
  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Mesh />
      <div style={{
        position: 'relative', zIndex: 1,
        height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 14px',
      }}>
        <RestCard seconds={90} onSkip={() => {}} />
      </div>
    </div>
  )
}

// ─── Components showcase ─────────────────────────────────────────────

function ComponentsShowcase() {
  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Mesh />
      <div style={{
        position: 'relative', zIndex: 1,
        height: '100%', overflowY: 'auto',
        padding: '32px 14px 32px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Components</div>

        {/* Buttons */}
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--fg-tertiary)',
        }}>Buttons</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="primary" icon="play">Primary</Button>
          <Button variant="accent" icon="check">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon="x">Danger</Button>
          <Button variant="success" icon="check">Success</Button>
          <Button variant="warning" icon="bell">Warning</Button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <Button variant="accent" block loading>Loading...</Button>

        {/* Glass variants */}
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--fg-tertiary)', marginTop: 8,
        }}>Glass</div>
        <Glass padding={14} radius={12}>
          <div style={{ fontSize: 'var(--text-base)' }}>Glass · default</div>
        </Glass>
        <Glass variant="strong" specular padding={14} radius={12}>
          <div style={{ fontSize: 'var(--text-base)' }}>Glass · strong + specular</div>
        </Glass>
        <Glass variant="tint" specular padding={14} radius={12}>
          <div style={{ fontSize: 'var(--text-base)' }}>Glass · tint + specular</div>
        </Glass>

        {/* AI Notes */}
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--fg-tertiary)', marginTop: 8,
        }}>AI Notes</div>
        <GlassAINote kind="insight" cta="Details">
          Your squat is plateauing — try paused reps at 80% 1RM.
        </GlassAINote>
        <GlassAINote kind="warning">
          Chest volume exceeds weekly limit 3rd week in a row.
        </GlassAINote>
        <GlassAINote kind="success">
          New PR on bench press! 80kg x 8 — up 5kg from last month.
        </GlassAINote>

        {/* Active Pill */}
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--fg-tertiary)', marginTop: 8,
        }}>Active Pill</div>
        <ActivePill name="Day 4 · Shoulders, Arms" mmss="32:15" />

        {/* Icons */}
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase', color: 'var(--fg-tertiary)', marginTop: 8,
        }}>Icons (sample)</div>
        <Glass padding={14} radius={12}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['home','activity','dumbbell','flame','zap','trophy','target','sparkles','camera','messageCircle',
              'chest','back','shoulder','arm','leg','abs','clock','bell','play','check'].map(n => (
              <div key={n} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 44,
              }}>
                <Icon name={n} size={20} style={{ color: 'var(--fg-secondary)' }} />
                <span style={{ fontSize: 8, color: 'var(--fg-tertiary)' }}>{n}</span>
              </div>
            ))}
          </div>
        </Glass>
      </div>
    </div>
  )
}

// ─── Main demo page ──────────────────────────────────────────────────

export default function DesignSystemDemo() {
  const [elapsed, setElapsed] = useState(127)

  // Tick timer for active state demo
  useState(() => {
    const id = setInterval(() => setElapsed(t => t + 1), 1000)
    return () => clearInterval(id)
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 20% 10%, rgba(22,22,28,0.8) 0%, var(--bg-base) 60%)',
      padding: '32px 16px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg-primary)' }}>
          AI Trainer · Glass Design System
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fg-tertiary)', marginTop: 8 }}>
          Live preview of all components in context
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 32, overflowX: 'auto',
        justifyContent: 'center', flexWrap: 'wrap',
        padding: '0 0 32px',
      }}>
        <PhoneFrame label="Home · default">
          <HomeScreen isActive={false} />
        </PhoneFrame>

        <PhoneFrame label="Home · active workout">
          <HomeScreen isActive={true} elapsed={elapsed} />
        </PhoneFrame>

        <PhoneFrame label="Rest timer">
          <RestTimerDemo />
        </PhoneFrame>

        <PhoneFrame label="Components">
          <ComponentsShowcase />
        </PhoneFrame>
      </div>
    </div>
  )
}
