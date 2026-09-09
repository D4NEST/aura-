/**
 * Ingesta masiva de proyectos FL Studio (.flp) al dataset de AURA.
 * Uso: npx tsx scripts/ingest_flp.ts [ruta] [--since=YYYY-MM-DD]
 *
 * La ruta por defecto es dataset_flp/. Siempre abre los .flp en modo LECTURA;
 * jamás modifica los archivos del productor. Escribe dataset_flp_analysis.json.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlp } from './flp_parse'
import {
  analyzeBeat,
  classifyGenre,
  collectFlpFiles,
  GENRES,
  type BeatAnalysis,
  type GenreAggregate,
} from './flp_analysis'

function sinceDate(): string | null {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--since='))
  if (!arg) return null
  const d = new Date(arg.slice('--since='.length))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function main(): void {
  const rootArg = process.argv.slice(2).find((a) => !a.startsWith('--since=') && !a.startsWith('--'))
  const root = rootArg ? resolve(rootArg) : resolve('dataset_flp')
  const since = sinceDate()
  const sinceMs = since ? new Date(`${since}T00:00:00`).getTime() : null

  let files = collectFlpFiles(root)
  if (sinceMs) {
    const before = files.length
    files = files.filter((f) => statSync(f).mtimeMs >= sinceMs)
    console.log(`AURA dataset FLP: ${before} encontrados · ${files.length} desde ${since}`)
  } else {
    console.log(`AURA dataset FLP: ${files.length} proyecto(s) en ${root}`)
  }
  if (files.length === 0) {
    console.log(
      'Sin archivos en esa ruta. Pasá la carpeta de tus .flp o usá dataset_flp/<genero>/<tonalidad>/',
    )
    return
  }

  const seen = new Set<string>()
  const beats: BeatAnalysis[] = []
  for (const file of files) {
    try {
      const st = statSync(file)
      const dedupeKey = `${file.toLowerCase().split(/[\\/]/).pop()}__${st.size}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      const parsed = parseFlp(file, readFileSync(file))
      const beat = analyzeBeat(file, parsed, {
        modified: new Date(st.mtimeMs).toISOString(),
        size: st.size,
      })
      beats.push(beat)
      const drums = beat.channels.filter((c) => c.role === 'drum').length
      const lines = beat.channels
        .filter((c) => c.notes > 0)
        .map((c) => `${c.name}(${c.role})`)
        .join(', ')
      console.log(
        `  ✓ ${file} — ${beat.tempo} BPM · ${beat.totalBars} compases · ` +
          `${beat.channels.length} canales (${drums} batería) · ${lines || 'sin notas'}`,
      )
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
    for (const b of list)
      for (const p of b.drums.commonNotes)
        pitchCnt.set(p, (pitchCnt.get(p) ?? 0) + 1)
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
  for (const b of beats) if (b.genre === 'otros') b.genre = classifyGenre(b.file)

  writeFileSync(
    join(process.cwd(), 'dataset_flp_analysis.json'),
    JSON.stringify({ generated: new Date().toISOString(), origin: 'flp', genres: agg, beats }, null, 2),
  )

  console.log('\nResumen por género:')
  for (const [g, a] of Object.entries(agg)) {
    console.log(
      `  ${g}: ${a.files} archivos · ${Math.round(a.avgTempo)} BPM · ${Math.round(a.avgBars)} compases` +
        (a.melodyRange ? ` · melodía ${a.melodyRange.min}..${a.melodyRange.max}` : '') +
        (a.bassRange ? ` · bajo ${a.bassRange.min}..${a.bassRange.max}` : ''),
    )
  }
  console.log('\nEscrito dataset_flp_analysis.json')
}

main()