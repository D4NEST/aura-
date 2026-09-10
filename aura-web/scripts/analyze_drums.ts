/**
 * ANALIZADOR DE BATERÍA AURA (type-beat analyzer, plano rítmico).
 *
 * Pipeline (flujo del productor validado): DETECCIÓN por banda espectral
 * (cada instrumento pica su propia banda) + CLASIFICACIÓN SECUENCIAL POR
 * CAPAS en el mismo orden del remake manual: primero kick (baja dominante),
 * luego snare, luego hats. Ideal para batería AISLADA (el `splitter` que
 * usa el productor), y tolera el kick debajo de todo (cuatro en piso).
 *
 * Uso:
 *   npm run analyze:drums -- <wav> [--bpm 92] [--genre reggaeton]
 *
 * Salida: pasos [1..16] por instrumento y acierto contra el patrón conocido
 * del motor (si coincide el género). DEBUG con AURA_DEBUG=1.
 */
import { readWav } from './wavlib'

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

interface Onset { time: number }

interface Analysis {
  kick: Onset[]
  snare: Onset[]
  hats: Onset[]
  mid: Onset[]
}

const FRAME_SIZE = 2048
const HOP = 512
const N_BINS = FRAME_SIZE / 2

const BANDS = {
  kick: { lo: 40, hi: 120 },
  snare: { lo: 800, hi: 5000 },
  hats: { lo: 7000, hi: 14000 },
  mid: { lo: 150, hi: 1000 },
} as const

type BandKey = keyof typeof BANDS

function analyze(wav: import('./wavlib').Wav, bpm: number): Analysis {
  const sampleRate = wav.sampleRate
  const nFrames = Math.max(1, Math.floor((wav.samples.length - FRAME_SIZE) / HOP))
  const re = new Float32Array(FRAME_SIZE)
  const im = new Float32Array(FRAME_SIZE)
  const win = new Float32Array(FRAME_SIZE)
  for (let i = 0; i < FRAME_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME_SIZE)

  const binFreq = (bin: number) => (bin * sampleRate) / FRAME_SIZE
  const binOf = (hz: number) => Math.round(hz / binFreq(1))

  // Matriz de espectros + energía por banda por frame.
  const specs = new Float32Array(nFrames * N_BINS)
  for (let f = 0; f < nFrames; f++) {
    const base = f * HOP
    for (let i = 0; i < FRAME_SIZE; i++) { re[i] = wav.samples[base + i] * win[i]; im[i] = 0 }
    fft(re, im)
    for (let k = 0; k < N_BINS; k++) specs[f * N_BINS + k] = Math.sqrt(re[k] ** 2 + im[k] ** 2)
  }

  // Detección: flujo por BANDA (un golpe quieto de hat sí mueve su banda 7k-14k,
  // aunque no mueva el total). Picos locales por banda + unión deduplicada.
  const bandEnergy: Record<BandKey, Float32Array> = {
    kick: new Float32Array(nFrames),
    snare: new Float32Array(nFrames),
    hats: new Float32Array(nFrames),
    mid: new Float32Array(nFrames),
  }
  for (let f = 0; f < nFrames; f++) {
    for (const band of Object.keys(BANDS) as BandKey[]) {
      const lo = Math.max(1, binOf(BANDS[band].lo))
      const hi = Math.min(N_BINS, binOf(BANDS[band].hi))
      let sum = 0
      for (let k = lo; k <= hi; k++) sum += specs[f * N_BINS + k]
      bandEnergy[band][f] = sum
    }
  }

  const bandFlow = new Map<number, { flux: number; source: BandKey }>()
  const minSepFrames = Math.max(1, Math.round((60 / bpm) / 16 / (HOP / sampleRate))) // 1/16
  for (const band of Object.keys(BANDS) as BandKey[]) {
    const e = bandEnergy[band]
    const flux = new Float32Array(nFrames)
    for (let f = 1; f < nFrames; f++) flux[f] = Math.max(0, e[f] - e[f - 1])
    const mean = Array.from(flux).reduce((a, b) => a + b, 0) / nFrames
    if (mean === 0) continue
    const std = Math.sqrt(Array.from(flux).reduce((a, b) => a + (b - mean) ** 2, 0) / nFrames)
    const thresh = mean + 1.35 * std
    for (let i = 1; i < nFrames - 1; i++) {
      if (flux[i] > thresh && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
        const cur = bandFlow.get(i)
        if (!cur || flux[i] > cur.flux) bandFlow.set(i, { flux: flux[i], source: band })
      }
    }
  }
  const frames = Array.from(bandFlow.keys()).sort((a, b) => a - b)
  const events: number[] = []
  for (const f of frames) {
    if (events.length === 0 || f - events[events.length - 1] >= minSepFrames) events.push(f)
  }

  // Clasificación SECUENCIAL POR CAPAS (orden del remake manual),
  // sobre ratios de banda crudos normalizados por ancho de banda.
  const bandCount: Record<BandKey, number> = { kick: 0, snare: 0, hats: 0, mid: 0 }
  for (const band of Object.keys(BANDS) as BandKey[]) {
    bandCount[band] = Math.min(N_BINS, Math.max(1, binOf(BANDS[band].hi) - binOf(BANDS[band].lo) + 1))
  }

  const getRatios = (ev: number) => {
    const acc: Record<BandKey, number> = { kick: 0, snare: 0, hats: 0, mid: 0 }
    for (let d = 0; d < 6; d++) {
      const frame = Math.min(nFrames - 1, ev + d)
      for (const band of Object.keys(BANDS) as BandKey[]) {
        const lo = Math.max(1, binOf(BANDS[band].lo))
        const hi = Math.min(N_BINS, binOf(BANDS[band].hi))
        let sum = 0
        for (let k = lo; k <= hi; k++) sum += specs[frame * N_BINS + k]
        acc[band] += sum / bandCount[band]
      }
    }
    const base = Object.values(acc).reduce((a, b) => a + b, 0) || 1
    return {
      kick: acc.kick / base,
      snare: acc.snare / base,
      hats: acc.hats / base,
      mid: acc.mid / base,
    }
  }

  const out: Analysis = { kick: [], snare: [], hats: [], mid: [] }
  const DEBUG = !!process.env.AURA_DEBUG
  for (const ev of events) {
    const r = getRatios(ev)
    const t = (ev * HOP + FRAME_SIZE / 2) / sampleRate
    const source = bandFlow.get(ev)?.source ?? 'mid'
    let cls: BandKey
    if (r.kick >= 0.45) cls = 'kick'
    else if (source === 'kick') cls = 'kick' // el pico vino de la banda baja
    else if (r.snare >= 0.2 && (r.snare >= r.hats || source === 'snare')) cls = 'snare'
    else if (r.hats >= 0.15 || source === 'hats') cls = 'hats'
    else if (source === 'mid' || r.mid >= 0.25) cls = 'mid'
    else cls = 'kick'
    out[cls].push({ time: t })
    if (DEBUG) console.log(`ev t=${t.toFixed(3)} src=${source} k=${r.kick.toFixed(2)} s=${r.snare.toFixed(2)} h=${r.hats.toFixed(2)} m=${r.mid.toFixed(2)} → ${cls}`)
  }
  return out
}

