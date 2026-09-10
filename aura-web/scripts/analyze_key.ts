/**
 * DETECTOR DE TONO Y MODO (mayor/menor) AURA.
 *
 * Chromagrama (folding de magnitud espectral en 12 clases de tono) + correlación
 * de Pearson con los perfiles de Krumhansl–Kessler para mayor y menor, barriendo
 * las 12 tónicas posibles. Responde: ¿en qué tono está y es mayor o menor?
 *
 * Uso:
 *   npm run analyze:key -- <wav>
 */
import { join } from 'path'
import { readWav } from './wavlib'

const FRAME_SIZE = 4096
const HOP = 1024
const N_BINS = FRAME_SIZE / 2

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cRe = 1
      let cIm = 0
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j]
        const uIm = im[i + j]
        const vRe = re[i + j + len / 2] * cRe - im[i + j + len / 2] * cIm
        const vIm = re[i + j + len / 2] * cIm + im[i + j + len / 2] * cRe
        re[i + j] = uRe + vRe
        im[i + j] = uIm + vIm
        re[i + j + len / 2] = uRe - vRe
        im[i + j + len / 2] = uIm - vIm
        const ncRe = cRe * wRe - cIm * wIm
        cIm = cRe * wIm + cIm * wRe
        cRe = ncRe
      }
    }
  }
}

// Perfiles de Krumhansl & Kessler (1982) para mayor y menor.
const PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
} as const

const NOTE_NAMES = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab']

function chroma(path: string): { chroma: Float32Array; frames: number } {
  const wav = readWav(path)
  const sr = wav.sampleRate
  const nFrames = Math.max(1, Math.floor((wav.samples.length - FRAME_SIZE) / HOP))
  const acc = new Float32Array(12)
  const re = new Float32Array(FRAME_SIZE)
  const im = new Float32Array(FRAME_SIZE)
  const win = new Float32Array(FRAME_SIZE)
  for (let i = 0; i < FRAME_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME_SIZE)

  let usableFrames = 0
  const LOG2 = Math.log(2)
  for (let f = 0; f < nFrames; f++) {
    const base = f * HOP
    for (let i = 0; i < FRAME_SIZE; i++) { re[i] = wav.samples[base + i] * win[i]; im[i] = 0 }
    fft(re, im)
    for (let k = 1; k < N_BINS; k++) {
      const freq = (k * sr) / FRAME_SIZE
      if (freq < 60 || freq > 10000) continue
      const mag = Math.sqrt(re[k] ** 2 + im[k] ** 2)
      if (mag < 1e-6) continue
      const pc = (((Math.round(12 * Math.log2(freq / 440) / 1) % 12) + 12) % 12)
      acc[pc] += mag
    }
    usableFrames++
  }
  return { chroma: acc, frames: usableFrames }
}

function pearson(a: Float32Array, b: number[]): number {
  const n = 12
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx += a[i]; sy += b[i]
    sxx += a[i] * a[i]; syy += b[i] * b[i]
    sxy += a[i] * b[i]
  }
  const num = n * sxy - sx * sy
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
  return den === 0 ? 0 : num / den
}

function main(): void {
  const args = process.argv.slice(2)
  const fileArgs = args.filter((a) => !a.startsWith('--'))
  if (fileArgs.length === 0) {
    console.log('Uso: npm run analyze:key -- <wav>')
    return
  }
  const path = fileArgs[0]
  const { chroma: chromaVec } = chroma(path)
  const total = Array.from(chromaVec).reduce((a, b) => a + b, 0)
  const meanPc = total / 12
  const stdPc = Math.sqrt(Array.from(chromaVec).reduce((a, b) => a + (b - meanPc) ** 2, 0) / 12)
  const cv = meanPc === 0 ? 0 : stdPc / meanPc // concentración cromática (ruido ≈ plano → cv bajo)

  let best = { tonic: 0, mode: 'major' as keyof typeof PROFILES, corr: -Infinity }
  const scores: { tonic: number; mode: keyof typeof PROFILES; corr: number }[] = []
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
      const rotated = new Float32Array(12)
      for (let pc = 0; pc < 12; pc++) rotated[(pc - tonic + 12) % 12] = chromaVec[pc]
      const corr = pearson(rotated, PROFILES[mode])
      scores.push({ tonic, mode, corr })
      if (corr > best.corr) best = { tonic, mode, corr }
    }
  }
  scores.sort((a, b) => b.corr - a.corr)

  const top5 = scores.slice(0, 5)
  console.log(`=== DETECTOR DE TONO / MODO AURA ===`)
  console.log(`archivo: ${path}`)
  console.log(`energía cromática total: ${total.toFixed(1)}`)
  console.log(`\nTOP 5 candidatos (tónica · modo · correlación):`)
  for (const s of top5) {
    const tag = s === best ? '  ← DETECTADO' : ''
    console.log(`  ${NOTE_NAMES[s.tonic].padEnd(3)} ${s.mode.padEnd(5)} ${s.corr.toFixed(3)}${tag}`)
  }

  const diff = best.corr - scores[1].corr
  const confident = best.corr > 0.45 && diff > 0.02 && total > 0.001 && cv >= 0.25
  console.log(`\nResultado: ${NOTE_NAMES[best.tonic]} ${best.mode} (r=${best.corr.toFixed(3)}, margen=${diff.toFixed(3)}, CV=${cv.toFixed(2)})`)
  if (!confident) {
    console.log('⚠ confianza BAJA: sin centro tonal claro (¿loop solo de batería? ¿audio sin melodía?).')
  }
}

main()