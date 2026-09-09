/**
 * Aprende los rangos de octava reales del catálogo por rol (acordes/bajo/lead).
 * Uso: npx tsx scripts/learn_ranges.ts [ruta] [--since=YYYY-MM-DD]
 *
 * Escribe learned_ranges.json con percentiles (P1/P5/P25/P50/P75/P95/P99)
 * de altura de nota por género x rol. Solo lectura de los .flp.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlp } from './flp_parse'
import { collectFlpFiles, splitNotesByRole } from './flp_analysis'

function sinceMs(): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--since='))
  if (!arg) return new Date('2024-01-01T00:00:00').getTime()
  const d = new Date(arg.slice('--since='.length))
  return Number.isNaN(d.getTime()) ? new Date('2024-01-01T00:00:00').getTime() : d.getTime()
}

function genreOf(file: string): string {
  const lower = file.toLowerCase()
  if (lower.includes('trap')) return 'trap'
  if (lower.includes('rap')) return 'rap'
  if (lower.includes('plug')) return 'plug'
  if (lower.includes('detroit') || lower.includes('drill')) return 'detroit'
  if (lower.includes('reggae') || lower.includes('perreo') || lower.includes('dembow') || lower.includes('dancehall')) return 'reggaeton'
  return 'otros'
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

function main(): void {
  const rootArg = process.argv.slice(2).find((a) => !a.startsWith('--since=') && !a.startsWith('--'))
  const root = rootArg ? resolve(rootArg) : resolve('dataset_flp')
  const since = sinceMs()

  const seen = new Set<string>()
  const files = collectFlpFiles(root).filter((f) => {
    const st = statSync(f)
    const k = `${f.toLowerCase().split(/[\\/]/).pop()}__${st.size}`
    if (seen.has(k)) return false
    seen.add(k)
    return st.mtimeMs >= since
  })
  console.log(`APRENDIZAJE DE RANGOS (>= 2024): ${files.length} proyectos en ${root}`)

  const buckets = new Map<string, Map<string, number[]>>()
  const bucketAt = (genre: string, role: 'chords' | 'bass' | 'lead'): number[] => {
    let g = buckets.get(genre)
    if (!g) {
      g = new Map<string, number[]>()
      buckets.set(genre, g)
    }
    let arr = g.get(role)
    if (!arr) {
      arr = []
      g.set(role, arr)
    }
    return arr
  }

  for (const file of files) {
    try {
      const parsed = parseFlp(file, readFileSync(file))
      const genre = genreOf(file)
      const split = splitNotesByRole(parsed)
      const add = (notes: typeof parsed.notes, role: 'chords' | 'bass' | 'lead') => {
        const arr = bucketAt(genre, role)
        for (const n of notes) arr.push((n.key ?? n.note) & 0x7f)
      }
      add(split.chords, 'chords')
      add(split.bass, 'bass')
      add(split.lead, 'lead')
    } catch (e) {
      console.warn(`  ✗ ${file}: ${String(e)}`)
    }
  }

  const result: Record<string, Record<string, number[]>> = {}
  for (const [genre, g] of buckets) {
    result[genre] = {}
    for (const [role, arr] of g) {
      const sorted = arr.slice().sort((a, b) => a - b)
      result[genre][role] = ['p1', 'p5', 'p25', 'p50', 'p75', 'p95', 'p99'].map((k, i) => ({
        p: k,
        note: pct(sorted, [1, 5, 25, 50, 75, 95, 99][i]),
        n: sorted.length,
      })) as unknown as number[]
    }
  }

  const json: Record<string, Record<string, { p1: number; p5: number; p25: number; p50: number; p75: number; p95: number; p99: number; n: number }>> = {}
  Object.entries(result).forEach(([genre, roles]) => {
    json[genre] = {}
    Object.entries(roles).forEach(([role, arr]) => {
      const a = arr as unknown as { p: string; note: number; n: number }[]
      json[genre][role] = {
        p1: a[0].note,
        p5: a[1].note,
        p25: a[2].note,
        p50: a[3].note,
        p75: a[4].note,
        p95: a[5].note,
        p99: a[6].note,
        n: a[0].n,
      }
    })
  })

  writeFileSync(join(process.cwd(), 'learned_ranges.json'), JSON.stringify(json, null, 2))

  for (const g of Object.keys(json)) {
    console.log(`\n${g.padEnd(10)}`)
    for (const role of ['chords', 'bass', 'lead']) {
      const r = json[g][role]
      if (!r) continue
      console.log(
        `  ${role.padEnd(7)} P5..P95 ${String(r.p5).padStart(3)}..${String(r.p95).padEnd(3)}  P50 ${String(r.p50).padStart(3)}  P1..P99 ${String(r.p1).padStart(3)}..${String(r.p99).padEnd(3)}  n=${r.n}`,
      )
    }
  }
  console.log('\nEscrito learned_ranges.json')
}

main()