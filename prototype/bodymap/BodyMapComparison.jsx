import React, { useState, useMemo } from 'react';
import Model from 'react-body-highlighter';

// ============================================================================
// БАЗА УПРАЖНЕНИЙ
// ============================================================================
// Каждое упражнение → primary и secondary мышцы.
// Идентификаторы здесь — это наши внутренние названия, потом мапим в формат
// react-body-highlighter.

const exerciseDatabase = {
  // День 1
  'Жим в Смите наклонный': { primary: ['upper-chest'], secondary: ['front-delts', 'triceps'] },
  'Жим гантелей лёжа': { primary: ['mid-chest'], secondary: ['front-delts', 'triceps'] },
  'Бабочка в тренажёре': { primary: ['mid-chest'], secondary: [] },
  'Кроссовер снизу-вверх': { primary: ['upper-chest'], secondary: [] },
  'Разгибания с канатом из-за головы': { primary: ['triceps'], secondary: [] },
  'Разгибания на блоке вниз': { primary: ['triceps'], secondary: [] },
  'Махи в тренажёре': { primary: ['side-delts'], secondary: [] },

  // День 2
  'Подтягивания': { primary: ['lats'], secondary: ['biceps', 'mid-back'] },
  'Тяга гантели в упоре': { primary: ['mid-back'], secondary: ['lats', 'biceps'] },
  'Тяга нижнего блока сидя': { primary: ['mid-back'], secondary: ['lats', 'biceps'] },
  'Тяга верхнего блока узким': { primary: ['lats'], secondary: ['biceps'] },
  'Тяга на прямых руках': { primary: ['lats'], secondary: [] },
  'Обратные разводки (pec-deck)': { primary: ['rear-delts'], secondary: ['mid-back'] },
  'Сгибания с гантелями на наклонной': { primary: ['biceps'], secondary: ['forearms'] },
  'Молотки': { primary: ['biceps'], secondary: ['forearms'] },

  // День 3
  'Жим ногами': { primary: ['quads'], secondary: ['glutes', 'hamstrings'] },
  'Болгарские выпады': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'Ягодичный мост': { primary: ['glutes'], secondary: ['hamstrings'] },
  'Разгибания ног сидя': { primary: ['quads'], secondary: [] },
  'Сгибания ног лёжа': { primary: ['hamstrings'], secondary: [] },
  'Гиперэкстензии 45°': { primary: ['hamstrings', 'glutes'], secondary: ['lower-back'] },
  'Подъёмы на носки стоя': { primary: ['calves'], secondary: [] },
  'Подъёмы на носки сидя': { primary: ['calves'], secondary: [] },
  'Палоф-пресс': { primary: ['obliques'], secondary: ['abs'] },
  'Прогулка с гирей': { primary: ['obliques'], secondary: ['traps', 'forearms'] },

  // День 4
  'Жим гантелей на наклонной': { primary: ['upper-chest'], secondary: ['front-delts', 'triceps'] },
  'Жим в тренажёре сидя': { primary: ['mid-chest'], secondary: ['front-delts', 'triceps'] },
  'Подтягивания обратным хватом': { primary: ['lats'], secondary: ['biceps'] },
  'Тяга в Т-грифе с упором': { primary: ['mid-back'], secondary: ['lats', 'biceps'] },
  'Жим гантелей сидя': { primary: ['front-delts'], secondary: ['side-delts', 'triceps'] },
  'Махи на блоке одной рукой': { primary: ['side-delts'], secondary: [] },
  'Фейс-пул': { primary: ['rear-delts'], secondary: ['traps'] },
  'Сгибания в блоке': { primary: ['biceps'], secondary: [] },
};

