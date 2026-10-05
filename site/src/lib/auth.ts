import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` })

/** Better Auth returns { error } instead of throwing; normalise to friendly copy. */
export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined) {
  if (!error) return null
  const code = error.code ?? ''
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return 'That email and password don’t match. Try again or reset your password.'
  if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') return 'An account with that email already exists. Sign in instead.'
  if (code === 'PASSWORD_TOO_SHORT') return 'Use at least 10 characters for your password.'
  if (code === 'INVALID_TOKEN') return 'This reset link has expired or was already used. Request a new one.'
  if (code === 'INVALID_PASSWORD') return 'That password isn’t correct.'
  if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  return error.message || 'Something went wrong. Please try again.'
}
