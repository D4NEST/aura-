import type { Emotion, Genre, Note, Rng } from './types'
import { LEAD_DENSITY, VELOCITIES, GROOVE, RANGES } from './constants'
import { noteFromDegree, chordFromDegree } from './harmony'
import { humanVelocity, microOffset, withinRange } from './humanize'

/**
 * Patrones de motivos melódicos por género.
 * Cada motivo es una secuencia de intervalos relativos a la tónica del acorde.
 * El motor elige un motivo, lo transporta al acorde actual y aplica variaciones.
 */
export interface MotifPattern {
  intervals: number[] // intervalos relativos (0 = tónica, 2 = 2ª, 4 = 3ª, etc.)
  rhythm: number[] // duración de cada nota en 1/16
  weight: number
}

export const MOTIF_PATTERNS: Record<Genre, MotifPattern[]> = {
  trap: [
    { intervals: [0, 2, 4, 2], rhythm: [1, 1, 1, 1], weight: 1 },
    { intervals: [0, 4, 7, 4], rhythm: [1, 2, 1, 2], weight: 0.7 },
    { intervals: [0, 2, 0], rhythm: [1, 1, 2], weight: 0.5 },
  ],
  rap: [
    { intervals: [0, 2, 4, 5, 4], rhythm: [1, 1, 1, 1, 2], weight: 1 },
    { intervals: [0, 4, 2, 0], rhythm: [1, 1, 1, 1], weight: 0.8 },
    { intervals: [0, 5, 4, 2], rhythm: [2, 1, 1, 2], weight: 0.6 },
  ],
  plug: [
    { intervals: [0, 4, 7, 4], rhythm: [1, 1, 2, 2], weight: 1 },
    { intervals: [0, 2, 4], rhythm: [2, 1, 3], weight: 0.7 },
  ],
  detroit: [
    { intervals: [0, 3, 5, 7, 5], rhythm: [1, 1, 1, 1, 2], weight: 1 },
    { intervals: [0, 5, 7, 5, 3], rhythm: [1, 1, 1, 1, 2], weight: 0.8 },
    { intervals: [0, 7, 5, 3], rhythm: [1, 1, 1, 1], weight: 0.6 },
  ],
  reggaeton: [
    { intervals: [0, 4, 5, 4], rhythm: [1, 1, 1, 1], weight: 1 },
    { intervals: [0, 2, 4, 2, 0], rhythm: [1, 1, 1, 1, 2], weight: 0.8 },
    { intervals: [0, 5, 4, 2], rhythm: [1, 1, 2, 2], weight: 0.7 },
  ],
}

/**
 * Genera una línea melódica con motivos por género.
 * Elige un motivo del catálogo, lo aplica al acorde actual con variaciones,
 * y asegura coherencia armónica.
 */
export function generateLead(
  scale: number[],
  degree: number,
  startTick: number,
  durationTicks: number,
  ticksPerBar: number,
  genre: Genre,
  baseEmotion: Emotion,
  rootOffset: number,
  rng: Rng = Math.random,
): Note[] {
  const notes: Note[] = []
  const step = ticksPerBar / 16
  const density = LEAD_DENSITY[genre]
  const leadRange = RANGES[genre].lead
  const tonic = 60 + rootOffset

  // Construir pool de notas disponibles en la escala, centradas en la tónica del acorde
  const chordRoot = noteFromDegree(scale, degree, 0, rootOffset)
  const pool = [
    chordRoot,
    chordRoot + (scale[2] ?? 4), // 3ra
    chordRoot + (scale[4] ?? 7), // 5ta
    chordRoot + (scale[6] ?? 11), // 7ma si existe
  ].filter((n) => n >= tonic - 12 && n <= tonic + 24)

  // Seleccionar motivos del género
  const motifs = MOTIF_PATTERNS[genre] ?? MOTIF_PATTERNS.trap
  const totalWeight = motifs.reduce((a, m) => a + m.weight, 0)
  let roll = rng() * totalWeight
  let selectedMotif = motifs[0]
  for (const m of motifs) {
    roll -= m.weight
    if (roll <= 0) {
      selectedMotif = m
      break
    }
  }

  // Aplicar el motivo con variaciones a lo largo de la duración
  let currentTick = startTick
  let motifIndex = 0
  let prevPitch = -1

  while (currentTick < startTick + durationTicks) {
    // Decidir si tocar el motivo o hacer una pausa/variación
    if (rng() < density) {
      const interval = selectedMotif.intervals[motifIndex % selectedMotif.intervals.length]
      const rhythm = selectedMotif.rhythm[motifIndex % selectedMotif.rhythm.length]

      // Calcular pitch basado en el intervalo del motivo
      let pitch = chordRoot + interval

      // Añadir variación aleatoria ocasional
      if (rng() < 0.15) {
        const variation = pool[Math.floor(rng() * pool.length)]
        pitch = variation
      }

      // Evitar repetir la misma nota consecutiva
      if (pitch === prevPitch && rng() < 0.7) {
        pitch = pool.find((p) => p !== prevPitch && Math.abs(p - prevPitch) <= 5) ?? pitch
      }

      const finalPitch = withinRange(pitch & 0x7f, leadRange)
      const groove = GROOVE[genre]
      const leadVel = VELOCITIES[genre].lead
      const swing = microOffset(groove.groove.harmony, motifIndex, step, groove.humanize, rng)

      notes.push({
        tick: currentTick + swing,
        dur: Math.max(1, rhythm * step - 5),
        note: finalPitch,
        velocity: humanVelocity(
          leadVel.mean + (baseEmotion === 'ira' ? 6 : 0),
          leadVel.jitter,
          rng,
        ),
      })

      prevPitch = finalPitch
      currentTick += rhythm * step
      motifIndex++
    } else {
      // Pausa: avanzar un paso sin añadir nota
      currentTick += step
      motifIndex++
    }

    // Reiniciar el motivo si se completa, con posibilidad de elegir otro
    if (motifIndex >= selectedMotif.intervals.length && rng() < 0.4) {
      roll = rng() * totalWeight
      for (const m of motifs) {
        roll -= m.weight
        if (roll <= 0) {
          selectedMotif = m
          break
        }
      }
      motifIndex = 0
    }
  }

  return notes
}