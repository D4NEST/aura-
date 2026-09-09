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
const failedLoads = new Set<string>() // Track failed loads to avoid repeated warnings

function baseUrl(): string {
  return (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
}

async function loadManifest(): Promise<LoopEntry[]> {
  if (manifestCache) return manifestCache
  try {
    const res = await fetch(`${baseUrl()}loops/manifest.json`, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[AURA] No se pudo cargar manifest.json: ${res.status} ${res.statusText}`)
      manifestCache = []
      return manifestCache
    }
    const data = (await res.json()) as { songs?: LoopEntry[] }
    manifestCache = data.songs ?? []
  } catch (e) {
    console.warn('[AURA] Error cargando manifest.json:', e)
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
  
  // Si ya falló antes, no reintentar
  if (failedLoads.has(file)) return null
  
  try {
    const decoded = await Tone.ToneAudioBuffer.load(`${baseUrl()}${file}`)
    const buffer = new Tone.ToneAudioBuffer(decoded)
    bufferCache.set(file, buffer)
    return buffer
  } catch (e) {
    // Log de warning (solo una vez por archivo)
    failedLoads.add(file)
    console.warn(`[AURA] No se pudo cargar sample "${file}":`, e)
    
    // Emitir evento para que la UI pueda mostrar notificación
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura:sample-error', { 
        detail: { file, error: String(e) } 
      }))
    }
    return null
  }
}

/**
 * Limpia la caché de buffers (útil para liberar memoria en sesiones largas).
 * Opcionalmente mantiene los N buffers más recientes.
 */
export function clearBufferCache(keepRecent: number = 0): void {
  if (keepRecent <= 0) {
    bufferCache.clear()
    failedLoads.clear()
    return
  }
  
  // Mantener solo los N más recientes (los últimos añadidos)
  const entries = Array.from(bufferCache.entries())
  if (entries.length > keepRecent) {
    const toRemove = entries.slice(0, entries.length - keepRecent)
    for (const [file] of toRemove) {
      bufferCache.delete(file)
    }
  }
}

/**
 * Obtiene estadísticas de la caché para debugging.
 */
export function getBufferStats(): { cached: number; failed: number } {
  return {
    cached: bufferCache.size,
    failed: failedLoads.size,
  }
}