import { Link } from 'react-router'
import { usePageTitle } from '../hooks'

export default function NotFound() {
  usePageTitle('Not found')
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="ghost-type text-[120px] text-ghost">404</p>
        <h1 className="display text-[36px]">This page doesn’t exist</h1>
        <p className="mt-2 text-[14px] text-ink-soft">It may have moved, or the link may be out of date.</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
          Go home
        </Link>
      </div>
    </div>
  )
}
