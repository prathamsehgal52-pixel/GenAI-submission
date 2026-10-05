import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { uploadFile, errorMessage } from '../../lib/api'
import type { Upload } from '../../lib/types'
import { Button, Dialog, IconButton, Spinner } from '../ui'

type Entry = {
  key: string
  file: File
  preview: string
  state: 'queued' | 'uploading' | 'done' | 'error'
  progress: number
  message?: string
  duplicate?: boolean
  abort?: () => void
}

const MAX = 15 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
const CONCURRENCY = 3

type Result = { results: { ok: boolean; duplicate?: boolean; error?: { message: string }; asset?: Upload }[] }

/**
 * Multi-photo upload with drag & drop, per-file progress, validation and
 * retry. Files go to the API one at a time (three in parallel) so a single
 * failure never blocks the rest.
 */
export function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const active = useRef(0)
  const queue = useRef<string[]>([])

  const fileMap = useRef(new Map<string, File>())
  const patch = (key: string, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.key === key ? { ...e, ...p } : e)))

  const pump = () => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const key = queue.current.shift()!
      const file = fileMap.current.get(key)
      const entry = file ? { key, file } : null
      if (!entry) continue
      active.current++
      const { promise, abort } = uploadFile<Result>('/uploads', entry.file, (p) => patch(key, { progress: p }))
      patch(key, { state: 'uploading', progress: 0, abort, message: undefined })
      promise
        .then((r) => {
          const res = r.results[0]
          if (res?.ok) patch(key, { state: 'done', progress: 1, duplicate: res.duplicate })
          else patch(key, { state: 'error', message: res?.error?.message ?? 'This photo couldn’t be uploaded.' })
        })
        .catch((e) => patch(key, { state: 'error', message: errorMessage(e) }))
        .finally(() => {
          active.current--
          qc.invalidateQueries({ queryKey: ['uploads'] })
          pump()
        })
    }
  }

  const add = (files: FileList | File[]) => {
    const next: Entry[] = []
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`
      fileMap.current.set(key, file)
      const base = { key, file, preview: URL.createObjectURL(file), progress: 0 }
      if (!ACCEPT.includes(file.type) && !/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)) next.push({ ...base, state: 'error', message: 'Not a supported photo format.' })
      else if (file.size > MAX) next.push({ ...base, state: 'error', message: 'Larger than 15 MB.' })
      else {
        next.push({ ...base, state: 'queued' })
        queue.current.push(key)
      }
    }
    setEntries((es) => [...es, ...next])
    pump()
  }

  const retry = (e: Entry) => {
    patch(e.key, { state: 'queued', message: undefined, progress: 0 })
    queue.current.push(e.key)
    pump()
  }

  const remove = (e: Entry) => {
    e.abort?.()
    queue.current = queue.current.filter((k) => k !== e.key)
    URL.revokeObjectURL(e.preview)
    fileMap.current.delete(e.key)
    setEntries((es) => es.filter((x) => x.key !== e.key))
  }

  const close = () => {
    entries.forEach((e) => e.state !== 'uploading' && URL.revokeObjectURL(e.preview))
    setEntries((es) => es.filter((e) => e.state === 'uploading' || e.state === 'queued'))
    qc.invalidateQueries({ queryKey: ['wardrobe'] })
    onClose()
  }

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault()
    setDrag(false)
    if (ev.dataTransfer.files.length) add(ev.dataTransfer.files)
  }

  const done = entries.filter((e) => e.state === 'done').length
  const busy = entries.some((e) => e.state === 'uploading' || e.state === 'queued')

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add clothes"
      wide
      footer={
        <>
          <span className="mr-auto self-center text-[13px] text-ink-soft" aria-live="polite">
            {entries.length ? `${done} of ${entries.length} uploaded${busy ? '…' : ''}` : 'Up to 10 at a time; add as many batches as you like.'}
          </span>
          {done > 0 && !busy ? (
            <Link to="/app/wardrobe/review" onClick={close} className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[13px] uppercase text-white">
              Review pieces
            </Link>
          ) : (
            <Button variant="ghost" onClick={close}>
              {busy ? 'Continue in background' : 'Close'}
            </Button>
          )}
        </>
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition-colors ${drag ? 'border-ink bg-white' : 'border-line bg-white/50'}`}
      >
        <p className="display text-[24px]">Drop photos here</p>
        <p className="mt-2 max-w-[44ch] text-[13px] text-ink-soft">
          One garment per photo works best: on a hanger, laid flat or worn. A photo of a full outfit works too; we’ll separate the pieces.
        </p>
        <Button className="mt-5" onClick={() => input.current?.click()}>
          Choose photos
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple
          className="sr-only"
          aria-label="Choose photos to upload"
          onChange={(e) => {
            if (e.target.files) add(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="mt-3 text-[11px] text-mute">JPEG, PNG, WebP or AVIF · up to 15 MB each</p>
      </div>

      {entries.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {entries.map((e) => (
            <li key={e.key} className="relative overflow-hidden rounded-[18px] bg-white">
              <img src={e.preview} alt="" className={`aspect-square w-full object-cover ${e.state === 'error' ? 'opacity-40' : ''}`} />
              <div className="absolute right-2 top-2">
                <IconButton label={`Remove ${e.file.name}`} onClick={() => remove(e)} className="h-7 w-7 bg-white/90">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </IconButton>
              </div>
              <div className="p-2.5">
                <p className="truncate text-[11px]">{e.file.name}</p>
                {e.state === 'uploading' && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(e.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${e.file.name}`}>
                    <div className="h-full bg-ink transition-[width]" style={{ width: `${Math.max(4, e.progress * 100)}%` }} />
                  </div>
                )}
                {e.state === 'queued' && <p className="mt-1 text-[11px] text-mute">Waiting…</p>}
                {e.state === 'done' && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[#2f6b45]">
                    {e.duplicate ? 'Already in your uploads' : 'Uploaded · tagging'}
                    {!e.duplicate && <Spinner className="h-3 w-3" />}
                  </p>
                )}
                {e.state === 'error' && (
                  <div className="mt-1">
                    <p className="text-[11px] leading-snug text-[#a1352a]">{e.message}</p>
                    {e.message !== 'Not a supported photo format.' && e.message !== 'Larger than 15 MB.' && (
                      <button type="button" onClick={() => retry(e)} className="mt-1 text-[11px] uppercase underline underline-offset-2">
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
