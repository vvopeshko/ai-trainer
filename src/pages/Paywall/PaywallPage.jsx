import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Glass, Button } from '../../components/ui/index.js'
import { useTranslation } from '../../i18n/useTranslation.js'
import { useTelegram } from '../../components/TelegramProvider.jsx'
import { useBillingStatus, useBillingPlans } from '../../hooks/queries.js'
import { useCheckout, useRedeemPromo } from '../../hooks/mutations.js'

// Paywall (product/ARCHITECTURE_PAYMENTS.md §5.4): hard paywall — сюда уводит
// BillingGate. Планы и методы приходят с сервера (/billing/plans) для
// резолвнутого региона; цены клиент не считает и не передаёт (§7.4).

const PERIOD_LABEL = { week: 'billing.perWeek', month: 'billing.perMonth', lifetime: 'billing.oneTime' }
const PLAN_LABEL = { week: 'billing.planWeek', month: 'billing.planMonth', lifetime: 'billing.planLifetime' }

// Код ошибки сервера → человекочитаемый текст (t() возвращает ключ, если перевода нет)
function billingErrorText(t, err) {
  const code = err?.payload?.code
  const key = `billing.error.${code}`
  const msg = code ? t(key) : null
  return msg && msg !== key ? msg : t('billing.error.generic')
}

function formatPrice(amount, currency) {
  if (currency === 'RUB') return `${Math.round(amount / 100).toLocaleString('ru-RU')} ₽`
  if (currency === 'XTR') return `${amount.toLocaleString('ru-RU')} ⭐`
  if (currency === 'USD') return `$${(amount / 100).toLocaleString('en-US')}`
  return `${amount} ${currency}`
}

