/**
 * Order status, drawn as the journey it is: placed → shipped → delivered.
 * Terminal detours (cancelled, refunded) replace the trail with a labelled
 * chip — they are ends, not stages.
 */
import { useT } from '../lib/i18n'

const STAGES = ['placed', 'shipped', 'delivered'] as const

export function StatusTrail({ status }: { status: string }) {
  const t = useT()
  const label = t.statusLabels[status] ?? status
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-sold)]/10 px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--color-sold)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-sold)]" aria-hidden />
        {label}
      </span>
    )
  }
  const at = Math.max(0, STAGES.indexOf(status as (typeof STAGES)[number]))
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${i <= at ? 'bg-[var(--color-cobalt)]' : 'bg-[var(--color-line)]'}`}
            title={t.statusLabels[s] ?? s}
          />
          {i < STAGES.length - 1 && (
            <span className={`h-px w-6 ${i < at ? 'bg-[var(--color-cobalt)]' : 'bg-[var(--color-line)]'}`} />
          )}
        </span>
      ))}
      <span className="ms-2 text-xs capitalize text-ink-soft">{label}</span>
    </div>
  )
}
