import { useNavigate } from 'react-router'
import { useMe } from '../app/hooks'

/** Primary CTA destination: the app for signed-in visitors, otherwise sign-up. */
export function useStartJourney() {
  const navigate = useNavigate()
  const me = useMe()
  return () => navigate(me.data ? '/app' : '/signup')
}

export function useSignedIn() {
  return !!useMe().data
}
