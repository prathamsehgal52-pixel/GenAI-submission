import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { COLOR_FAMILIES, OCCASION_LABELS, OCCASIONS, STYLES, type Occasion } from '../../../shared/taxonomy'
import { api, errorMessage } from '../../lib/api'
import type { Item, Outfit } from '../../lib/types'
import { useMe, usePageTitle } from '../hooks'
import { itemLabel } from '../parts/ItemCard'
import { ItemPicker } from '../parts/ItemPicker'
import { OutfitCard } from '../parts/Outfit'
import { PageHeader } from '../parts/PageHeader'
import { Button, Chip, ColorChips, EmptyState, ErrorState, Field, Img, Input, Notice, Select, Spinner, Toggle, cap } from '../ui'

type Result =
  | { status: 'complete'; requestId: string; outfits: Outfit[]; weather: { summary: string; locationName: string; date: string } | null; source: 'ai' | 'rules'; cached: boolean }
  | { status: 'insufficient'; requestId: string; missing: string[]; message: string }

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function StyleMe() {
  usePageTitle('Style me')
  const me = useMe()
  const [params] = useSearchParams()
  const today = iso(new Date())
  const tomorrow = iso(new Date(Date.now() + 86400000))
  const [occasion, setOccasion] = useState<Occasion>((params.get('occasion') as Occasion) || (me.data?.profile.occasions[0] as Occasion) || 'everyday')
  const [style, setStyle] = useState('')
  const [formality, setFormality] = useState(0)
  const [date, setDate] = useState(params.get('date') ?? today)
  const [useWeather, setUseWeather] = useState(true)
  const [colors, setColors] = useState<string[]>([])
  const [include, setInclude] = useState<Item[]>([])
  const [avoid, setAvoid] = useState<Item[]>([])
  const [notes, setNotes] = useState('')
  const [picker, setPicker] = useState<'include' | 'avoid' | null>(null)
  const [more, setMore] = useState(false)
  const [seen, setSeen] = useState<string[]>([])
  const results = useRef<HTMLDivElement>(null)

  // Deep link from an item page: /app/style?include=<id>
  const includeId = params.get('include')
  const preItem = useQuery({ queryKey: ['item', includeId], queryFn: () => api<{ item: Item }>(`/wardrobe/${includeId}`), enabled: !!includeId })
  useEffect(() => {
    if (preItem.data) setInclude([preItem.data.item])
  }, [preItem.data])

  const style_ = useMutation({
    mutationFn: (regenerate: boolean) =>
      api<Result>('/styling', {
        body: {
          occasion,
          style: style || undefined,
          formality: formality || undefined,
          date,
          useWeather,
          preferredColors: colors,
          includeItemIds: include.map((i) => i.id),
          avoidItemIds: avoid.map((i) => i.id),
          notes: notes.trim() || undefined,
          count: 3,
          excludeOutfitIds: regenerate ? seen : [],
        },
      }),
    onSuccess: (r, regenerate) => {
      if (r.status === 'complete') setSeen((s) => (regenerate ? [...s, ...r.outfits.map((o) => o.id)] : r.outfits.map((o) => o.id)))
      setTimeout(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    },
  })

  const autoRan = useRef(false)
  useEffect(() => {
    if (params.get('auto') === '1' && !autoRan.current && me.data) {
      autoRan.current = true
      style_.mutate(false)
    }
  }, [params, me.data, style_])

  const hasLocation = me.data?.profile.latitude != null
  const r = style_.data

  return (
    <div>
      <PageHeader eyebrow="Your stylist" lines={['Style', 'me.']} alt={['me.']} sub="Tell your stylist where you’re going. Every look is built only from pieces in your wardrobe." />
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
        <form
          className="space-y-6 lg:sticky lg:top-24 lg:self-start"
          onSubmit={(e) => {
            e.preventDefault()
            style_.mutate(false)
          }}
        >
          <Field label="Occasion">
            <div role="radiogroup" aria-label="Occasion" className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip key={o} selected={occasion === o} onClick={() => setOccasion(o)}>
                  {OCCASION_LABELS[o]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="When">
            <div className="flex flex-wrap gap-2">
              <Chip selected={date === today} onClick={() => setDate(today)}>
                Today
              </Chip>
              <Chip selected={date === tomorrow} onClick={() => setDate(tomorrow)}>
                Tomorrow
              </Chip>
              <input type="date" aria-label="Pick a date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 rounded-full border border-line bg-white/60 px-3 text-[13px] outline-none focus:border-ink" />
            </div>
          </Field>
          {me.data?.capabilities.weather && (
            <div className="rounded-[20px] bg-white/70 p-4">
              {hasLocation ? (
                <Toggle checked={useWeather} onChange={setUseWeather} label={`Dress for the weather in ${me.data.profile.locationName?.split(',')[0]}`} description="Uses the forecast for the day you pick, when one is available." />
              ) : (
                <p className="text-[13px] text-ink-soft">
                  <Link to="/app/settings#location" className="text-ink underline underline-offset-2">Add your city</Link> to factor the forecast into your looks.
                </p>
              )}
            </div>
          )}
          <Field label="Wear this">
            <div className="flex flex-wrap items-center gap-2">
              {include.map((i) => (
                <span key={i.id} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[13px]">
                  <Img src={i.thumbUrl} alt="" className="h-7 w-7 rounded-full" />
                  {itemLabel(i)}
                  <button type="button" aria-label={`Remove ${itemLabel(i)}`} onClick={() => setInclude((x) => x.filter((y) => y.id !== i.id))}>
                    ×
                  </button>
                </span>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setPicker('include')}>
                {include.length ? 'Change' : 'Choose pieces'}
              </Button>
            </div>
          </Field>
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="text-[12px] uppercase text-ink-soft underline-offset-4 hover:text-ink hover:underline">
            {more ? 'Fewer options' : 'More options: style, formality, colours'}
          </button>
          {more && (
            <div className="space-y-6" style={{ animation: 'fade-up 300ms both' }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Style" htmlFor="style">
                  <Select id="style" value={style} onChange={(e) => setStyle(e.target.value)}>
                    <option value="">My usual</option>
                    {STYLES.map((s) => (
                      <option key={s} value={s}>
                        {cap(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Formality" htmlFor="formality">
                  <Select id="formality" value={formality} onChange={(e) => setFormality(Number(e.target.value))}>
                    <option value={0}>Match occasion</option>
                    <option value={1}>Very casual</option>
                    <option value={2}>Casual</option>
                    <option value={3}>Smart casual</option>
                    <option value={4}>Smart</option>
                    <option value={5}>Formal</option>
                  </Select>
                </Field>
              </div>
              <Field label="Colours to feature">
                <ColorChips label="Colours to feature" options={COLOR_FAMILIES.filter((c) => c !== 'multi')} value={colors} onChange={(v) => setColors(v.slice(0, 6))} />
              </Field>
              <Field label="Not this">
                <div className="flex flex-wrap items-center gap-2">
                  {avoid.map((i) => (
                    <span key={i.id} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[13px]">
                      <Img src={i.thumbUrl} alt="" className="h-7 w-7 rounded-full" />
                      {itemLabel(i)}
                      <button type="button" aria-label={`Remove ${itemLabel(i)}`} onClick={() => setAvoid((x) => x.filter((y) => y.id !== i.id))}>
                        ×
                      </button>
                    </span>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setPicker('avoid')}>
                    {avoid.length ? 'Change' : 'Choose pieces'}
                  </Button>
                </div>
              </Field>
              <Field label="Anything else?" htmlFor="notes" hint="e.g. “lots of walking”, “outdoor dinner”">
                <Input id="notes" value={notes} maxLength={240} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          )}
          <Button type="submit" className="w-full" loading={style_.isPending && !style_.variables}>
            Style me
          </Button>
        </form>

        <div ref={results} className="scroll-mt-24">
          {style_.isPending && !r && (
            <div className="grid min-h-[420px] place-items-center rounded-[28px] bg-white/50" role="status">
              <div className="flex flex-col items-center gap-3 text-ink-soft">
                <Spinner className="h-6 w-6" />
                <p className="text-[14px]">Putting looks together from your wardrobe…</p>
              </div>
            </div>
          )}
          {style_.isError && <ErrorState message={errorMessage(style_.error)} onRetry={() => style_.mutate(false)} />}
          {!style_.isPending && !r && !style_.isError && (
            <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-line p-8 text-center">
              <div>
                <p className="display text-[30px]">Your looks appear here</p>
                <p className="mt-2 text-[14px] text-ink-soft">Choose an occasion and press Style me.</p>
              </div>
            </div>
          )}
          {r?.status === 'insufficient' && (
            <EmptyState
              title={r.missing.length ? 'A few more pieces needed' : 'No match for this brief'}
              body={r.message}
              action={
                r.missing.length ? (
                  <Link to="/app/wardrobe?upload=1" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
                    Add clothes
                  </Link>
                ) : undefined
              }
            />
          )}
          {r?.status === 'complete' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-ink-soft">
                  {r.weather ? `Forecast for ${r.weather.locationName.split(',')[0]}: ${r.weather.summary}.` : useWeather && hasLocation ? 'No forecast available for this date, so weather wasn’t considered.' : `${r.outfits.length} ${r.outfits.length === 1 ? 'look' : 'looks'} from your wardrobe.`}
                </p>
                <Button size="sm" variant="light" onClick={() => style_.mutate(true)} loading={style_.isPending && style_.variables === true}>
                  Show me different looks
                </Button>
              </div>
              {!me.data?.capabilities.aiStylist && <Notice>Your stylist’s written notes are unavailable right now. These looks are matched on colour, formality and occasion.</Notice>}
              {r.outfits.map((o) => (
                <OutfitCard key={o.id} outfit={o} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ItemPicker key={`inc-${picker}`} open={picker === 'include'} onClose={() => setPicker(null)} title="Wear this" max={3} selected={include.map((i) => i.id)} onDone={(_, items) => setInclude(items)} />
      <ItemPicker key={`av-${picker}`} open={picker === 'avoid'} onClose={() => setPicker(null)} title="Not this" max={50} selected={avoid.map((i) => i.id)} onDone={(_, items) => setAvoid(items)} />
    </div>
  )
}
