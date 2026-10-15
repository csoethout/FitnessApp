import { Download, Share } from 'lucide-react'
import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { buildExport, type ExportFile } from '@/data/export'

/**
 * Export all your data as a zip of CSV files. Two taps on purpose: iPhone only opens the share sheet
 * ("Save to Files", AirDrop, Mail…) directly from a tap, so the file is prepared first.
 */
export function ExportCard() {
  const { db, store, sync } = useData()
  const [file, setFile] = useState<ExportFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function prepare() {
    setBusy(true)
    setError(null)
    try {
      await sync.syncNow().catch(() => {}) // pull anything from other devices first; works offline too
      setFile(await buildExport(db, store.userId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!file) return
    const f = new File([file.blob], file.filename, { type: 'application/zip' })
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: file.filename })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return // closed the share sheet
      }
    }
    const url = URL.createObjectURL(file.blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: file.filename })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Export">
      <h2 className="font-semibold">Export all data</h2>
      <p className="text-sm text-muted">A zip of CSV files: workouts and sets, weigh-ins, food, cardio and targets (lb, miles), plus every table as stored.</p>
      {!file ? (
        <button type="button" disabled={busy} onClick={() => void prepare()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border disabled:opacity-50">
          <Download size={18} /> {busy ? 'Preparing…' : 'Prepare export'}
        </button>
      ) : (
        <>
          <p className="mt-3 text-sm">
            {file.filename} · {Math.max(1, Math.round(file.blob.size / 1024))} KB
            <span className="block text-xs text-muted">{file.summary}</span>
          </p>
          <button type="button" onClick={() => void save()} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-ink">
            <Share size={18} /> Save or share
          </button>
        </>
      )}
      {error && <p className="mt-2 text-sm text-danger">Couldn't prepare the export: {error}</p>}
    </section>
  )
}
