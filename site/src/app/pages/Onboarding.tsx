import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { GlyphText } from '../../components/GlyphText'
import { Logo } from '../../components/Hero'
import { Photo } from '../../components/Photo'
import { api, errorMessage } from '../../lib/api'
import type { Me } from '../../lib/types'
import { journey, usePageTitle } from '../hooks'
import { ColorsEditor, LocationEditor, OccasionsEditor, profilePayload, ShoppingEditor, StylesEditor, type Draft } from '../prefs'
import { Button } from '../ui'

const steps = [
  { key: 'consent', title: ['How your', 'photos are used'], alt: 'photos', image: '/images/rack-whites.jpg' },
  { key: 'style', title: ['Tell us your', 'style.'], alt: 'style.', image: '/images/look-work.jpg' },
  { key: 'colors', title: ['Your', 'colours.'], alt: 'colours.', image: '/images/knit-rack.jpg' },
  { key: 'occasions', title: ['Your', 'days.'], alt: 'days.', image: '/images/look-weekend.jpg' },
  { key: 'shopping', title: ['How you', 'shop.'], alt: 'shop.', image: '/images/knit-poncho.jpg' },
  { key: 'location', title: ['Dress for the', 'weather.'], alt: 'weather.', image: '/images/look-denim.jpg' },
] as const

export default function Onboarding() {
  usePageTitle('Welcome')
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  const [draft, setDraft] = useState<Draft>({ department: 'any', currency: 'USD' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()
  const s = steps[step]
  const update = (d: Draft) => setDraft((x) => ({ ...x, ...d }))
  const last = step === steps.length - 1

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ profile: Me['profile'] }>('/me/onboarding', { body: { imageConsent: true, profile: profilePayload(draft) } })
      // The onboarding route guard sees the completed profile and continues to the first upload.
      journey.justOnboarded = true
      qc.setQueryData<Me | null>(['me'], (m) => (m ? { ...m, profile: res.profile } : m))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-[14px]">
      <div className="grid min-h-[calc(100vh-16px)] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#bfd2d8_0%,#d3e0e3_45%,#eceeef_100%)] sm:rounded-[28px] lg:min-h-[calc(100vh-28px)] lg:grid-cols-[1fr_1.15fr]">
        <div className="relative hidden lg:block">
          <Photo key={s.image} src={s.image} alt="" crop={{ position: '50% 30%' }} className="absolute inset-3 rounded-[22px]" />
        </div>
        <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
          <div className="flex items-center justify-between">
            <Logo />
            <p className="text-[12px] uppercase text-ink-soft">
              Step {step + 1} of {steps.length}
            </p>
          </div>
          <div className="mt-6 flex gap-1.5" aria-hidden="true">
            {steps.map((x, i) => (
              <span key={x.key} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-ink' : 'bg-white/70'}`} />
            ))}
          </div>

          <div className="mx-auto w-full max-w-[560px] flex-1 py-10">
            <GlyphText key={s.key} as="h1" trigger="load" lines={[...s.title]} altWords={[s.alt]} className="display text-[clamp(36px,4.6vw,60px)]" />

            <div className="mt-8" key={`b-${s.key}`} style={{ animation: 'fade-up 400ms both' }}>
              {s.key === 'consent' && (
                <div className="space-y-4 text-[15px] leading-[1.55] text-ink-soft">
                  <p>Armoire builds your digital wardrobe from photos you upload of clothes you own. Here’s exactly what happens to them:</p>
                  <ul className="space-y-2.5 rounded-[22px] bg-white/70 p-5 text-[14px]">
                    <li>• Photos are stored privately. Only you can see them, through short-lived secure links.</li>
                    <li>• Location data and other hidden metadata are removed from every photo when it’s uploaded.</li>
                    <li>• Photos are sent to our AI provider to recognise each garment’s type, colours and details. They are not used to train AI models.</li>
                    <li>• Your style preferences shape your outfits and shopping suggestions. We never sell your data.</li>
                    <li>• You can export or permanently delete everything at any time in Settings.</li>
                  </ul>
                  <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-white px-4 py-3.5 text-ink">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[#121212]" />
                    <span className="text-[14px]">
                      I agree to my clothing photos being processed as described. Read the full{' '}
                      <Link to="/privacy" target="_blank" className="underline underline-offset-2">
                        privacy notice
                      </Link>
                      .
                    </span>
                  </label>
                </div>
              )}
              {s.key === 'style' && <StylesEditor value={draft} onChange={update} />}
              {s.key === 'colors' && <ColorsEditor value={draft} onChange={update} />}
              {s.key === 'occasions' && <OccasionsEditor value={draft} onChange={update} />}
              {s.key === 'shopping' && <ShoppingEditor value={draft} onChange={update} />}
              {s.key === 'location' && <LocationEditor value={draft} onChange={update} />}
            </div>

            {error && (
              <p role="alert" className="mt-6 rounded-[16px] bg-[#f4dfdb] px-4 py-3 text-[13px] text-[#7a231b]">
                {error}
              </p>
            )}

            <div className="mt-10 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep((x) => x - 1)} className={`text-[13px] uppercase text-ink-soft underline-offset-4 hover:text-ink hover:underline ${step === 0 ? 'invisible' : ''}`}>
                Back
              </button>
              <div className="flex gap-2">
                {step > 0 && !last && (
                  <Button variant="ghost" onClick={() => setStep((x) => x + 1)}>
                    Skip
                  </Button>
                )}
                {last ? (
                  <Button onClick={finish} loading={busy}>
                    Start my wardrobe
                  </Button>
                ) : (
                  <Button onClick={() => setStep((x) => x + 1)} disabled={step === 0 && !consent}>
                    Continue
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
