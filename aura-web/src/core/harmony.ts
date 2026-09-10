import type { Emotion, Genre, Mode, Rng } from './types'
import type { VoiceVelocityProfile } from './constants'
import { ESCALAS, GENRE_PROGRESSIONS, MODE_SCALES } from './constants'
import { humanVelocity } from './humanize'

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
  addEleventh = false,
): number[] {
  const chord = [
    noteFromDegree(scale, degree, 0, rootOffset),
    noteFromDegree(scale, degree + 2, 0, rootOffset),
    noteFromDegree(scale, degree + 4, 0, rootOffset),
  ]
  if (addSeventh) chord.push(noteFromDegree(scale, degree + 6, 0, rootOffset))
  if (addNinth) chord.push(noteFromDegree(scale, degree + 8, 0, rootOffset))
  if (addEleventh) chord.push(noteFromDegree(scale, degree + 10, 0, rootOffset))
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
 * Voice leading: distancia de movimiento entre dos voicings (menor = más compacto).
 * Se pondera la dupla de notas graves (el bajo del acorde) porque es la que ancla
 * la percepción armónica.
 */
export function voicingDistance(a: number[], b: number[]): number {
  const as = [...a].sort((x, y) => x - y)
  const bs = [...b].sort((x, y) => x - y)
  const n = Math.max(as.length, bs.length)
  let d = 0
  for (let i = 0; i < n; i++) {
    const av = as[Math.min(i, as.length - 1)]
    const bv = bs[Math.min(i, bs.length - 1)]
    d += i === 0 ? Math.abs(av - bv) * 2 : Math.abs(av - bv)
  }
  return d
}

/**
 * Elige la inversión que requiere el menor movimiento de semitonos posible
 * respecto al acorde previo (evita saltos bruscos y choques armónicos).
 * Sin previo o 15% del tiempo: inversión aleatoria (sabor/experimento).
 */
export function nearestInversion(
  raw: number[],
  prev: number[] | undefined,
  rng: Rng = Math.random,
): number[] {
  const variants: ('root' | 'first' | 'second' | 'open' | 'drop2')[] = [
    'root', 'first', 'second', 'open', 'drop2',
  ]
  const voiced = variants.map((v) => applyInversion(raw, v))
  if (!prev || rng() < 0.15) return voiced[Math.floor(rng() * voiced.length)]
  let best = voiced[0]
  let bestD = Infinity
  for (const c of voiced) {
    const d = voicingDistance(c, prev)
    if (d < bestD) {
      best = c
      bestD = d
    }
  }
  return best
}

/**
 * Rootless voicing: omite la fundamental del acorde cuando el bajo/sub-synth ya
 * la está sosteniendo (evita saturar 60-250 Hz y deja que el bajo defina el peso).
 */
export function rootlessVoicing(chord: number[], rootMidi: number): number[] {
  const rootClass = rootMidi % 12
  const kept = chord.filter((n) => n % 12 !== rootClass)
  return kept.length >= 2 ? kept : chord
}

/** Jerarquía de velocidades por rol de voz (matriz de producción del productor).
 *  (definida en constants.ts como VoiceVelocityProfile) */

/**
 * Velocity por rol de voz: fundamental 70-80%, internas (3ra/5ta) 50-65%,
 * extensiones (7ma/9na/11na) 80-90%, y la nota superior 90-100% (guía el oído).
 */
export function voiceVelocityFor(
  note: number,
  isHighest: boolean,
  rootClass: number,
  prof: VoiceVelocityProfile,
  rng: Rng = Math.random,
): number {
  const cls = note % 12
  let role: keyof VoiceVelocityProfile
  if (isHighest) role = 'top'
  else if (cls === rootClass) role = 'root'
  else if (cls === (rootClass + 3) % 12 || cls === (rootClass + 4) % 12 || cls === (rootClass + 7) % 12)
    role = 'inner'
  else role = 'extension'
  return humanVelocity(prof[role], prof.jitter, rng)
}

/**
 * Lleva el acorde a un rango cómodo (tónica de C3 a C4) y compacta las
 * notas superiores para que el conjunto suene cohesionado. Deja la
 * fundamental cerca del final inferior; evita que las tensiones (7ª/9ª)
 * queden "pegadas" o salten a octavas raras.
 */
const IDEAL_LOW = 55 // G3: registros más altos que el bajo evitan el "acorde=bajo"
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
  source: 'principal' | 'alternativa' | 'real' | 'genre'
  mutated: boolean
}

export interface ProgressionOptions {
  mode?: Mode
  genre?: Genre
}

/**
 * Selecciona una progresión del catálogo del motor: principal (40%),
 * "clave" del género (25%), reales aprendidas del catálogo real (22%)
 * y alternativa (13%), con 30% de chance de mutación sobre la elegida
 * (la mutación usa la escala del modo activo: mayor o menor explícito).
 */
export function selectProgression(
  emotion: Emotion,
  rng: Rng = Math.random,
  opts: ProgressionOptions = {},
): ProgressionPick {
  const p = PROGRESIONES_BASE[emotion]
  const reales = p.reales ?? []
  const genreProgs = opts.genre ? GENRE_PROGRESSIONS[opts.genre] : []
  const mutScale = opts.mode ? MODE_SCALES[opts.mode] : ESCALAS[emotion]
  const candidates: { prog: number[]; weight: number; source: ProgressionPick['source'] }[] = [
    { prog: p.principal, weight: 40, source: 'principal' },
    ...genreProgs.map((prog) => ({ prog, weight: genreProgs.length ? 25 / genreProgs.length : 0, source: 'genre' as const })),
    ...reales.map((prog) => ({ prog, weight: reales.length ? 22 / reales.length : 0, source: 'real' as const })),
    { prog: p.alternativa, weight: 13, source: 'alternativa' },
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
    progression: mutated ? mutateProgression(chosen, mutScale, rng) : [...chosen],
    source,
    mutated,
  }
}