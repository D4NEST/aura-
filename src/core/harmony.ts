import type { Emotion, Rng } from './types'
import { ESCALAS } from './constants'

export function noteFromDegree(
  scale: number[],
  degree: number,
  octaveShift = 0,
  rootOffset = 0,
): number {
  const scaleLen = scale.length
  const octave = Math.floor((degree - 1) / scaleLen) + octaveShift
  const idx = ((degree - 1) % scaleLen + scaleLen) % scaleLen
  const base = 48 + rootOffset
  return base + scale[idx] + octave * 12
}

export function chordFromDegree(
  scale: number[],
  degree: number,
  rootOffset = 0,
  addSeventh = false,
  addNinth = false,
): number[] {
  const chord = [
    noteFromDegree(scale, degree, 0, rootOffset),
    noteFromDegree(scale, degree + 2, 0, rootOffset),
    noteFromDegree(scale, degree + 4, 0, rootOffset),
  ]
  if (addSeventh) chord.push(noteFromDegree(scale, degree + 6, 0, rootOffset))
  if (addNinth) chord.push(noteFromDegree(scale, degree + 8, 0, rootOffset))
  return chord
}

export function applyInversion(
  chord: number[],
  inversion: 'root' | 'first' | 'second' | 'open' | 'drop2' = 'root',
): number[] {
  let c = [...chord].sort((a, b) => a - b)
  if (inversion === 'first' && c.length >= 1) c = [...c.slice(1), c[0] + 12]
  else if (inversion === 'second' && c.length >= 2)
    c = [...c.slice(2), c[0] + 12, c[1] + 12]
  else if (inversion === 'open' && c.length >= 2) {
    const c2 = [...c]
    c2[1] += 12
    c = c2
  } else if (inversion === 'drop2' && c.length >= 4) {
    const c2 = [...c]
    const drop = c2.splice(c2.length - 2, 1)[0]
    c = [drop - 12, ...c2]
  }
  // Compactar: voicing controlado para evitar saltos/disonancias extremas.
  return compactVoicing(c)
}

/**
 * Lleva el acorde a un rango cómodo (tónica de C3 a C4) y compacta las
 * notas superiores para que el conjunto suene cohesionado. Deja la
 * fundamental cerca del final inferior; evita que las tensiones (7ª/9ª)
 * queden "pegadas" o salten a octavas raras.
 */
const IDEAL_LOW = 48 // C3
const VOICE_SPAN = 21 // ~una octava y media máx entre extremos

export function compactVoicing(chordIn: number[]): number[] {
  let c = [...chordIn].sort((a, b) => a - b)

  // La voz más grave se acerca a IDEAL_LOW (respetando la posición del acorde).
  const target = IDEAL_LOW
  while (c[0] > target + 5) c = c.map((n) => n - 12).sort((a, b) => a - b)
  while (c[0] < target - 6) c = c.map((n) => n + 12).sort((a, b) => a - b)

  // Compactar las voces superiores al span máximo.
  while (c[c.length - 1] - c[0] > VOICE_SPAN) {
    c = [...c.slice(0, c.length - 1), c[c.length - 1] - 12].sort((a, b) => a - b)
  }
  return c
}

export function applyTensionRules(chord: number[], emotion: Emotion): number[] {
  if (emotion === 'ira') return [chord[0], chord[0] + 7]
  if (emotion === 'tristeza' && chord.length >= 3) {
    const c = [...chord] as number[]
    c[1] = c[0] + 2
    return compactVoicing(c)
  }
  if (emotion === 'amor') {
    const c = [...chord]
    const seventh = c[0] + 11
    if (!c.includes(seventh)) c.push(seventh)
    return compactVoicing(c)
  }
  if (emotion === 'decepcion' && chord.length > 0) {
    // En lugar de bajar siempre el agudo una octava, se compacta el cierre
    // para que la tensión quede controlada (sin disonancias flotantes).
    const c = [...chord] as number[]
    c[c.length - 1] -= 1
    return compactVoicing(c)
  }
  return chord
}

export function mutateProgression(
  progression: number[],
  scale: number[],
  rng: Rng = Math.random,
): number[] {
  const mutated = [...progression]
  const idx = Math.floor(rng() * mutated.length)
  const scaleLen = scale.length
  let newDegree = Math.floor(rng() * scaleLen) + 1
  if (newDegree === mutated[idx]) {
    newDegree = (newDegree % scaleLen) + 1
  }
  mutated[idx] = newDegree
  return mutated
}

export function progressionFor(emotion: Emotion, rng: Rng = Math.random) {
  return selectProgression(emotion, rng).progression
}

import { PROGRESIONES as PROGRESIONES_BASE } from './constants'

export interface ProgressionPick {
  progression: number[]
  source: 'principal' | 'alternativa' | 'real'
  mutated: boolean
}

/**
 * Selecciona una progresión del catálogo del motor: principal (50%),
 * reales aprendidas del catálogo real (30%) y alternativa (20%),
 * con 30% de chance de mutación sobre la elegida.
 */
export function selectProgression(emotion: Emotion, rng: Rng = Math.random): ProgressionPick {
  const p = PROGRESIONES_BASE[emotion]
  const reales = p.reales ?? []
  const candidates: { prog: number[]; weight: number; source: ProgressionPick['source'] }[] = [
    { prog: p.principal, weight: 50, source: 'principal' },
    { prog: p.alternativa, weight: 20, source: 'alternativa' },
    ...reales.map((prog) => ({
      prog,
      weight: reales.length > 0 ? 30 / reales.length : 0,
      source: 'real' as const,
    })),
  ]
  const total = candidates.reduce((a, c) => a + c.weight, 0)
  let roll = rng() * total
  let chosen = candidates[0].prog
  let source = candidates[0].source
  for (const c of candidates) {
    roll -= c.weight
    if (roll <= 0) {
      chosen = c.prog
      source = c.source
      break
    }
  }
  const mutated = rng() < 0.3
  return {
    progression: mutated ? mutateProgression(chosen, ESCALAS[emotion], rng) : [...chosen],
    source,
    mutated,
  }
}