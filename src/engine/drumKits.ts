import type { Genre } from '../core/types'

export interface DrumKitProfile {
  kick: {
    note: number
    dur: number
    pitchDecay: number
    octaves: number
    decay: number
    gain: number
  }
  snare: {
    decay: number
    filter: number
    gain: number
    noise: 'white' | 'brown' | 'pink'
  }
  hat: { decay: number; filter: number; gain: number }
  openHat: { decay: number; filter: number; gain: number }
  perc: { harmonicity: number; resonance: number; decay: number; note: number; gain: number }
  bus: number
}

export const DRUM_KITS: Record<Genre, DrumKitProfile> = {
  trap: {
    bus: 0.9,
    kick: { note: 33, dur: 0.42, pitchDecay: 0.028, octaves: 7, decay: 0.55, gain: 1 },
    snare: { decay: 0.2, filter: 1500, gain: 0.8, noise: 'white' },
    hat: { decay: 0.045, filter: 9200, gain: 0.42 },
    openHat: { decay: 0.5, filter: 7600, gain: 0.32 },
    perc: { harmonicity: 7, resonance: 1000, decay: 0.05, note: 64, gain: 0.5 },
  },
  rap: {
    bus: 1,
    kick: { note: 36, dur: 0.3, pitchDecay: 0.045, octaves: 6, decay: 0.4, gain: 1 },
    snare: { decay: 0.22, filter: 2000, gain: 0.85, noise: 'brown' },
    hat: { decay: 0.05, filter: 8400, gain: 0.5 },
    openHat: { decay: 0.4, filter: 7600, gain: 0.35 },
    perc: { harmonicity: 5.1, resonance: 1200, decay: 0.07, note: 62, gain: 0.5 },
  },
  detroit: {
    bus: 1,
    kick: { note: 36, dur: 0.3, pitchDecay: 0.03, octaves: 5, decay: 0.35, gain: 1 },
    snare: { decay: 0.25, filter: 1200, gain: 0.8, noise: 'white' },
    hat: { decay: 0.055, filter: 9500, gain: 0.5 },
    openHat: { decay: 0.45, filter: 8000, gain: 0.35 },
    perc: { harmonicity: 6, resonance: 1800, decay: 0.06, note: 63, gain: 0.55 },
  },
  reggaeton: {
    bus: 1,
    kick: { note: 36, dur: 0.34, pitchDecay: 0.022, octaves: 6, decay: 0.32, gain: 1 },
    snare: { decay: 0.14, filter: 3200, gain: 0.6, noise: 'white' },
    hat: { decay: 0.06, filter: 8000, gain: 0.55 },
    openHat: { decay: 0.38, filter: 7200, gain: 0.3 },
    perc: { harmonicity: 8, resonance: 2200, decay: 0.045, note: 73, gain: 0.6 },
  },
  plug: {
    bus: 0.95,
    kick: { note: 36, dur: 0.3, pitchDecay: 0.06, octaves: 5, decay: 0.5, gain: 1 },
    snare: { decay: 0.14, filter: 2600, gain: 0.5, noise: 'white' },
    hat: { decay: 0.04, filter: 10000, gain: 0.36 },
    openHat: { decay: 0.4, filter: 8600, gain: 0.3 },
    perc: { harmonicity: 5.5, resonance: 900, decay: 0.07, note: 60, gain: 0.4 },
  },
}