import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { OCCASION_LABELS, type Occasion } from '../../../shared/taxonomy'
import { api, errorMessage } from '../../lib/api'
import type { Item, Outfit } from '../../lib/types'
import { Button, Dialog, Heart, Img, Input, Spinner, cap } from '../ui'
import { useToast } from '../ui/toast'
import { itemLabel } from './ItemCard'

const MAIN = ['outerwear', 'top', 'dress', 'bottom']

/** Editorial composition: main pieces large, shoes and accessories as smaller tiles. */
export function OutfitCollage({ outfit, className = '' }: { outfit: Pick<Outfit, 'items'>; className?: string }) {
  const main = outfit.items.filter((i) => MAIN.includes(i.role))
  const small = outfit.items.filter((i) => !MAIN.includes(i.role))
  return (
    <div className={`grid gap-1.5 ${className}`} style={{ gridTemplateColumns: small.length ? '1fr 0.42fr' : '1fr' }}>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: main.length > 1 ? `repeat(${Math.min(main.length, 2)}, 1fr)` : '1fr' }}>
        {main.map((p, idx) => (
          <Img key={p.item.id} src={p.item.thumbUrl} alt={itemLabel(p.item)} className={`h-full w-full rounded-[14px] ${main.length === 3 && idx === 0 ? 'row-span-2' : ''} ${main.length === 1 ? 'aspect-[3/4]' : 'aspect-[3/4]'}`} />
        ))}
      </div>
      {small.length > 0 && (
        <div className="grid content-start gap-1.5">
          {small.map((p) => (
            <Img key={p.item.id} src={p.item.thumbUrl} alt={itemLabel(p.item)} className="aspect-square w-full rounded-[14px]" />
          ))}
        </div>
      )}
    </div>
  )
}

