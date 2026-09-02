import { useRef, useState } from 'react'
import { useQuery, useMediaUpload } from '@thebes/sdk'
import {
  STORE_CID, M, decodeAdminProducts, decodeCategories,
  addProduct, updateProduct, setProductPhoto, setProductArchived, restock,
  addCategory, seedDemo,
  type AdminProduct, type Category,
} from '../../lib/store-api'
import { MEDIA_CID } from '../../lib/config'
import { toE8s } from '../../lib/format'
import { formatPrice } from '../../lib/config'
import { MediaImage } from '../MediaImage'
import { Button, Spinner, ErrorNote } from '../ui'
import { Field, Card, inputCls, errStr } from './common'
import { useT } from '../../lib/i18n'

/** Catalogue management: create products (with on-chain photos + categories),
 *  edit copy/price/category in place, restock, archive. */
export function CatalogueTab() {
  const t = useT()
  const { data, loading, error, refetch } = useQuery<AdminProduct[]>(STORE_CID, M.adminProductsView, undefined, decodeAdminProducts)
  const { data: cats, refetch: refetchCats } = useQuery<Category[]>(STORE_CID, M.categoriesView, undefined, decodeCategories)
  const products = data ?? []
  const categories = cats ?? []

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-6">
        <NewProductCard categories={categories} onChanged={() => { refetch(); refetchCats() }} />
        <CategoriesCard categories={categories} onChanged={refetchCats} />
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">{t.catalogueHeading}</h2>
        {loading ? (
          <div className="mt-4"><Spinner /></div>
        ) : error ? (
          <div className="mt-4"><ErrorNote message={error} /></div>
        ) : (
          <ul className="mt-4 space-y-3">
            {products.map((p) => (
              <CatalogueRow key={p.id.toString()} p={p} categories={categories} onChanged={refetch} />
            ))}
            {products.length === 0 && <SeedCard onChanged={() => { refetch(); refetchCats() }} />}
          </ul>
        )}
      </section>
    </div>
  )
}

function SeedCard({ onChanged }: { onChanged: () => void }) {
  const t = useT()
  const [seeding, setSeeding] = useState(false)
  const [err, setErr] = useState<string>()
  async function seed() {
    setSeeding(true)
    setErr(undefined)
    try { await seedDemo(); onChanged() } catch (e) { setErr(errStr(e)) } finally { setSeeding(false) }
  }
  return (
    <Card>
      <p className="text-sm text-ink-soft">
        {t.seedExplainer}
      </p>
      {err && <div className="mt-2"><ErrorNote message={err} /></div>}
      <Button className="mt-3" variant="ghost" onClick={seed} disabled={seeding}>
        {seeding ? t.loadingSimple : t.loadDemoShop}
      </Button>
    </Card>
  )
}

function NewProductCard({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const t = useT()
  const media = useMediaUpload(MEDIA_CID)
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [catId, setCatId] = useState('0')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string>()
  const [err, setErr] = useState<string>()

  async function onPickPhoto(file: File | undefined) {
    if (!file) return
    setErr(undefined)
    try {
      const r = await media.upload(file, 'photo')
      setPhotoPath(r.path)
    } catch (e) {
      setErr(errStr(e))
    }
  }

  async function create() {
    setBusy(true)
    setErr(undefined)
    setNote(undefined)
    try {
      const id = await addProduct(name.trim(), desc.trim(), toE8s(price), Number(stock || '0'), BigInt(catId), photoPath)
      setNote(t.addedProduct(id))
      setName(''); setDesc(''); setPrice(''); setStock(''); setCatId('0'); setPhotoPath(null)
      if (fileRef.current) fileRef.current.value = ''
      onChanged()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = name.trim() && price.trim() && !busy && !media.busy

  return (
    <Card title={t.addAProduct}>
      <label className="mt-4 block text-sm font-medium">{t.photo}</label>
      <div className="mt-2 flex items-center gap-4">
        <div className="w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--color-line)]">
          <MediaImage path={photoPath ?? ''} alt={t.newProductAlt} ratio="1 / 1" />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => onPickPhoto(e.target.files?.[0])}
            className="block text-sm file:me-3 file:rounded-lg file:border-0 file:bg-[var(--color-cobalt)] file:px-3 file:py-1.5 file:text-white"
          />
          {media.busy && (
            <p className="mt-2 text-xs text-ink-soft nums">{t.uploading(Math.round(media.progress * 100))}</p>
          )}
          {photoPath && !media.busy && <p className="mt-2 text-xs text-[var(--color-cobalt-ink)]">{t.storedOnChain}</p>}
          <p className="mt-1 text-[11px] text-ink-soft">{t.compressedNote}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Field label={t.fieldName}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} /></Field>
        <Field label={t.fieldDescription}><textarea className={inputCls} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t.descPlaceholder} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t.fieldPrice}><input className={`${inputCls} nums`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12.50" /></Field>
          <Field label={t.fieldStock}><input className={`${inputCls} nums`} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="20" /></Field>
          <Field label={t.fieldCategory}>
            <select className={inputCls} value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="0">{t.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id.toString()} value={c.id.toString()}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {err && <div className="mt-3"><ErrorNote message={err} /></div>}
      {note && <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">{note}</p>}

      <Button className="mt-4 w-full" onClick={create} disabled={!canSubmit}>
        {busy ? t.adding : t.addProduct}
      </Button>
    </Card>
  )
}

function CategoriesCard({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()
  async function create() {
    setBusy(true)
    setErr(undefined)
    try { await addCategory(name.trim()); setName(''); onChanged() } catch (e) { setErr(errStr(e)) } finally { setBusy(false) }
  }
  return (
    <Card title={t.categoriesTitle}>
      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id.toString()} className="chip" data-on="false" style={{ cursor: 'default' }}>
            {c.name} <span className="nums opacity-60">{c.productCount.toString()}</span>
          </span>
        ))}
        {categories.length === 0 && <p className="text-sm text-ink-soft">{t.noCategoriesYet}</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.newCategoryPlaceholder} />
        <Button variant="ghost" onClick={create} disabled={busy || !name.trim()}>{t.add}</Button>
      </div>
      {err && <div className="mt-2"><ErrorNote message={err} /></div>}
    </Card>
  )
}

