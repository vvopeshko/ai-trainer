import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Model from 'react-body-highlighter';
import Body from 'react-muscle-highlighter';
import createBodyHighlighter from 'body-highlighter';
import { BodyChart, ViewSide } from 'body-muscles';

// ============================================================================
// ОБЩИЕ ДАННЫЕ
// ============================================================================

const PRESETS = [
  {
    label: 'Грудь + Трицепс',
    primary: ['chest', 'triceps', 'front_delt'],
    secondary: ['side_delt'],
  },
  {
    label: 'Спина + Бицепс',
    primary: ['lats', 'middle_back', 'traps', 'biceps'],
    secondary: ['rear_delt', 'forearms'],
  },
  {
    label: 'Ноги + Кор',
    primary: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
    secondary: ['abdominals', 'obliques', 'adductors'],
  },
  {
    label: 'Push',
    primary: ['chest', 'front_delt', 'side_delt', 'triceps'],
    secondary: [],
  },
  {
    label: 'Pull',
    primary: ['lats', 'middle_back', 'rear_delt', 'biceps'],
    secondary: ['traps', 'forearms'],
  },
];

// Наши мышцы для UI
const ALL_MUSCLES = [
  { id: 'chest', label: 'Грудь' },
  { id: 'front_delt', label: 'Перед. дельта' },
  { id: 'side_delt', label: 'Сред. дельта' },
  { id: 'rear_delt', label: 'Задн. дельта' },
  { id: 'lats', label: 'Широчайшие' },
  { id: 'middle_back', label: 'Середина спины' },
  { id: 'traps', label: 'Трапеции' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'quadriceps', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Задняя поверхность' },
  { id: 'glutes', label: 'Ягодичные' },
  { id: 'calves', label: 'Голени' },
  { id: 'adductors', label: 'Приводящие' },
  { id: 'abdominals', label: 'Пресс' },
  { id: 'obliques', label: 'Косые' },
];

// ============================================================================
// 1. react-body-highlighter
// ============================================================================

const MAP_RBH = {
  chest: 'chest',
  front_delt: 'front-deltoids',
  side_delt: 'front-deltoids',
  rear_delt: 'back-deltoids',
  lats: 'upper-back',
  middle_back: 'upper-back',
  traps: 'trapezius',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  adductors: 'adductor',
  abdominals: 'abs',
  obliques: 'obliques',
};

function ReactBodyHighlighterCard({ primary, secondary, onClick }) {
  const data = useMemo(() => {
    const result = [];
    const mappedPrimary = [...new Set(primary.map(m => MAP_RBH[m]).filter(Boolean))];
    const mappedSecondary = [...new Set(
      secondary.map(m => MAP_RBH[m]).filter(Boolean).filter(m => !mappedPrimary.includes(m))
    )];
    for (let i = 0; i < 3; i++) {
      if (mappedPrimary.length) result.push({ name: `p${i}`, muscles: mappedPrimary });
    }
    if (mappedSecondary.length) result.push({ name: 's', muscles: mappedSecondary });
    return result;
  }, [primary, secondary]);

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <div style={{ width: 120 }}>
        <Model
          data={data}
          style={{ width: '100%', height: 'auto' }}
          highlightedColors={['#3b82f6', '#4ade80', '#4ade80']}
          bodyColor="rgba(255,255,255,0.08)"
          onClick={onClick}
        />
      </div>
      <div style={{ width: 120 }}>
        <Model
          type="posterior"
          data={data}
          style={{ width: '100%', height: 'auto' }}
          highlightedColors={['#3b82f6', '#4ade80', '#4ade80']}
          bodyColor="rgba(255,255,255,0.08)"
          onClick={onClick}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 2. react-muscle-highlighter
// ============================================================================

const MAP_RMH = {
  chest: 'chest',
  front_delt: 'deltoids',
  side_delt: 'deltoids',
  rear_delt: 'deltoids',
  lats: 'upper-back',
  middle_back: 'upper-back',
  traps: 'trapezius',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  adductors: 'adductors',
  abdominals: 'abs',
  obliques: 'obliques',
};

function ReactMuscleHighlighterCard({ primary, secondary, onClick }) {
  const data = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const m of primary) {
      const slug = MAP_RMH[m];
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        result.push({ slug, intensity: 2 });
      }
    }
    for (const m of secondary) {
      const slug = MAP_RMH[m];
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        result.push({ slug, intensity: 1 });
      }
    }
    return result;
  }, [primary, secondary]);

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <div style={{ width: 120 }}>
        <Body
          side="front"
          gender="male"
          data={data}
          colors={['#3b82f6', '#4ade80']}
          border="none"
          defaultFill="rgba(255,255,255,0.08)"
          onBodyPartPress={onClick}
        />
      </div>
      <div style={{ width: 120 }}>
        <Body
          side="back"
          gender="male"
          data={data}
          colors={['#3b82f6', '#4ade80']}
          border="none"
          defaultFill="rgba(255,255,255,0.08)"
          onBodyPartPress={onClick}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 3. body-highlighter (framework-agnostic)
