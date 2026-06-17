import { useRef, useState, type ReactNode } from 'react'
import { useQuery, useUpdate, useMediaUpload } from '@thebes/sdk'
import {
  STORE_CID, M, decodeProducts, addProduct, setProductPhoto, restock, seedDemo, type Product,
} from '../lib/store-api'
import { MEDIA_CID } from '../lib/config'
import { MediaImage } from '../components/MediaImage'
import { Button, Spinner, ErrorNote } from '../components/ui'

/** Parse a human price ("12.50") into e8s base units. */
function toE8s(s: string): bigint {
  const [w, f = ''] = s.trim().split('.')
  const frac = (f + '00000000').slice(0, 8)
  return BigInt(w || '0') * 100_000_000n + BigInt(frac || '0')
}

export function Admin() {
  const { data, loading, error, refetch } = useQuery<Product[]>(STORE_CID, M.productsView, undefined, decodeProducts)
  const { call } = useUpdate()
  const media = useMediaUpload(MEDIA_CID)
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [note, setNote] = useState<string>()
  const [formErr, setFormErr] = useState<string>()

  async function seed() {
    setSeeding(true); setFormErr(undefined); setNote(undefined)
    try { await seedDemo(); setNote('Demo catalog loaded'); refetch() }
    catch (e) { setFormErr(e instanceof Error ? e.message : String(e)) }
    finally { setSeeding(false) }
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return
    setFormErr(undefined)
    try {
      const r = await media.upload(file, 'photo')
      setPhotoPath(r.path)
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function create() {
    setBusy(true)
    setFormErr(undefined)
    setNote(undefined)
    try {
      const id = await addProduct(name.trim(), desc.trim(), toE8s(price), Number(stock || '0'), photoPath)
      setNote(`Added product #${id.toString()}`)
      setName(''); setDesc(''); setPrice(''); setStock(''); setPhotoPath(null)
      if (fileRef.current) fileRef.current.value = ''
      refetch()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const products = data ?? []
  const canSubmit = name.trim() && price.trim() && !busy && !media.busy

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      {/* Owner + new product */}
      <section className="space-y-6">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Shop owner</h2>
          <p className="mt-1 text-sm text-ink-soft">First caller claims the shop. After that only the owner/admins can add or restock products.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => call(STORE_CID, 'claimOwner').then(() => setNote('Ownership claimed (if it was unclaimed)')).catch((e) => setFormErr(String(e)))}>
              Claim ownership
            </Button>
            <Button variant="ghost" onClick={seed} disabled={seeding}>{seeding ? 'Loading…' : 'Load demo catalog'}</Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Add a product</h2>

          <label className="mt-4 block text-sm font-medium">Photo</label>
          <div className="mt-2 flex items-center gap-4">
            <div className="w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--color-line)]">
              <MediaImage path={photoPath ?? ''} alt="New product" ratio="1 / 1" />
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => onPickPhoto(e.target.files?.[0])}
                className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-cobalt)] file:px-3 file:py-1.5 file:text-white"
              />
              {media.busy && (
                <p className="mt-2 text-xs text-ink-soft nums">Uploading… {Math.round(media.progress * 100)}%</p>
              )}
              {photoPath && !media.busy && <p className="mt-2 text-xs text-[var(--color-cobalt-ink)]">Stored on-chain ✓</p>}
              <p className="mt-1 text-[11px] text-ink-soft">Compressed on-chain to a bounded JPEG/WebP.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Hand-thrown mug" /></Field>
            <Field label="Description"><textarea className={inputCls} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Stoneware, 300ml…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (◈)"><input className={`${inputCls} nums`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12.50" /></Field>
              <Field label="Stock"><input className={`${inputCls} nums`} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="20" /></Field>
            </div>
          </div>

          {formErr && <div className="mt-3"><ErrorNote message={formErr} /></div>}
          {note && <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">{note}</p>}

          <Button className="mt-4 w-full" onClick={create} disabled={!canSubmit}>
            {busy ? 'Adding…' : 'Add product'}
          </Button>
        </div>
      </section>

      {/* Catalogue management */}
      <section>
        <h2 className="font-display text-lg font-bold">Catalogue</h2>
        {loading ? (
          <div className="mt-4"><Spinner /></div>
        ) : error ? (
          <div className="mt-4"><ErrorNote message={error} /></div>
        ) : (
          <ul className="mt-4 space-y-3">
            {products.map((p) => (
              <AdminRow key={p.id.toString()} p={p} onChanged={refetch} />
            ))}
            {products.length === 0 && <p className="text-sm text-ink-soft">No products yet — add the first one.</p>}
          </ul>
        )}
      </section>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-[var(--color-line)] bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-[var(--color-cobalt)]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function AdminRow({ p, onChanged }: { p: Product; onChanged: () => void }) {
  const media = useMediaUpload(MEDIA_CID)
  const [add, setAdd] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  async function replacePhoto(file: File | undefined) {
    if (!file) return
    setErr(undefined)
    try {
      const r = await media.upload(file, 'photo')
      await setProductPhoto(p.id, r.path)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function doRestock() {
    setBusy(true)
    setErr(undefined)
    try {
      await restock(p.id, Number(add || '0'))
      setAdd('')
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        <MediaImage path={p.photoPath} alt={p.name} ratio="1 / 1" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink line-clamp-1">{p.name}</p>
        <p className="text-xs text-ink-soft nums">{p.stockCount.toString()} in stock</p>
        {err && <p className="mt-1 text-xs text-[var(--color-sold)]">{err}</p>}
      </div>
      <label className="cursor-pointer text-xs text-[var(--color-cobalt)] hover:underline">
        {media.busy ? `${Math.round(media.progress * 100)}%` : 'Photo'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => replacePhoto(e.target.files?.[0])} />
      </label>
      <div className="flex items-center gap-1">
        <input
          className="w-14 rounded-lg border border-[var(--color-line)] bg-paper px-2 py-1 text-sm nums"
          inputMode="numeric"
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          placeholder="+0"
          aria-label={`Restock ${p.name}`}
        />
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={doRestock} disabled={busy || !add}>Restock</Button>
      </div>
    </li>
  )
}
