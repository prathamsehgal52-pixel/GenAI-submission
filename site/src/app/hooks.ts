import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { Me } from '../lib/types'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const me = await api<Me | { user: null }>('/me')
        return me.user ? (me as Me) : null
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
  })
}

/** Set when onboarding completes so the route guard can continue to the first upload. */
export const journey = { justOnboarded: false }

export function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[][]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })))
}

export function usePageTitle(title: string) {
  if (typeof document !== 'undefined') document.title = title ? `${title} · Armoire` : 'Armoire'
}