// ============================================================================

// Same mapping as react-body-highlighter (same muscle IDs)
const MAP_BH = MAP_RBH;

function BodyHighlighterCard({ primary, secondary, onClick }) {
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const frontInstance = useRef(null);
  const backInstance = useRef(null);

  const data = useMemo(() => {
    const result = [];
    const mappedPrimary = [...new Set(primary.map(m => MAP_BH[m]).filter(Boolean))];
    const mappedSecondary = [...new Set(
      secondary.map(m => MAP_BH[m]).filter(Boolean).filter(m => !mappedPrimary.includes(m))
    )];
    for (let i = 0; i < 3; i++) {
      if (mappedPrimary.length) result.push({ name: `p${i}`, muscles: mappedPrimary });
    }
    if (mappedSecondary.length) result.push({ name: 's', muscles: mappedSecondary });
    return result;
  }, [primary, secondary]);

  useEffect(() => {
    // Cleanup previous
    if (frontInstance.current) { frontInstance.current.destroy(); frontInstance.current = null; }
    if (backInstance.current) { backInstance.current.destroy(); backInstance.current = null; }

    if (frontRef.current) {
      frontRef.current.innerHTML = '';
      frontInstance.current = createBodyHighlighter({
        container: frontRef.current,
        type: 'anterior',
        data,
        bodyColor: 'rgba(255,255,255,0.08)',
        highlightedColors: ['#3b82f6', '#4ade80', '#4ade80'],
        onClick: onClick ? (stat) => onClick(stat) : undefined,
        style: { width: '100%' },
      });
    }
    if (backRef.current) {
      backRef.current.innerHTML = '';
      backInstance.current = createBodyHighlighter({
        container: backRef.current,
        type: 'posterior',
        data,
        bodyColor: 'rgba(255,255,255,0.08)',
        highlightedColors: ['#3b82f6', '#4ade80', '#4ade80'],
        onClick: onClick ? (stat) => onClick(stat) : undefined,
        style: { width: '100%' },
      });
    }

    return () => {
      if (frontInstance.current) frontInstance.current.destroy();
      if (backInstance.current) backInstance.current.destroy();
    };
  }, [data, onClick]);

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <div ref={frontRef} style={{ width: 120 }} />
      <div ref={backRef} style={{ width: 120 }} />
    </div>
  );
}

// ============================================================================
// 4. body-muscles (framework-agnostic, 70+ muscles)
// ============================================================================

const MAP_BM_PRIMARY = {
  chest: ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
  front_delt: ['shoulder-front-left', 'shoulder-front-right'],
  side_delt: ['shoulder-side-left', 'shoulder-side-right'],
  rear_delt: ['deltoid-rear-left', 'deltoid-rear-right'],
  lats: ['lats-upper-left', 'lats-upper-right', 'lats-mid-left', 'lats-mid-right', 'lats-lower-left', 'lats-lower-right'],
  middle_back: ['spine'],
  traps: ['traps-upper-left', 'traps-upper-right', 'traps-mid-left', 'traps-mid-right'],
  biceps: ['biceps-left', 'biceps-right'],
  triceps: ['triceps-long-left', 'triceps-long-right', 'triceps-lateral-left', 'triceps-lateral-right'],
  forearms: ['forearm-left', 'forearm-right', 'forearm-flexors-left', 'forearm-flexors-right'],
  quadriceps: ['quads-left', 'quads-right'],
  hamstrings: ['hamstrings-medial-left', 'hamstrings-medial-right', 'hamstrings-lateral-left', 'hamstrings-lateral-right'],
  glutes: ['gluteus-maximus-left', 'gluteus-maximus-right', 'gluteus-medius-left', 'gluteus-medius-right'],
  calves: ['calves-gastroc-medial-left', 'calves-gastroc-medial-right', 'calves-gastroc-lateral-left', 'calves-gastroc-lateral-right'],
  adductors: ['adductors-left', 'adductors-right'],
  abdominals: ['abs-upper-left', 'abs-upper-right', 'abs-lower-left', 'abs-lower-right'],
  obliques: ['obliques-left', 'obliques-right'],
};

