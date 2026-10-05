import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { CATEGORY_SINGULAR, type Category } from '../../../shared/taxonomy'
import { api, errorMessage } from '../../lib/api'
import type { Item } from '../../lib/types'
import { Heart, Img } from '../ui'
import { useToast } from '../ui/toast'

export const itemLabel = (i: Pick<Item, 'name' | 'subcategory' | 'category'>) => i.name || i.subcategory || (i.category ? CATEGORY_SINGULAR[i.category as Category] : 'Untitled piece')

/** Wardrobe grid tile in the landing page's card language. */
export function ItemCard({ item, to }: { item: Item; to?: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const fav = useMutation({
    mutationFn: (favorite: boolean) => api(`/wardrobe/${item.id}`, { method: 'PATCH', body: { favorite } }),
    onMutate: async (favorite) => {
      qc.setQueriesData<{ items: Item[] }>({ queryKey: ['wardrobe'] }, (d) => (d ? { ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, favorite } : x)) } : d))
    },
    onError: (e) => {
      toast(errorMessage(e), { tone: 'error' })
      qc.invalidateQueries({ queryKey: ['wardrobe'] })
    },
  })
  return (
    <article className="group relative aspect-[3/4] overflow-hidden rounded-[18px] bg-card lg:rounded-[22px]">
      <Link to={to ?? `/app/wardrobe/${item.id}`} className="absolute inset-0 z-[1]" aria-label={`Open ${itemLabel(item)}`} />
      <Img src={item.thumbUrl} alt="" className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
      <div className="absolute right-2.5 top-2.5 z-[2] flex items-center gap-1 lg:right-3 lg:top-3">
        {item.category && <span className="hidden h-7 items-center rounded-full bg-white/85 px-3 text-[11px] backdrop-blur sm:inline-flex">{CATEGORY_SINGULAR[item.category as Category]}</span>}
        <button
          type="button"
          onClick={() => fav.mutate(!item.favorite)}
          aria-pressed={item.favorite}
          aria-label={item.favorite ? `Remove ${itemLabel(item)} from favourites` : `Add ${itemLabel(item)} to favourites`}
          className={`grid h-7 w-7 place-items-center rounded-full backdrop-blur transition-colors ${item.favorite ? 'bg-ink text-white' : 'bg-white/85 text-ink hover:bg-white'}`}
        >
          <Heart filled={item.favorite} className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-[2] rounded-[14px] bg-[#ededee]/90 px-3 py-2.5 backdrop-blur lg:inset-x-3 lg:bottom-3">
        <p className="truncate text-[12px] lg:text-[13px]">{itemLabel(item)}</p>
        <p className="truncate text-[11px] capitalize text-ink-soft">{item.colorNames[0] ?? item.colors[0] ?? 'Colour not set'}</p>
      </div>
    </article>
  )
}

export function ItemThumb({ item, className = '' }: { item: Item; className?: string }) {
  return <Img src={item.thumbUrl} alt={itemLabel(item)} className={`rounded-[14px] ${className}`} />
}
