import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Parity-тест схемы: ловит забытую ручную правку после `@better-auth/cli generate`
// (codegen перезаписывает email на String NOT NULL — у TG-юзеров email нет).
// См. product/ARCHITECTURE_WEB_AUTH.md §3.3 шаг 3.

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../prisma/schema.prisma',
)
const schema = readFileSync(schemaPath, 'utf8')
const userModel = schema.match(/model User \{[\s\S]*?\n\}/)?.[0] ?? ''

describe('schema parity (web-auth)', () => {
  it('User.email — nullable (String? @unique)', () => {
    expect(userModel).toMatch(/email\s+String\?\s+@unique/)
  })

  it('User.telegramId — nullable (BigInt? @unique)', () => {
    expect(userModel).toMatch(/telegramId\s+BigInt\?\s+@unique/)
  })

  it('таблицы Better Auth присутствуют', () => {
    for (const model of ['Session', 'Account', 'Verification', 'RateLimit']) {
      expect(schema).toMatch(new RegExp(`model ${model} \\{`))
    }
  })
})
