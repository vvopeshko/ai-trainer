function parseAllowlist(raw) {
  return new Set(String(raw || '').split(',').map((value) => value.trim()).filter(Boolean))
}

function userKeys(user) {
  const keys = new Set([user?.id].filter(Boolean))
  if (user?.telegramId != null) keys.add(`tg:${user.telegramId}`)
  return keys
}

export function resolveEvidenceRole(user, env = process.env) {
  const keys = userKeys(user)
  const approvers = parseAllowlist(env.EVIDENCE_APPROVER_IDS)
  const reviewers = parseAllowlist(env.EVIDENCE_REVIEWER_IDS)

  if ([...keys].some((key) => approvers.has(key))) return 'approver'
  if ([...keys].some((key) => reviewers.has(key))) return 'reviewer'
  return null
}

export function requireEvidenceRole(requiredRole = 'reviewer') {
  return (req, res, next) => {
    const role = resolveEvidenceRole(req.user)
    const allowed = role === 'approver' || (requiredRole === 'reviewer' && role === 'reviewer')
    if (!allowed) {
      return res.status(403).json({
        error: 'Evidence review access denied',
        code: 'EVIDENCE_ACCESS_DENIED',
      })
    }
    req.evidenceRole = role
    next()
  }
}
