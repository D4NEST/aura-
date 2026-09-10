import * as Tone from 'tone'
import type { Genre, SoundBundle } from '../core/types'
import type { SoundDesignConfig } from '../core/constants'
import { PRODUCTION_RECIPES } from '../core/constants'

export interface PresetDef {
  id: string
  label: string
  make: (design?: SoundDesignConfig) => Tone.ToneAudioNode
}

type VoiceKind = 'piano' | 'pad' | 'bass' | 'lead'

interface EnvPatch {
  attack?: number
  decay?: number
  sustain?: number
  release?: number
}

/**
 * Traducción de `transient_attack` a envolventes por tipo de voz.
 * - SHARP: ataque 0.001-0.005s y decay corto (Detroit/trap; plucks secos).
 * - SOFT/PADDED: ataque lento 0.08-0.2s y release largo (plug/ambient).
 * El bajo 808 se respeta intacto para conservar el sub profundo.
 */
function envPatch(design: SoundDesignConfig | undefined, kind: VoiceKind): EnvPatch {
  if (!design) return {}
  if (kind === 'bass') return {}
  const sharp = design.transient_attack === 'SHARP'
  if (kind === 'pad') {
    return sharp
      ? { attack: 0.08, decay: 0.4, sustain: 0.7, release: 1.4 }
      : { attack: 0.2, decay: 0.5, sustain: 0.8, release: 2.0 }
  }
  return sharp
    ? { attack: 0.004, decay: 0.15, sustain: 0.0, release: 0.35 }
    : { attack: 0.12, decay: 0.8, sustain: 0.3, release: 0.7 }
}

export interface DesignExt {
  /** Nodo por el que sale la señal diseñada (únltimo de la cadena). */
  out: Tone.ToneAudioNode
  /** Nodos a disponer junto con la voz (cadena + LFOs). */
  dispose: Tone.ToneAudioNode[]
}

/**
 * Lee la extensión de diseño de una voz: `out` conectará la señal al bus
 * en lugar del instrumento, y `dispose` será liberado junto con la voz.
 */
export function designExt(node: Tone.ToneAudioNode): DesignExt | null {
  const cast = node as unknown as { __auraOut?: Tone.ToneAudioNode; __auraChain?: Tone.ToneAudioNode[] }
  if (!cast.__auraOut && !cast.__auraChain?.length) return null
  return { out: cast.__auraOut ?? node, dispose: cast.__auraChain ?? [] }
}

/**
 * Aplica el diseño de sonido por género (constants + preset activo) a una voz
 * sintetizada: envolventes ya están horneadas en `make(design)`; aquí se
 * insertan saturación, filtro paso bajo y detune tape tras el instrumento.
 */
function applyDesign(node: Tone.ToneAudioNode, design?: SoundDesignConfig): Tone.ToneAudioNode {
  if (!design) return node
  const audio: Tone.ToneAudioNode[] = []
  const lfos: Tone.LFO[] = []
  const cutoff = design.cutoff_hz ?? 0

  if (design.body === 'WARM_SATURATED') {
    // Cuerpo cálido saturado: drive ligero + lowpass de control (evita lepra).
    audio.push(new Tone.Distortion({ distortion: 0.06, oversample: '4x' }))
    audio.push(new Tone.Filter({ frequency: cutoff > 0 ? cutoff : 4000, type: 'lowpass', rolloff: -12 }))
  } else if (design.body === 'DARK_FILTERED') {
    // Tapa el brillo: lowpass entre 1500 y 3500 Hz (traps 808 densos).
    audio.push(new Tone.Filter({ frequency: cutoff > 0 ? cutoff : 2500, type: 'lowpass', rolloff: -24 }))
  } else if (design.body === 'BRIGHT') {
    // Cuerpo brillante: corte libre 10-12 kHz con Q ligero (Detroit FM).
    audio.push(new Tone.Filter({ frequency: cutoff > 0 ? cutoff : 10000, type: 'lowpass', rolloff: -12, Q: 1.5 }))
  }

  if (design.texture === 'TAPE_DETUNE') {
    // Textura lo-fi: LFO 2-4 Hz sobre el detune del oscilador (±2.5 a ±6 cents).
    const depth = design.detune_lfo_depth === 'LOW' ? 2.5 : design.detune_lfo_depth === 'MEDIUM' ? 6 : 4
    const lfo = new Tone.LFO(3.2, depth)
    const synth = node as unknown as { detune?: Tone.Signal }
    if (synth.detune) lfo.connect(synth.detune)
    lfo.start()
    lfos.push(lfo)
  }

  if (audio.length === 0 && lfos.length === 0) return node
  const cast = node as unknown as { __auraOut?: Tone.ToneAudioNode; __auraChain?: Tone.ToneAudioNode[] }
  if (audio.length > 0) {
    node.disconnect()
    let prev: Tone.ToneAudioNode = node
    for (const c of audio) {
      prev.connect(c)
      prev = c
    }
    cast.__auraOut = prev
  }
  cast.__auraChain = [...(cast.__auraChain ?? []), ...audio, ...lfos]
  return node
}

