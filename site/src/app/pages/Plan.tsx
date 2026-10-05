import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import type { DayForecast, Outfit } from '../../lib/types'
import { useMe, usePageTitle } from '../hooks'
import { OutfitCollage } from '../parts/Outfit'
import { PageHeader } from '../parts/PageHeader'
import { Button, Dialog, ErrorState, IconButton, PageLoader, Spinner, formatTemp } from '../ui'
import { useToast } from '../ui/toast'

type PlanRow = { id: string; date: string; occasion: string | null; note: string | null; worn: boolean; outfit: Outfit }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => new Date(`${s}T12:00:00`)
function weekStart(d: Date) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function AddLook({ date, open, onClose }: { date: string | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const looks = useQuery({ queryKey: ['looks'], queryFn: () => api<{ outfits: Outfit[] }>('/outfits?saved=true'), enabled: open })
  const add = useMutation({
    mutationFn: (outfitId: string) => api('/plans', { body: { outfitId, date } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast('Added to your plan.')
      onClose()
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  return (
    <Dialog open={open} onClose={onClose} wide title={date ? parse(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Add a look'}>
      {looks.isLoading && (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      )}
      {looks.data?.outfits.length === 0 && (
        <div className="py-8 text-center text-[14px] text-ink-soft">
          You have no saved looks yet.{' '}
          <Link to="/app/style" className="text-ink underline underline-offset-2">
            Get styled
          </Link>{' '}
          and save the ones you like.
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {looks.data?.outfits.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => add.mutate(o.id)} disabled={add.isPending} className="block w-full rounded-[20px] bg-white/70 p-2 text-left transition-colors hover:bg-white">
              <OutfitCollage outfit={o} />
              <p className="mt-2 truncate px-1 text-[13px]">{o.title}</p>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

export default function Plan() {
  usePageTitle('Plan')
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const start = weekStart(params.get('week') ? parse(params.get('week')!) : new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return iso(d)
  })
  const [adding, setAdding] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['plans', days[0]], queryFn: () => api<{ plans: PlanRow[]; forecast: DayForecast[] }>(`/plans?from=${days[0]}&to=${days[6]}`) })
  const patch = useMutation({
    mutationFn: ({ id, worn }: { id: string; worn: boolean }) => api(`/plans/${id}`, { method: 'PATCH', body: { worn } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
      if (v.worn) toast('Marked as worn.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast('Removed from your plan.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const shift = (weeks: number) => {
    const d = new Date(start)
    d.setDate(d.getDate() + weeks * 7)
    setParams({ week: iso(d) }, { replace: true })
  }
  const today = iso(new Date())
  const unit = me.data?.profile.temperatureUnit ?? 'C'
  const label = `${parse(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parse(days[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <div>
      <PageHeader eyebrow={label} lines={['Your', 'week.']} alt={['week.']}>
        <IconButton label="Previous week" onClick={() => shift(-1)}>
          ‹
        </IconButton>
        <Button size="sm" variant="light" onClick={() => setParams({}, { replace: true })}>
          This week
        </Button>
        <IconButton label="Next week" onClick={() => shift(1)}>
          ›
        </IconButton>
      </PageHeader>
      {q.isLoading ? (
        <PageLoader />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <ol className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const plans = q.data!.plans.filter((p) => p.date === d)
            const f = q.data!.forecast.find((x) => x.date === d)
            const past = d < today
            return (
              <li key={d} className={`flex min-h-[220px] flex-col rounded-[22px] p-3 ${d === today ? 'bg-white' : 'bg-white/55'}`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] uppercase">
                    {parse(d).toLocaleDateString(undefined, { weekday: 'short' })} <span className="text-mute">{parse(d).getDate()}</span>
                  </p>
                  {f && <p className="text-[11px] text-ink-soft" title={f.precipitationChance != null ? `${f.precipitationChance}% chance of rain` : undefined}>{formatTemp(f.maxC, unit)}</p>}
                </div>
                <div className="mt-2 flex-1 space-y-2">
                  {plans.map((p) => (
                    <div key={p.id} className="rounded-[16px] bg-page p-1.5">
                      <Link to={`/app/looks/${p.outfit.id}`} aria-label={p.outfit.title}>
                        <OutfitCollage outfit={p.outfit} />
                      </Link>
                      <p className="mt-1.5 truncate px-1 text-[12px]">{p.outfit.title}</p>
                      <div className="mt-1 flex items-center justify-between gap-1 px-1">
                        <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                          <input type="checkbox" checked={p.worn} onChange={(e) => patch.mutate({ id: p.id, worn: e.target.checked })} className="accent-[#121212]" />
                          Worn
                        </label>
                        <button type="button" onClick={() => remove.mutate(p.id)} className="text-[11px] uppercase text-mute hover:text-ink" aria-label={`Remove ${p.outfit.title} from ${d}`}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {!past && (
                  <button type="button" onClick={() => setAdding(d)} className="mt-2 h-9 rounded-full border border-dashed border-line text-[12px] uppercase text-ink-soft transition-colors hover:border-ink hover:text-ink">
                    + Add look
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {me.data?.capabilities.weather && me.data.profile.latitude == null && (
        <p className="mt-6 text-[13px] text-ink-soft">
          <Link to="/app/settings#location" className="text-ink underline underline-offset-2">Add your city</Link> to see the forecast beside each day.
        </p>
      )}
      <AddLook date={adding} open={!!adding} onClose={() => setAdding(null)} />
    </div>
  )
}
