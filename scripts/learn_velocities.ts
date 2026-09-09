/**
 * Aprende la velocity humana real del catálogo (rol × género).
 * Uso: npx tsx scripts/learn_velocities.ts [ruta] [--since=YYYY-MM-DD]
 *
 * Escanea los .flp (>= 2024 por defecto), agrupa velocities por rol musical
 * (acordes/bajo/lead/batería por familia) y escribe learned_velocities.json.
 * Solo lectura de los .flp; jamás los modifica.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlp } from './flp_parse'
import {
  classifyChannel,
  collectFlpFiles,
  drumFamilyOf,
} from './flp_analysis'

interface Stat {
  count: number
  mean: number
  std: number
  jitter: number
  min: number
  max: number
}

function addStat(map: Map<string, number[]>, key: string, v: number): void {
  const arr = map.get(key) ?? []
  arr.push(v)
  map.set(key, arr)
}

function compute(key: string, arr: number[], projectVars: Map<string, { n: number; variance: number }[]>): Stat {
  const count = arr.length
  if (count === 0) return { count: 0, mean: 0, std: 0, jitter: 0, min: 0, max: 0 }
  const mean = arr.reduce((a, b) => a + b, 0) / count
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / count
  // Jitter humano = desviación típica promedio DENTRO de cada proyecto
  // (cuánto varía la velocity entre notas del mismo beat, sin el ruido entre proyectos).
  const pvs = projectVars.get(key) ?? []
  const num = pvs.reduce((a, v) => a + v.variance * v.n, 0)
  const den = pvs.reduce((a, v) => a + v.n, 0)
  const jitter = den > 0 ? Math.sqrt(num / den) : Math.sqrt(variance)
  return {
    count,
    mean: Math.round(mean * 10) / 10,
    std: Math.round(Math.sqrt(variance) * 10) / 10,
    jitter: Math.round(jitter * 10) / 10,
    min: Math.min(...arr),
    max: Math.max(...arr),
  }
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
  console.log(`APRENDIZAJE DE VELOCITIES (>= 2024): ${files.length} proyectos en ${root}`)

  const buckets = new Map<string, number[]>()
  const projectVars = new Map<string, { n: number; variance: number }[]>()
  for (const file of files) {
    try {
      const parsed = parseFlp(file, readFileSync(file))
      const genre = genreOf(file)
      const byChannel = new Map<number, typeof parsed.notes>()
      for (const n of parsed.notes) {
        const list = byChannel.get(n.rackChannel) ?? []
        list.push(n)
        byChannel.set(n.rackChannel, list)
      }
      const local = new Map<string, number[]>()
      for (const ch of parsed.channels.values()) {
        const notes = byChannel.get(ch.iid) ?? []
        if (notes.length === 0) continue
        const role = classifyChannel(ch, notes)
        if (role === 'drum') {
          const fam = drumFamilyOf(ch)
          for (const n of notes) {
            addStat(buckets, `${genre}.drum_${fam}`, n.velocity)
            addStat(buckets, `all.drum_${fam}`, n.velocity)
            addStat(local, `all.drum_${fam}`, n.velocity)
          }
        } else if (role !== 'otros') {
          for (const n of notes) {
            addStat(buckets, `${genre}.${role}`, n.velocity)
            addStat(buckets, `all.${role}`, n.velocity)
            addStat(local, `all.${role}`, n.velocity)
          }
        }
      }
      for (const [key, vals] of local) {
        if (vals.length < 2) continue
        const m = vals.reduce((a, b) => a + b, 0) / vals.length
        const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length
        const list = projectVars.get(key) ?? []
        list.push({ n: vals.length, variance })
        projectVars.set(key, list)
      }
    } catch (e) {
      console.warn(`  ✗ ${file}: ${String(e)}`)
    }
  }

  const result: Record<string, Stat> = {}
  for (const [key, arr] of buckets) result[key] = compute(key, arr, projectVars)
  writeFileSync(
    join(process.cwd(), 'learned_velocities.json'),
    JSON.stringify({ generated: new Date().toISOString(), filter: 'desde 2024', velocities: result }, null, 2),
  )

  const order = ['chords', 'bass', 'lead', 'drum_kick', 'drum_snare', 'drum_hat', 'drum_perc']
  console.log('\nVelocities (mean ± std · jitter humano · n):')
  for (const role of order) {
    for (const scope of ['all', ...['trap', 'rap', 'plug', 'detroit', 'reggaeton']]) {
      const s = result[`${scope}.${role}`]
      if (s && s.count > 0) {
        console.log(`  ${role.padEnd(10)} ${scope.padEnd(9)} ${String(s.mean).padStart(5)} ± ${String(s.std).padEnd(4)} j≈${String(s.jitter).padEnd(4)}  n=${s.count}`)
      }
    }
  }
  console.log('\nEscrito learned_velocities.json')
}

main()