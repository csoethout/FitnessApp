import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cleanBarcode, expandUpcE, isValidBarcode } from '@/lib/barcode'

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> }

/**
 * Loads the barcode reader (zxing, ~1 MB WebAssembly) only when the scanner opens, from our own site.
 * iPhone Safari has no built-in BarcodeDetector, so this library does the decoding.
 */
async function makeDetector(): Promise<Detector> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
  return new BarcodeDetector({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8'] })
}

type Status = 'starting' | 'scanning' | 'denied' | 'nocamera'

/** Full-screen camera view that reports the first barcode it reads. You can also type the number. */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [typed, setTyped] = useState('')
  const done = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    async function start() {
      try {
        const [detector, s] = await Promise.all([
          makeDetector(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
        ])
        stream = s
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        const v = video.current!
        v.srcObject = s
        await v.play()
        setStatus('scanning')
        const tick = async () => {
          if (stopped || done.current) return
          if (v.readyState >= 2) {
            try {
              // The reader already verifies check digits; UPC-E is expanded to the 12-digit form databases use.
              const codes = (await detector.detect(v)).map((b) => (b.format === 'upc_e' ? expandUpcE(b.rawValue) : b.rawValue))
              const found = codes.find((c) => isValidBarcode(c))
              if (found && !done.current && !stopped) {
                done.current = true
                onCode(found)
                return
              }
            } catch {
              // a frame that can't be read; try the next one
            }
          }
          timer = setTimeout(() => void tick(), 120)
        }
        void tick()
      } catch (err) {
        if (stopped) return
        const name = err instanceof Error ? err.name : ''
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'nocamera')
      }
    }
    void start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop()) // turn the camera off
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typedOk = isValidBarcode(typed)
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black pt-[env(safe-area-inset-top)]">
      <div className="flex items-center px-4 pt-3 text-white">
        <h2 className="flex-1 text-xl font-semibold">Scan barcode</h2>
        <button type="button" onClick={onClose} aria-label="Close scanner" className="grid size-12 place-items-center">
          <X />
        </button>
      </div>
      <div className="relative mx-4 mt-2 flex-1 overflow-hidden rounded-2xl bg-surface">
        {/* playsInline + muted: iOS otherwise opens the video full screen or refuses to start it */}
        <video ref={video} playsInline muted autoPlay className="size-full object-cover" aria-label="Camera" />
        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-xl border-2 border-accent" aria-hidden />
        )}
        <p className="absolute inset-x-4 bottom-4 text-center text-sm text-white drop-shadow">
          {status === 'starting' && 'Starting camera…'}
          {status === 'scanning' && 'Hold the barcode inside the box'}
          {status === 'denied' && 'Camera access is off. Allow it in Settings → Safari → Camera (or the app’s settings), or type the number below.'}
          {status === 'nocamera' && 'Camera not available. Type the number under the barcode below.'}
        </p>
      </div>
      <form
        className="flex gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault()
          if (typedOk && !done.current) {
            done.current = true
            onCode(typed)
          }
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(cleanBarcode(e.target.value))}
          placeholder="Or type the number"
          aria-label="Barcode number"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-base text-text outline-none focus:border-accent"
        />
        <button type="submit" disabled={!typedOk} className="min-h-12 rounded-xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-40">
          Look up
        </button>
      </form>
      {typed.length >= 8 && !typedOk && <p className="-mt-2 px-4 pb-3 text-xs text-amber-400">That number doesn’t look complete; check the digits.</p>}
    </div>
  )
}