function CatalogueRow({ p, categories, onChanged }: { p: AdminProduct; categories: Category[]; onChanged: () => void }) {
  const t = useT()
  const media = useMediaUpload(MEDIA_CID)
  const [add, setAdd] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState<string>()

  // Edit state seeds from the row when the editor opens.
  const [eName, setEName] = useState(p.name)
  const [eDesc, setEDesc] = useState(p.description)
  const [ePrice, setEPrice] = useState(formatPrice(p.priceE8s))
  const [eCat, setECat] = useState(p.categoryId.toString())

  async function replacePhoto(file: File | undefined) {
    if (!file) return
    setErr(undefined)
    try {
      const r = await media.upload(file, 'photo')
      await setProductPhoto(p.id, r.path)
      onChanged()
    } catch (e) {
      setErr(errStr(e))
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
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    setBusy(true)
    setErr(undefined)
    try {
      await updateProduct(p.id, eName.trim(), eDesc.trim(), toE8s(ePrice), BigInt(eCat))
      setEditing(false)
      onChanged()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  async function toggleArchive() {
    setBusy(true)
    setErr(undefined)
    try {
      await setProductArchived(p.id, !p.archived)
      onChanged()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-3 ${p.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
          <MediaImage path={p.photoPath} alt={p.name} ratio="1 / 1" artId={p.id} artName={p.name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink line-clamp-1">
            {p.name}
            {p.archived && <span className="ms-2 rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{t.archived}</span>}
          </p>
          <p className="text-xs text-ink-soft nums">
            ◈{formatPrice(p.priceE8s)} · {t.available(p.available)}
            {p.reserved > 0n && ` ${t.heldParen(p.reserved)}`}
            {p.categoryName && ` · ${p.categoryName}`}
          </p>
          {err && <p className="mt-1 text-xs text-[var(--color-sold)]">{err}</p>}
        </div>
        <label className="cursor-pointer text-xs text-[var(--color-cobalt)] hover:underline">
          {media.busy ? `${Math.round(media.progress * 100)}%` : t.photo}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => replacePhoto(e.target.files?.[0])} />
        </label>
        <button className="text-xs text-[var(--color-cobalt)] hover:underline" onClick={() => setEditing(!editing)}>
          {editing ? t.close : t.edit}
        </button>
        <div className="flex items-center gap-1">
          <input
            className="w-14 rounded-lg border border-[var(--color-line)] bg-paper px-2 py-1 text-sm nums"
            inputMode="numeric"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
            placeholder="+0"
            aria-label={t.restockAria(p.name)}
          />
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={doRestock} disabled={busy || !add}>{t.restock}</Button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-[var(--color-line)] pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.fieldName}><input className={inputCls} value={eName} onChange={(e) => setEName(e.target.value)} /></Field>
            <Field label={t.fieldPrice}><input className={`${inputCls} nums`} inputMode="decimal" value={ePrice} onChange={(e) => setEPrice(e.target.value)} /></Field>
          </div>
          <Field label={t.fieldDescription}><textarea className={inputCls} rows={2} value={eDesc} onChange={(e) => setEDesc(e.target.value)} /></Field>
          <Field label={t.fieldCategory}>
            <select className={inputCls} value={eCat} onChange={(e) => setECat(e.target.value)}>
              <option value="0">{t.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id.toString()} value={c.id.toString()}>{c.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex justify-between">
            <Button variant="danger" className="px-3 py-1 text-xs" onClick={toggleArchive} disabled={busy}>
              {p.archived ? t.unarchive : t.archive}
            </Button>
            <Button className="px-3 py-1 text-xs" onClick={saveEdit} disabled={busy || !eName.trim()}>{t.saveChanges}</Button>
          </div>
        </div>
      )}
    </li>
  )
}
