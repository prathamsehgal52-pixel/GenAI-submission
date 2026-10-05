import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import type { Outfit } from '../../lib/types'
import { usePageTitle } from '../hooks'
import { OutfitCard } from '../parts/Outfit'
import { Button, ConfirmDialog, ErrorState, PageLoader } from '../ui'
import { useToast } from '../ui/toast'

type Detail = { outfit: Outfit; plans: { id: string; date: string; worn: boolean }[] }

export default function LookDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const q = useQuery({ queryKey: ['look', id], queryFn: () => api<Detail>(`/outfits/${id}`) })
  usePageTitle(q.data?.outfit.title ?? 'Look')
  const del = useMutation({
    mutationFn: () => api(`/outfits/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['looks'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast('Look deleted.')
      navigate('/app/looks', { replace: true })
    },
    onError: (e) => toast(errorMessage(e), { tone: 'error' }),
  })
  if (q.isLoading) return <PageLoader />
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
  const { outfit, plans } = q.data
  const upcoming = plans.filter((p) => p.date >= new Date().toISOString().slice(0, 10))
  return (
    <div>
      <Link to="/app/looks" className="text-[12px] uppercase text-mute underline-offset-4 hover:text-ink hover:underline">
        ← Saved looks
      </Link>
      <div className="mt-4">
        <OutfitCard outfit={outfit} onChange={(o) => qc.setQueryData<Detail>(['look', id], (d) => (d ? { ...d, outfit: o } : d))} />
      </div>
      {upcoming.length > 0 && (
        <p className="mt-4 text-[13px] text-ink-soft">
          Planned for{' '}
          {upcoming.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link to={`/app/plan?week=${p.date}`} className="underline underline-offset-2">
                {new Date(`${p.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
      <div className="mt-8 border-t border-line pt-6">
        <Button variant="ghost" className="!text-[#8f2a20]" onClick={() => setConfirm(true)}>
          Delete look
        </Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => del.mutate()} loading={del.isPending} danger title="Delete this look?" body="It will be removed from your saved looks and your plan. The clothes stay in your wardrobe." confirmLabel="Delete" />
    </div>
  )
}
