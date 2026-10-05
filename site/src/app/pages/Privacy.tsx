import { Link } from 'react-router'
import { Logo } from '../../components/Hero'
import { usePageTitle } from '../hooks'

const sections: [string, string[]][] = [
  ['What we collect', [
    'Account details: your name, email address and a securely hashed password.',
    'Photos of clothing you choose to upload, and the garment details recognised from them or entered by you.',
    'Style preferences you give us, such as styles, colours, occasions, budget, preferred brands and, if you add it, your city.',
    'Activity inside Armoire: outfits generated, looks you save, rate or plan, and products you save or hide.',
  ]],
  ['How photos are processed', [
    'When you upload a photo we remove hidden metadata (including location data) and store resized copies in private storage. Photos are only shown to you, through links that expire.',
    'Each photo is sent to our AI provider (Anthropic) to recognise garment type, colours and details. Our provider does not use this data to train its models.',
    'Material descriptions are estimates from appearance. We never claim to know fabric composition or brand unless you enter it.',
  ]],
  ['How we use your information', [
    'To build your digital wardrobe, generate outfits from your own clothes and explain why they work.',
    'To find products that complement your wardrobe. Product searches are built from garment categories and your preferences; your photos are never shared with retailers.',
    'If you add a city, it is used only to look up the forecast (via Open-Meteo) so outfits can suit the weather.',
    'To send account emails (like password resets) and, only if you opt in, occasional emails about new finds.',
  ]],
  ['Shopping links', [
    'Products come from authorised retail sources such as the eBay Browse API and partner product feeds. Prices and availability are shown as last checked and may change. Purchases happen on the retailer’s site under their terms. Some links may earn us a commission; this never affects how products are ranked for you.',
  ]],
  ['Your choices', [
    'You can edit or delete any garment, look or preference at any time.',
    'You can download a copy of your data from Settings.',
    'Deleting your account permanently removes your account, photos and all associated data from our systems. Backups containing it expire within 30 days.',
  ]],
  ['Security', [
    'Data is encrypted in transit. Photos are stored privately and accessed only through short-lived signed links. Access to your data is restricted to your account.',
  ]],
]

export default function Privacy() {
  usePageTitle('Privacy')
  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[760px]">
        <Link to="/" aria-label="Armoire home">
          <Logo />
        </Link>
        <h1 className="display mt-12 text-[clamp(40px,6vw,72px)]">Privacy & your data</h1>
        <p className="mt-4 text-[15px] text-ink-soft">Last updated October 2026. This notice explains what Armoire collects, why, and the choices you have.</p>
        <div className="mt-10 space-y-8">
          {sections.map(([title, paras]) => (
            <section key={title} className="rounded-[24px] bg-white/70 p-6 sm:p-8">
              <h2 className="text-[16px] font-medium uppercase">{title}</h2>
              <ul className="mt-3 space-y-2.5 text-[15px] leading-[1.55] text-ink-soft">
                {paras.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-10 text-[13px] text-mute">
          <Link to="/" className="underline underline-offset-2">
            Back to Armoire
          </Link>
        </p>
      </div>
    </div>
  )
}
