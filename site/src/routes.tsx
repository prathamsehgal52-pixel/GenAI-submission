import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Outlet, isRouteErrorResponse, useLocation, useRouteError, type RouteObject } from 'react-router'
import LandingPage from './LandingPage'
import { AppShell } from './app/AppShell'
import { journey, useMe } from './app/hooks'
import { ErrorState, PageLoader } from './app/ui'

const AuthPage = lazy(() => import('./app/pages/Auth'))
const Onboarding = lazy(() => import('./app/pages/Onboarding'))
const Home = lazy(() => import('./app/pages/Home'))
const Wardrobe = lazy(() => import('./app/pages/Wardrobe'))
const Review = lazy(() => import('./app/pages/Review'))
const ItemDetail = lazy(() => import('./app/pages/ItemDetail'))
const StyleMe = lazy(() => import('./app/pages/StyleMe'))
const Looks = lazy(() => import('./app/pages/Looks'))
const LookDetail = lazy(() => import('./app/pages/LookDetail'))
const Discover = lazy(() => import('./app/pages/Discover'))
const Plan = lazy(() => import('./app/pages/Plan'))
const Insights = lazy(() => import('./app/pages/Insights'))
const Settings = lazy(() => import('./app/pages/Settings'))
const Admin = lazy(() => import('./app/pages/Admin'))
const Privacy = lazy(() => import('./app/pages/Privacy'))
const NotFound = lazy(() => import('./app/pages/NotFound'))

const S = (el: ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>

/** A destination inside the app only (prevents open redirects). */
export const safeNext = (n: string | null) => (n && n.startsWith('/app') && !n.startsWith('//') ? n : '/app')

/** Requires a session; sends signed-out visitors to sign in and returns them after. */
function RequireAuth({ onboarding }: { onboarding?: boolean }) {
  const me = useMe()
  const loc = useLocation()
  if (me.isLoading) return <PageLoader />
  if (me.isError) return <div className="p-6"><ErrorState message="We couldn’t load your account." onRetry={() => me.refetch()} /></div>
  if (!me.data) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  const done = !!me.data.profile.onboardingCompletedAt
  if (!onboarding && !done) return <Navigate to="/onboarding" replace />
  if (onboarding && done) {
    return <Navigate to={journey.justOnboarded ? '/app/wardrobe?upload=1&welcome=1' : '/app'} replace />
  }
  return <Outlet />
}

/** Signed-in visitors skip the auth screens. */
function GuestOnly() {
  const me = useMe()
  const loc = useLocation()
  if (me.isLoading) return <PageLoader />
  if (me.data) return <Navigate to={safeNext(new URLSearchParams(loc.search).get('next'))} replace />
  return <Outlet />
}

/** Branded fallback for unexpected render errors. */
function RouteError() {
  const err = useRouteError()
  const notFound = isRouteErrorResponse(err) && err.status === 404
  if (!notFound) console.error(err)
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="display text-[40px]">{notFound ? 'This page doesn’t exist' : 'Something went wrong'}</h1>
        <p className="mt-3 text-[14px] text-ink-soft">{notFound ? 'The link may be out of date.' : 'Please reload the page. If it keeps happening, try again in a few minutes.'}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
            Reload
          </button>
          <Link to="/app" className="inline-flex h-11 items-center rounded-full bg-white px-6 text-[13px] uppercase">
            Go to Armoire
          </Link>
        </div>
      </div>
    </div>
  )
}

const rawRoutes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/privacy', element: S(<Privacy />) },
  {
    element: <GuestOnly />,
    children: [
      { path: '/signin', element: S(<AuthPage mode="signin" />) },
      { path: '/signup', element: S(<AuthPage mode="signup" />) },
      { path: '/forgot-password', element: S(<AuthPage mode="forgot" />) },
    ],
  },
  { path: '/reset-password', element: S(<AuthPage mode="reset" />) },
  { element: <RequireAuth onboarding />, children: [{ path: '/onboarding', element: S(<Onboarding />) }] },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/app',
        element: <AppShell />,
        children: [
          { index: true, element: S(<Home />) },
          { path: 'wardrobe', element: S(<Wardrobe />) },
          { path: 'wardrobe/review', element: S(<Review />) },
          { path: 'wardrobe/:id', element: S(<ItemDetail />) },
          { path: 'style', element: S(<StyleMe />) },
          { path: 'looks', element: S(<Looks />) },
          { path: 'looks/:id', element: S(<LookDetail />) },
          { path: 'discover', element: S(<Discover />) },
          { path: 'plan', element: S(<Plan />) },
          { path: 'insights', element: S(<Insights />) },
          { path: 'settings', element: S(<Settings />) },
          { path: 'admin', element: S(<Admin />) },
          { path: '*', element: S(<NotFound />) },
        ],
      },
    ],
  },
  { path: '*', element: S(<NotFound />) },
]

export const routes: RouteObject[] = [{ errorElement: <RouteError />, children: rawRoutes }]
