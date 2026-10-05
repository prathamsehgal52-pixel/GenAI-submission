import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import type { Outfit } from '../../lib/types'
import { usePageTitle } from '../hooks'
import { LookTile } from '../parts/Outfit'
import { PageHeader } from '../parts/PageHeader'
import { EmptyState, ErrorState, Skeleton } from '../ui'

export default function Looks() {
  usePageTitle('Saved looks')
  const q = useQuery({ queryKey: ['looks'], queryFn: () => api<{ outfits: Outfit[] }>('/outfits?saved=true') })
  return (
    <div>
      <PageHeader eyebrow={q.data ? `${q.data.outfits.length} saved` : undefined} lines={['Saved', 'looks']} alt={['looks']}>
        <Link to="/app/style" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
          Style me
        </Link>
      </PageHeader>
      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data!.outfits.length === 0 ? (
        <EmptyState
          title="No saved looks yet"
          body="When your stylist puts together something you love, tap the heart to keep it here."
          action={<Link to="/app/style" className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">Get styled</Link>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {q.data!.outfits.map((o) => (
            <LookTile key={o.id} outfit={o} />
          ))}
        </div>
      )}
    </div>
  )
}
