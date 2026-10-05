import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, errorMessage, uploadFile } from '../../lib/api'
import type { Item } from '../../lib/types'
import { useMe, usePageTitle } from '../hooks'
import { itemLabel } from '../parts/ItemCard'
import { ItemEditor, changedFields, draftFrom, type ItemDraft } from '../parts/ItemEditor'
import { Button, ConfirmDialog, ErrorState, Heart, Img, PageLoader, Toggle } from '../ui'
import { useToast } from '../ui/toast'

type Detail = { item: Item; pairsWithCount: number; pairsWith: Item[]; savedLookCount: number }

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const me = useMe()
  const q = useQuery({ queryKey: ['item', id], queryFn: () => api<Detail>(`/wardrobe/${id}`) })
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replacing, setReplacing] = useState<number | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const item = q.data?.item
  usePageTitle(item ? itemLabel(item) : 'Piece')
  useEffect(() => {
    if (item) setDraft(draftFrom(item))
  }, [item])

  const refresh = (data?: { item: Item }) => {
    if (data) qc.setQueryData<Detail>(['item', id], (d) => (d ? { ...d, item: data.item } : d))
    qc.invalidateQueries({ queryKey: ['item', id] })
    qc.invalidateQueries({ queryKey: ['wardrobe'] })
    qc.invalidateQueries({ queryKey: ['facets'] })
  }
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ item: Item }>(`/wardrobe/${id}`, { method: 'PATCH', body }),
    onSuccess: (d) => refresh(d),
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const remove = useMutation({
    mutationFn: () => api(`/wardrobe/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wardrobe'] })
      qc.invalidateQueries({ queryKey: ['facets'] })
      toast('Deleted from your wardrobe.')
      navigate('/app/wardrobe', { replace: true })
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const reanalyze = useMutation({
    mutationFn: () => api<{ item: Item }>(`/wardrobe/${id}/reanalyze`, { method: 'POST' }),
    onSuccess: (d) => {
      refresh(d)
      setDraft(draftFrom(d.item))
      toast('Details refreshed from the photo. Your own edits were kept.')
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })

  if (q.isLoading || (!draft && item)) return <PageLoader />
  if (q.isError || !item || !draft) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />

  const changes = changedFields(item, draft)
  const dirty = Object.keys(changes).length > 0

  const replaceImage = (file: File) => {
    setReplacing(0)
    const { promise } = uploadFile<{ item: Item }>(`/wardrobe/${id}/image`, file, (p) => setReplacing(p), 'PUT')
    promise
      .then((d) => {
        refresh(d)
        toast('Photo replaced.')
      })
      .catch((e) => toast(errorMessage(e), { tone: 'error' }))
      .finally(() => setReplacing(null))
  }

  return (
    <div>
      <Link to="/app/wardrobe" className="text-[12px] uppercase text-mute underline-offset-4 hover:text-ink hover:underline">
        ← Wardrobe
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative overflow-hidden rounded-[28px] bg-card">
            <Img src={item.imageUrl ?? item.thumbUrl} alt={itemLabel(item)} className="aspect-[4/5] w-full" />
            {replacing !== null && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-[13px] text-white" role="status">
                Uploading {Math.round(replacing * 100)}%
              </div>
            )}
            <button
              type="button"
              onClick={() => patch.mutate({ favorite: !item.favorite })}
              aria-pressed={item.favorite}
              aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
              className={`absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full backdrop-blur transition-colors ${item.favorite ? 'bg-ink text-white' : 'bg-white/85 text-ink'}`}
            >
              <Heart filled={item.favorite} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="light" onClick={() => fileInput.current?.click()} disabled={replacing !== null}>
              Replace photo
            </Button>
            {me.data?.capabilities.autoTagging && (
              <Button size="sm" variant="light" onClick={() => reanalyze.mutate()} loading={reanalyze.isPending}>
                Re-detect details
              </Button>
            )}
            <input ref={fileInput} type="file" accept="image/*" className="sr-only" aria-label="Choose a replacement photo" onChange={(e) => e.target.files?.[0] && replaceImage(e.target.files[0])} />
          </div>
        </div>

        <div>
          <p className="text-[12px] uppercase text-mute">{item.status === 'archived' ? 'Archived' : item.status === 'review' ? 'Waiting for review' : `In your wardrobe since ${new Date(item.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}</p>
          <h1 className="display mt-2 text-[clamp(32px,4vw,52px)]">{itemLabel(item)}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-full bg-white/70 px-3 py-1.5">Pairs with {q.data!.pairsWithCount} {q.data!.pairsWithCount === 1 ? 'piece' : 'pieces'}</span>
            <span className="rounded-full bg-white/70 px-3 py-1.5">In {q.data!.savedLookCount} saved {q.data!.savedLookCount === 1 ? 'look' : 'looks'}</span>
          </div>
          {item.status === 'active' && (
            <Link to={`/app/style?include=${item.id}`} className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white transition-colors hover:bg-[#2e2f31]">
              Style this piece
            </Link>
          )}

          <section className="mt-8 rounded-[28px] bg-white/70 p-5 sm:p-7" aria-label="Details">
            <ItemEditor item={item} draft={draft} onChange={(d) => setDraft((x) => (x ? { ...x, ...d } : x))} />
            <div className="sticky bottom-24 mt-6 flex flex-wrap gap-2 lg:bottom-4">
              <Button onClick={() => patch.mutate({ ...changes, ...(item.status === 'review' && draft.category ? { status: 'active' } : {}) }, { onSuccess: () => toast('Saved.') })} disabled={!dirty && item.status !== 'review'} loading={patch.isPending}>
                {item.status === 'review' ? 'Save and add to wardrobe' : 'Save changes'}
              </Button>
              {dirty && (
                <Button variant="ghost" onClick={() => setDraft(draftFrom(item))}>
                  Undo changes
                </Button>
              )}
            </div>
          </section>

          <section className="mt-6 space-y-5 rounded-[28px] bg-white/70 p-5 sm:p-7" aria-label="Styling options">
            <Toggle checked={!item.excludeFromStyling} onChange={(v) => patch.mutate({ excludeFromStyling: !v })} label="Use in outfit suggestions" description="Turn off for pieces that are at the tailor, packed away or you’re not wearing right now." />
          </section>

          {q.data!.pairsWith.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[12px] uppercase text-ink-soft">Works with</h2>
              <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                {q.data!.pairsWith.map((p) => (
                  <li key={p.id}>
                    <Link to={`/app/wardrobe/${p.id}`} className="block">
                      <Img src={p.thumbUrl} alt={itemLabel(p)} className="aspect-[3/4] w-full rounded-[14px]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
            {item.status === 'active' && (
              <Button variant="ghost" onClick={() => patch.mutate({ status: 'archived' }, { onSuccess: () => toast('Archived. It won’t appear in outfits.') })}>
                Archive
              </Button>
            )}
            {item.status === 'archived' && (
              <Button variant="ghost" onClick={() => patch.mutate({ status: 'active' }, { onSuccess: () => toast('Back in your wardrobe.') })}>
                Restore to wardrobe
              </Button>
            )}
            <Button variant="ghost" className="!text-[#8f2a20]" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Delete this piece?"
        body="It will be removed from your wardrobe and from any saved looks, and its photo will be deleted. This can’t be undone. To keep it but hide it from outfits, archive it instead."
        confirmLabel="Delete"
      />
    </div>
  )
}
