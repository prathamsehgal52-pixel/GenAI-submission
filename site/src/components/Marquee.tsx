/** Oversized thin type row. Long enough to overflow both edges while it scrolls. */
export function GhostRow({ text, className = '', data }: { text: string; className?: string; data?: string }) {
  return (
    <div aria-hidden="true" data-row={data} className={`ghost-type pointer-events-none whitespace-nowrap will-change-transform ${className}`}>
      {`${text} ${text} ${text}`}
    </div>
  )
}
