import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { SignOutChip, query } from '@thebes/sdk'
import { STORE_CID, M, decodeCart } from '../lib/store-api'
import { LangToggle, ThemeToggle } from './ui'
import { ConservationSeal } from './ConservationSeal'
import { useT } from '../lib/i18n'

/** App shell: a quiet, type-led header (wordmark + nav + live cart badge) over
 *  an image-forward page. The chrome stays restrained so product photography
 *  carries the page; the footer carries the shop's public audit seal. */
export function Layout() {
  const t = useT()
  const tabs = [
    { to: '/', label: t.navBrowse, end: true },
    { to: '/orders', label: t.navOrders, end: false },
    { to: '/admin', label: t.navAdmin, end: false },
  ]
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <NavLink to="/" className="font-display text-2xl font-extrabold tracking-tight">
            {t.brand}<span className="text-[var(--color-cobalt)]">.</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[var(--color-cobalt)]/10 text-[var(--color-cobalt-ink)]'
                      : 'text-ink-soft hover:text-ink'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
            <CartLink />
            <LangToggle />
            <ThemeToggle />
            <SignOutChip className="ms-1 border-s border-[var(--color-line)] ps-3" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl space-y-4 px-5 py-10">
        <ConservationSeal />
        <p className="text-xs text-ink-soft">{t.footerLine}</p>
      </footer>
    </div>
  )
}

/** Cart tab with a live line-count badge; pops when something lands. */
function CartLink() {
  const t = useT()
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
      {t.navCart}
      {count !== undefined && count > 0 && (
        <span
          className={`absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-gold)] px-1 text-[10px] font-bold text-white nums ${pop ? 'badge-pop' : ''}`}
          aria-label={t.cartBadge(count)}
        >
          {count}
        </span>
      )}
    </NavLink>
  )
}
