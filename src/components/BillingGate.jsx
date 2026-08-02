import { Navigate, useLocation } from 'react-router-dom'
import { useBillingStatus } from '../hooks/queries.js'

// Hard paywall (product/ARCHITECTURE_PAYMENTS.md §5.4): без активной подписки
// приложение недоступно целиком. Рубильник — gatingEnabled с сервера
// (PREMIUM_GATING): выключен → гейт прозрачен, старый бэкенд без биллинга — тоже.
//
// Публичные пути: web-auth страницы (до логина подписку не проверить),
// /demo (dev-утилита) и сам /paywall.
const PUBLIC_PREFIXES = ['/login', '/auth', '/demo', '/paywall', '/admin']

export function BillingGate({ children }) {
  const location = useLocation()
  const { data: billing } = useBillingStatus()

  const isPublic = PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p))
  // Пока статус грузится (billing == null) — рендерим приложение: у подписчика
  // нет мигания paywall'ом, у неподписанного данные всё равно отобьёт сервер (403).
  const gated = billing?.gatingEnabled && !billing.active

  if (gated && !isPublic) {
    return <Navigate to="/paywall" replace />
  }
  return children
}
