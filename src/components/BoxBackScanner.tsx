import { useRef, useState, useEffect, useCallback } from 'react'
import type { SpecialFeature, SpecialFeatureCategory } from '../types'
import { SPECIAL_FEATURE_CATEGORIES } from '../types'

// ── Heuristic parser ─────────────────────────────────────────────────────────

interface Candidate {
  id: string
  text: string
  checked: boolean
  category: SpecialFeatureCategory | ''
  disc: number | ''
}

const NOISE_PATTERNS = [
  /^\s*$/, // blank
  /^[\d\s.,:;!?|\\/-]{0,6}$/, // pure punctuation / numbers
  /^(blu[-\s]?ray|dvd|uhd|4k|disc\s*\d?|side\s*[ab])/i, // format headers
  /^(special\s+features?|bonus\s+(features?|content)|extras?)\s*:?\s*$/i, // section header itself
  /copyright|all rights reserved|™|®|©|\bwww\b|\bhttp/i, // legal / URLs
  /^\s*[\u2022\u2023\u25E6\u2043\u2219\-–—•·]+\s*$/, // lone bullet chars
]

function isNoise(line: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(line))
}

// Strip leading bullet / dash / number from a line
function cleanLine(line: string): string {
  return line
    .replace(/^[\s\u2022\u2023\u25E6\u2043\u2219•·\-–—*]+/, '')
    .replace(/^[\d]+[.):\s]+/, '')
    .trim()
}

// Guess category from a line's text
function guessCategory(text: string): SpecialFeatureCategory | '' {
  const t = text.toLowerCase()
  if (/commentary|commentry/.test(t)) return 'Audio Commentary'
  if (/trailer/.test(t)) return 'Trailer'
  if (/teaser/.test(t)) return 'Teaser'
  if (/interview/.test(t)) return 'Interview'
  if (/deleted|alternate scene/.test(t)) return 'Deleted Scenes'
  if (/blooper|outtake|gag reel/.test(t)) return 'Outtakes / Bloopers'
  if (/featurette/.test(t)) return 'Featurette'
  if (/documentary|doc\b/.test(t)) return 'Documentary'
  if (/short film/.test(t)) return 'Short Film'
  if (/gallery|photo/.test(t)) return 'Image Gallery'
  if (/music video/.test(t)) return 'Music Video'
  if (/essay|video essay/.test(t)) return 'Essay / Video Essay'
  if (/introduction|intro\b/.test(t)) return 'Introduction'
  if (/tv spot|television spot/.test(t)) return 'TV Spot'
  if (/q&a|q and a/.test(t)) return 'Q&A'
  return ''
}

/**
 * Expand a single OCR line into multiple items when inline bullet/separator
 * characters are present. Box backs commonly list features in a run-on
 * paragraph like: "Commentary • Interview with director • Trailer"
 */
function expandInlineBullets(line: string): string[] {
  // Split on: bullet chars, or " | " or " / " used as separators
  // Use a lookahead/lookbehind to avoid splitting on hyphens inside words
  return line
    .split(/\s*[•·\u2022\u2023\u25E6\u2043\u2219]\s*|\s{1,2}[|]\s{1,2}|\s{2,}\/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseOcrText(raw: string): Candidate[] {
  // First split on newlines, then expand inline bullets within each line
  const lines = raw
    .split('\n')
    .flatMap((line) => expandInlineBullets(line))

  const FEATURE_HEADER =
    /special\s+features?|bonus\s+(features?|content|material)|extras?|supplements?/i

  // Find where the special features block starts
  let blockStart = -1
  for (let i = 0; i < lines.length; i++) {
    if (FEATURE_HEADER.test(lines[i])) {
      blockStart = i
      break
    }
  }

  const candidates: Candidate[] = []
  let id = 0

  const processLine = (line: string, inBlock: boolean) => {
    const cleaned = cleanLine(line)
    if (cleaned.length < 4) return // too short to be useful
    if (isNoise(cleaned)) return

    candidates.push({
      id: String(id++),
      text: cleaned,
      checked: inBlock, // pre-check lines inside the detected block
      category: guessCategory(cleaned),
      disc: '',
    })
  }

  if (blockStart === -1) {
    // No clear block found — surface everything, unchecked
    lines.forEach((l) => processLine(l, false))
  } else {
    // Lines before the block header: unchecked
    lines.slice(0, blockStart).forEach((l) => processLine(l, false))
    // Lines from the block header onward: checked
    lines.slice(blockStart + 1).forEach((l) => processLine(l, true))
  }

  return candidates
}

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
  onSkip: () => void
}

function CropCanvas({ imageSrc, onConfirm, onSkip }: CropCanvasProps) {
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

      // Dim everything outside the selection
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.clearRect(x, y, w, h)
      ctx.drawImage(img, x, y, w, h, x, y, w, h)

      // Selection border
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
        Drag to select only the <span className="text-white">Special Features</span> section of the box,
        then tap <span className="text-accent font-medium">Crop &amp; Scan</span>. Or skip to scan the whole image.
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:bg-surface-overlay hover:text-white"
        >
          Skip — Scan Full Image
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasSelection}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Crop &amp; Scan
        </button>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'crop' | 'processing' | 'review'

interface BoxBackScannerProps {
  onSave: (features: SpecialFeature[]) => void
  onClose: () => void
}

export function BoxBackScanner({ onSave, onClose }: BoxBackScannerProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isDragging, setIsDragging] = useState(false)

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

  function handleCropSkip() {
    if (!pendingFile || !cropSrc) return
    setPreviewSrc(cropSrc)
    runOcr(pendingFile)
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
            <h2 className="text-base font-semibold text-white">Scan Box Back</h2>
            <p className="mt-0.5 text-xs text-muted">
              {stage === 'idle' && 'Upload or photograph the back of the box to extract special features.'}
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

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 px-6 py-10 text-center transition cursor-pointer ${
                  isDragging
                    ? 'border-accent bg-accent/10'
                    : 'border-dashed border-border bg-surface-overlay hover:border-accent/60 hover:bg-surface-raised'
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-10 w-10 text-muted"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3 12V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75V12" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-white">Drop an image here</p>
                  <p className="mt-1 text-xs text-muted">or click to browse your files</p>
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

              {/* Camera shortcut (mobile-friendly) */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted transition hover:bg-surface-overlay hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                Use Camera
              </button>
            </div>
          )}

          {/* ── Stage: crop ── */}
          {stage === 'crop' && cropSrc && (
            <CropCanvas
              imageSrc={cropSrc}
              onConfirm={handleCropConfirm}
              onSkip={handleCropSkip}
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
              {/* Image thumbnail */}
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
                        setStage('idle')
                        setCandidates([])
                        setPreviewSrc(null)
                        setCropSrc(null)
                        setPendingFile(null)
                      }}
                      className="mt-2 text-xs text-muted underline transition hover:text-white"
                    >
                      ← Try a different image
                    </button>
                  </div>
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
                    onChange={(e) => setManualName(e.target.value)}
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
