import type { Emotion, Genre, Note, Rng } from './types'
import { LEAD_DENSITY, VELOCITIES, GROOVE, RANGES } from './constants'
import { noteFromDegree, chordFromDegree } from './harmony'
import { humanVelocity, microOffset, withinRange } from './humanize'

/**
 * Genera una línea melódica simple (lead) sobre la progresión: pulsa en una
 * rejilla de 16 pasos según la densidad del género, priorizando tensiones del
 * acorde activo (fundamental, 3ª, 5ª, 7ª) dentro de un rango cómodo.
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
  const steps = Math.floor(durationTicks / step)
  const density = LEAD_DENSITY[genre]
  const leadRange = RANGES[genre].lead
  const tonic = 60 + rootOffset

  // Notas del acorde activo (sin 7ª/9ª extras para no ensuciar).
  const chordTones = [...new Set(chordFromDegree(scale, degree, rootOffset))].map(
    (n) => n,
  )
  const pool = [
    ...chordTones,
    noteFromDegree(scale, degree, 1, rootOffset),
    noteFromDegree(scale, degree + 2, 1, rootOffset),
    noteFromDegree(scale, degree + 4, 1, rootOffset),
  ].filter((n) => n >= tonic && n <= tonic + 19)

  let melodicPrev = -1
  let phraseLen = 0
  for (let s = 0; s < steps; s++) {
    const hit = rng() < density
    if (!hit) continue

    // Motivos: silencios cortos dentro de cada frase.
    phraseLen++
    if (phraseLen > 6) {
      phraseLen = 0
      continue
    }

    const chooseScale = rng() < 0.25
    let pitch: number
    if (chooseScale) {
      const candidates = pool.length > 0 ? pool : [tonic]
      pitch = candidates[Math.floor(rng() * candidates.length)]
    } else {
      const base = pool.length > 0 && rng() < 0.6
        ? pool[Math.floor(rng() * pool.length)]
        : tonic + scale[Math.floor(rng() * scale.length)]
      // Alternar entre notas de tierra y movimiento por escalera.
      pitch = melodicPrev >= 0 && rng() < 0.35
        ? Math.max(tonic, melodicPrev + (rng() < 0.5 ? -2 : 2))
        : base
    }

    const durSteps = rng() < 0.3 ? 3 : 1
    const leadVel = VELOCITIES[genre].lead
    const groove = GROOVE[genre]
    const finalPitch = withinRange(pitch & 0x7f, leadRange)
    notes.push({
      tick: startTick + s * step + microOffset(groove.groove.harmony, s, step, groove.humanize, rng),
      dur: durSteps * step - 5,
      note: finalPitch,
      velocity: humanVelocity(
        leadVel.mean + (baseEmotion === 'ira' ? 6 : 0),
        leadVel.jitter,
        rng,
      ),
    })
    melodicPrev = finalPitch
  }
  return notes
}