/**
 * Núcleo de análisis de proyectos FL Studio (.flp).
 * Lo usa scripts/ingest_flp.ts (masivo) y scripts/validate_progressions.ts (reglas).
 * NUNCA modifica los archivos: solo lectura (parse) + métricas en memoria.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { FlpChannel, FlpNote, FlpProject } from './flp_parse'

export type Role = 'drum' | 'bass' | 'chords' | 'lead' | 'otros'

export interface NoteStat {
  min: number
  max: number
  avg: number
  count: number
}

export interface ChannelCard {
  iid: number
  name: string
  type: number
  role: Role
  notes: number
  avgNote: number
}

export interface BeatAnalysis {
  file: string
  genre: string
  key: string
  totalBars: number
  tempo: number
  durationSec: number
  modified?: string
  size?: number
  channels: ChannelCard[]
  drums: { notes: number; density16: number[]; commonNotes: number[] }
  melodies: {
    count: number
    rangeMin: number
    rangeMax: number
    avgNote: number
    density: number
  } | null
  bass: NoteStat | null
}

export interface RoleSplit {
  drum: FlpNote[]
  bass: FlpNote[]
  lead: FlpNote[]
  chords: FlpNote[]
}

export interface GenreAggregate {
  files: number
  avgTempo: number
  avgBars: number
  melodyRange: { min: number; max: number } | null
  avgMelodyNote: number | null
  bassRange: { min: number; max: number } | null
  avgBassNote: number | null
  drumDensity16: number[]
  drumNotesTop: number[]
}

export const GENRES = ['trap', 'rap', 'plug', 'detroit', 'reggaeton']

const DRUM_RE =
  /kick|snare|clap|hi[- ]?hat|o[- ]?hat|open|perc|tom|crash|ride|cymbal|\b808\b|boom|fx|drum|wood|tamb|shaker|rim|clap|zap|roll|stamp|glitch|scream|vox\b/i
const KICK_RE = /kick|kick|boom|bassdrum|\b808\b/i
const SNARE_RE = /snare|clap|rim|wood|tamb/i
const HAT_RE = /hat|shaker|tick/i
const PERC_RE = /perc|tom|cymbal|crash|ride|cowbell|zap|open/i
const BASS_RE = /\bbass\b|sub|808 bass|808s\b/i
const CHORD_RE = /chord|keys|piano|rhode|ep|pad|string|organ|mellotron|wurli|hammond/i
const LEAD_RE = /lead|pluck|melody|main|arp|xyl|marim|flute|choir|vox|vocal|bell|guitar|sitar|horn|trump/i

function noteLabel(ch: FlpChannel): string {
  return `${ch.name ?? ''} ${ch.pluginName ?? ''} ${ch.internalName ?? ''}`.toLowerCase()
}

export type DrumFamily = 'kick' | 'snare' | 'hat' | 'perc' | 'other'

/** Familia de batería según el nombre/plugin del canal. */
export function drumFamilyOf(ch: FlpChannel): DrumFamily {
  const label = noteLabel(ch)
  if (KICK_RE.test(label)) return 'kick'
  if (SNARE_RE.test(label)) return 'snare'
  if (HAT_RE.test(label)) return 'hat'
  if (PERC_RE.test(label)) return 'perc'
  return 'other'
}

/** Clasifica el rol de un canal según su nombre/plugin y la estadística de sus notas. */
export function classifyChannel(ch: FlpChannel, notes: FlpNote[]): Role {
  if (notes.length === 0) return 'otros'
  const label = noteLabel(ch)
  const keys = notes.map((n) => n.key)
  const avg = keys.reduce((a, b) => a + b, 0) / keys.length
  const spread = Math.max(...keys) - Math.min(...keys)

  if (BASS_RE.test(label)) return 'bass'
  if (DRUM_RE.test(label)) return 'drum'
  if (avg < 50) return 'bass'
  if (CHORD_RE.test(label)) return 'chords'
  if (LEAD_RE.test(label)) return 'lead'

  // Fallback por registro y densidad percibida
  if (spread <= 14 && avg < 62) return 'chords'
  if (avg >= 68) return 'lead'
  return 'chords'
}

