import { useEffect, useState } from 'react'
import { COLOR_FAMILIES, DEPARTMENT_LABELS, DEPARTMENTS, FITS, OCCASION_LABELS, OCCASIONS, STYLES } from '../../shared/taxonomy'
import { api, errorMessage } from '../lib/api'
import type { Profile } from '../lib/types'
import { Button, Chip, ColorChips, Field, Input, MultiChips, Select, Spinner } from './ui'

export type Draft = Partial<Profile>

export function StylesEditor({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  return (
    <Field label="Styles you gravitate to" hint="Pick up to three.">
      <MultiChips label="Styles" options={STYLES} value={value.preferredStyles ?? []} onChange={(v) => onChange({ preferredStyles: v })} max={3} />
    </Field>
  )
}

export function ColorsEditor({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="space-y-6">
      <Field label="Colours you love wearing">
        <ColorChips label="Favourite colours" options={COLOR_FAMILIES.filter((c) => c !== 'multi')} value={value.favoriteColors ?? []} onChange={(v) => onChange({ favoriteColors: v, avoidColors: (value.avoidColors ?? []).filter((c) => !v.includes(c)) })} />
      </Field>
      <Field label="Colours you’d rather avoid" hint="Your stylist and finds will steer clear of these.">
        <ColorChips label="Colours to avoid" options={COLOR_FAMILIES.filter((c) => c !== 'multi')} value={value.avoidColors ?? []} onChange={(v) => onChange({ avoidColors: v, favoriteColors: (value.favoriteColors ?? []).filter((c) => !v.includes(c)) })} />
      </Field>
    </div>
  )
}

export function OccasionsEditor({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  return (
    <div className="space-y-6">
      <Field label="What do you usually dress for?">
        <MultiChips label="Occasions" options={OCCASIONS} labels={OCCASION_LABELS} value={value.occasions ?? []} onChange={(v) => onChange({ occasions: v })} />
      </Field>
      <Field label="How do you like things to fit?">
        <MultiChips label="Fit" options={FITS} value={value.fits ?? []} onChange={(v) => onChange({ fits: v })} />
      </Field>
    </div>
  )
}

export function ShoppingEditor({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const [brand, setBrand] = useState('')
  const brands = value.preferredBrands ?? []
  const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))))
  return (
    <div className="space-y-6">
      <Field label="Shop in">
        <div role="radiogroup" aria-label="Department" className="flex flex-wrap gap-2">
          {DEPARTMENTS.map((d) => (
            <Chip key={d} selected={(value.department ?? 'any') === d} onClick={() => onChange({ department: d })}>
              {DEPARTMENT_LABELS[d]}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-[1fr_1fr_110px] gap-3">
        <Field label="Budget from" htmlFor="bmin">
          <Input id="bmin" type="number" inputMode="numeric" min={0} placeholder="Any" value={value.budgetMin ?? ''} onChange={(e) => onChange({ budgetMin: num(e.target.value) })} />
        </Field>
        <Field label="Up to" htmlFor="bmax">
          <Input id="bmax" type="number" inputMode="numeric" min={0} placeholder="Any" value={value.budgetMax ?? ''} onChange={(e) => onChange({ budgetMax: num(e.target.value) })} />
        </Field>
        <Field label="Currency" htmlFor="cur">
          <Select id="cur" value={value.currency ?? 'USD'} onChange={(e) => onChange({ currency: e.target.value })}>
            {['USD', 'GBP', 'EUR', 'CAD', 'AUD'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Brands or shops you like" hint="Optional. Press Enter to add.">
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <button key={b} type="button" onClick={() => onChange({ preferredBrands: brands.filter((x) => x !== b) })} className="flex h-9 items-center gap-2 rounded-full bg-ink px-3.5 text-[13px] text-white" aria-label={`Remove ${b}`}>
              {b} <span aria-hidden="true">×</span>
            </button>
          ))}
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && brand.trim()) {
                e.preventDefault()
                if (!brands.includes(brand.trim()) && brands.length < 20) onChange({ preferredBrands: [...brands, brand.trim().slice(0, 60)] })
                setBrand('')
              }
            }}
            placeholder="Add a brand"
            aria-label="Add a brand"
            className="h-9 min-w-[140px] flex-1 rounded-full border border-line bg-white px-4 text-[13px] outline-none focus:border-ink"
          />
        </div>
      </Field>
    </div>
  )
}

type Place = { name: string; region: string | null; country: string | null; latitude: number; longitude: number }

export function LocationEditor({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    const t = setTimeout(async () => {
      setBusy(true)
      setError(null)
      try {
        const r = await api<{ places: Place[] }>(`/me/places?q=${encodeURIComponent(q.trim())}`)
        setResults(r.places)
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  return (
    <Field label="Your city" hint="Optional. Used only to look up the forecast so looks suit the weather." error={error}>
      {value.locationName ? (
        <div className="flex items-center justify-between gap-3 rounded-full bg-white px-5 py-3">
          <span className="text-[15px]">{value.locationName}</span>
          <Button size="sm" variant="ghost" onClick={() => onChange({ locationName: null, latitude: null, longitude: null })}>
            Remove
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for your city" aria-label="Search for your city" />
          {busy && <Spinner className="absolute right-4 top-3.5 h-5 w-5 text-mute" />}
          {results && (
            <ul className="mt-2 overflow-hidden rounded-[20px] bg-white" role="listbox" aria-label="Matching places">
              {results.length === 0 && <li className="px-5 py-3 text-[14px] text-ink-soft">No matching places.</li>}
              {results.map((p) => {
                const label = [p.name, p.region, p.country].filter(Boolean).join(', ')
                return (
                  <li key={`${p.latitude},${p.longitude}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        onChange({ locationName: label, latitude: p.latitude, longitude: p.longitude })
                        setQ('')
                        setResults(null)
                      }}
                      className="block w-full px-5 py-3 text-left text-[14px] hover:bg-page"
                    >
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}

/** Keys the profile endpoint accepts. */
export function profilePayload(d: Draft) {
  const keys = ['department', 'preferredStyles', 'favoriteColors', 'avoidColors', 'occasions', 'fits', 'budgetMin', 'budgetMax', 'currency', 'preferredBrands', 'locationName', 'latitude', 'longitude', 'temperatureUnit', 'notifyDiscoveriesEmail'] as const
  return Object.fromEntries(keys.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]))
}
