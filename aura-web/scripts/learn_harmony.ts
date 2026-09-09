/**
 * Aprende el ritmo armónico real del catálogo: cuántos compases aguanta cada
 * acorde, por género. Uso: npx tsx scripts/learn_harmony.ts [ruta] [--since]
 *
 * Detecta cambios de acorde usando el bajo (raíz) — un nuevo pitch-class (o un
 * hueco) marca el inicio de un nuevo acorde. Si un proyecto no tiene bajo,
 * usa los acordes. Escribe learned_harmony.json con la distribución de
 * duraciones (en compases) por género. Solo lectura de los .flp.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlp } from './flp_parse'
import { classifyChannel, collectFlpFiles, splitNotesByRole } from './flp_analysis'

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
  console.log(`APRENDIZAJE DE RITMO ARMÓNICO (>= 2024): ${files.length} proyectos en ${root}`)

  const dist = new Map<string, Map<number, number>>()
  const count = new Map<string, number>()
  const projectCount = new Map<string, number>()
  const addDur = (genre: string, bars: number) => {
    if (bars <= 0) return
    const d = Math.min(12, Math.max(1, Math.round(bars)))
    let m = dist.get(genre)
    if (!m) {
      m = new Map<number, number>()
      dist.set(genre, m)
    }
    m.set(d, (m.get(d) ?? 0) + 1)
    count.set(genre, (count.get(genre) ?? 0) + 1)
  }

  for (const file of files) {
    try {
      const parsed = parseFlp(file, readFileSync(file))
      const genre = genreOf(file)
      const ppq = parsed.ppq
      const barTicks = ppq * 4
      const split = splitNotesByRole(parsed)
      projectCount.set(genre, (projectCount.get(genre) ?? 0) + 1)

      const bassSorted = split.bass.slice().sort((a, b) => a.position - b.position)
      let marker: { pos: number; pc: number } | null = null
      if (bassSorted.length > 0) {
        const hits: { pos: number; pc: number }[] = []
        for (const n of bassSorted) {
          const p = n.position
          if (hits.length && p - hits[hits.length - 1].pos < ppq / 4) continue
          hits.push({ pos: p, pc: (n.key ?? n.note) % 12 })
        }
        for (const hit of hits) {
          if (marker === null) {
            marker = hit
            continue
          }
          if (hit.pc !== marker.pc || hit.pos - marker.pos >= barTicks * 2) {
            const bars = (hit.pos - marker.pos) / barTicks
            addDur(genre, bars)
            marker = hit
          }
        }
      } else {
        const chordSorted = split.chords.slice().sort((a, b) => a.position - b.position)
        let prevPc = -1
        for (const n of chordSorted) {
          const pc = (n.key ?? n.note) % 12
          if (marker === null) {
            marker = { pos: n.position, pc }
            prevPc = pc
            continue
          }
          if (pc !== prevPc || n.position - marker.pos >= barTicks * 2) {
            addDur(genre, (n.position - marker.pos) / barTicks)
            marker = { pos: n.position, pc }
            prevPc = pc
          }
        }
      }
    } catch (e) {
      console.warn(`  ✗ ${file}: ${String(e)}`)
    }
  }

  const result: Record<string, { weights: Record<string, number>; total: number; projects: number }> = {}
  for (const [genre, m] of dist) {
    result[genre] = {
      weights: Object.fromEntries([...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v])),
      total: count.get(genre) ?? 0,
      projects: projectCount.get(genre) ?? 0,
    }
  }

  writeFileSync(join(process.cwd(), 'learned_harmony.json'), JSON.stringify(result, null, 2))

  for (const g of Object.keys(result)) {
    const ws = result[g].weights
    const sum = Object.values(ws).reduce((a, b) => a + b, 0) || 1
    const pct = (k: string) => `${Math.round(((ws[k] ?? 0) / sum) * 100)}%`
    console.log(
      `${g.padEnd(10)} ${(1 + 'b').padStart(4)}=${pct('1').padStart(4)} ${'2b'.padStart(4)}=${pct('2').padStart(4)} ${'3b'.padStart(4)}=${pct('3').padStart(4)} ${'4b'.padStart(4)}=${pct('4').padStart(4)} ${'5b+'.padStart(4)}=${pct('5').padStart(4)}  n=${result[g].total} (${result[g].projects} beats)`,
    )
  }
  console.log('\nEscrito learned_harmony.json')
}

main()