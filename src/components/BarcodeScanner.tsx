import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()

        if (devices.length === 0) {
          setError('No camera found on this device.')
          setIsStarting(false)
          return
        }

        // Prefer back/rear/environment-facing camera on mobile
        const rearCamera = devices.find((d) =>
          /back|rear|environment/i.test(d.label),
        )
        // Fall back to last device (often rear on mobile when unlabeled)
        const deviceId = rearCamera?.deviceId ?? devices[devices.length - 1].deviceId

        if (!videoRef.current) return

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              onScanRef.current(result.getText())
            }
          },
        )

        controlsRef.current = controls
        setIsStarting(false)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : ''
        if (/permission|notallowed|denied/i.test(msg)) {
          setError('Camera access denied. Please allow camera permissions and try again.')
        } else if (/notfound|devicenotfound/i.test(msg)) {
          setError('No camera found on this device.')
        } else {
          setError('Could not start the camera. Try again.')
        }
        setIsStarting(false)
      }
    }

    start()

    return () => {
      controlsRef.current?.stop()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur-sm">
        <p className="text-sm font-medium text-white">Scan Barcode</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted transition hover:text-white"
          aria-label="Close scanner"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* ── Camera view ── */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto mb-4 h-12 w-12 text-muted"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                />
              </svg>
              <p className="mb-5 text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
            />

            {/* Dim overlay with a clear scanning window */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Top/bottom dim bands */}
              <div className="absolute inset-x-0 top-0 h-[calc(50%-2rem)] bg-black/50" />
              <div className="absolute inset-x-0 bottom-0 h-[calc(50%-2rem)] bg-black/50" />
              {/* Left/right dim bands */}
              <div className="absolute inset-y-[calc(50%-2rem)] left-0 w-12 bg-black/50" />
              <div className="absolute inset-y-[calc(50%-2rem)] right-0 w-12 bg-black/50" />

              {/* Scanning window corners */}
              <div className="relative h-16 w-[calc(100%-6rem)]">
                <div className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-accent" />
                <div className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-accent" />
                <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-accent" />
                <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-accent" />
                {/* Scanning line animation */}
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-accent/60 shadow-[0_0_6px_1px] shadow-accent/40" />
              </div>
            </div>
          </>
        )}

        {/* Starting state overlay */}
        {isStarting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-sm text-muted">Starting camera…</p>
          </div>
        )}
      </div>

      {/* ── Footer hint ── */}
      {!error && (
        <div className="bg-black/80 px-4 py-3 text-center backdrop-blur-sm">
          <p className="text-xs text-muted">
            Point the camera at the barcode on your disc case
          </p>
        </div>
      )}
    </div>
  )
}