function toGrid(onsets: Onset[], bpm: number, refTime: number): number[] {
  if (onsets.length === 0) return []
  const secPer16 = (60 / bpm) / 16
  const steps = new Set<number>()
  for (const o of onsets) {
    const step = Math.round((o.time - refTime) / secPer16)
    const pos = (((step % 16) + 16) % 16) + 1
    steps.add(pos)
  }
  return Array.from(steps).sort((a, b) => a - b)
}

function gridString(steps: number[]): string {
  const cells: string[] = []
  for (let s = 1; s <= 16; s++) cells.push(steps.includes(s) ? 'X' : '.')
  return cells.join('')
}

interface KnownPattern { kick: number[]; snare: number[]; hats: number[] }

const KNOWN: Record<string, KnownPattern> = {
  reggaeton: { kick: [1, 5, 9, 13], snare: [4, 7, 12, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
  detroit: { kick: [1, 5, 9, 13], snare: [5, 13], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
  trap: { kick: [1, 5, 9, 13], snare: [5, 13], hats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
  rap: { kick: [1, 5, 9, 13], snare: [5, 9, 13], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
}

function main(): void {
  const args = process.argv.slice(2)
  const fileArgs = args.filter((a) => !a.startsWith('--'))
  const bpmArg = args.find((a) => a.startsWith('--bpm'))
  const genreArg = args.find((a) => a.startsWith('--genre'))
  if (fileArgs.length === 0) {
    console.log('Uso: npm run analyze:drums -- <wav> [--bpm 92] [--genre reggaeton]')
    return
  }
  const path = fileArgs[0]
  const bpm = bpmArg ? Number(bpmArg.split('=')[1] ?? bpmArg) : 92
  let genre = genreArg ? genreArg.split('=')[1] ?? genreArg : ''
  if (!genre) genre = path.includes('reggaeton') ? 'reggaeton' : path.includes('detroit') ? 'detroit' : path.includes('trap') ? 'trap' : path.includes('rap') ? 'rap' : ''

  const wav = readWav(path)
  console.log(`=== ANALIZADOR DE BATERÍA AURA (clasificación por capas) ===`)
  console.log(`archivo: ${path}`)
  console.log(`sampleRate: ${wav.sampleRate} Hz · duración: ${(wav.samples.length / wav.sampleRate).toFixed(2)} s · BPM: ${bpm}`)
  console.log(`rejilla 1/16 · X = golpe (conjunto de compases) · 1 compás = 16 pasos\n`)

  const onsetData = analyze(wav, bpm)
  const known = genre ? KNOWN[genre] : undefined
  // Ancla: primer kick (downbeat comienza la barra 1); si no, primer evento.
  const firstStrong = onsetData.kick[0]?.time ?? onsetData.snare[0]?.time ?? onsetData.hats[0]?.time ?? 0

  for (const [band, label] of [['kick', 'Kick '], ['snare', 'Snare'], ['hats', 'Hats '], ['mid', 'Mid/Perc']] as [keyof Analysis, string][]) {
    const onsets = onsetData[band]
    const grid = toGrid(onsets, bpm, firstStrong)
    console.log(`${label} [${onsets.length.toString().padStart(3)}]  ${gridString(grid)}`)
    if (known && (band === 'kick' || band === 'snare' || band === 'hats')) {
      const knownSteps = known[band as keyof KnownPattern]
      const hit = grid.filter((s) => knownSteps.includes(s)).length
      const total = new Set([...grid, ...knownSteps]).size
      const acc = total ? Math.round((hit / total) * 100) : 0
      console.log(`        vs conocido (${genre}) → acierto ${acc}% (${gridString(knownSteps)})`)
    }
  }

  const onsetCount = onsetData.kick.length + onsetData.snare.length + onsetData.hats.length + onsetData.mid.length
  const secPerBar = (60 / bpm) * 4
  const bars = wav.samples.length / wav.sampleRate / secPerBar
  console.log(`\n~${bars.toFixed(1)} compases · ${onsetCount} ataques clasificados`)
}

main()