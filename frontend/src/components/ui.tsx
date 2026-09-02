import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { formatPrice } from '../lib/config'
import { useLang, useT } from '../lib/i18n'

/** The signature: a gold, tabular, punched market price-tag. */
export function PriceTag({ e8s, size = 'md', struck = false }: { e8s: bigint; size?: 'md' | 'lg'; struck?: boolean }) {
  return (
    <span className={`price-tag ${size === 'lg' ? 'text-xl' : 'text-sm'} ${struck ? 'line-through opacity-50' : ''}`}>
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

export function Spinner({ label }: { label?: string }) {
  const t = useT()
  return (
    <div className="flex items-center gap-2 text-ink-soft text-sm" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-cobalt)]" />
      {label ?? t.loading}…
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

/** A quiet stat tile for the admin dashboard. Number first, label after. */
export function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface px-4 py-3">
      <p className={`font-display text-2xl font-bold nums leading-tight ${accent ? 'text-[var(--color-gold)]' : 'text-ink'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
    </div>
  )
}

/** ± stepper used by the product page and cart lines. */
export function QtyStepper({
  value, min = 1, max, onChange, disabled = false, label,
}: {
  value: number; min?: number; max: number; onChange: (next: number) => void; disabled?: boolean; label: string
}) {
  const t = useT()
  return (
    <div className="inline-flex items-center rounded-lg ring-1 ring-[var(--color-line)]">
      <button
        className="px-3 py-1.5 text-lg leading-none disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={t.decrease(label)}
      >−</button>
      <span className="w-9 text-center text-sm nums" aria-live="polite">{value}</span>
      <button
        className="px-3 py-1.5 text-lg leading-none disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={t.increase(label)}
      >+</button>
    </div>
  )
}

/** Sun/moon theme toggle. Stamps data-theme on <html>; system is the default. */
export function ThemeToggle() {
  const t = useT()
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('souk-theme') ?? '')

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme
      localStorage.setItem('souk-theme', theme)
    } else {
      delete document.documentElement.dataset.theme
      localStorage.removeItem('souk-theme')
    }
  }, [theme])

  const dark =
    theme === 'dark' ||
    (theme === '' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <button
      className="rounded-lg p-2 text-ink-soft transition hover:text-ink"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? t.themeToLight : t.themeToDark}
      title={dark ? t.themeLight : t.themeDark}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

/** EN ⇄ AR toggle. The label always names the OTHER language — the one the
 *  click takes you to — in that language's own script. */
export function LangToggle() {
  const { lang, setLang, t } = useLang()
  return (
    <button
      className="rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-soft transition hover:text-ink"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      aria-label={t.langToggleLabel}
      title={t.langToggleLabel}
      lang={lang === 'ar' ? 'en' : 'ar'}
    >
      {t.langToggleShort}
    </button>
  )
}

/** A small ring that draws down as a checkout hold expires. */
export function HoldRing({ fraction, label }: { fraction: number; label: string }) {
  const r = 15
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, fraction))
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <circle
          cx="19" cy="19" r={r} fill="none"
          stroke={clamped > 0.2 ? 'var(--color-cobalt)' : 'var(--color-sold)'}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform="rotate(-90 19 19)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s ease' }}
        />
      </svg>
      <span className="font-display text-lg font-bold nums" aria-live="polite">{label}</span>
    </span>
  )
}