export function useOutfitActions(outfit: Outfit, onChange?: (o: Outfit) => void) {
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['looks'] })
    qc.invalidateQueries({ queryKey: ['look', outfit.id] })
    qc.invalidateQueries({ queryKey: ['insights'] })
  }
  const save = useMutation({
    mutationFn: (saved: boolean) => api(`/outfits/${outfit.id}/save`, { method: saved ? 'POST' : 'DELETE' }),
    onSuccess: (_d, saved) => {
      onChange?.({ ...outfit, saved })
      refresh()
      toast(saved ? 'Saved to your looks.' : 'Removed from saved looks.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const feedback = useMutation({
    mutationFn: (value: -1 | 0 | 1) => api(`/outfits/${outfit.id}/feedback`, { body: { value } }),
    onSuccess: (_d, value) => {
      onChange?.({ ...outfit, feedback: value })
      if (value) toast(value > 0 ? 'Noted. You’ll see more like this.' : 'Noted. You’ll see fewer combinations like this.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  return { save, feedback, refresh }
}

export function SwapDialog({ outfit, item, onClose, onSwapped }: { outfit: Outfit; item: Item | null; onClose: () => void; onSwapped: (o: Outfit) => void }) {
  const toast = useToast()
  const q = useQuery({
    queryKey: ['alternatives', outfit.id, item?.id],
    queryFn: () => api<{ alternatives: { item: Item; score: number }[] }>(`/outfits/${outfit.id}/alternatives?itemId=${item!.id}`),
    enabled: !!item,
  })
  const swap = useMutation({
    mutationFn: (withItemId: string) => api<{ outfit: Outfit }>(`/outfits/${outfit.id}/replace`, { body: { itemId: item!.id, withItemId } }),
    onSuccess: (r) => {
      onSwapped(r.outfit)
      toast('Swapped.')
      onClose()
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  return (
    <Dialog open={!!item} onClose={onClose} title={item ? `Swap the ${itemLabel(item).toLowerCase()}` : 'Swap'}>
      {q.isLoading && (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      )}
      {q.isError && <p className="text-[14px] text-ink-soft">{errorMessage(q.error)}</p>}
      {q.data && q.data.alternatives.length === 0 && <p className="py-6 text-[14px] text-ink-soft">You don’t have another piece of this type that works here yet.</p>}
      {q.data && q.data.alternatives.length > 0 && (
        <>
          <p className="mb-4 text-[13px] text-ink-soft">Ranked by how well each piece works with the rest of this look.</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {q.data.alternatives.map((a) => (
              <li key={a.item.id}>
                <button type="button" disabled={swap.isPending} onClick={() => swap.mutate(a.item.id)} className="group block w-full text-left">
                  <Img src={a.item.thumbUrl} alt="" className="aspect-[3/4] w-full rounded-[16px] transition-transform group-hover:scale-[0.98]" />
                  <p className="mt-1.5 truncate text-[12px]">{itemLabel(a.item)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  )
}

export function PlanDialog({ outfit, open, onClose }: { outfit: Outfit; open: boolean; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const toast = useToast()
  const qc = useQueryClient()
  const plan = useMutation({
    mutationFn: () => api('/plans', { body: { outfitId: outfit.id, date, occasion: outfit.occasion } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['looks'] })
      toast(`Planned for ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`)
      onClose()
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Plan this look"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => plan.mutate()} loading={plan.isPending}>
            Add to plan
          </Button>
        </>
      }
    >
      <label htmlFor="plan-date" className="mb-2 block text-[12px] uppercase text-ink-soft">
        Date
      </label>
      <Input id="plan-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      <p className="mt-3 text-[13px] text-ink-soft">Planned looks are kept in Saved looks too.</p>
    </Dialog>
  )
}

/** Full outfit presentation with every action wired to the API. */
export function OutfitCard({ outfit: initial, onChange, compact }: { outfit: Outfit; onChange?: (o: Outfit) => void; compact?: boolean }) {
  const [outfit, setOutfit] = useState(initial)
  const update = (o: Outfit) => {
    setOutfit(o)
    onChange?.(o)
  }
  const { save, feedback } = useOutfitActions(outfit, update)
  const [swapItem, setSwapItem] = useState<Item | null>(null)
  const [planning, setPlanning] = useState(false)
  return (
    <article className="overflow-hidden rounded-[28px] bg-white/70 p-3 sm:p-4" style={{ animation: 'fade-up 450ms both' }}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-6">
        <OutfitCollage outfit={outfit} />
        <div className="flex flex-col px-1 pb-1 sm:px-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              {outfit.occasion && <p className="text-[11px] uppercase text-mute">{OCCASION_LABELS[outfit.occasion as Occasion] ?? cap(outfit.occasion)}{outfit.style ? ` · ${cap(outfit.style)}` : ''}</p>}
              <h3 className="display mt-1 text-[26px] sm:text-[30px]">{outfit.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => save.mutate(!outfit.saved)}
              disabled={save.isPending}
              aria-pressed={outfit.saved}
              aria-label={outfit.saved ? 'Remove from saved looks' : 'Save look'}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${outfit.saved ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-ink hover:text-white'}`}
            >
              <Heart filled={outfit.saved} />
            </button>
          </div>
          <p className="mt-3 text-[14px] leading-[1.5] text-ink-soft">{outfit.explanation}</p>
          {!compact && outfit.factors.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {outfit.factors.slice(0, 4).map((f, i) => (
                <li key={i} className="grid grid-cols-[86px_1fr] gap-3 py-2.5 text-[13px] leading-snug">
                  <span className={`uppercase ${f.kind === 'caution' ? 'text-[#9a5b1e]' : ''}`}>{f.label}</span>
                  <span className="text-ink-soft">{f.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] uppercase text-mute">Pieces from your wardrobe</p>
          <ul className="mt-2 space-y-1.5">
            {outfit.items.map(({ role, item }) => (
              <li key={item.id} className="flex items-center gap-3 rounded-[14px] bg-white/80 p-1.5 pr-2">
                <Img src={item.thumbUrl} alt="" className="h-11 w-11 rounded-[10px]" />
                <Link to={`/app/wardrobe/${item.id}`} className="min-w-0 flex-1 truncate text-[13px] underline-offset-4 hover:underline">
                  {itemLabel(item)}
                  <span className="ml-1.5 text-[11px] text-mute">{cap(role)}</span>
                </Link>
                <button type="button" onClick={() => setSwapItem(item)} className="shrink-0 rounded-full px-3 py-1.5 text-[11px] uppercase text-ink-soft transition-colors hover:bg-ink hover:text-white">
                  Swap
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Button size="sm" variant="light" onClick={() => setPlanning(true)}>
              Plan it
            </Button>
            <div className="ml-auto flex items-center gap-1" role="group" aria-label="Rate this look">
              <button type="button" aria-pressed={outfit.feedback === 1} aria-label="More like this" onClick={() => feedback.mutate(outfit.feedback === 1 ? 0 : 1)} className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${outfit.feedback === 1 ? 'bg-ink text-white' : 'bg-white hover:bg-page'}`}>
                <Thumb />
              </button>
              <button type="button" aria-pressed={outfit.feedback === -1} aria-label="Fewer like this" onClick={() => feedback.mutate(outfit.feedback === -1 ? 0 : -1)} className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${outfit.feedback === -1 ? 'bg-ink text-white' : 'bg-white hover:bg-page'}`}>
                <Thumb down />
              </button>
            </div>
          </div>
        </div>
      </div>
      <SwapDialog outfit={outfit} item={swapItem} onClose={() => setSwapItem(null)} onSwapped={update} />
      <PlanDialog outfit={outfit} open={planning} onClose={() => setPlanning(false)} />
    </article>
  )
}

function Thumb({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${down ? 'rotate-180' : ''}`} aria-hidden="true">
      <path d="M7 11v9H4v-9h3Zm0 0 4-7c1.5 0 2.5 1 2 2.8L12.5 10H18a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17 20H7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** Compact card for grids of saved looks. */
export function LookTile({ outfit }: { outfit: Outfit }) {
  return (
    <Link to={`/app/looks/${outfit.id}`} className="group block rounded-[24px] bg-white/70 p-2.5 transition-colors hover:bg-white">
      <OutfitCollage outfit={outfit} />
      <div className="px-1.5 pb-1 pt-3">
        <p className="text-[11px] uppercase text-mute">{outfit.occasion ? (OCCASION_LABELS[outfit.occasion as Occasion] ?? cap(outfit.occasion)) : 'Look'}</p>
        <p className="display mt-0.5 truncate text-[20px]">{outfit.title}</p>
      </div>
    </Link>
  )
}