const workouts = [
  {
    id: 1, name: 'Грудь + Трицепс', subtitle: 'День 1', duration: '~75 мин',
    exercises: [
      { name: 'Жим в Смите наклонный', sets: 4 },
      { name: 'Жим гантелей лёжа', sets: 3 },
      { name: 'Бабочка в тренажёре', sets: 3 },
      { name: 'Кроссовер снизу-вверх', sets: 3 },
      { name: 'Разгибания с канатом из-за головы', sets: 3 },
      { name: 'Разгибания на блоке вниз', sets: 3 },
      { name: 'Махи в тренажёре', sets: 4 },
    ],
  },
  {
    id: 2, name: 'Спина + Бицепс', subtitle: 'День 2', duration: '~75 мин',
    exercises: [
      { name: 'Подтягивания', sets: 4 },
      { name: 'Тяга гантели в упоре', sets: 3 },
      { name: 'Тяга нижнего блока сидя', sets: 3 },
      { name: 'Тяга верхнего блока узким', sets: 3 },
      { name: 'Тяга на прямых руках', sets: 3 },
      { name: 'Обратные разводки (pec-deck)', sets: 4 },
      { name: 'Сгибания с гантелями на наклонной', sets: 3 },
      { name: 'Молотки', sets: 2 },
    ],
  },
  {
    id: 3, name: 'Ноги + Кор', subtitle: 'День 3', duration: '~70 мин',
    exercises: [
      { name: 'Жим ногами', sets: 3 },
      { name: 'Болгарские выпады', sets: 3 },
      { name: 'Ягодичный мост', sets: 3 },
      { name: 'Разгибания ног сидя', sets: 3 },
      { name: 'Сгибания ног лёжа', sets: 3 },
      { name: 'Гиперэкстензии 45°', sets: 3 },
      { name: 'Подъёмы на носки стоя', sets: 3 },
      { name: 'Подъёмы на носки сидя', sets: 2 },
      { name: 'Палоф-пресс', sets: 3 },
      { name: 'Прогулка с гирей', sets: 2 },
    ],
  },
  {
    id: 4, name: 'Грудь + Спина + Плечи', subtitle: 'День 4', duration: '~75 мин',
    exercises: [
      { name: 'Жим гантелей на наклонной', sets: 3 },
      { name: 'Жим в тренажёре сидя', sets: 3 },
      { name: 'Подтягивания обратным хватом', sets: 3 },
      { name: 'Тяга в Т-грифе с упором', sets: 3 },
      { name: 'Жим гантелей сидя', sets: 3 },
      { name: 'Махи на блоке одной рукой', sets: 3 },
      { name: 'Фейс-пул', sets: 3 },
      { name: 'Сгибания в блоке', sets: 3 },
    ],
  },
];

// ============================================================================
// МАППИНГ для react-body-highlighter
// ============================================================================
// Особенности:
// - 'chest' у них целиком (нет разделения верх/середина)
// - дельты только 'front-deltoids' / 'back-deltoids' (нет средней)
// - 'upper-back' покрывает и широчайшие, и середину спины

const mapToLib = {
  'upper-chest': 'chest',
  'mid-chest': 'chest',
  'front-delts': 'front-deltoids',
  'side-delts': 'front-deltoids',
  'rear-delts': 'back-deltoids',
  'lats': 'upper-back',
  'mid-back': 'upper-back',
  'lower-back': 'lower-back',
  'traps': 'trapezius',
  'biceps': 'biceps',
  'triceps': 'triceps',
  'forearms': 'forearm',
  'abs': 'abs',
  'obliques': 'obliques',
  'quads': 'quadriceps',
  'hamstrings': 'hamstring',
  'glutes': 'gluteal',
  'calves': 'calves',
};

// Готовим данные для react-body-highlighter. Чтобы получить градиент
// интенсивности, дублируем упражнение по числу подходов: библиотека
// агрегирует по частоте упоминания мышцы.
function getLibData(workout) {
  const result = [];
  workout.exercises.forEach((ex) => {
    const db = exerciseDatabase[ex.name];
    if (!db) return;

    const primary = db.primary.map((m) => mapToLib[m]).filter(Boolean);
    const secondary = db.secondary.map((m) => mapToLib[m]).filter(Boolean);

    for (let i = 0; i < ex.sets; i++) {
      result.push({ name: ex.name, muscles: primary });
    }
    if (secondary.length > 0) {
      result.push({ name: ex.name + ' (вспом.)', muscles: secondary });
    }
  });
  return result;
}

