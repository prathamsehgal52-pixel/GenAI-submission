import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CATEGORIES, CATEGORY_LABELS } from '../../../shared/taxonomy'
import { api } from '../../lib/api'
import type { Item } from '../../lib/types'
import { Button, Chip, Dialog, Img, Input, Spinner } from '../ui'
import { itemLabel } from './ItemCard'

/** Choose pieces from the active wardrobe (e.g. "wear this" / "not this"). */
export function ItemPicker({ open, onClose, title, selected, onDone, max }: { open: boolean; onClose: () => void; title: string; selected: string[]; onDone: (ids: string[], items: Item[]) => void; max: number }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>(selected)
  const items = useQuery({
    queryKey: ['wardrobe', 'picker', q, cat],
    queryFn: () => api<{ items: Item[] }>(`/wardrobe?limit=120${q ? `&q=${encodeURIComponent(q)}` : ''}${cat ? `&category=${cat}` : ''}`),
    enabled: open,
  })
  const all = useQuery({ queryKey: ['wardrobe', 'picker-all'], queryFn: () => api<{ items: Item[] }>('/wardrobe?limit=120'), enabled: open })
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? p : [...p, id]))
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <span className="mr-auto self-center text-[13px] text-ink-soft">
            {picked.length} of {max} selected
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onDone(picked, (all.data?.items ?? []).filter((i) => picked.includes(i.id)))
              onClose()
            }}
          >
            Done
          </Button>
        </>
      }
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your wardrobe" aria-label="Search your wardrobe" />
      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip selected={!cat} onClick={() => setCat(null)}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>
      {items.isLoading ? (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {items.data?.items.map((i) => {
            const on = picked.includes(i.id)
            return (
              <li key={i.id}>
                <button type="button" aria-pressed={on} onClick={() => toggle(i.id)} className={`relative block w-full overflow-hidden rounded-[16px] text-left ring-offset-2 ring-offset-page transition ${on ? 'ring-2 ring-ink' : ''}`}>
                  <Img src={i.thumbUrl} alt="" className="aspect-[3/4] w-full" />
                  {on && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-white">✓</span>}
                  <span className="block truncate px-1 py-1.5 text-[11px]">{itemLabel(i)}</span>
                </button>
              </li>
            )
          })}
          {items.data?.items.length === 0 && <li className="col-span-full py-8 text-center text-[14px] text-ink-soft">Nothing matches.</li>}
        </ul>
      )}
    </Dialog>
  )
}
