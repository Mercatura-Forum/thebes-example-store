import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { SignOutChip, query } from '@thebes/sdk'
import { STORE_CID, M, decodeCart } from '../lib/store-api'
import { ThemeToggle } from './ui'
import { ConservationSeal } from './ConservationSeal'

const tabs = [
  { to: '/', label: 'Browse', end: true },
  { to: '/orders', label: 'Orders' },
  { to: '/admin', label: 'Admin' },
]

/** App shell: a quiet, type-led header (wordmark + nav + live cart badge) over
 *  an image-forward page. The chrome stays restrained so product photography
 *  carries the page; the footer carries the shop's public audit seal. */
export function Layout() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <NavLink to="/" className="font-display text-2xl font-extrabold tracking-tight">
            souk<span className="text-[var(--color-cobalt)]">.</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[var(--color-cobalt)]/10 text-[var(--color-cobalt-ink)]'
                      : 'text-ink-soft hover:text-ink'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
            <CartLink />
            <ThemeToggle />
            <SignOutChip className="ml-1 border-l border-[var(--color-line)] pl-3" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl space-y-4 px-5 py-10">
        <ConservationSeal />
        <p className="text-xs text-ink-soft">
          An on-chain storefront — the shop, the catalogue, every product photo and
          every ledger entry live on the chain. You own it.
        </p>
      </footer>
    </div>
  )
}

/** Cart tab with a live line-count badge; pops when something lands. */
function CartLink() {
  const [count, setCount] = useState<number>()
  const [pop, setPop] = useState(false)
  const popTimer = useRef<number>(undefined)

  const refresh = useCallback((withPop: boolean) => {
    query(STORE_CID, M.cartView)
      .then((r) => {
        const lines = decodeCart(r.reply_hex ?? r.reply ?? '')
        setCount((prev) => {
          if (withPop && prev !== undefined && lines.length !== prev) {
            setPop(true)
            window.clearTimeout(popTimer.current)
            popTimer.current = window.setTimeout(() => setPop(false), 400)
          }
          return lines.length
        })
      })
      .catch(() => {}) // the badge is decoration; pages surface real errors
  }, [])

  useEffect(() => {
    refresh(false)
    const onPoke = () => refresh(true)
    window.addEventListener('souk:cart-changed', onPoke)
    return () => {
      window.removeEventListener('souk:cart-changed', onPoke)
      window.clearTimeout(popTimer.current)
    }
  }, [refresh])

  return (
    <NavLink
      to="/cart"
      className={({ isActive }) =>
        `relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          isActive ? 'bg-[var(--color-cobalt)]/10 text-[var(--color-cobalt-ink)]' : 'text-ink-soft hover:text-ink'
        }`
      }
    >
      Cart
      {count !== undefined && count > 0 && (
        <span
          className={`absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-gold)] px-1 text-[10px] font-bold text-white nums ${pop ? 'badge-pop' : ''}`}
          aria-label={`${count} lines in cart`}
        >
          {count}
        </span>
      )}
    </NavLink>
  )
}
