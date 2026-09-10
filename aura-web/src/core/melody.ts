import type { Emotion, Genre, Note, Rng } from './types'
import { LEAD_DENSITY, GROOVE, RANGES } from './constants'
import { noteFromDegree } from './harmony'
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
 * Genera una línea melódica con fraseo call-and-response de 4 compases.
 *
 * Reglas de oro (matriz de producción del productor):
 *  - Notas de reposo sobre las extensiones del acorde: 3ra, 7ma y 9na.
 *  - Movimiento mayormente por grados conjuntos (step-wise); saltos de octava
 *    reservados para el clímax (compás de respuesta).
 *  - Frase 4T: pregunta (compás 1) → sostenimiento (2) → respuesta/alza (3) →
 *    resolución/transición (4, dejando libre el paso 16).
 *  - Silencios estratégicos: nunca pisar el paso 9 (beat 3, donde golpea la caja).
 *  - Layback: la melodía se desfasa 10-20 ticks detrás de la rejilla estricta.
 *  - Dinámicas: beats 1 y 3 al 85-95%, notas de paso al 50-65%.
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
  phraseBar = 0,
  rng: Rng = Math.random,
): Note[] {
  const notes: Note[] = []
  const step = ticksPerBar / 16
  const density = LEAD_DENSITY[genre]
  const leadRange = RANGES[genre].lead
  const tonic = 60 + rootOffset

  const chordRoot = noteFromDegree(scale, degree, 0, rootOffset)

  // Pool de notas de reposo: extensiones del acorde (3ra, 7ma, 9na).
  const targets = [
    chordRoot + scale[2], // 3ra
    chordRoot + scale[6], // 7ma
    chordRoot + scale[8], // 9na (si existe en la escala)
  ].filter((n) => n >= tonic - 12 && n <= tonic + 27)
  const fallbackTargets = [chordRoot + scale[2], chordRoot + scale[4], chordRoot + scale[6]]

  // Fraseo 4 compases: rol por compás de la frase.
  const phrase = (phraseBar % 4) as 0 | 1 | 2 | 3
  const phraseDensity: Record<number, number> = { 0: 0.42, 1: 0.18, 2: 0.5, 3: 0.38 }

  const motifs = MOTIF_PATTERNS[genre] ?? MOTIF_PATTERNS.trap
  const totalWeight = motifs.reduce((a, m) => a + m.weight, 0)
  const pickMotif = (): MotifPattern => {
    let roll = rng() * totalWeight
    for (const m of motifs) {
      roll -= m.weight
      if (roll <= 0) return m
    }
    return motifs[0]
  }
  let selectedMotif = pickMotif()

  // ¿Cerca de la tónica para saltar a la octava en el clímax?
  const canLeap = phrase === 2
  const nearestTarget = (p: number): number => {
    const poolAll = targets.length ? targets : fallbackTargets
    let best = p
    let bestD = Infinity
    for (const t of poolAll) {
      const d = Math.abs(t - p)
      if (d < bestD) {
        best = t
        bestD = d
      }
    }
    return best
  }

  let currentTick = startTick
  let currentStep = 0
  let motifIndex = 0
  let prevPitch = -1

  // Layback general: 10-20 ticks detrás de la rejilla.
  const layback = 10 + Math.floor(rng() * 11)

  while (currentTick < startTick + durationTicks) {
    const stepIdx = currentStep % 16

    // Regla de oro: despejar el paso 9 (beat 3) donde golpea la caja.
    if (stepIdx === 8 && rng() < 0.95) {
      currentTick += step
      currentStep++
      continue
    }

    const phraseStart = currentTick === startTick && phrase === 0
    const skips = phraseStart && stepIdx < (rng() < 0.5 ? 2 : 4) ? 1 : 0
    if (skips) {
      // La pregunta entra después del primer kick (paso 3 o 5).
      currentTick += step
      currentStep++
      continue
    }

    // El paso 16 (cierre del compás de resolución) queda libre para dar paso al loop.
    if (phrase === 3 && stepIdx === 15) {
      currentTick += step
      currentStep++
      continue
    }

    if (rng() < (phraseDensity[phrase] ?? density)) {
      const interval = selectedMotif.intervals[motifIndex % selectedMotif.intervals.length]
      const rhythm = selectedMotif.rhythm[motifIndex % selectedMotif.rhythm.length]
      let pitch = chordRoot + interval

      // Movimiento por grados conjuntos: acercar el salto del motivo a prevPitch.
      if (prevPitch !== -1 && Math.abs(pitch - prevPitch) > 6 && rng() < 0.55) {
        pitch = prevPitch + (rng() < 0.5 ? -1 : 1)
      }

      // Reposo sobre extensiones: el cierre de frase aterriza en 3ra/7ma/9na.
      const isLanding =
        phrase === 0 && motifIndex === 2 ||
        phrase === 3 && stepIdx > 8 ||
        rng() < (genre === 'trap' || genre === 'rap' ? 0.3 : 0.18)
      if (isLanding) pitch = nearestTarget(pitch)

      // Respuesta en ascenso: picado staccato subiendo a la octava superior.
      if (canLeap && prevPitch !== -1 && rng() < 0.4) {
        const candidate = prevPitch + 12
        if (candidate <= tonic + 27) pitch = candidate
      }

      // Variación armónica ocasional (siempre dentro de la escala).
      if (rng() < 0.12) {
        pitch = chordRoot + scale[Math.floor(rng() * scale.length)]
      }

      // Evitar saltos de más de una octava (no vuelos raros).
      if (prevPitch !== -1 && Math.abs(pitch - prevPitch) > 12) {
        pitch = prevPitch + (pitch > prevPitch ? 12 : -12)
      }

      const finalPitch = withinRange(pitch & 0x7f, leadRange)
      const groove = GROOVE[genre]
      const swing =
        microOffset(groove.groove.harmony, stepIdx, step, groove.humanize, rng) + layback

      // Dinámicas: beats 1 y 3 fuertes (85-95%), notas de paso suaves (50-65%).
      const mainBeat = stepIdx === 0 || stepIdx === 8
      const velocity = Math.min(
        127,
        (mainBeat ? humanVelocity(90, 5, rng) : humanVelocity(58, 7, rng)) +
          (baseEmotion === 'ira' ? 4 : 0),
      )

      notes.push({
        tick: currentTick + swing,
        dur: phrase === 1 && stepIdx >= 2 ? Math.max(1, 6 * step - 5) : Math.max(1, rhythm * step - 5),
        note: finalPitch,
        velocity,
      })

      prevPitch = finalPitch
      currentTick += (phrase === 1 && stepIdx >= 2 ? 6 : rhythm) * step
      motifIndex++
    } else {
      currentTick += step
      motifIndex++
    }

    currentStep++
    if (motifIndex >= selectedMotif.intervals.length && rng() < 0.4) {
      selectedMotif = pickMotif()
      motifIndex = 0
    }
  }

  return notes
}