// ============================================================================
// САМОПИСНЫЙ SVG
// ============================================================================

function calculateMuscleVolume(workout) {
  const volumes = {};
  workout.exercises.forEach((ex) => {
    const db = exerciseDatabase[ex.name];
    if (!db) return;
    db.primary.forEach((m) => { volumes[m] = (volumes[m] || 0) + ex.sets * 1.0; });
    db.secondary.forEach((m) => { volumes[m] = (volumes[m] || 0) + ex.sets * 0.4; });
  });
  return volumes;
}

function getIntensity(volume) {
  if (!volume || volume < 1) return 0;
  if (volume < 4) return 1;
  if (volume < 8) return 2;
  return 3;
}

const intensityColors = {
  0: 'rgba(255,255,255,0.06)',
  1: 'rgba(96,165,250,0.35)',
  2: 'rgba(96,165,250,0.65)',
  3: 'rgba(96,165,250,1)',
};

function CustomBodyMap({ volumes }) {
  const fill = (muscle) => intensityColors[getIntensity(volumes[muscle])];

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {/* Front view */}
      <svg viewBox="0 0 120 280" style={{ width: '50%', maxWidth: '120px' }}>
        <g fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5">
          <circle cx="60" cy="20" r="12" />
          <rect x="55" y="30" width="10" height="8" />
          <path d="M 35 40 Q 30 70 32 110 Q 35 140 38 160 L 82 160 Q 85 140 88 110 Q 90 70 85 40 Z" />
          <path d="M 35 42 Q 22 60 18 90 Q 16 115 20 140 L 28 140 Q 30 115 32 90 Q 33 65 38 45 Z" />
          <path d="M 85 42 Q 98 60 102 90 Q 104 115 100 140 L 92 140 Q 90 115 88 90 Q 87 65 82 45 Z" />
          <path d="M 18 140 Q 16 165 20 185 L 28 185 Q 30 165 28 140 Z" />
          <path d="M 102 140 Q 104 165 100 185 L 92 185 Q 90 165 92 140 Z" />
          <path d="M 40 160 Q 38 200 42 240 L 56 240 Q 58 200 56 160 Z" />
          <path d="M 80 160 Q 82 200 78 240 L 64 240 Q 62 200 64 160 Z" />
          <path d="M 42 240 Q 40 260 44 275 L 54 275 Q 56 260 56 240 Z" />
          <path d="M 78 240 Q 80 260 76 275 L 66 275 Q 64 260 64 240 Z" />
        </g>
        <path d="M 40 48 Q 50 46 58 50 L 58 58 Q 50 56 40 58 Z" fill={fill('upper-chest')} />
        <path d="M 62 50 Q 70 46 80 48 L 80 58 Q 70 56 62 58 Z" fill={fill('upper-chest')} />
        <path d="M 40 58 Q 50 62 58 60 L 58 75 Q 50 78 40 76 Z" fill={fill('mid-chest')} />
        <path d="M 62 60 Q 70 62 80 58 L 80 76 Q 70 78 62 75 Z" fill={fill('mid-chest')} />
        <ellipse cx="36" cy="48" rx="6" ry="8" fill={fill('front-delts')} />
        <ellipse cx="84" cy="48" rx="6" ry="8" fill={fill('front-delts')} />
        <ellipse cx="30" cy="52" rx="4" ry="9" fill={fill('side-delts')} />
        <ellipse cx="90" cy="52" rx="4" ry="9" fill={fill('side-delts')} />
        <ellipse cx="27" cy="75" rx="6" ry="14" fill={fill('biceps')} />
        <ellipse cx="93" cy="75" rx="6" ry="14" fill={fill('biceps')} />
        <ellipse cx="24" cy="115" rx="6" ry="16" fill={fill('forearms')} />
        <ellipse cx="96" cy="115" rx="6" ry="16" fill={fill('forearms')} />
        <path d="M 50 80 L 70 80 L 68 130 L 52 130 Z" fill={fill('abs')} />
        <path d="M 40 82 L 50 80 L 52 130 L 42 128 Z" fill={fill('obliques')} />
        <path d="M 70 80 L 80 82 L 78 128 L 68 130 Z" fill={fill('obliques')} />
        <ellipse cx="48" cy="195" rx="9" ry="28" fill={fill('quads')} />
        <ellipse cx="72" cy="195" rx="9" ry="28" fill={fill('quads')} />
        <ellipse cx="49" cy="255" rx="6" ry="15" fill={fill('calves')} />
        <ellipse cx="71" cy="255" rx="6" ry="15" fill={fill('calves')} />
      </svg>
      {/* Back view */}
      <svg viewBox="0 0 120 280" style={{ width: '50%', maxWidth: '120px' }}>
        <g fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5">
          <circle cx="60" cy="20" r="12" />
          <rect x="55" y="30" width="10" height="8" />
          <path d="M 35 40 Q 30 70 32 110 Q 35 140 38 160 L 82 160 Q 85 140 88 110 Q 90 70 85 40 Z" />
          <path d="M 35 42 Q 22 60 18 90 Q 16 115 20 140 L 28 140 Q 30 115 32 90 Q 33 65 38 45 Z" />
          <path d="M 85 42 Q 98 60 102 90 Q 104 115 100 140 L 92 140 Q 90 115 88 90 Q 87 65 82 45 Z" />
          <path d="M 18 140 Q 16 165 20 185 L 28 185 Q 30 165 28 140 Z" />
          <path d="M 102 140 Q 104 165 100 185 L 92 185 Q 90 165 92 140 Z" />
          <path d="M 40 160 Q 38 200 42 240 L 56 240 Q 58 200 56 160 Z" />
          <path d="M 80 160 Q 82 200 78 240 L 64 240 Q 62 200 64 160 Z" />
          <path d="M 42 240 Q 40 260 44 275 L 54 275 Q 56 260 56 240 Z" />
          <path d="M 78 240 Q 80 260 76 275 L 66 275 Q 64 260 64 240 Z" />
        </g>
        <path d="M 50 40 L 70 40 L 75 60 L 60 65 L 45 60 Z" fill={fill('traps')} />
        <ellipse cx="35" cy="50" rx="6" ry="8" fill={fill('rear-delts')} />
        <ellipse cx="85" cy="50" rx="6" ry="8" fill={fill('rear-delts')} />
        <path d="M 45 60 L 75 60 L 73 90 L 47 90 Z" fill={fill('mid-back')} />
        <path d="M 40 65 L 50 80 L 48 115 L 36 115 Z" fill={fill('lats')} />
        <path d="M 80 65 L 70 80 L 72 115 L 84 115 Z" fill={fill('lats')} />
        <path d="M 50 115 L 70 115 L 68 140 L 52 140 Z" fill={fill('lower-back')} />
        <ellipse cx="27" cy="78" rx="6" ry="16" fill={fill('triceps')} />
        <ellipse cx="93" cy="78" rx="6" ry="16" fill={fill('triceps')} />
        <ellipse cx="50" cy="165" rx="10" ry="14" fill={fill('glutes')} />
        <ellipse cx="70" cy="165" rx="10" ry="14" fill={fill('glutes')} />
        <ellipse cx="48" cy="200" rx="9" ry="22" fill={fill('hamstrings')} />
        <ellipse cx="72" cy="200" rx="9" ry="22" fill={fill('hamstrings')} />
        <ellipse cx="49" cy="252" rx="6" ry="16" fill={fill('calves')} />
        <ellipse cx="71" cy="252" rx="6" ry="16" fill={fill('calves')} />
      </svg>
    </div>
  );
}