export const PIANO_PRESETS: PresetDef[] = [
  {
    id: 'rhodes',
    label: 'Rhodes FM',
    make: (design) =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.02,
        modulationIndex: 9,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: {
          attack: 0.004,
          decay: 2.0,
          sustain: 0.0,
          release: 1.3,
          ...envPatch(design, 'piano'),
        },
        modulationEnvelope: {
          attack: 0.004,
          decay: 0.25,
          sustain: 0.1,
          release: 0.5,
        },
      }),
  },
  {
    id: 'acoustic',
    label: 'Acústico',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.003,
          decay: 0.9,
          sustain: 0.12,
          release: 1.1,
          ...envPatch(design, 'piano'),
        },
      }),
  },
  {
    id: 'dx',
    label: 'E-Piano DX',
    make: (design) =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 0.5,
        modulationIndex: 4,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: {
          attack: 0.002,
          decay: 1.6,
          sustain: 0.0,
          release: 1.0,
          ...envPatch(design, 'piano'),
        },
        modulationEnvelope: {
          attack: 0.002,
          decay: 0.2,
          sustain: 0.05,
          release: 0.4,
        },
      }),
  },
  {
    id: 'clav',
    label: 'Clavinet',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: {
          attack: 0.002,
          decay: 1.4,
          sustain: 0.0,
          release: 0.5,
          ...envPatch(design, 'piano'),
        },
      }),
  },
]

export const PAD_PRESETS: PresetDef[] = [
  {
    id: 'warm',
    label: 'Warm',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
          attack: 1.2,
          decay: 0.6,
          sustain: 0.8,
          release: 2.4,
          ...envPatch(design, 'pad'),
        },
      }),
  },
  {
    id: 'sabre',
    label: 'Sabre',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
        envelope: {
          attack: 0.8,
          decay: 0.4,
          sustain: 0.7,
          release: 2.0,
          ...envPatch(design, 'pad'),
        },
      }),
  },
  {
    id: 'strings',
    label: 'Strings',
    make: (design) =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.2,
        modulationIndex: 5,
        oscillator: { type: 'sine' },
        modulation: { type: 'sawtooth' },
        envelope: {
          attack: 0.9,
          decay: 0.3,
          sustain: 0.75,
          release: 2.2,
          ...envPatch(design, 'pad'),
        },
        modulationEnvelope: {
          attack: 0.6,
          decay: 0.3,
          sustain: 0.5,
          release: 1.2,
        },
      }),
  },
]

