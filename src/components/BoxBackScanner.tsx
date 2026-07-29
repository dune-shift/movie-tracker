import { useRef, useState, useEffect, useCallback } from 'react'
import type { SpecialFeature, SpecialFeatureCategory } from '../types'
import { SPECIAL_FEATURE_CATEGORIES } from '../types'
import { type OcrCandidate, parseOcrText, guessCategory } from '../services/ocrParser'

// ── Crop canvas ───────────────────────────────────────────────────────────────

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface CropCanvasProps {
  imageSrc: string
  onConfirm: (rect: CropRect, naturalW: number, naturalH: number) => void
}

function CropCanvas({ imageSrc, onConfirm }: CropCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  // rect stored in *canvas* coordinates
  const rectRef = useRef<CropRect | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [, forceRender] = useState(0)

  // Draw image + overlay + selection rectangle
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const rect = rectRef.current
    if (rect && rect.w !== 0 && rect.h !== 0) {
      const x = rect.w < 0 ? rect.x + rect.w : rect.x
      const y = rect.h < 0 ? rect.y + rect.h : rect.y
      const w = Math.abs(rect.w)
      const h = Math.abs(rect.h)

      // Dim everything OUTSIDE the selection using a composite punch-out
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.beginPath()
      // Outer rect (whole canvas) minus inner rect (selection) = ring shape
      ctx.rect(0, 0, canvas.width, canvas.height)
      ctx.rect(x, y, w, h)
      ctx.fill('evenodd')
      ctx.restore()

      // Selection border — solid outline only, no fill inside
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.strokeRect(x, y, w, h)

      // Corner handles
      const hs = 8
      ctx.fillStyle = '#6366f1'
      ;[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => {
        ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs)
      })
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      // Scale canvas to fit container width, maintain aspect ratio
      const maxW = canvas.parentElement?.clientWidth ?? 600
      const scale = Math.min(1, maxW / img.naturalWidth)
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      draw()
    }
    img.src = imageSrc
  }, [imageSrc, draw])

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault() // prevent browser from treating canvas as a draggable image
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = getCanvasPos(e)
    dragStartRef.current = pos
    rectRef.current = { x: pos.x, y: pos.y, w: 0, h: 0 }
    draw()
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragStartRef.current) return
    const pos = getCanvasPos(e)
    rectRef.current = {
      x: dragStartRef.current.x,
      y: dragStartRef.current.y,
      w: pos.x - dragStartRef.current.x,
      h: pos.y - dragStartRef.current.y,
    }
    draw()
  }

  function onPointerUp() {
    dragStartRef.current = null
    forceRender((n) => n + 1) // trigger re-render to enable/disable Confirm button
  }

  function handleConfirm() {
    const canvas = canvasRef.current
    const img = imgRef.current
    const rect = rectRef.current
    if (!canvas || !img || !rect) return

    // Normalize negative widths/heights
    const x = rect.w < 0 ? rect.x + rect.w : rect.x
    const y = rect.h < 0 ? rect.y + rect.h : rect.y
    const w = Math.abs(rect.w)
    const h = Math.abs(rect.h)
    if (w < 10 || h < 10) return

    // Convert canvas coords back to natural image coords
    const scaleX = img.naturalWidth / canvas.width
    const scaleY = img.naturalHeight / canvas.height
    onConfirm(
      {
        x: x * scaleX,
        y: y * scaleY,
        w: w * scaleX,
        h: h * scaleY,
      },
      img.naturalWidth,
      img.naturalHeight,
    )
  }

  const hasSelection = (() => {
    const r = rectRef.current
    return r !== null && Math.abs(r.w) >= 10 && Math.abs(r.h) >= 10
  })()

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Drag a box around the <span className="text-white">Special Features</span> section, then tap{' '}
        <span className="text-accent font-medium">Crop &amp; Scan</span>.
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <canvas
          ref={canvasRef}
          draggable={false}
          className="block w-full cursor-crosshair touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!hasSelection}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        Crop &amp; Scan
      </button>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'paste' | 'crop' | 'processing' | 'review'

