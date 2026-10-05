import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import { authClient, authErrorMessage } from '../../lib/auth'
import type { Profile } from '../../lib/types'
import { useMe, usePageTitle } from '../hooks'
import { PageHeader } from '../parts/PageHeader'
import { ColorsEditor, LocationEditor, OccasionsEditor, profilePayload, ShoppingEditor, StylesEditor, type Draft } from '../prefs'
import { Button, Chip, Dialog, Field, Input, PageLoader, Toggle } from '../ui'
import { useToast } from '../ui/toast'

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[28px] bg-white/70 p-5 sm:p-8">
      <h2 className="display text-[24px] sm:text-[28px]">{title}</h2>
      {description && <p className="mt-1.5 max-w-[60ch] text-[14px] text-ink-soft">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function useProfileSaver() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (d: Draft) => api<{ profile: Profile }>('/me/profile', { method: 'PATCH', body: profilePayload(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast('Saved.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
}

function PreferencesBlock({ profile, editors, label }: { profile: Profile; editors: ComponentType<{ value: Draft; onChange: (d: Draft) => void }>[]; label: string }) {
  const [draft, setDraft] = useState<Draft>(profile)
  useEffect(() => {
    setDraft(profile)
  }, [profile])
  const save = useProfileSaver()
  const dirty = JSON.stringify(profilePayload(draft)) !== JSON.stringify(profilePayload(profile))
  return (
    <div className="space-y-6">
      {editors.map((Editor, i) => (
        <Editor key={i} value={draft} onChange={(d) => setDraft((x) => ({ ...x, ...d }))} />
      ))}
      <Button onClick={() => save.mutate(draft)} disabled={!dirty} loading={save.isPending}>
        Save {label}
      </Button>
    </div>
  )
}

export default function Settings() {
  usePageTitle('Settings')
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [delError, setDelError] = useState<string | null>(null)
  useEffect(() => {
    setName(me.data?.user.name ?? '')
  }, [me.data?.user.name])
  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView()
  }, [])
  const save = useProfileSaver()

  const rename = useMutation({
    mutationFn: () => api('/me/name', { method: 'PATCH', body: { name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      toast('Name updated.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const changePw = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true })
      if (error) throw new Error(authErrorMessage(error) ?? 'Couldn’t change password.')
    },
    onSuccess: () => {
      setPw({ current: '', next: '' })
      setPwError(null)
      toast('Password changed. Other devices were signed out.')
    },
    onError: (e) => setPwError((e as Error).message),
  })
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.deleteUser({ password: delPw })
      if (error) throw new Error(authErrorMessage(error) ?? 'Couldn’t delete your account.')
    },
    onSuccess: () => {
      qc.clear()
      navigate('/', { replace: true })
    },
    onError: (e) => setDelError((e as Error).message),
  })
  const exportData = async () => {
    try {
      const data = await api('/me/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: 'armoire-export.json' })
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' })
    }
  }

  if (!me.data) return <PageLoader />
  const { profile, user, capabilities } = me.data

  return (
    <div className="mx-auto max-w-[880px]">
      <PageHeader lines={['Settings']} />
      <div className="space-y-4">
        <Section title="Account">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Name" htmlFor="acc-name">
              <Input id="acc-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button variant="light" onClick={() => rename.mutate()} disabled={!name.trim() || name === user.name} loading={rename.isPending}>
              Update name
            </Button>
          </div>
          <p className="mt-4 text-[14px] text-ink-soft">
            Signed in as <span className="text-ink">{user.email}</span>
          </p>
        </Section>

        <Section title="Style profile" description="Your stylist and new finds use these preferences.">
          <PreferencesBlock profile={profile} label="style profile" editors={[StylesEditor, ColorsEditor, OccasionsEditor]} />
        </Section>

        <Section title="Shopping" description="Shapes the products you see in Discover.">
          <PreferencesBlock profile={profile} label="shopping preferences" editors={[ShoppingEditor]} />
        </Section>

        <Section id="location" title="Location & weather" description="We use your city only to fetch the forecast for your outfits.">
          <PreferencesBlock profile={profile} label="location" editors={[LocationEditor]} />
          <div className="mt-6 flex items-center gap-2">
            <span className="mr-2 text-[12px] uppercase text-ink-soft">Temperature</span>
            {(['C', 'F'] as const).map((u) => (
              <Chip key={u} selected={profile.temperatureUnit === u} onClick={() => save.mutate({ temperatureUnit: u })}>
                °{u}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Notifications">
          <Toggle
            checked={profile.notifyDiscoveriesEmail}
            onChange={(v) => save.mutate({ notifyDiscoveriesEmail: v })}
            disabled={!capabilities.email}
            label="Email me about strong new finds"
            description={capabilities.email ? 'At most once a week, only when new products match several pieces you own.' : 'Email notifications aren’t available right now.'}
          />
        </Section>

        <Section title="Password">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              changePw.mutate()
            }}
          >
            <Field label="Current password" htmlFor="pw-cur">
              <Input id="pw-cur" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw((x) => ({ ...x, current: e.target.value }))} />
            </Field>
            <Field label="New password" htmlFor="pw-new" hint="At least 10 characters.">
              <Input id="pw-new" type="password" autoComplete="new-password" required minLength={10} value={pw.next} onChange={(e) => setPw((x) => ({ ...x, next: e.target.value }))} />
            </Field>
            {pwError && (
              <p role="alert" className="text-[13px] text-[#a1352a] sm:col-span-2">
                {pwError}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" variant="light" loading={changePw.isPending} disabled={!pw.current || pw.next.length < 10}>
                Change password
              </Button>
            </div>
          </form>
        </Section>

        <Section title="Privacy & data" description="Your photos are private and stored securely. They are processed to recognise garments and are never sold or used to train AI models.">
          <div className="flex flex-wrap gap-2">
            <Link to="/privacy" className="inline-flex h-11 items-center rounded-full border border-line px-6 text-[13px] uppercase hover:bg-white">
              Privacy notice
            </Link>
            <Button variant="ghost" onClick={exportData}>
              Download my data
            </Button>
          </div>
          <div className="mt-8 border-t border-line pt-6">
            <h3 className="text-[15px]">Delete account</h3>
            <p className="mt-1 max-w-[60ch] text-[14px] text-ink-soft">Permanently deletes your account, wardrobe, photos, looks, plans and saved finds. This can’t be undone.</p>
            <Button variant="danger" className="mt-4" onClick={() => setDeleting(true)}>
              Delete my account
            </Button>
          </div>
        </Section>
      </div>

      <Dialog
        open={deleting}
        onClose={() => {
          setDeleting(false)
          setDelPw('')
          setDelError(null)
        }}
        title="Delete your account?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => del.mutate()} loading={del.isPending} disabled={!delPw}>
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-ink-soft">All your photos and data will be permanently deleted. Enter your password to confirm.</p>
        <div className="mt-4">
          <Field label="Password" htmlFor="del-pw" error={delError}>
            <Input id="del-pw" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}