// ============================================================================
// react-body-highlighter Wrapper
// ============================================================================

function LibBodyMap({ workout }) {
  const data = useMemo(() => getLibData(workout), [workout]);

  // Кастомные цвета — от самого светлого к самому насыщенному синему
  const customColors = ['#3b82f6', '#1d4ed8'];

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ width: '50%', maxWidth: '140px' }}>
        <Model
          data={data}
          style={{ width: '100%', height: 'auto' }}
          highlightedColors={customColors}
          bodyColor="rgba(255,255,255,0.1)"
        />
      </div>
      <div style={{ width: '50%', maxWidth: '140px' }}>
        <Model
          type="posterior"
          data={data}
          style={{ width: '100%', height: 'auto' }}
          highlightedColors={customColors}
          bodyColor="rgba(255,255,255,0.1)"
        />
      </div>
    </div>
  );
}

// ============================================================================
// КАРТОЧКА ТРЕНИРОВКИ
// ============================================================================

function WorkoutCard({ workout }) {
  const volumes = useMemo(() => calculateMuscleVolume(workout), [workout]);
  const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets, 0);

  return (
    <div style={{
      background: '#13141a',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{workout.subtitle}</div>
          <div style={{ fontSize: '20px', fontWeight: '600' }}>{workout.name}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
          <div>{workout.duration}</div>
          <div>{totalSets} подх.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center',
            marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Самописный SVG
          </div>
          <CustomBodyMap volumes={volumes} />
        </div>
        <div>
          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center',
            marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            react-body-highlighter
          </div>
          <LibBodyMap workout={workout} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================================

export default function BodyMapComparison() {
  const [selectedId, setSelectedId] = useState(1);
  const selectedWorkout = workouts.find((w) => w.id === selectedId);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      padding: '24px',
      maxWidth: '800px',
      margin: '0 auto',
    }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          fontSize: '12px', color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Сравнение библиотек body-highlighter
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '600', margin: '4px 0 0 0' }}>
          Body Map: самописный vs react-body-highlighter
        </h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {workouts.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedId(w.id)}
            style={{
              background: selectedId === w.id ? 'rgba(96,165,250,0.2)' : '#13141a',
              border: selectedId === w.id ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.06)',
              color: '#fff', padding: '10px 16px', borderRadius: '10px',
              fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {w.subtitle}: {w.name}
          </button>
        ))}
      </div>

      <WorkoutCard workout={selectedWorkout} />

      <div style={{
        background: '#13141a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '20px', marginTop: '24px',
      }}>
        <h3 style={{ fontSize: '15px', margin: '0 0 16px 0' }}>Сравнение по характеристикам</h3>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Аспект</th>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Самописный</th>
              <th style={{ textAlign: 'left', padding: '8px 6px' }}>Библиотека</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.8)' }}>Анатомия</td>
              <td style={{ padding: '10px 6px' }}>Стилизованная</td>
              <td style={{ padding: '10px 6px' }}>Точная (полигоны)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.8)' }}>Верх/середина груди</td>
              <td style={{ padding: '10px 6px', color: '#86efac' }}>Есть</td>
              <td style={{ padding: '10px 6px', color: '#fca5a5' }}>Нет (целиком)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.8)' }}>3 пучка дельт</td>
              <td style={{ padding: '10px 6px', color: '#86efac' }}>Есть</td>
              <td style={{ padding: '10px 6px', color: '#fca5a5' }}>Только перед/зад</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.8)' }}>Интенсивность</td>
              <td style={{ padding: '10px 6px' }}>4 уровня по объёму</td>
              <td style={{ padding: '10px 6px' }}>Градиент по частоте</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.8)' }}>Размер</td>
              <td style={{ padding: '10px 6px' }}>~5 KB (inline)</td>
              <td style={{ padding: '10px 6px' }}>~168 KB</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.8)' }}>Кликабельные регионы</td>
              <td style={{ padding: '10px 6px' }}>Руками</td>
              <td style={{ padding: '10px 6px', color: '#86efac' }}>Из коробки</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: '20px', padding: '16px',
        background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
        borderRadius: '12px', fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.85)',
      }}>
        <strong>Как пользоваться:</strong> переключай тренировки кнопками выше. В каждой карточке слева мой самописный SVG,
        справа — настоящая <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>react-body-highlighter</code>.
        Видна разница в анатомической точности силуэта и в том, как библиотека рисует мышцы реальными полигонами.
      </div>
    </div>
  );
}
