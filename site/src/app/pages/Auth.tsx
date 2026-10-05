import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Logo } from '../../components/Hero'
import { Photo } from '../../components/Photo'
import { GlyphText } from '../../components/GlyphText'
import { authClient, authErrorMessage } from '../../lib/auth'
import { usePageTitle } from '../hooks'
import { safeNext } from '../../routes'
import { Button, Field, Input } from '../ui'

type Mode = 'signin' | 'signup' | 'forgot' | 'reset'

const copy: Record<Mode, { title: [string, string]; alt: string; sub: string; doc: string }> = {
  signin: { title: ['Welcome', 'back.'], alt: 'back.', sub: 'Sign in to your wardrobe.', doc: 'Sign in' },
  signup: { title: ['Build your', 'wardrobe.'], alt: 'wardrobe.', sub: 'Create your account. It takes less than a minute.', doc: 'Create account' },
  forgot: { title: ['Reset your', 'password.'], alt: 'password.', sub: 'We’ll email you a secure link to choose a new one.', doc: 'Reset password' },
  reset: { title: ['Choose a new', 'password.'], alt: 'password.', sub: 'Use at least 10 characters.', doc: 'Choose a new password' },
}


export default function AuthPage({ mode }: { mode: Mode }) {
  const c = copy[mode]
  usePageTitle(c.doc)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const token = params.get('token')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        if (error) return setError(authErrorMessage(error))
        await qc.invalidateQueries({ queryKey: ['me'] })
        navigate('/onboarding', { replace: true })
      } else if (mode === 'signin') {
        const { error } = await authClient.signIn.email({ email: email.trim(), password })
        if (error) return setError(authErrorMessage(error))
        await qc.invalidateQueries({ queryKey: ['me'] })
        navigate(safeNext(params.get('next')), { replace: true })
      } else if (mode === 'forgot') {
        const { error } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/reset-password` })
        if (error && (error.status ?? 500) >= 500) return setError('We couldn’t send the email just now. Please try again in a few minutes.')
        if (error) return setError(authErrorMessage(error))
        setSent(true)
      } else {
        if (!token) return setError('This reset link is incomplete. Request a new one.')
        const { error } = await authClient.resetPassword({ newPassword: password, token })
        if (error) return setError(authErrorMessage(error))
        setSent(true)
      }
    } catch {
      setError('We couldn’t reach Armoire. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-[14px]">
      <div className="grid min-h-[calc(100vh-16px)] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#bfd2d8_0%,#d3e0e3_45%,#eceeef_100%)] sm:min-h-[calc(100vh-24px)] sm:rounded-[28px] lg:min-h-[calc(100vh-28px)] lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden lg:block">
          <Photo src="/images/look-city.jpg" alt="" crop={{ position: '56% 35%' }} className="absolute inset-3 rounded-[22px]" />
          <div className="absolute inset-3 rounded-[22px] bg-gradient-to-t from-black/50 via-transparent to-black/10" />
          <p className="absolute bottom-10 left-10 max-w-[30ch] text-[15px] leading-[1.45] text-white/90">
            Turn the clothes you own into outfits you’ll love, and buy only what completes them.
          </p>
        </div>
        <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="Armoire home">
              <Logo />
            </Link>
            {mode === 'signin' && (
              <Link to="/signup" className="text-[13px] uppercase underline-offset-4 hover:underline">
                Create account
              </Link>
            )}
            {mode === 'signup' && (
              <Link to="/signin" className="text-[13px] uppercase underline-offset-4 hover:underline">
                Sign in
              </Link>
            )}
          </div>

          <div className="mx-auto my-auto w-full max-w-[420px] py-10">
            <GlyphText as="h1" trigger="load" lines={c.title} altWords={[c.alt]} className="display text-[clamp(40px,5vw,64px)]" />
            <p className="mt-3 text-[15px] text-ink-soft">{c.sub}</p>

            {sent ? (
              <div className="mt-8 rounded-[22px] bg-white/80 p-5 text-[14px] leading-[1.5] text-ink-soft" role="status">
                {mode === 'forgot' ? (
                  <>If an account exists for <strong className="font-medium text-ink">{email}</strong>, a reset link is on its way. It expires in one hour.</>
                ) : (
                  <>Your password has been changed. You can now sign in with it.</>
                )}
                <div className="mt-4">
                  <Link to="/signin" className="text-[13px] uppercase text-ink underline underline-offset-4">
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-4" noValidate={false}>
                {mode === 'signup' && (
                  <Field label="Your name" htmlFor="name">
                    <Input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                  </Field>
                )}
                {mode !== 'reset' && (
                  <Field label="Email" htmlFor="email">
                    <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                )}
                {mode !== 'forgot' && (
                  <Field
                    label={mode === 'reset' ? 'New password' : 'Password'}
                    htmlFor="password"
                    hint={mode === 'signin' ? undefined : 'At least 10 characters.'}
                  >
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={mode === 'signin' ? 1 : 10}
                      maxLength={128}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                )}
                {error && (
                  <p role="alert" className="rounded-[16px] bg-[#f4dfdb] px-4 py-3 text-[13px] text-[#7a231b]">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={busy} className="w-full">
                  {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}
                </Button>
                {mode === 'signin' && (
                  <p className="text-center text-[13px]">
                    <Link to="/forgot-password" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                      Forgot your password?
                    </Link>
                  </p>
                )}
                {mode === 'signup' && (
                  <p className="text-center text-[12px] text-mute">
                    By creating an account you agree to how we handle your data, described in our{' '}
                    <Link to="/privacy" className="underline underline-offset-2">
                      privacy notice
                    </Link>
                    .
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
