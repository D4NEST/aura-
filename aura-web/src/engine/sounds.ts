import * as Tone from 'tone'
import type { Genre, SoundBundle } from '../core/types'

export interface PresetDef {
  id: string
  label: string
  make: () => Tone.ToneAudioNode
}

export const PIANO_PRESETS: PresetDef[] = [
  {
    id: 'rhodes',
    label: 'Rhodes FM',
    make: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.02,
        modulationIndex: 9,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.004, decay: 2.0, sustain: 0.0, release: 1.3 },
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
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.003,
          decay: 0.9,
          sustain: 0.12,
          release: 1.1,
        },
      }),
  },
  {
    id: 'dx',
    label: 'E-Piano DX',
    make: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 0.5,
        modulationIndex: 4,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 1.6, sustain: 0.0, release: 1.0 },
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
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: {
          attack: 0.002,
          decay: 1.4,
          sustain: 0.0,
          release: 0.5,
        },
      }),
  },
]

export const PAD_PRESETS: PresetDef[] = [
  {
    id: 'warm',
    label: 'Warm',
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 1.2, decay: 0.6, sustain: 0.8, release: 2.4 },
      }),
  },
  {
    id: 'sabre',
    label: 'Sabre',
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
        envelope: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 2.0 },
      }),
  },
  {
    id: 'strings',
    label: 'Strings',
    make: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.2,
        modulationIndex: 5,
        oscillator: { type: 'sine' },
        modulation: { type: 'sawtooth' },
        envelope: { attack: 0.9, decay: 0.3, sustain: 0.75, release: 2.2 },
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
    make: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        filter: { type: 'lowpass', Q: 2, frequency: 1100 },
        envelope: { attack: 0.015, decay: 0.5, sustain: 0.45, release: 0.3 },
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
    make: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { type: 'lowpass', Q: 1, frequency: 900 },
        envelope: { attack: 0.012, decay: 0.4, sustain: 0.6, release: 0.25 },
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
    make: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 3, frequency: 1600 },
        envelope: { attack: 0.008, decay: 0.7, sustain: 0.0, release: 0.3 },
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
    make: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { type: 'lowpass', Q: 5, frequency: 2600 },
        envelope: { attack: 0.008, decay: 0.3, sustain: 0.3, release: 0.2 },
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
    make: () =>
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { type: 'lowpass', Q: 4, frequency: 3200 },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.4 },
      }),
  },
  {
    id: 'pluck',
    label: 'Pluck',
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.5 },
      }),
  },
  {
    id: 'saw',
    label: 'Saw',
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.4 },
      }),
  },
  {
    id: 'hover',
    label: 'Hover',
    make: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.2, decay: 0.4, sustain: 0.7, release: 1.2 },
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

export function buildPiano(id: string): Tone.ToneAudioNode {
  return findPreset(PIANO_PRESETS, id).make()
}
export function buildPad(id: string): Tone.ToneAudioNode {
  return findPreset(PAD_PRESETS, id).make()
}
export function buildBass(id: string): Tone.ToneAudioNode {
  return findPreset(BASS_PRESETS, id).make()
}
export function buildLead(id: string): Tone.ToneAudioNode {
  return findPreset(LEAD_PRESETS, id).make()
}