export default function PaywallPage() {
  const { t } = useTranslation()
  const { webApp } = useTelegram()
  const navigate = useNavigate()

  const { data: billing } = useBillingStatus()
  const { data: catalog, isLoading } = useBillingPlans()
  const checkout = useCheckout()
  const redeemPromo = useRedeemPromo()

  const [planCode, setPlanCode] = useState('premium_month')
  const [method, setMethod] = useState(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoNote, setPromoNote] = useState(null)
  const [error, setError] = useState(null)

  // Подписка активна (оплатил / промокод / гейт выключен изнутри) — в приложение
  useEffect(() => {
    if (billing?.active) navigate('/', { replace: true })
  }, [billing?.active, navigate])

  const plans = catalog?.plans ?? []
  const selectedPlan = plans.find((p) => p.code === planCode) ?? plans[0]
  // Методы, у которых есть цена на выбранный план (lifetime у tribute нет — скрываем)
  const planMethods = useMemo(() => {
    if (!catalog || !selectedPlan) return []
    return catalog.methods.filter((m) => selectedPlan.prices.some((p) => p.method === m))
  }, [catalog, selectedPlan])
  const activeMethod = planMethods.includes(method) ? method : planMethods[0] ?? null
  const activePrice = selectedPlan?.prices.find((p) => p.method === activeMethod) ?? null

  async function pay() {
    if (!selectedPlan || !activeMethod) return
    setError(null)
    try {
      const result = await checkout.mutateAsync({ planCode: selectedPlan.code, method: activeMethod })
      if (result.type === 'granted') return // useEffect выше уведёт на главную
      if (result.type === 'invoice_link' && webApp?.openInvoice) {
        webApp.openInvoice(result.url, () => {
          // paid | cancelled | failed — в любом случае перечитываем статус
          checkout.reset()
        })
      } else if (result.type === 'telegram_link' && webApp?.openTelegramLink) {
        webApp.openTelegramLink(result.url)
      } else if (result.url) {
        // redirect (ЮKassa/Paddle): в TMA — внешний браузер, на web — прямой переход
        if (webApp?.openLink) webApp.openLink(result.url)
        else window.location.href = result.url
      }
    } catch (err) {
      setError(billingErrorText(t, err))
    }
  }

  async function applyPromo(e) {
    e.preventDefault()
    setError(null)
    setPromoNote(null)
    try {
      const result = await redeemPromo.mutateAsync(promoCode)
      if (result.kind === 'free_period') {
        setPromoNote(t('billing.promoFreeApplied', { days: result.freeDays }))
        // рефетч статуса уже запущен мутацией — гейт снимется сам
      } else {
        setPromoNote(t('billing.promoDiscountApplied', { pct: result.discountPct }))
      }
      setPromoCode('')
    } catch (err) {
      setError(billingErrorText(t, err))
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 'calc(var(--safe-top, 0px) + var(--space-6)) var(--space-4) calc(var(--safe-bottom, 0px) + var(--space-6))',
        maxWidth: 480,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-2xl)', fontWeight: 800, textAlign: 'center' }}>
        {t('billing.paywallTitle')}
      </h1>
      <p
        style={{
          margin: '0 0 var(--space-5)',
          fontSize: 'var(--text-sm)',
          color: 'var(--fg-secondary)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {t('billing.paywallSubtitle')}
      </p>

      {/* Планы */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {plans.map((plan) => {
          const selected = plan.code === selectedPlan?.code
          const price = plan.prices.find((p) => p.method === (planMethods.includes(method) ? method : plan.prices[0]?.method))
            ?? plan.prices[0]
          const featured = plan.period === 'month'
          return (
            <Glass
              key={plan.code}
              radius={14}
              padding="var(--space-3) var(--space-4)"
              onClick={() => setPlanCode(plan.code)}
              style={{
                cursor: 'pointer',
                border: selected
                  ? '1px solid hsla(var(--accent-h,158),60%,55%,0.75)'
                  : '1px solid rgba(255,255,255,0.08)',
                position: 'relative',
              }}
            >
              {featured && (
                <span
                  style={{
                    position: 'absolute',
                    top: -9,
                    right: 14,
                    fontSize: 'var(--text-xs)',
                    padding: '1px 8px',
                    borderRadius: 999,
                    background: 'hsla(var(--accent-h,158),60%,42%,0.9)',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {t('billing.featured')}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{t(PLAN_LABEL[plan.period])}</span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>
                    {price ? formatPrice(price.amount, price.currency) : '—'}
                  </span>{' '}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)' }}>
                    {t(PERIOD_LABEL[plan.period])}
                  </span>
                </span>
              </div>
            </Glass>
          )
        })}
      </div>

      {/* Способ оплаты — только если их больше одного */}
      {planMethods.length > 1 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-tertiary)', marginBottom: 'var(--space-2)' }}>
            {t('billing.methodTitle')}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {planMethods.map((m) => (
              <Button
                key={m}
                variant={m === activeMethod ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMethod(m)}
              >
                {t(`billing.method.${m}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {!isLoading && planMethods.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-tertiary)', textAlign: 'center' }}>
          {t('billing.noMethods')}
        </p>
      ) : (
        <Button
          variant="accent"
          size="lg"
          block
          loading={checkout.isPending}
          disabled={!activePrice}
          onClick={pay}
        >
          {activePrice
            ? t('billing.payCta', { price: formatPrice(activePrice.amount, activePrice.currency) })
            : '…'}
        </Button>
      )}

      {/* Промокод */}
      <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
        {!promoOpen ? (
          <button
            type="button"
            onClick={() => setPromoOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg-tertiary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t('billing.promoToggle')}
          </button>
        ) : (
          <form onSubmit={applyPromo} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={t('billing.promoPlaceholder')}
              autoCapitalize="characters"
              autoComplete="off"
              style={{
                flex: 1,
                height: 40,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--fg-primary)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
              }}
            />
            <Button type="submit" variant="secondary" size="md" loading={redeemPromo.isPending} disabled={!promoCode.trim()}>
              {t('billing.promoApply')}
            </Button>
          </form>
        )}
      </div>

      {promoNote && (
        <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-xs)', color: 'var(--success)', textAlign: 'center' }}>
          {promoNote}
        </p>
      )}
      {error && (
        <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--text-xs)', color: 'var(--danger)', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}