function BodyMusclesCard({ primary, secondary, onClick }) {
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const frontChart = useRef(null);
  const backChart = useRef(null);

  const bodyState = useMemo(() => {
    const state = {};
    for (const m of primary) {
      const parts = MAP_BM_PRIMARY[m] || [];
      for (const p of parts) {
        state[p] = { intensity: 7, selected: false };
      }
    }
    for (const m of secondary) {
      const parts = MAP_BM_PRIMARY[m] || [];
      for (const p of parts) {
        if (!state[p]) {
          state[p] = { intensity: 3, selected: false };
        }
      }
    }
    return state;
  }, [primary, secondary]);

  useEffect(() => {
    if (frontChart.current) { frontChart.current.destroy(); frontChart.current = null; }
    if (backChart.current) { backChart.current.destroy(); backChart.current = null; }

    if (frontRef.current) {
      frontRef.current.innerHTML = '';
      try {
        frontChart.current = new BodyChart(frontRef.current, {
          view: ViewSide.FRONT,
          bodyState,
          onMuscleClick: onClick ? (id, name) => onClick({ muscle: id, name }) : undefined,
          enableTransitions: true,
        });
      } catch (e) {
        console.warn('body-muscles front error:', e);
      }
    }
    if (backRef.current) {
      backRef.current.innerHTML = '';
      try {
        backChart.current = new BodyChart(backRef.current, {
          view: ViewSide.BACK,
          bodyState,
          onMuscleClick: onClick ? (id, name) => onClick({ muscle: id, name }) : undefined,
          enableTransitions: true,
        });
      } catch (e) {
        console.warn('body-muscles back error:', e);
      }
    }

    return () => {
      if (frontChart.current) frontChart.current.destroy();
      if (backChart.current) backChart.current.destroy();
    };
  }, [bodyState, onClick]);

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <div ref={frontRef} style={{ width: 120, height: 260 }} />
      <div ref={backRef} style={{ width: 120, height: 260 }} />
    </div>
  );
}

// ============================================================================
// UI HELPERS
// ============================================================================

