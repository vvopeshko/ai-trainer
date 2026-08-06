import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys.js'
import { apiGet, apiPatch, apiPost } from '../utils/api.js'

const ROOT = '/api/v1/admin/evidence'

function params(filters = {}) {
  const search = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value != null) search.set(key, value)
  })
  const result = search.toString()
  return result ? `?${result}` : ''
}

export function useEvidenceAccess() {
  return useQuery({
    queryKey: queryKeys.evidence.access,
    queryFn: () => apiGet(`${ROOT}/access`),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useEvidenceQuestions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.evidence.questions,
    queryFn: async () => (await apiGet(`${ROOT}/questions`)).questions,
    enabled,
    staleTime: 60_000,
  })
}

export function useEvidenceQuestion(id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.evidence.question(id),
    queryFn: async () => (await apiGet(`${ROOT}/questions/${id}`)).question,
    enabled: enabled && Boolean(id),
  })
}

export function useEvidenceClaims(filters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.evidence.claims(filters),
    queryFn: async () => (await apiGet(`${ROOT}/claims${params(filters)}`)).claims,
    enabled,
    staleTime: 30_000,
  })
}

export function useEvidenceClaim(id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.evidence.claim(id),
    queryFn: async () => (await apiGet(`${ROOT}/claim-versions/${id}`)).claim,
    enabled: enabled && Boolean(id),
  })
}

export function useEvidenceRuntime(questionId, outcome, enabled = false) {
  return useQuery({
    queryKey: queryKeys.evidence.runtime(questionId, outcome),
    queryFn: async () => (await apiGet(
      `${ROOT}/runtime-check/${questionId}${params({ outcome })}`,
    )).guidance,
    enabled: enabled && Boolean(questionId),
    retry: false,
  })
}

export function useEvidenceAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ method = 'POST', path, body }) => {
      const request = method === 'PATCH' ? apiPatch : apiPost
      return request(`${ROOT}${path}`, body)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.evidence.all }),
  })
}
