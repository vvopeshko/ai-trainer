// ======================================
// Каталог планов и цен + резолв региона/методов
// ======================================
//
// Каталог маленький (3 плана × несколько цен) — грузится из БД один раз
// и кешируется в памяти модуля. После изменения сида нужен рестарт сервера
// (или loadCatalog({ force: true })).

import prisma from '../../utils/prisma.js'
import { AppError } from '../../middleware/errorHandler.js'
import { availableMethods as coreAvailableMethods, pickPrice, resolvePriceRegion as coreResolveRegion } from './billingCore.js'

let catalog = null // Map(planCode → plan { id, code, period, sortOrder, prices: [...] })

export async function loadCatalog({ force = false } = {}) {
  if (catalog && !force) return catalog
  const plans = await prisma.billingPlan.findMany({
    where: { isActive: true },
    include: { prices: true },
    orderBy: { sortOrder: 'asc' },
  })
  catalog = new Map(plans.map((p) => [p.code, p]))
  if (catalog.size === 0) {
    console.warn('[billing] каталог планов пуст — прогони server/scripts/seedBilling.js')
  }
  return catalog
}

export async function getPlan(planCode) {
  const cat = await loadCatalog()
  const plan = cat.get(planCode)
  if (!plan) throw new AppError(400, 'PLAN_NOT_FOUND', `Неизвестный план: ${planCode}`)
  return plan
}

export async function listPlans() {
  const cat = await loadCatalog()
  return [...cat.values()]
}

// Цена с fallback на 'default'-корзину; null нельзя — если цены нет, метод недоступен
export async function getPrice(planCode, provider, region) {
  const plan = await getPlan(planCode)
  const price = pickPrice(plan.prices, provider, region)
  if (!price) throw new AppError(400, 'PRICE_NOT_FOUND', `Нет цены ${planCode}/${provider}/${region}`)
  return price
}

// Фиче-флаги методов — PAYMENT_PROVIDERS=stars,yookassa,tribute,paddle (паттерн AUTH_PROVIDERS)
export function getEnabledProviders() {
  return (process.env.PAYMENT_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

// Регион юзера: geoip по IP (фаза 3, seam countryCode) → languageCode → 'default'.
// req.ip корректен: trust proxy уже настроен в index.js.
export function resolvePriceRegion(req) {
  // TODO(фаза 3): countryCode из geoip по req.ip — до этого корзину решает язык
  const languageCode = req.user?.languageCode || null
  return coreResolveRegion({ countryCode: null, languageCode })
}

export function resolveMethods(req, region) {
  let platform = req.authType === 'web' ? 'web' : 'telegram'
  // Только dev (ALLOW_DEV_BYPASS — маркер локалки): смоук web-флоу под `tma dev_bypass`
  if (process.env.ALLOW_DEV_BYPASS === 'true' && req.headers['x-dev-platform']) {
    platform = req.headers['x-dev-platform']
  }
  // Telegram.WebApp.platform с фронта: ?client=ios|android|tdesktop|weba (query или header)
  const tmaClient = String(req.query?.client || req.headers['x-tma-platform'] || '').toLowerCase() || null
  return coreAvailableMethods({ platform, tmaClient, region, enabled: getEnabledProviders() })
}
