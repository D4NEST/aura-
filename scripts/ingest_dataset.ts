/**
 * Extractor de estadísticas del dataset de beats reales.
 * Uso: npm run ingest  (escanea dataset/, escribe dataset_analysis.json)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import type { Track as MidiTrack, Note as MidiNote } from '@tonejs/midi'

const require = createRequire(import.meta.url)
const { Midi } = require('@tonejs/midi') as typeof import('@tonejs/midi')

interface NoteStat {
  min: number
  max: number
  avg: number
  count: number
}

interface BeatAnalysis {
  file: string
  genre: string
  key: string
  totalBars: number
  tempo: number
  durationSec: number
  drums: {
    notes: number
    density16: number[]
    commonNotes: number[]
  }
  melodies: {
    count: number
    rangeMin: number
    rangeMax: number
    avgNote: number
    density: number
  } | null
  bass: NoteStat | null
}

interface GenreAggregate {
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

const GENRES = ['trap', 'rap', 'plug', 'detroit', 'reggaeton']

function analyzeNotes(notes: MidiNote[]): NoteStat {
  if (notes.length === 0) return { min: 0, max: 0, avg: 0, count: 0 }
  const mids = notes.map((n) => n.midi)
  return {
    min: Math.min(...mids),
    max: Math.max(...mids),
    avg: mids.reduce((a, b) => a + b, 0) / mids.length,
    count: mids.length,
  }
}

function trackKind(track: MidiTrack): 'drum' | 'bass' | 'melodic' {
  if (track.channel === 9 || /percuss|drums|kit/i.test(track.name)) return 'drum'
  if (track.notes.length === 0) return 'melodic'
  const avg =
    track.notes.reduce((a, n) => a + n.midi, 0) / track.notes.length
  return avg < 50 ? 'bass' : 'melodic'
}

function eighthGrid(track: MidiTrack, spb: number): number[] {
  const grid = new Array(16).fill(0)
  for (const n of track.notes) {
    const step = Math.floor(n.time / (spb / 4)) % 16
    if (step >= 0 && step < 16) grid[step]++
  }
  const max = Math.max(...grid, 1)
  return grid.map((v) => v / max)
}

function topPitches(notes: MidiNote[], k = 8): number[] {
  const map = new Map<number, number>()
  for (const n of notes) {
    const p = Math.round(n.midi) % 12
    map.set(p, (map.get(p) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([p]) => p)
}

function classifyGenre(file: string): string {
  const lower = file.toLowerCase()
  for (const g of GENRES) if (lower.indexOf(g) !== -1) return g
  return 'otros'
}

function main(): void {
  const root = join(process.cwd(), 'dataset')
  const counts = new Map<string, number>()
  const files: string[] = []

  for (const g of GENRES) {
    let n = 0
    const gDir = join(root, g)
    try {
      for (const tone of readdirSync(gDir)) {
        const toneDir = join(gDir, tone)
        const st = readdirSync(toneDir, { withFileTypes: true })
        for (const e of st) {
          if (/\.(mid|midi)$/i.test(e.name)) {
            files.push(join(toneDir, e.name))
            n++
          }
        }
      }
    } catch {
      /* carpeta aún vacía */
    }
    counts.set(g, n)
  }

  const total = files.length
  console.log(`AURA dataset: ${total} beat(s) detectado(s)`)
  for (const g of GENRES) console.log(`  ${g}: ${counts.get(g) ?? 0}`)
  if (total === 0) {
    console.log('Sin archivos aún. Exportá tus beats a dataset/<genero>/<tonalidad>/')
    return
  }

  const beats: BeatAnalysis[] = []
  for (const file of files) {
    try {
      const mid = new Midi(readFileSync(file))
      const spb = (60 / (mid.header.tempos[0]?.bpm ?? 120)) * 4
      const drums = mid.tracks.filter((t) => trackKind(t) === 'drum')
      const basses = mid.tracks
        .filter((t) => trackKind(t) === 'bass')
        .flatMap((t) => t.notes)
      const melodies = mid.tracks.filter((t) => trackKind(t) === 'melodic')
      const melNotes = melodies.flatMap((t) => t.notes)
      const melRange = analyzeNotes(melNotes)
      const bassStat = analyzeNotes(basses)

      const drumNotes = drums.flatMap((t) => t.notes)
      const gridAgg = new Array(16).fill(0)
      for (const d of drums) {
        const g = eighthGrid(d, spb)
        g.forEach((v, i) => (gridAgg[i] = Math.max(gridAgg[i], v)))
      }

      const genre = classifyGenre(file)
      const key = file.toLowerCase().includes('maj') ? 'maj' : 'min'
      beats.push({
        file,
        genre,
        key,
        totalBars: Math.round(mid.duration / spb) || 1,
        tempo: mid.header.tempos[0]?.bpm ?? 0,
        durationSec: mid.duration,
        drums: {
          notes: drumNotes.length,
          density16: gridAgg,
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
      })
      console.log(`  ✓ ${file} — ${beats[beats.length - 1].tempo} BPM`)
    } catch (e) {
      console.warn(`  ✗ ${file}: ${String(e)}`)
    }
  }

  const agg: Record<string, GenreAggregate> = {}
  for (const g of GENRES) {
    const list = beats.filter((b) => b.genre === g)
    if (list.length === 0) continue
    const sum = <T>(get: (b: BeatAnalysis) => T | null, pick: (v: T) => number) => {
      const vals = list.map(get).filter((x): x is T => x != null).map(pick)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    const melMin = sum((b) => b.melodies, (m) => m.rangeMin)
    const melMax = sum((b) => b.melodies, (m) => m.rangeMax)
    const bassMin = sum((b) => b.bass, (b) => b.min)
    const bassMax = sum((b) => b.bass, (b) => b.max)
    const den = new Array(16).fill(0)
    for (const b of list) b.drums.density16.forEach((v, i) => (den[i] += v))
    const denMax = Math.max(...den, 1)
    const pitchCnt = new Map<number, number>()
    for (const b of list) for (const p of b.drums.commonNotes) pitchCnt.set(p, (pitchCnt.get(p) ?? 0) + 1)
    agg[g] = {
      files: list.length,
      avgTempo: sum((b) => b.tempo, (v) => v) ?? 0,
      avgBars: sum((b) => b.totalBars, (v) => v) ?? 0,
      melodyRange: melMin != null && melMax != null ? { min: melMin, max: melMax } : null,
      avgMelodyNote: sum((b) => b.melodies, (m) => m.avgNote),
      bassRange: bassMin != null && bassMax != null ? { min: bassMin, max: bassMax } : null,
      avgBassNote: sum((b) => b.bass, (b) => b.avg),
      drumDensity16: den.map((v) => v / denMax),
      drumNotesTop: [...pitchCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p]) => p),
    }
  }

  writeFileSync(
    join(process.cwd(), 'dataset_analysis.json'),
    JSON.stringify({ generated: new Date().toISOString(), genres: agg }, null, 2),
  )
  console.log('\nResumen por género:')
  for (const [g, a] of Object.entries(agg)) {
    console.log(
      `  ${g}: ${a.files} archivos · ${Math.round(a.avgTempo)} BPM · ${Math.round(a.avgBars)} compases` +
        (a.melodyRange ? ` · melodía ${a.melodyRange.min}..${a.melodyRange.max}` : '') +
        (a.bassRange ? ` · bajo ${a.bassRange.min}..${a.bassRange.max}` : ''),
    )
  }
  console.log('\nEscrito dataset_analysis.json')
}

main()