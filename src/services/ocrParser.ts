import type { SpecialFeatureCategory } from '../types'

// ── Public interface ──────────────────────────────────────────────────────────

export interface OcrCandidate {
  id: string
  text: string
  checked: boolean
  category: SpecialFeatureCategory | ''
  disc: number | ''
}

/**
 * Parse raw Tesseract OCR output into a list of special-feature candidates.
 * Lines inside a detected "Special Features" section are pre-checked;
 * all other lines are surfaced unchecked for the user to triage.
 */
export function parseOcrText(raw: string): OcrCandidate[] {
  // 1. Normalize OCR artefacts, 2. split on newlines,
  // 3. expand inline bullets, 4. catch OCR-misread bullets
  const lines = normalizeOcr(raw)
    .split('\n')
    .flatMap((line) => expandInlineBullets(line))
    .flatMap((line) => splitOnOcrBulletMisreads(line))

  const FEATURE_HEADER =
    /special\s+features?|bonus\s+(features?|content|material)|extras?|supplements?|contents?:|new\s+and\s+archival|archival\s+(features?|materials?)/i

  // Find where the special features block starts
  let blockStart = -1
  for (let i = 0; i < lines.length; i++) {
    if (FEATURE_HEADER.test(lines[i])) {
      blockStart = i
      break
    }
  }

  const candidates: OcrCandidate[] = []
  let id = 0

  const processLine = (line: string, inBlock: boolean) => {
    const cleaned = cleanLine(line)
    if (cleaned.length < 3) return // too short to be useful
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

// ── Internal helpers ──────────────────────────────────────────────────────────

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

/** Strip leading bullet / dash / number from a line. */
function cleanLine(line: string): string {
  return line
    .replace(/^[\s\u2022\u2023\u25E6\u2043\u2219•·\-–—*]+/, '')
    .replace(/^[\d]+[.):\s]+/, '')
    .trim()
}

/** Guess category from a line's text. */
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
 * Pre-normalize raw Tesseract output before splitting into lines.
 * Fixes the most common OCR artefacts so downstream parsers see
 * a consistent set of separators.
 */
function normalizeOcr(raw: string): string {
  return (
    raw
      // Unify all Unicode bullet / arrow / square variants → standard bullet •
      .replace(/[●◆◉▪▸►◀■▶‣⁃◦○◘◙\u25CF\u25CB\u25AA\u25AB\u25B8\u25BA\u2024\u2027]/gu, '•')
      // Lone * at start of a line (used as list marker) → •
      .replace(/^[ \t]*\*[ \t]+/gm, '• ')
      // Lone hyphen / en-dash / em-dash at start of a line → •
      .replace(/^[ \t]*[-–—][ \t]+/gm, '• ')
      // Tab characters between content → newline (OCR sometimes outputs columns with tabs)
      .replace(/([^\n\t])\t+([^\n\t])/g, '$1\n$2')
      // 4+ spaces between word characters → newline (OCR column-break artefact)
      .replace(/(\w)[ ]{4,}(\w)/g, '$1\n$2')
  )
}

/**
 * Expand a single OCR line into multiple items when inline bullet/separator
 * characters are present. Box backs commonly list features in a run-on
 * paragraph like: "Commentary • Interview with director • Trailer"
 */
function expandInlineBullets(line: string): string[] {
  return line
    .split(
      // bullet chars (standard + after normalizeOcr)
      /\s*[•·\u2022\u2023\u25E6\u2043\u2219]\s*/ +
      // pipe separator with surrounding spaces
      '|[ \\t]{1,2}[|][ \\t]{1,2}' +
      // inline * used as bullet
      '|\\s+\\*\\s+' +
      // en-dash or em-dash used as inline separator (space-surrounded)
      '|\\s{1,2}[–—]\\s{1,2}',
    )
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Detect lines where Tesseract misread bullet chars as the letter 'e' or 'o'.
 * Pattern: a standalone lowercase letter followed by a space and a capital word,
 * repeated two or more times in the same line → split on those letters.
 */
function splitOnOcrBulletMisreads(line: string): string[] {
  // Count how many times we see a lone 'e' or 'o' before a capitalized word
  const eHits = (line.match(/\be [A-Z]/g) ?? []).length
  if (eHits >= 2) {
    return line.split(/\be +/).map((s) => s.trim()).filter(Boolean)
  }
  const oHits = (line.match(/\bo [A-Z]/g) ?? []).length
  if (oHits >= 2) {
    return line.split(/\bo +/).map((s) => s.trim()).filter(Boolean)
  }
  return [line]
}