function Chip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (color || 'rgba(255,255,255,0.15)') : '#1a1b22',
        border: active
          ? `1.5px solid ${color || 'rgba(255,255,255,0.3)'}`
          : '1px solid rgba(255,255,255,0.08)',
        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
        padding: '5px 10px',
        borderRadius: 7,
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function LibCard({ title, subtitle, children, badge, notes }) {
  return (
    <div style={{
      background: '#13141a',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              background: badge.bg, color: badge.color,
            }}>
              {badge.text}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{subtitle}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        {children}
      </div>

      {notes && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, lineHeight: 1.6,
          color: 'rgba(255,255,255,0.45)',
        }}>
          {notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function BodyMapComparison() {
  const [primary, setPrimary] = useState(['chest', 'triceps', 'front_delt']);
  const [secondary, setSecondary] = useState(['side_delt']);
  const [clicked, setClicked] = useState(null);

  const toggleMuscle = useCallback((muscleId, type) => {
    const setter = type === 'primary' ? setPrimary : setSecondary;
    const otherSetter = type === 'primary' ? setSecondary : setPrimary;
    setter(prev => prev.includes(muscleId) ? prev.filter(m => m !== muscleId) : [...prev, muscleId]);
    otherSetter(prev => prev.filter(m => m !== muscleId));
  }, []);

  const handleClick = useCallback((data) => {
    const label = data?.muscle || data?.slug || '?';
    setClicked(String(label));
    setTimeout(() => setClicked(null), 2000);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      padding: '20px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
        }}>
          Сравнение библиотек
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
          Body Map: 4 варианта реализации
        </h1>
      </div>

      {/* Controls */}
      <div style={{
        background: '#13141a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: 16, marginBottom: 20,
      }}>
        {/* Presets */}
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8,
        }}>
          Пресеты
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {PRESETS.map(p => (
            <Chip key={p.label} label={p.label} onClick={() => { setPrimary([...p.primary]); setSecondary([...p.secondary]); }} />
          ))}
        </div>

        {/* Primary */}
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8,
        }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#4ade80', marginRight: 6, verticalAlign: 'middle' }} />
          Primary
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {ALL_MUSCLES.map(m => (
            <Chip key={m.id} label={m.label} active={primary.includes(m.id)} color="rgba(74,222,128,0.25)" onClick={() => toggleMuscle(m.id, 'primary')} />
          ))}
        </div>

        {/* Secondary */}
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 8,
        }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#3b82f6', marginRight: 6, verticalAlign: 'middle' }} />
          Secondary
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {ALL_MUSCLES.map(m => (
            <Chip key={m.id} label={m.label} active={secondary.includes(m.id)} color="rgba(59,130,246,0.25)" onClick={() => toggleMuscle(m.id, 'secondary')} />
          ))}
        </div>
      </div>

      {/* Click feedback */}
      {clicked && (
        <div style={{
          marginBottom: 12, padding: '8px 14px',
          background: 'rgba(255,255,255,0.06)', borderRadius: 8,
          fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center',
        }}>
          Клик → <strong>{clicked}</strong>
        </div>
      )}

      {/* 4 cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <LibCard
          title="react-body-highlighter"
          subtitle="v2.0.5 · React · ~168 KB"
          badge={{ text: 'ТЕКУЩАЯ', bg: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
          notes={[
            '✓ Самая популярная (400+ stars)',
            '✗ Нет верх/низ груди, нет средней дельты',
            '✗ Нет intensity API — хак через frequency',
            '✗ Primary/secondary — один набор цветов',
          ]}
        >
          <ReactBodyHighlighterCard primary={primary} secondary={secondary} onClick={handleClick} />
        </LibCard>

        <LibCard
          title="react-muscle-highlighter"
          subtitle="v1.2.0 · React · slug-based"
          notes={[
            '✓ slug + intensity из коробки',
            '✓ Male/female модели',
            '✓ Per-part color/style',
            '✗ Те же ограничения по мышцам (~23)',
            '✗ 15 stars, low adoption',
          ]}
        >
          <ReactMuscleHighlighterCard primary={primary} secondary={secondary} onClick={handleClick} />
        </LibCard>

        <LibCard
          title="body-highlighter"
          subtitle="v3.0.2 · Vanilla JS · fork"
          notes={[
            '✓ Framework-agnostic, zero deps',
            '✓ Тот же SVG что react-body-highlighter',
            '✓ .update() / .destroy() API',
            '✗ Те же мышцы (~22)',
            '✗ 0 stars, свежий проект',
          ]}
        >
          <BodyHighlighterCard primary={primary} secondary={secondary} onClick={handleClick} />
        </LibCard>

        <LibCard
          title="body-muscles"
          subtitle="v1.0.0 · Vanilla JS · 70+ мышц"
          badge={{ text: '70+ МЫШЦ', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
          notes={[
            '✓ 70+ анатомических зон',
            '✓ Верх/низ груди, 3 дельты, lats отдельно',
            '✓ Intensity 0-10, hover, transitions',
            '✓ Zero deps, 29 KB',
            '✗ 1 star, свежий проект',
            '✗ Свои ID мышц → маппинг больше',
          ]}
        >
          <BodyMusclesCard primary={primary} secondary={secondary} onClick={handleClick} />
        </LibCard>
      </div>

      {/* Comparison table */}
      <div style={{
        background: '#13141a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: 20,
      }}>
        <h3 style={{ fontSize: 15, margin: '0 0 14px' }}>Сравнение</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={th}>Аспект</th>
                <th style={th}>react-body-highlighter</th>
                <th style={th}>react-muscle-highlighter</th>
                <th style={th}>body-highlighter</th>
                <th style={th}>body-muscles</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_DATA.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...td, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{row.aspect}</td>
                  {row.values.map((v, j) => (
                    <td key={j} style={{ ...td, color: v.startsWith('✓') ? '#86efac' : v.startsWith('✗') ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { textAlign: 'left', padding: '8px 8px', fontSize: 11, whiteSpace: 'nowrap' };
const td = { padding: '8px 8px', verticalAlign: 'top' };

const TABLE_DATA = [
  { aspect: 'Фреймворк', values: ['React', 'React', 'Vanilla JS', 'Vanilla JS'] },
  { aspect: 'Мышц', values: ['~20', '~23', '~22', '✓ 70+'] },
  { aspect: 'Верх/низ груди', values: ['✗ Нет', '✗ Нет', '✗ Нет', '✓ Есть'] },
  { aspect: '3 пучка дельт', values: ['✗ front/back', '✗ 1 slug', '✗ front/back', '✓ front/side/rear'] },
  { aspect: 'Lats отдельно', values: ['✗ upper-back', '✗ upper-back', '✗ upper-back', '✓ 6 зон lats'] },
  { aspect: 'Intensity API', values: ['✗ Хак frequency', '✓ 1-N', '✗ Хак frequency', '✓ 0-10 шкала'] },
  { aspect: 'Primary/Secondary', values: ['✗ Один набор', '✓ Per-part color', '✗ Один набор', '✓ Per-part intensity'] },
  { aspect: 'Male/Female', values: ['✗', '✓', '✗', '✗'] },
  { aspect: 'onClick', values: ['✓', '✓', '✓', '✓'] },
  { aspect: 'onHover', values: ['✗', '✗', '✗', '✓'] },
  { aspect: 'Transitions', values: ['✗', '✗', '✗', '✓'] },
  { aspect: 'Размер', values: ['~168 KB', 'Лёгкий', 'Минимальный', '~29 KB'] },
  { aspect: 'GitHub stars', values: ['400+', '15', '0', '1'] },
  { aspect: 'Зависимости', values: ['React', 'React', '0', '0'] },
];
