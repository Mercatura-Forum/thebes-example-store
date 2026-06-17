import { NavLink, Outlet } from 'react-router-dom'
import { SignOutChip } from '@thebes/sdk'

const tabs = [
  { to: '/', label: 'Browse', end: true },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'Orders' },
  { to: '/admin', label: 'Admin' },
]

/** App shell: a quiet, type-led header (wordmark + nav) over an image-forward
 *  page. The chrome stays restrained so product photography carries the page. */
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
            <SignOutChip className="ml-2 border-l border-[var(--color-line)] pl-3" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-ink-soft">
        An on-chain storefront — the shop, the catalogue, and every product photo
        live on the chain. You own it.
      </footer>
    </div>
  )
}
