import { useState } from 'react'
import type { Crop } from '../data/types'

type Props = {
  src: string
  alt: string
  crop?: Crop
  className?: string
  imgClassName?: string
  eager?: boolean
  grade?: boolean
}

/**
 * Cover-fit photo with an art-directed crop. If the file fails to load, a
 * tonal placeholder keeps the composition intact.
 */
export function Photo({ src, alt, crop, className = '', imgClassName = '', eager, grade = true }: Props) {
  const [failed, setFailed] = useState(false)
  const position = crop?.position ?? '50% 50%'
  const scale = crop?.scale ?? 1
  const positioned = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative'

  return (
    <div className={`${positioned} overflow-hidden bg-gradient-to-b from-[#3a3b3d] to-[#8d9095] ${className}`}>
      {failed ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex items-end p-4 text-[11px] uppercase tracking-wide text-white/60"
        >
          {alt}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover ${grade ? 'grade' : ''} ${imgClassName}`}
          style={{
            objectPosition: position,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: position,
          }}
        />
      )}
    </div>
  )
}
