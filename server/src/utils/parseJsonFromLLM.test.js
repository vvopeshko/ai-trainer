import { describe, it, expect } from 'vitest'
import { parseJsonFromLLM } from './parseJsonFromLLM.js'

describe('parseJsonFromLLM', () => {
  it('parses clean JSON', () => {
    const input = '{"name": "bench press", "sets": 3}'
    expect(parseJsonFromLLM(input)).toEqual({ name: 'bench press', sets: 3 })
  })

  it('parses JSON wrapped in ```json fence', () => {
    const input = 'Here is the result:\n```json\n{"foo": "bar"}\n```\nDone.'
    expect(parseJsonFromLLM(input)).toEqual({ foo: 'bar' })
  })

  it('parses JSON wrapped in plain ``` fence', () => {
    const input = '```\n{"a": 1}\n```'
    expect(parseJsonFromLLM(input)).toEqual({ a: 1 })
  })

  it('extracts first {...} from surrounding text', () => {
    const input = 'Sure! Here you go: {"exercise": "squat"} hope that helps.'
    expect(parseJsonFromLLM(input)).toEqual({ exercise: 'squat' })
  })

  it('handles nested braces correctly', () => {
    const input = '{"outer": {"inner": true}}'
    expect(parseJsonFromLLM(input)).toEqual({ outer: { inner: true } })
  })

  it('returns null for completely invalid input', () => {
    expect(parseJsonFromLLM('no json here at all')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseJsonFromLLM('')).toBeNull()
  })

  it('parses JSON array', () => {
    const input = '[{"id": 1}, {"id": 2}]'
    expect(parseJsonFromLLM(input)).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('handles fence with invalid JSON inside gracefully', () => {
    const input = '```json\n{invalid json}\n```'
    // Falls through to brace match which also fails
    expect(parseJsonFromLLM(input)).toBeNull()
  })
})
