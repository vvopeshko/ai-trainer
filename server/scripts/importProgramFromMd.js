/**
 * Разовый скрипт: импорт программы из Программа_тренировок.md
 *
 * Парсит markdown-документ напрямую (без LLM), резолвит упражнения через exerciseResolver,
 * сохраняет в БД с guidelines.
 *
 * Запуск: cd server && node --env-file=.env scripts/importProgramFromMd.js
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import prisma from '../src/utils/prisma.js'
import { resolveExercise } from '../src/services/exerciseResolver.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Hardcoded program structure from Программа_тренировок.md ────────

const PROGRAM = {
  name: 'Гипертрофия 4 дня (грудь + спина)',
  description: 'Программа для гипертрофии с приоритетом на грудь и спину. 4 силовых в неделю + бокс 2 раза. Учитывает ограничения L4-L5.',
  days: [
    {
      title: 'День 1 — Грудь + Трицепс + Средняя дельта',
      durationMin: 75,
      notes: 'Жим в Смите наклонный — главный приоритет, без него день не выполнен. Кроссовер снизу-вверх критичен для верха груди при росте 190. Махи в конце, чтобы не убить плечи перед жимами.',
      exercises: [
        { nameRu: 'Жим в Смите наклонный (15-30°)', slug: 'zhim-v-smite-naklonnyj', sets: 4, repsMin: 8, repsMax: 10, restSec: 180, rir: '1-2' },
        { nameRu: 'Жим гантелей лёжа горизонтальный', slug: 'zhim-gantelej-lyozha-gorizontalnyj', sets: 3, repsMin: 8, repsMax: 12, restSec: 150, rir: '1-2' },
        { nameRu: 'Бабочка в тренажёре', slug: 'babochka-v-trenazhere', sets: 3, repsMin: 10, repsMax: 15, restSec: 90, rir: '1' },
        { nameRu: 'Кроссовер снизу-вверх', slug: 'krossover-snizu-vverkh', sets: 3, repsMin: 12, repsMax: 15, restSec: 90, rir: '0-1' },
        { nameRu: 'Разгибания с канатом из-за головы', slug: 'razgibaniya-s-kanatom-iz-za-golovy', sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rir: '1-2' },
        { nameRu: 'Разгибания на блоке вниз', slug: 'razgibaniya-na-bloke-vniz', sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rir: '0-1' },
        { nameRu: 'Махи в тренажёре', slug: 'makhi-v-trenazhere', sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rir: '0-1' },
      ],
    },
    {
      title: 'День 2 — Спина + Бицепс + Задняя дельта',
      durationMin: 75,
      notes: 'Подтягивания если не идут 4×6 чистых — заменить тягой верхнего блока широким хватом. Тяга гантели в упоре безопаснее для L4-L5, чем тяга со штангой в наклоне. Pec-deck reverse эффективнее обычных обратных разводок для задней дельты.',
      exercises: [
        { nameRu: 'Подтягивания (обычный хват)', slug: 'podtyagivaniya-obychnyj-khvat', sets: 4, repsMin: 6, repsMax: 10, restSec: 180, rir: '1-2' },
        { nameRu: 'Тяга гантели в упоре одной рукой', slug: 'tyaga-ganteli-v-upore-odnoj-rukoj', sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rir: '1-2' },
        { nameRu: 'Тяга нижнего блока сидя (нейтральный хват)', slug: 'tyaga-nizhnego-bloka-sidya-nejtralnyj-khvat', sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rir: '1-2' },
        { nameRu: 'Тяга верхнего блока узким параллельным', slug: 'tyaga-verkhnego-bloka-uzkim-parallelnym', sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rir: '1' },
        { nameRu: 'Тяга на прямых руках в блоке', slug: 'tyaga-na-pryamykh-rukakh-v-bloke', sets: 3, repsMin: 12, repsMax: 15, restSec: 90, rir: '1' },
        { nameRu: 'Обратные разводки в pec-deck reverse', slug: 'obratnye-razvodki-v-pec-deck-reverse', sets: 4, repsMin: 12, repsMax: 15, restSec: 90, rir: '0-1' },
        { nameRu: 'Сгибания с гантелями на наклонной', slug: 'sgibaniya-s-gantelyami-na-naklonnoj', sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rir: '1-2' },
        { nameRu: 'Молотки', slug: 'molotki', sets: 2, repsMin: 12, repsMax: 12, restSec: 60, rir: '0-1' },
      ],
    },
    {
      title: 'День 3 — Ноги + Кор',
      durationMin: 70,
      notes: 'Ягодичный мост: лопатки на скамье, в верхней точке таз вровень с корпусом (НЕ переразгибаться), подбородок прижат к груди. Гиперэкстензии под 45°: опускание до параллели, вверх до прямой линии, без веса первые 1-2 недели. Палоф-пресс: косые работают изометрически — не качаются на массу.',
      exercises: [
        { nameRu: 'Жим ногами', slug: 'zhim-nogami', sets: 3, repsMin: 10, repsMax: 12, restSec: 180, rir: '1-2' },
        { nameRu: 'Болгарские выпады с гантелями', slug: 'bolgarskie-vypady-s-gantelyami', sets: 3, repsMin: 10, repsMax: 10, restSec: 120, rir: '1-2', notes: 'каждая нога' },
        { nameRu: 'Ягодичный мост со штангой', slug: 'yagodichnyj-most-so-shtangoj', sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rir: '1-2' },
        { nameRu: 'Разгибания ног сидя', slug: 'razgibaniya-nog-sidya', sets: 3, repsMin: 12, repsMax: 12, restSec: 90, rir: '1' },
        { nameRu: 'Сгибания ног лёжа', slug: 'sgibaniya-nog-lyozha', sets: 3, repsMin: 12, repsMax: 12, restSec: 90, rir: '1' },
        { nameRu: 'Гиперэкстензии под 45°', slug: 'giperekstenzii-pod-45', sets: 3, repsMin: 12, repsMax: 12, restSec: 90, rir: '1-2' },
        { nameRu: 'Подъёмы на носки стоя', slug: 'podyomy-na-noski-stoya', sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rir: '0-1' },
        { nameRu: 'Подъёмы на носки сидя', slug: 'podyomy-na-noski-sidya', sets: 2, repsMin: 15, repsMax: 20, restSec: 60, rir: '0-1' },
        { nameRu: 'Палоф-пресс в блоке', slug: 'palof-press-v-bloke', sets: 3, repsMin: 12, repsMax: 12, restSec: 45, notes: 'на сторону' },
        { nameRu: 'Прогулка с гирей в одной руке (фермер)', slug: 'progulka-s-girej-v-odnoj-ruke', sets: 2, repsMin: 30, repsMax: 30, restSec: 60, notes: '30 м на сторону' },
      ],
    },
    {
      title: 'День 4 — Грудь + Спина + Плечи (поддерживающий)',
      durationMin: 75,
      notes: '',
      exercises: [
        { nameRu: 'Жим гантелей на наклонной (30°)', slug: 'zhim-gantelej-na-naklonnoj', sets: 3, repsMin: 8, repsMax: 10, restSec: 150, rir: '1-2' },
        { nameRu: 'Жим в тренажёре сидя (горизонталь)', slug: 'zhim-v-trenazhere-sidya-gorizontal', sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rir: '1-2' },
        { nameRu: 'Подтягивания обратным хватом', slug: 'podtyagivaniya-obratnym-khvatom', sets: 3, repsMin: 8, repsMax: 10, restSec: 150, rir: '1-2' },
        { nameRu: 'Тяга в тренажёре с упором', slug: 'tyaga-v-trenazhere-s-uporom', sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rir: '1-2' },
        { nameRu: 'Жим гантелей сидя', slug: 'zhim-gantelej-sidya', sets: 3, repsMin: 10, repsMax: 10, restSec: 120, rir: '1-2' },
        { nameRu: 'Махи в стороны на блоке одной рукой', slug: 'makhi-v-storony-na-bloke-odnoj-rukoj', sets: 3, repsMin: 12, repsMax: 12, restSec: 60, rir: '0-1' },
        { nameRu: 'Фейс-пул', slug: 'fejs-pul', sets: 3, repsMin: 15, repsMax: 15, restSec: 60, rir: '0-1' },
        { nameRu: 'Сгибания на бицепс в блоке', slug: 'sgibaniya-na-biceps-v-bloke', sets: 3, repsMin: 12, repsMax: 12, restSec: 60, rir: '0-1' },
        { nameRu: 'Разгибания с канатом вниз', slug: 'razgibaniya-s-kanatom-vniz', sets: 3, repsMin: 12, repsMax: 12, restSec: 60, rir: '0-1' },
      ],
    },
  ],
}

const GUIDELINES = {
  volumeTargets: [
    { muscle: 'Грудь (приоритет)', sets: '16-18', note: 'акцент на верх' },
    { muscle: 'Спина вертикаль', sets: '6-8', note: 'ширина' },
    { muscle: 'Спина горизонталь', sets: '6-8', note: 'толщина' },
    { muscle: 'Спина изоляция широчайших', sets: '3', note: 'тяга на прямых' },
    { muscle: 'Средняя дельта', sets: '8-10', note: 'для V-силуэта' },
    { muscle: 'Задняя дельта', sets: '6-8', note: 'баланс с грудью' },
    { muscle: 'Передняя дельта', sets: '2-4', note: 'хватает косвенной' },
    { muscle: 'Бицепс', sets: '8-10', note: '+ косвенно из тяг' },
    { muscle: 'Трицепс', sets: '8-10', note: '+ косвенно из жимов' },
    { muscle: 'Квадрицепс', sets: '6-8', note: 'поддержка' },
    { muscle: 'Бицепс бедра', sets: '6-8', note: 'через 2 угла' },
    { muscle: 'Ягодичные', sets: '3-4', note: 'покрыты косвенно' },
    { muscle: 'Икры', sets: '4-6', note: 'обе головки' },
    { muscle: 'Кор стабилизация', sets: '5-7', note: 'антиротация + антиэкстензия' },
    { muscle: 'Косые на гипертрофию', sets: '0', note: 'не утолщаем талию' },
  ],
  progression: 'Двойная прогрессия: сначала повышаешь повторы в диапазоне (например с 8 до 10), потом прибавляешь вес (+2.5 кг верх тела, +5 кг ноги) и возвращаешься к нижней границе. Оптимальный RIR для гипертрофии: 1-2.',
  deload: 'Раз в 6-8 недель или при застое 2-3 недели подряд: рабочие веса −30-40%, 5-6 повторов вместо 8-10, полный отдых 7 дней по нагрузке.',
  constraints: [
    'L4-L5 — исключены становые/наклонные тяги со штангой, скручивания и повторяющееся сгибание поясницы под нагрузкой',
    'Нет гиперэкстензий с переразгибанием',
    'Нет наклонов в стороны с гантелей и русских твистов — гипертрофия косых = шире талия',
    'Нет тяги к подбородку со штангой узким хватом — импинджмент плеча',
  ],
  nutrition: 'Поддержка ~2700-2900 ккал/день. Для роста: +200-300 ккал. Белок 1.8-2.0 г/кг = 150-170 г/день — приоритет.',
  schedule: 'Пн / Вт / Чт / Пт — силовые. Бокс — Ср и Сб. Между двумя днями груди и двумя днями спины минимум 48 часов.',
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  // Find dev user (telegramId=0)
  const user = await prisma.user.findFirst({
    where: { telegramId: 0n },
  })

  if (!user) {
    console.error('Dev user (telegramId=0) not found. Run seed:dev first.')
    process.exit(1)
  }

  console.log(`Importing program for user ${user.firstName} (${user.id})...`)

  // Resolve exercises
  const resolvedDays = []
  for (const day of PROGRAM.days) {
    const resolvedExercises = []
    for (const ex of day.exercises) {
      const resolved = await resolveExercise({
        slug: ex.slug,
        nameRu: ex.nameRu,
      })
      console.log(`  ${resolved.resolvedBy}: ${ex.nameRu} → ${resolved.exerciseId}`)
      resolvedExercises.push({
        exerciseId: resolved.exerciseId,
        slug: ex.slug,
        nameRu: ex.nameRu,
        sets: ex.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        restSec: ex.restSec,
        ...(ex.rir && { rir: ex.rir }),
        ...(ex.notes && { notes: ex.notes }),
        alternatives: [],
      })
    }
    resolvedDays.push({
      title: day.title,
      ...(day.durationMin && { durationMin: day.durationMin }),
      ...(day.notes && { notes: day.notes }),
      exercises: resolvedExercises,
    })
  }

  // Create program
  const program = await prisma.program.create({
    data: {
      userId: user.id,
      name: PROGRAM.name,
      description: PROGRAM.description,
      durationWeeks: 4,
      isActive: false,
      planJson: { days: resolvedDays },
      guidelines: GUIDELINES,
    },
  })

  console.log(`\nProgram created: ${program.id}`)
  console.log(`  Name: ${program.name}`)
  console.log(`  Days: ${resolvedDays.length}`)
  console.log(`  Exercises: ${resolvedDays.reduce((s, d) => s + d.exercises.length, 0)}`)
  console.log(`  Guidelines: ${Object.keys(GUIDELINES).join(', ')}`)
  console.log(`\nOpen: http://localhost:5173/program/${program.id}`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
