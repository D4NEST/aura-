import type { Rng } from './types'

export interface PitchWindow {
  lo: number
  hi: number
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Elige un índice con pesos [w0..wN]; devuelve el índice. */
export function pickWeighted(weights: number[], rng: () => number = Math.random): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}

/** Acota una nota al rango de octava del catálogo para el género (transpose ±12). */
export function withinRange(pitch: number, window: PitchWindow | undefined): number {
  if (!window) return pitch
  const n = pitch & 0x7f
  let best = clamp(n, window.lo, window.hi)
  let bestDist = Math.abs(best - n)
  for (let k = -3; k <= 3; k++) {
    const cand = n + k * 12
    if (cand >= window.lo && cand <= window.hi) return cand
    const dist = cand < window.lo ? window.lo - cand : cand - window.hi
    if (dist < bestDist) {
      bestDist = dist
      best = cand < window.lo ? window.lo : window.hi
    }
  }
  return best
}

/** Velocity con distribución normal (Box-Muller), acotada a [1,127]. */
export function humanVelocity(
  mean: number,
  jitter: number,
  rng: Rng = Math.random,
): number {
  if (jitter <= 0) return clamp(Math.round(mean), 1, 127)
  const u1 = Math.max(rng(), 1e-9)
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return clamp(Math.round(mean + z * jitter), 1, 127)
}

/** Desvío de micro-timing en ticks para el paso dado dentro del compás: swing sistemático del groove + jitter humano ocasional. */
export function microOffset(
  groove: number[] | undefined,
  stepInBar: number,
  ticksPer16th: number,
  humanize: number = 0,
  rng: Rng = Math.random,
): number {
  const systematic = groove?.[((stepInBar % 16) + 16) % 16] ?? 0
  let ticks = systematic * ticksPer16th
  if (humanize > 0 && rng() < humanize) {
    ticks += (rng() * 2 - 1) * 0.1 * ticksPer16th
  }
  return Math.round(ticks)
}