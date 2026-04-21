import { Dumbbell } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'

export default function WorkoutPage() {
  const { t } = useTranslation()
  const { user, isDev } = useTelegram()

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7C5CFC]/15 text-[#7C5CFC]">
          <Dumbbell size={22} strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('workout.title')}</h1>
          <p className="text-sm text-[#E8E8F0]/60">
            {t('workout.helloUser', { name: user?.firstName ?? '...' })}
          </p>
        </div>
      </header>

      <section className="rounded-3xl border border-white/5 bg-[#1A1A24] p-6">
        <p className="text-sm leading-relaxed text-[#E8E8F0]/70">{t('workout.placeholder')}</p>
      </section>

      {isDev && (
        <p className="mt-6 text-center text-xs uppercase tracking-wider text-[#E8E8F0]/30">
          dev mode (без Telegram)
        </p>
      )}
    </main>
  )
}
