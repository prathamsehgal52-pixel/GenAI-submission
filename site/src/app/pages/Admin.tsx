import { useQuery } from '@tanstack/react-query'
import { ApiError, api, errorMessage } from '../../lib/api'
import NotFound from './NotFound'
import { usePageTitle } from '../hooks'
import { PageHeader } from '../parts/PageHeader'
import { Card, ErrorState, PageLoader, timeAgo } from '../ui'

type Status = {
  environment: string
  configured: Record<string, boolean | string | null>
  health: { integration: string; lastSuccessAt: string | null; lastFailureAt: string | null; lastError: string | null }[]
  ai30d: { calls: number; failures: number; inputTokens: number; outputTokens: number; cost: string; p50: number; byOperation: { operation: string; calls: number; cost: string }[] }
  totals: { users: number; items: number; products: number; runs: number }
  queues: { name: string; state: string; n: number }[]
}

const LABELS: Record<string, string> = { ai: 'AI (garment recognition & stylist)', ebay: 'eBay Browse API', feed: 'Affiliate product feeds', email: 'Email delivery', weather: 'Weather (Open-Meteo)', storage: 'Object storage', errorReporting: 'Error reporting' }

/** Operator-only view (ADMIN_EMAILS). Shows configuration state, never secrets. */
export default function Admin() {
  usePageTitle('Operations')
  const q = useQuery({ queryKey: ['admin'], queryFn: () => api<Status>('/admin/status'), refetchInterval: 30_000 })
  if (q.isLoading) return <PageLoader />
  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
  const s = q.data
  return (
    <div>
      <PageHeader eyebrow={`Environment: ${s.environment}`} lines={['Operations']} />
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(s.totals).map(([k, v]) => (
          <Card key={k} className="!p-5">
            <p className="display text-[36px]">{v}</p>
            <p className="text-[12px] text-ink-soft">{k === 'runs' ? 'discovery runs (24h)' : k}</p>
          </Card>
        ))}
      </div>
      <h2 className="mt-8 text-[12px] uppercase text-mute">Integrations</h2>
      <div className="mt-3 overflow-hidden rounded-[24px] bg-white/70">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase text-mute">
            <tr>
              <th className="px-5 py-3 font-normal">Integration</th>
              <th className="px-5 py-3 font-normal">Configured</th>
              <th className="px-5 py-3 font-normal">Last success</th>
              <th className="px-5 py-3 font-normal">Last failure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Object.entries(LABELS).map(([k, label]) => {
              const h = s.health.find((x) => x.integration === k)
              return (
                <tr key={k}>
                  <td className="px-5 py-3">{label}{k === 'ai' && s.configured.aiModel ? <span className="ml-2 text-mute">{String(s.configured.aiModel)}</span> : null}</td>
                  <td className="px-5 py-3">{s.configured[k] ? 'Yes' : <span className="text-[#9a5b1e]">No</span>}</td>
                  <td className="px-5 py-3 text-ink-soft">{h?.lastSuccessAt ? timeAgo(h.lastSuccessAt) : '—'}</td>
                  <td className="px-5 py-3 text-ink-soft">{h?.lastFailureAt ? <span title={h.lastError ?? ''}>{timeAgo(h.lastFailureAt)}: {h.lastError?.slice(0, 80)}</span> : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="text-[15px]">AI usage (30 days)</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <div><dt className="text-mute">Calls</dt><dd className="text-[20px]">{s.ai30d.calls}</dd></div>
            <div><dt className="text-mute">Failures</dt><dd className="text-[20px]">{s.ai30d.failures}</dd></div>
            <div><dt className="text-mute">Tokens in / out</dt><dd>{Number(s.ai30d.inputTokens).toLocaleString()} / {Number(s.ai30d.outputTokens).toLocaleString()}</dd></div>
            <div><dt className="text-mute">Estimated cost</dt><dd>${Number(s.ai30d.cost).toFixed(2)}</dd></div>
            <div><dt className="text-mute">Median latency</dt><dd>{(s.ai30d.p50 / 1000).toFixed(1)} s</dd></div>
          </dl>
          <ul className="mt-4 divide-y divide-line text-[13px]">
            {s.ai30d.byOperation.map((o) => (
              <li key={o.operation} className="flex justify-between py-2"><span>{o.operation}</span><span className="text-ink-soft">{o.calls} · ${Number(o.cost).toFixed(2)}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-[15px]">Job queues</h2>
          {s.queues.length === 0 ? <p className="mt-3 text-[13px] text-ink-soft">No jobs recorded yet.</p> : (
            <ul className="mt-4 divide-y divide-line text-[13px]">
              {s.queues.map((x) => (
                <li key={`${x.name}-${x.state}`} className="flex justify-between py-2"><span>{x.name}</span><span className="text-ink-soft">{x.state}: {x.n}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
