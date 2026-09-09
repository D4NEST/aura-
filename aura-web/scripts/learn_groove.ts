/**
 * Aprende el groove/micro-timing real del catálogo.
 * Uso: npx tsx scripts/learn_groove.ts [ruta] [--since=YYYY-MM-DD]
 *
 * Para cada proyecto (>= 2024 por defecto) mide, sobre la rejilla de 16ths,
 * cuánto se desvían las posiciones de las notas (armonía y batería por
 * separado) en cada paso del compás. Escribe learned_groove.json con el
 * desvío medio por paso (fracción de semicorchea) y su dispersión.
 * Solo lectura de los .flp; jamás los modifica.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlp } from './flp_parse'
import { classifyChannel, collectFlpFiles, splitNotesByRole } from './flp_analysis'

interface StepStat {
  dev: number[]
  count: number
}

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
  console.log(`APRENDIZAJE DE GROOVE (>= 2024): ${files.length} proyectos en ${root}`)

  // paso -> [desvíos en ticks]  (por género y grupo)
  const harmony = new Map<string, StepStat[]>()
  const drums = new Map<string, StepStat[]>()
  const noteAt = (map: Map<string, StepStat[]>, genre: string, step: number) => {
    let arr = map.get(genre)
    if (!arr) {
      arr = Array.from({ length: 16 }, () => ({ dev: [], count: 0 }))
      map.set(genre, arr)
    }
    return arr[step]
  }

  for (const file of files) {
    try {
      const parsed = parseFlp(file, readFileSync(file))
      const genre = genreOf(file)
      const ppq = parsed.ppq
      const stepTicks = ppq / 4
      const barTicks = ppq * 4
      const split = splitNotesByRole(parsed)

      const byChannel = new Map<number, typeof parsed.notes>()
      for (const n of parsed.notes) {
        const list = byChannel.get(n.rackChannel) ?? []
        list.push(n)
        byChannel.set(n.rackChannel, list)
      }
      const drumNotes: typeof parsed.notes = []
      for (const ch of parsed.channels.values()) {
        const notes = byChannel.get(ch.iid) ?? []
        if (notes.length && classifyChannel(ch, notes) === 'drum') drumNotes.push(...notes)
      }

      const sample = (notes: typeof parsed.notes, map: Map<string, StepStat[]>) => {
        for (const n of notes) {
          const rel = n.position % barTicks
          const idx = Math.round(rel / stepTicks)
          const devFrac = (rel - (idx % 16) * stepTicks) / stepTicks
          const s = noteAt(map, genre, ((idx % 16) + 16) % 16)
          s.dev.push(devFrac)
          s.count++
        }
      }
      sample([...split.chords, ...split.bass, ...split.lead], harmony)
      sample(drumNotes, drums)
    } catch (e) {
      console.warn(`  ✗ ${file}: ${String(e)}`)
    }
  }

  const result: Record<string, { harmony: number[][]; drums: number[][] }> = {}
  for (const g of ['trap', 'rap', 'plug', 'detroit', 'reggaeton', 'otros']) {
    const gHarmony = harmony.get(g)
    const gDrums = drums.get(g)
    if (!gHarmony && !gDrums) continue
    const toFrac = (arr: StepStat[] | undefined): number[][] => {
      const out: number[][] = []
      let offTotal = 0
      let countTotal = 0
      for (let i = 0; i < 16; i++) {
        const s = arr?.[i]
        if (!s || s.count === 0) {
          out.push([0, 0, 0, 0])
          continue
        }
        const near = s.dev.filter((d) => Math.abs(d) <= 0.6)
        const off = s.dev.length - near.length
        offTotal += off
        countTotal += s.dev.length
        if (near.length === 0) {
          out.push([0, 0, 0, off / s.dev.length])
          continue
        }
        const mean = near.reduce((a, b) => a + b, 0) / near.length
        const variance = near.reduce((a, b) => a + (b - mean) ** 2, 0) / near.length
        out.push([
          Math.round(mean * 1000) / 1000,
          Math.round(Math.sqrt(variance) * 1000) / 1000,
          near.length,
          off / s.dev.length,
        ])
      }
      out.push([5, offTotal / countTotal, countTotal, 0] as unknown as number[])
      return out
    }
    result[g] = { harmony: toFrac(gHarmony), drums: toFrac(gDrums) }
  }

  writeFileSync(
    join(process.cwd(), 'learned_groove.json'),
    JSON.stringify({ generated: new Date().toISOString(), filter: 'desde 2024', grooves: result }, null, 2),
  )

  for (const g of Object.keys(result)) {
    const row = (arr: number[][]): string =>
      arr
        .slice(0, 16)
        .map(([d, j, n]) => `${d > 0 ? '+' : ''}${(d * 24).toFixed(1)}·${(j * 24).toFixed(1)}${n > 0 ? `[${n}]` : ''}`)
        .join(' ')
    const foot = (arr: number[][]) => arr[16]
    console.log(`\n${g.padEnd(10)} HARMONY (desvío·jitter en ticks de 1/16; notas libres ${((foot(result[g].harmony)?.[1] ?? 0) * 100).toFixed(1)}%):`)
    console.log('  ' + row(result[g].harmony))
    console.log(`${g.padEnd(10)} DRUMS (notas libres ${((foot(result[g].drums)?.[1] ?? 0) * 100).toFixed(1)}%):`)
    console.log('  ' + row(result[g].drums))
  }
  console.log('\nEscrito learned_groove.json')
}

main()