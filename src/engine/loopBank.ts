import * as Tone from 'tone'
import type { Emotion, Genre } from '../core/types'

export interface DrumLoopPlan {
  file: string
  bpm: number
  bars: number
}

export interface DrumKitFiles {
  kick?: string
  snare?: string
  hat?: string
  openhat?: string
  perc?: string
}

export interface DrumBank {
  loop?: DrumLoopPlan
  kit?: DrumKitFiles
}

interface LoopEntry {
  genre: Genre
  emotion?: Emotion
  bpm?: number
  bars?: number
  file?: string
  kit?: DrumKitFiles
}

let manifestCache: LoopEntry[] | null = null
const bufferCache = new Map<string, Tone.ToneAudioBuffer>()

function baseUrl(): string {
  return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
}

async function loadManifest(): Promise<LoopEntry[]> {
  if (manifestCache) return manifestCache
  try {
    const res = await fetch(`${baseUrl()}loops/manifest.json`, { cache: 'no-store' })
    if (!res.ok) {
      manifestCache = []
      return manifestCache
    }
    const data = (await res.json()) as { songs?: LoopEntry[] }
    manifestCache = data.songs ?? []
  } catch {
    manifestCache = []
  }
  return manifestCache
}

export async function resolveDrumBank(
  genre?: Genre,
  emotion?: Emotion,
  bpm?: number,
): Promise<DrumBank | null> {
  if (!genre) return null
  const entries = await loadManifest()
  const bank: DrumBank = {}

  const loop = entries.find(
    (e) =>
      e.file &&
      e.genre === genre &&
      e.emotion === emotion &&
      e.bpm === bpm &&
      e.bars,
  )
  if (loop) {
    bank.loop = { file: loop.file!, bpm: loop.bpm!, bars: loop.bars! }
  }

  const kit = entries.find((e) => e.kit && e.genre === genre)
  if (kit?.kit) bank.kit = kit.kit

  return bank.loop || bank.kit ? bank : null
}

export async function loadLoopBuffer(file: string): Promise<Tone.ToneAudioBuffer | null> {
  const cached = bufferCache.get(file)
  if (cached) return cached
  try {
    const decoded = await Tone.ToneAudioBuffer.load(`${baseUrl()}${file}`)
    const buffer = new Tone.ToneAudioBuffer(decoded)
    bufferCache.set(file, buffer)
    return buffer
  } catch {
    return null
  }
}