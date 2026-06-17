import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { formatPrice } from '../lib/config'

/** The signature: a gold, tabular, punched market price-tag. */
export function PriceTag({ e8s, size = 'md' }: { e8s: bigint; size?: 'md' | 'lg' }) {
  return (
    <span className={`price-tag ${size === 'lg' ? 'text-xl' : 'text-sm'}`}>
      <span aria-hidden className="opacity-60 text-[0.7em]">◈</span>
      <span className="nums">{formatPrice(e8s)}</span>
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}
/** Cobalt is the action accent — reserved for primary buttons + links only. */
export function Button({ variant = 'primary', className = '', ...props }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
  const styles: Record<string, string> = {
    primary: 'bg-[var(--color-cobalt)] text-white hover:brightness-110 active:brightness-95',
    ghost: 'bg-transparent text-ink ring-1 ring-[var(--color-line)] hover:bg-[var(--color-paper)]',
    danger: 'bg-transparent text-[var(--color-sold)] ring-1 ring-[var(--color-sold)]/30 hover:bg-[var(--color-sold)]/5',
  }
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-soft text-sm" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-cobalt)]" />
      {label}…
    </div>
  )
}

/** Empty states are first-class: say why, and offer the next action. */
export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface p-10 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{hint}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-[var(--color-sold)]/8 px-3 py-2 text-sm text-[var(--color-sold)]">{message}</p>
  )
}
