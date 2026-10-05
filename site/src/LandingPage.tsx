import { useEffect } from 'react'
import { ClosetGrid } from './components/ClosetGrid'
import { ClosetIntro } from './components/ClosetIntro'
import { Discovery } from './components/Discovery'
import { FinalCTA, Footer } from './components/FinalCTA'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Pillars } from './components/Pillars'
import { Stylist } from './components/Stylist'
import { WardrobeSplit } from './components/WardrobeSplit'
import { ScrollTrigger } from './lib/motion'

export default function LandingPage() {
  useEffect(() => {
    // Images and web fonts change layout height; re-measure scroll triggers once settled.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    document.fonts?.ready.then(refresh)
    return () => window.removeEventListener('load', refresh)
  }, [])

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Hero />
      <main id="main">
        <WardrobeSplit />
        <Pillars />
        <ClosetIntro />
        <ClosetGrid />
        <Stylist />
        <Discovery />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