interface BoxBackScannerProps {
  onSave: (features: SpecialFeature[]) => void
  onClose: () => void
}

export function BoxBackScanner({ onSave, onClose }: BoxBackScannerProps) {
  const [stage, setStage] = useState<Stage>('paste')
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [candidates, setCandidates] = useState<OcrCandidate[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Paste-text state
  const [pasteText, setPasteText] = useState('')
  const [reviewSource, setReviewSource] = useState<'image' | 'paste'>('image')

  // Manual-add row state
  const [manualName, setManualName] = useState('')
  const [manualCategory, setManualCategory] = useState<SpecialFeatureCategory | ''>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── OCR ────────────────────────────────────────────────────────────────────

  async function runOcr(file: File) {
    setStage('processing')
    setProgress(0)
    setProgressStatus('Loading OCR engine…')
    setError(null)

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          setProgressStatus(m.status)
          setProgress(Math.round((m.progress ?? 0) * 100))
        },
      })

      const {
        data: { text },
      } = await worker.recognize(file)
      await worker.terminate()

      const parsed = parseOcrText(text)
      setCandidates(parsed)
      setStage('review')
    } catch (err) {
      console.error(err)
      setError('OCR failed. Please try again or enter features manually.')
      setStage('idle')
    }
  }

  // ── Paste-text handler ──────────────────────────────────────────────────────

  function handleParsePaste() {
    const text = pasteText.trim()
    if (!text) return
    const parsed = parseOcrText(text)
    setCandidates(parsed)
    setReviewSource('paste')
    setPreviewSrc(null)
    setStage('review')
  }

  // ── File / drop handlers ────────────────────────────────────────────────────

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    // Show crop stage first
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setPendingFile(file)
    setReviewSource('image')
    setStage('crop')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  // ── Crop handlers ───────────────────────────────────────────────────────────

  function handleCropConfirm(rect: CropRect, naturalW: number, naturalH: number) {
    if (!cropSrc) return

    // Draw the cropped region to a new canvas and convert to a File
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(rect.w)
      canvas.height = Math.round(rect.h)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Fallback to full image
            if (pendingFile) runOcr(pendingFile)
            return
          }
          const croppedFile = new File([blob], 'crop.jpg', { type: 'image/jpeg' })
          // Update preview to show the cropped area
          setPreviewSrc(URL.createObjectURL(blob))
          runOcr(croppedFile)
        },
        'image/jpeg',
        0.92,
      )
    }
    img.src = cropSrc
    // Suppress unused warning — naturalW/H used for reference only
    void naturalW
    void naturalH
  }

  // ── Candidate editing ───────────────────────────────────────────────────────

  function toggleCandidate(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)),
    )
  }

  function updateCandidateText(id: string, text: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, text } : c)),
    )
  }

  function updateCandidateCategory(id: string, category: SpecialFeatureCategory | '') {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, category } : c)),
    )
  }

  function updateCandidateDisc(id: string, disc: number | '') {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, disc } : c)),
    )
  }

  function removeCandidate(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }

  function addManual() {
    const name = manualName.trim()
    if (!name) return
    setCandidates((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        text: name,
        checked: true,
        category: manualCategory,
        disc: '',
      },
    ])
    setManualName('')
    setManualCategory('')
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function handleSave() {
    const selected = candidates.filter((c) => c.checked && c.text.trim())
    const features: SpecialFeature[] = selected.map((c) => ({
      id: crypto.randomUUID(),
      name: c.text.trim(),
      category: c.category || undefined,
      disc: c.disc !== '' ? c.disc : undefined,
    }))
    onSave(features)
  }

  const checkedCount = candidates.filter((c) => c.checked).length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Import Features</h2>
            <p className="mt-0.5 text-xs text-muted">
              {stage === 'idle' && 'Upload or photograph the back of the box to extract special features.'}
              {stage === 'paste' && 'Paste the special features description from the distributor or retailer listing.'}
              {stage === 'crop' && 'Drag to select the Special Features section, then crop & scan.'}
              {stage === 'processing' && 'Reading text from your image…'}
              {stage === 'review' && 'Review the detected features below, then click "Add Features".'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-overlay hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-6">

          {/* ── Stage: idle ── */}
          {stage === 'idle' && (
            <div className="space-y-4">
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              {/* Primary: camera CTA */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-10 text-center transition hover:bg-accent-hover active:scale-[0.98]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-12 w-12 text-white/80"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <div>
                  <p className="text-base font-semibold text-white">Take a Photo</p>
                  <p className="mt-0.5 text-xs text-white/60">Point your camera at the box back</p>
                </div>
              </button>

              {/* Secondary: paste text */}
              <button
                type="button"
                onClick={() => { setPasteText(''); setStage('paste') }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs text-muted transition hover:border-border/80 hover:text-white/70"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0">
                  <path d="M5.5 13.5A1.5 1.5 0 017 12h6a1.5 1.5 0 011.5 1.5v1A1.5 1.5 0 0113 16H7a1.5 1.5 0 01-1.5-1.5v-1z" />
                  <path fillRule="evenodd" d="M6.5 3A1.5 1.5 0 005 4.5v11A1.5 1.5 0 006.5 17h7A1.5 1.5 0 0015 15.5v-11A1.5 1.5 0 0013.5 3h-7zM6.5 4h7a.5.5 0 01.5.5v11a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5z" clipRule="evenodd" />
                </svg>
                Paste features text instead
              </button>

              {/* Tertiary: upload file — small & subtle */}
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs transition ${
                  isDragging
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-border text-muted hover:border-border/80 hover:text-white/70'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0">
                  <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                </svg>
                Upload an image instead
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
            </div>
          )}

          {/* ── Stage: paste ── */}
          {stage === 'paste' && (
            <div className="space-y-4">
              <textarea
                autoFocus
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Paste the special features list here. For example:\n\n• Audio commentary with director\n• Behind-the-scenes featurette\n• Theatrical trailer\n\nAny format works — bullets, numbered lists, or plain lines.`}
                rows={10}
                className="w-full resize-none rounded-xl border border-border bg-surface-overlay px-4 py-3 text-sm text-white placeholder-muted/40 outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Parse Features →
              </button>

              {/* Secondary: photo options */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted">or use a photo instead</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs text-muted transition hover:border-border/80 hover:text-white/70"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  Take a Photo
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs transition ${
                    isDragging
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-border text-muted hover:border-border/80 hover:text-white/70'
                  }`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                  </svg>
                  Upload Image
                </div>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileSelect(file)
                }}
              />
            </div>
          )}

          {/* ── Stage: crop ── */}
          {stage === 'crop' && cropSrc && (
            <CropCanvas
              imageSrc={cropSrc}
              onConfirm={handleCropConfirm}
            />
          )}

          {/* ── Stage: processing ── */}
          {stage === 'processing' && (
            <div className="space-y-5">
              {/* Preview thumbnail */}
              {previewSrc && (
                <div className="mx-auto max-h-48 max-w-xs overflow-hidden rounded-lg border border-border">
                  <img src={previewSrc} alt="Box back preview" className="h-full w-full object-contain" />
                </div>
              )}

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="capitalize">{progressStatus || 'Processing…'}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted">
                  This may take a moment. OCR runs entirely in your browser — no data is sent anywhere.
                </p>
              </div>
            </div>
          )}

          {/* ── Stage: review ── */}
          {stage === 'review' && (
            <div className="space-y-4">
              {/* Review header — image path */}
              {previewSrc && (
                <div className="flex items-start gap-4">
                  <img
                    src={previewSrc}
                    alt="Box back"
                    className="h-24 w-20 flex-shrink-0 rounded-lg border border-border object-contain"
                  />
                  <div className="flex-1 text-sm text-muted">
                    <p>
                      Found <span className="font-medium text-white">{candidates.length}</span> candidate lines.{' '}
                      <span className="font-medium text-accent">{checkedCount} selected</span> — adjust below, then confirm.
                    </p>
                    <p className="mt-1 text-xs">
                      Lines inside a "Special Features" section are pre-checked. Uncheck anything that's not a feature.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCandidates([])
                        setPreviewSrc(null)
                        setCropSrc(null)
                        setPendingFile(null)
                        setStage('idle')
                      }}
                      className="mt-2 text-xs text-muted underline transition hover:text-white"
                    >
                      ← Try a different image
                    </button>
                  </div>
                </div>
              )}

              {/* Review header — paste path */}
              {!previewSrc && reviewSource === 'paste' && (
                <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
                  <p>
                    Found <span className="font-medium text-white">{candidates.length}</span> feature{candidates.length !== 1 ? 's' : ''}.{' '}
                    <span className="font-medium text-accent">{checkedCount} selected</span> — adjust below, then confirm.
                  </p>
                  <p className="mt-1 text-xs">
                    Categories were auto-detected from the text. Edit any name, change the category, or uncheck items you don't want.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCandidates([])
                      setStage('paste')
                    }}
                    className="mt-2 text-xs text-muted underline transition hover:text-white"
                  >
                    ← Paste different text
                  </button>
                </div>
              )}

              {/* Candidates list */}
              {candidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                  No text could be detected. Try a clearer or brighter photo.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 px-3 py-2.5 transition ${
                        c.checked ? 'bg-surface-overlay' : 'bg-surface opacity-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={() => toggleCandidate(c.id)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-accent"
                      />

                      {/* Text + controls */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={c.text}
                          onChange={(e) => updateCandidateText(c.id, e.target.value)}
                          disabled={!c.checked}
                          className="w-full rounded border border-border bg-transparent px-2 py-0.5 text-sm text-white outline-none focus:border-accent disabled:text-muted"
                        />

                        {c.checked && (
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={c.category}
                              onChange={(e) =>
                                updateCandidateCategory(c.id, e.target.value as SpecialFeatureCategory | '')
                              }
                              className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-white outline-none focus:border-accent"
                            >
                              <option value="">Category…</option>
                              {SPECIAL_FEATURE_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min="1"
                              placeholder="Disc #"
                              value={c.disc === '' ? '' : c.disc}
                              onChange={(e) =>
                                updateCandidateDisc(
                                  c.id,
                                  e.target.value === '' ? '' : Number(e.target.value),
                                )
                              }
                              className="w-20 rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-white outline-none focus:border-accent"
                            />
                          </div>
                        )}
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeCandidate(c.id)}
                        className="mt-0.5 flex-shrink-0 text-muted transition hover:text-white"
                        aria-label="Remove"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual add row */}
              <div className="rounded-xl border border-dashed border-border bg-surface-raised px-3 py-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                  Add manually
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Feature name…"
                    value={manualName}
                    onChange={(e) => {
                      const val = e.target.value
                      setManualName(val)
                      // Auto-detect category from name as the user types
                      const detected = guessCategory(val)
                      if (detected) setManualCategory(detected)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addManual()}
                    className="flex-1 min-w-[160px] rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-sm text-white placeholder-muted/50 outline-none focus:border-accent"
                  />
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as SpecialFeatureCategory | '')}
                    className="rounded-lg border border-border bg-surface-overlay px-2 py-1.5 text-sm text-white outline-none focus:border-accent"
                  >
                    <option value="">Category…</option>
                    {SPECIAL_FEATURE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addManual}
                    disabled={!manualName.trim()}
                    className="rounded-lg border border-border bg-surface-overlay px-3 py-1.5 text-sm text-muted transition hover:bg-surface-raised hover:text-white disabled:opacity-40"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-overlay hover:text-white"
          >
            Cancel
          </button>

          {stage === 'review' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={checkedCount === 0 && manualName.trim() === ''}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add {checkedCount > 0 ? `${checkedCount} Feature${checkedCount !== 1 ? 's' : ''}` : 'Features'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
