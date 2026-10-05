import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import type { Item, Upload } from '../../lib/types'
import { usePageTitle } from '../hooks'
import { ItemEditor, changedFields, draftFrom, type ItemDraft } from '../parts/ItemEditor'
import { PageHeader } from '../parts/PageHeader'
import { Button, EmptyState, ErrorState, Img, PageLoader, Spinner } from '../ui'
import { useToast } from '../ui/toast'

function ReviewCard({ item }: { item: Item }) {
  const [draft, setDraft] = useState<ItemDraft>(() => draftFrom(item))
  const [more, setMore] = useState(false)
  const [image, setImage] = useState(false)
  const qc = useQueryClient()
  const toast = useToast()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['review'] })
    qc.invalidateQueries({ queryKey: ['facets'] })
    qc.invalidateQueries({ queryKey: ['wardrobe'] })
    qc.invalidateQueries({ queryKey: ['uploads'] })
  }
  const accept = useMutation({
    mutationFn: () => api(`/wardrobe/${item.id}`, { method: 'PATCH', body: { ...changedFields(item, draft), category: draft.category, status: 'active' } }),
    onSuccess: () => {
      toast(`${draft.name || 'Piece'} added to your wardrobe.`)
      done()
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const discard = useMutation({
    mutationFn: () => api(`/wardrobe/${item.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Discarded.')
      done()
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  const needsDetails = !item.aiTagged
  return (
    <article className="grid gap-5 rounded-[28px] bg-white/70 p-3 sm:p-4 md:grid-cols-[260px_1fr] md:gap-7" style={{ animation: 'fade-up 400ms both' }}>
      <div>
        <button type="button" onClick={() => setImage(true)} className="block w-full" aria-label="View larger photo">
          <Img src={item.thumbUrl} alt={draft.name || 'Uploaded garment'} className="aspect-[3/4] w-full rounded-[20px]" />
        </button>
        <p className="mt-2 px-1 text-[12px] text-ink-soft">
          {needsDetails ? 'Add a few details so your stylist can use this piece.' : item.aiConfidence != null && item.aiConfidence < 0.6 ? 'We weren’t sure about this one. Please check the details.' : 'Detected from your photo. Check it looks right.'}
        </p>
      </div>
      <div className="flex flex-col py-1 pr-1">
        <ItemEditor item={item} draft={draft} onChange={(d) => setDraft((x) => ({ ...x, ...d }))} compact={!more} />
        <button type="button" onClick={() => setMore((v) => !v)} className="mt-4 self-start text-[12px] uppercase text-ink-soft underline-offset-4 hover:text-ink hover:underline" aria-expanded={more}>
          {more ? 'Fewer details' : 'More details: occasions, seasons, fit'}
        </button>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => accept.mutate()} loading={accept.isPending} disabled={!draft.category}>
            Add to wardrobe
          </Button>
          <Button variant="ghost" onClick={() => discard.mutate()} loading={discard.isPending}>
            Discard
          </Button>
        </div>
      </div>
      {image && (
        <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setImage(false)}>
          <Img src={item.imageUrl ?? item.thumbUrl} alt="" fit="contain" className="max-h-[90vh] max-w-full rounded-[18px]" />
        </div>
      )}
    </article>
  )
}

export default function Review() {
  usePageTitle('Review new pieces')
  const qc = useQueryClient()
  const toast = useToast()
  // Photos still being tagged by the background worker; poll until they land here.
  const uploads = useQuery({
    queryKey: ['uploads'],
    queryFn: () => api<{ uploads: Upload[] }>('/uploads'),
    refetchInterval: (q) => (q.state.data?.uploads.some((u) => u.recognitionStatus === 'pending' || u.recognitionStatus === 'running') ? 2500 : false),
  })
  const tagging = uploads.data?.uploads.filter((u) => u.recognitionStatus === 'pending' || u.recognitionStatus === 'running').length ?? 0
  const review = useQuery({
    queryKey: ['review'],
    queryFn: () => api<{ items: Item[]; total: number }>('/wardrobe?status=review&limit=120&sort=oldest&full=true'),
    refetchInterval: tagging > 0 ? 2500 : false,
  })
  useEffect(() => {
    if (tagging === 0) qc.invalidateQueries({ queryKey: ['review'] })
  }, [tagging, qc])
  const ready = (review.data?.items ?? []).filter((i) => i.category && i.aiTagged)
  const all = useMutation({
    mutationFn: () => api<{ confirmed: number }>('/wardrobe/confirm', { body: { ids: ready.map((i) => i.id) } }),
    onSuccess: (r) => {
      toast(`${r.confirmed} ${r.confirmed === 1 ? 'piece' : 'pieces'} added to your wardrobe.`)
      qc.invalidateQueries({ queryKey: ['review'] })
      qc.invalidateQueries({ queryKey: ['facets'] })
      qc.invalidateQueries({ queryKey: ['wardrobe'] })
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })

  if (review.isLoading) return <PageLoader />
  if (review.isError) return <ErrorState message={errorMessage(review.error)} onRetry={() => review.refetch()} />
  const items = review.data?.items ?? []

  return (
    <div>
      <PageHeader
        eyebrow={<Link to="/app/wardrobe" className="underline-offset-4 hover:underline">← Wardrobe</Link>}
        lines={['Review new', 'pieces']}
        alt={['pieces']}
        sub="Check what we found in your photos. Correct anything that looks off. Your edits are kept and never overwritten."
      >
        {ready.length > 1 && (
          <Button onClick={() => all.mutate()} loading={all.isPending}>
            Add all {ready.length} as detected
          </Button>
        )}
      </PageHeader>
      {tagging > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-[20px] bg-white/70 px-5 py-4 text-[14px]" role="status">
          <Spinner className="h-4 w-4" /> Tagging {tagging} {tagging === 1 ? 'photo' : 'photos'}… new pieces appear here as they’re ready.
        </p>
      )}
      {items.length === 0 && tagging > 0 ? null : items.length === 0 ? (
        <EmptyState title="All caught up" body="There’s nothing waiting for review. New photos appear here once they’re tagged." action={<Link to="/app/wardrobe?upload=1" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">Add more clothes</Link>} />
      ) : (
        <div className="space-y-4">
          {items.map((i) => (
            <ReviewCard key={i.id} item={i} />
          ))}
        </div>
      )}
    </div>
  )
}
