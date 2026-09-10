export type Emotion = 'tristeza' | 'ira' | 'amor' | 'decepcion' | 'nostalgia'
export type Genre = 'trap' | 'rap' | 'plug' | 'detroit' | 'reggaeton'
export type Mode = 'mayor' | 'menor'
export type Rng = () => number

export interface Section {
  name: string
  emotion: Emotion
  genre: Genre
  bars: number
  role?: 'intro' | 'pre' | 'coro' | 'estrofa' | 'outro' | string
}

export interface Note {
  tick: number
  dur: number
  note: number
  velocity: number
}

export interface Track {
  name: string
  channel: number
  program: number
  notes: Note[]
}

export interface SectionProgression {
  name: string
  role?: string
  emotion: Emotion
  genre: Genre
  bars: number
  progression: number[]
  source: 'principal' | 'alternativa' | 'real' | 'genre' | 'preset'
  mutated: boolean
}

export interface SongResult {
  tracks: Track[]
  ticksPerBeat: number
  totalBars: number
  totalTicks: number
  progressions: SectionProgression[]
  genre?: Genre
}

export type CasualMode = '12' | '24' | 'full'

export interface SoundBundle {
  piano: string
  pad: string
  bass: string
  lead: string
}

export interface Mood {
  emotion: Emotion
  label: string
  description: string
  tempo: number
}