export const BASS_PRESETS: PresetDef[] = [
  {
    id: 'sub',
    label: 'Sub 808',
    make: (design) =>
      new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        filter: { type: 'lowpass', Q: 2, frequency: 1100 },
        envelope: {
          attack: 0.015,
          decay: 0.5,
          sustain: 0.45,
          release: 0.3,
          ...envPatch(design, 'bass'),
        },
        filterEnvelope: {
          attack: 0.015,
          decay: 0.25,
          sustain: 0.4,
          release: 0.3,
          baseFrequency: 120,
          octaves: 2.2,
        },
      }),
  },
  {
    id: 'retro',
    label: 'Retro',
    make: (design) =>
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { type: 'lowpass', Q: 1, frequency: 900 },
        envelope: {
          attack: 0.012,
          decay: 0.4,
          sustain: 0.6,
          release: 0.25,
          ...envPatch(design, 'bass'),
        },
        filterEnvelope: {
          attack: 0.012,
          decay: 0.2,
          sustain: 0.5,
          release: 0.2,
          baseFrequency: 100,
          octaves: 1.8,
        },
      }),
  },
  {
    id: 'picked',
    label: 'Picked',
    make: (design) =>
      new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 3, frequency: 1600 },
        envelope: {
          attack: 0.008,
          decay: 0.7,
          sustain: 0.0,
          release: 0.3,
          ...envPatch(design, 'bass'),
        },
        filterEnvelope: {
          attack: 0.008,
          decay: 0.3,
          sustain: 0.2,
          release: 0.2,
          baseFrequency: 200,
          octaves: 2,
        },
      }),
  },
  {
    id: 'dist',
    label: 'Dist',
    make: (design) =>
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { type: 'lowpass', Q: 5, frequency: 2600 },
        envelope: {
          attack: 0.008,
          decay: 0.3,
          sustain: 0.3,
          release: 0.2,
          ...envPatch(design, 'bass'),
        },
        filterEnvelope: {
          attack: 0.008,
          decay: 0.2,
          sustain: 0.4,
          release: 0.15,
          baseFrequency: 250,
          octaves: 2.4,
        },
      }),
  },
]

export const LEAD_PRESETS: PresetDef[] = [
  {
    id: 'mono',
    label: 'Mono',
    make: (design) =>
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { type: 'lowpass', Q: 4, frequency: 3200 },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.4,
          release: 0.4,
          ...envPatch(design, 'lead'),
        },
      }),
  },
  {
    id: 'pluck',
    label: 'Pluck',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.002,
          decay: 0.6,
          sustain: 0.0,
          release: 0.5,
          ...envPatch(design, 'lead'),
        },
      }),
  },
  {
    id: 'saw',
    label: 'Saw',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: {
          attack: 0.02,
          decay: 0.25,
          sustain: 0.5,
          release: 0.4,
          ...envPatch(design, 'lead'),
        },
      }),
  },
  {
    id: 'hover',
    label: 'Hover',
    make: (design) =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.2,
          decay: 0.4,
          sustain: 0.7,
          release: 1.2,
          ...envPatch(design, 'lead'),
        },
      }),
  },
]

export const SOUND_DEFAULTS: Record<Genre, SoundBundle> = {
  trap: { piano: 'acoustic', pad: 'warm', bass: 'sub', lead: 'pluck' },
  rap: { piano: 'acoustic', pad: 'sabre', bass: 'sub', lead: 'mono' },
  plug: { piano: 'acoustic', pad: 'strings', bass: 'retro', lead: 'pluck' },
  detroit: { piano: 'clav', pad: 'warm', bass: 'dist', lead: 'saw' },
  reggaeton: { piano: 'acoustic', pad: 'strings', bass: 'retro', lead: 'pluck' },
}

export interface PresetGroups {
  piano: PresetDef[]
  pad: PresetDef[]
  bass: PresetDef[]
  lead: PresetDef[]
}

export const PRESET_GROUPS: PresetGroups = {
  piano: PIANO_PRESETS,
  pad: PAD_PRESETS,
  bass: BASS_PRESETS,
  lead: LEAD_PRESETS,
}

function findPreset(groups: PresetDef[], id: string): PresetDef {
  return groups.find((p) => p.id === id) ?? groups[0]
}

/** Diseño de sonido activo para un género (de SOUND_DESIGN de PRODUCTION_RECIPES). */
export function soundDesignFor(genre?: Genre): SoundDesignConfig | undefined {
  return genre ? PRODUCTION_RECIPES[genre]?.soundDesign : undefined
}

export function buildPiano(id: string, design?: SoundDesignConfig): Tone.ToneAudioNode {
  return applyDesign(findPreset(PIANO_PRESETS, id).make(design), design)
}
export function buildPad(id: string, design?: SoundDesignConfig): Tone.ToneAudioNode {
  return applyDesign(findPreset(PAD_PRESETS, id).make(design), design)
}
export function buildBass(id: string, design?: SoundDesignConfig): Tone.ToneAudioNode {
  return applyDesign(findPreset(BASS_PRESETS, id).make(design), design)
}
export function buildLead(id: string, design?: SoundDesignConfig): Tone.ToneAudioNode {
  return applyDesign(findPreset(LEAD_PRESETS, id).make(design), design)
}