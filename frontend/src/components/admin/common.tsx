import type { ReactNode } from 'react'

export const inputCls =
  'w-full rounded-lg border border-[var(--color-line)] bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-[var(--color-cobalt)]'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4">
      {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
      {children}
    </div>
  )
}

/** Surface a thrown error as a string, uniformly. */
export function errStr(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
