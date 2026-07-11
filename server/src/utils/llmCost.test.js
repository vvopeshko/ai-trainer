import { describe, it, expect, vi } from 'vitest'
import { estimateCostUsd, getPricing } from './llmCost.js'

describe('getPricing', () => {
  it('матчит модель по префиксу (датированный id)', () => {
    expect(getPricing('claude-sonnet-4-6-20260514')).toEqual({ in: 3, out: 15 })
    expect(getPricing('claude-opus-4-1')).toEqual({ in: 15, out: 75 }) // legacy-прайс
    expect(getPricing('claude-opus-4-6')).toEqual({ in: 5, out: 25 }) // Opus 4.6+
  })

  it('неизвестная модель → фолбэк на Sonnet + warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getPricing('gpt-5')).toEqual({ in: 3, out: 15 })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('estimateCostUsd', () => {
  it('считает по прайсу: 1M in + 1M out у Sonnet = $3 + $15', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(18, 6)
  })

  it('масштабируется линейно: 1000 in + 500 out у Sonnet', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      input_tokens: 1000,
      output_tokens: 500,
    })
    // 1000*3/1e6 + 500*15/1e6 = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 9)
  })

  it('Opus дороже Sonnet', () => {
    const usage = { input_tokens: 1000, output_tokens: 1000 }
    expect(estimateCostUsd('claude-opus-4-1', usage)).toBeGreaterThan(
      estimateCostUsd('claude-sonnet-4-6', usage),
    )
  })

  it('учитывает кэш-токены: write 1.25× входной цены, read 0.1×', () => {
    const cost = estimateCostUsd('claude-sonnet-4-6', {
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    })
    // 3*1.25 + 3*0.1 = 3.75 + 0.3 = 4.05
    expect(cost).toBeCloseTo(4.05, 6)
  })

  it('пустой usage → 0', () => {
    expect(estimateCostUsd('claude-sonnet-4-6', {})).toBe(0)
    expect(estimateCostUsd('claude-sonnet-4-6')).toBe(0)
  })
})