/** Separa las notas del proyecto por rol musical. */
export function splitNotesByRole(p: FlpProject): RoleSplit {
  const notesByChannel = new Map<number, FlpNote[]>()
  for (const n of p.notes) {
    const list = notesByChannel.get(n.rackChannel) ?? []
    list.push(n)
    notesByChannel.set(n.rackChannel, list)
  }
  const split: RoleSplit = { drum: [], bass: [], lead: [], chords: [] }
  for (const ch of p.channels.values()) {
    const notes = notesByChannel.get(ch.iid) ?? []
    if (notes.length === 0) continue
    const role = classifyChannel(ch, notes)
    split[role === 'drum' ? 'drum' : role === 'bass' ? 'bass' : role === 'lead' ? 'lead' : 'chords'].push(...notes)
  }
  return split
}

export function analyzeNotes(notes: FlpNote[]): NoteStat {
  if (notes.length === 0) return { min: 0, max: 0, avg: 0, count: 0 }
  const keys = notes.map((n) => n.key)
  return {
    min: Math.min(...keys),
    max: Math.max(...keys),
    avg: keys.reduce((a, b) => a + b, 0) / keys.length,
    count: keys.length,
  }
}

export function topPitches(notes: FlpNote[], k = 8): number[] {
  const map = new Map<number, number>()
  for (const n of notes) {
    const p = n.key % 12
    map.set(p, (map.get(p) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([p]) => p)
}

/** Grid de semicorcheas (16 pasos) promediado por compás. */
export function drumGrid(notes: FlpNote[], ppq: number): number[] {
  const grid = new Array(16).fill(0)
  const barTicks = ppq * 4
  const stepTicks = ppq / 4
  for (const n of notes) {
    const step = Math.floor((n.position % barTicks) / stepTicks)
    if (step >= 0 && step < 16) grid[step]++
  }
  const max = Math.max(...grid, 1)
  return grid.map((v) => v / max)
}

export function classifyGenre(file: string): string {
  const lower = file.toLowerCase()
  for (const g of GENRES) if (lower.includes(g)) return g
  return 'otros'
}

export function analyzeBeat(
  file: string,
  p: FlpProject,
  meta?: { modified?: string; size?: number },
): BeatAnalysis {
  const ppq = p.ppq
  const split = splitNotesByRole(p)
  const { drum: drumNotes, bass: bassNotes, lead: leadNotes, chords: chordNotes } = split
  const melNotes = [...leadNotes, ...chordNotes]

  const channels: ChannelCard[] = []
  const notesByChannel = new Map<number, FlpNote[]>()
  for (const n of p.notes) {
    const list = notesByChannel.get(n.rackChannel) ?? []
    list.push(n)
    notesByChannel.set(n.rackChannel, list)
  }
  for (const ch of p.channels.values()) {
    const notes = notesByChannel.get(ch.iid) ?? []
    channels.push({
      iid: ch.iid,
      name: ch.name ?? ch.pluginName ?? ch.internalName ?? `canal ${ch.iid}`,
      type: ch.type,
      role: classifyChannel(ch, notes),
      notes: notes.length,
      avgNote:
        notes.length > 0 ? notes.reduce((a, n) => a + n.key, 0) / notes.length : 0,
    })
  }

  const spb = (60 / (p.tempo || 120)) * 4 // segundos por compás (4/4)
  const effLength = (n: FlpNote) => n.length || ppq / 4
  const maxTick = Math.max(...p.notes.map((n) => n.position + effLength(n)), 1)
  const totalBars = Math.ceil(maxTick / (ppq * 4)) || 1
  const durationSec = totalBars * spb

  const melRange = analyzeNotes(melNotes)
  const bassStat = analyzeNotes(bassNotes)
  const lower = file.toLowerCase()
  const key = lower.includes('maj') ? 'maj' : 'min'

  return {
    file,
    genre: classifyGenre(file),
    key,
    totalBars,
    tempo: p.tempo,
    durationSec,
    modified: meta?.modified,
    size: meta?.size,
    channels,
    drums: {
      notes: drumNotes.length,
      density16: drumGrid(drumNotes, ppq),
      commonNotes: topPitches(drumNotes),
    },
    melodies:
      melNotes.length > 0
        ? {
            count: melNotes.length,
            rangeMin: melRange.min,
            rangeMax: melRange.max,
            avgNote: melRange.avg,
            density: melNotes.length / Math.max(melRange.max - melRange.min, 12),
          }
        : null,
    bass: bassStat.count > 0 ? bassStat : null,
  }
}

export function collectFlpFiles(root: string): string[] {
  const files: string[] = []
  let dir
  try {
    dir = readdirSync(root, { withFileTypes: true })
  } catch {
    return files
  }
  const walk = (d: string): void => {
    for (const e of d === root ? dir : readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.flp$/i.test(e.name)) files.push(full)
    }
  }
  walk(root)
  return files
}