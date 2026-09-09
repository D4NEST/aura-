/**
 * Valida proyectos FLP contra las reglas armónicas del motor AURA.
 * Uso: npx tsx scripts/validate_progressions.ts [ruta] [--since=YYYY-MM-DD]
 *
 * Para cada .flp (>= 2024 por defecto) detecta la escala emocional que mejor le
 * encaja (5 escalas del motor × 12 tonos, ponderando bajo > acordes > melodía),
 * extrae la progresión real por compases y la compara contra PROGRESIONES.
 * Los proyectos que cumplen "reglas de escala" (>= 90% in-scale) Y "reglas de
 * progresión" se guardan como referencias en learned_flp_rules.json.
 * Solo lectura de los .flp; jamás los modifica.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlp } from './flp_parse'
import { collectFlpFiles, splitNotesByRole } from './flp_analysis'
import { ESCALAS, PROGRESIONES, ROOTS } from '../src/core/constants'

const MIN_IN_SCALE = 0.9

interface Detection {
  emotion: keyof typeof ESCALAS
  root: number
  inScale: number
  notes: number
}
interface Progression {
  sig: number[]
  matchedRule: string | null
}

/** Encuentra la (emoción→escala, tono) que maximiza notas dentro de escala. */
function detectBestScale(
  notes: { key: number; weight: number }[],
): Detection | null {
  if (notes.length < 4) return null
  let best: Detection & { score: number } | null = null
  for (const [emotion, scale] of Object.entries(ESCALAS) as [keyof typeof ESCALAS, number[]][]) {
    for (let root = 0; root < 12; root++) {
      const set = new Set(scale.map((s) => (s + root) % 12))
      let inSet = 0
      let total = 0
      for (const n of notes) {
        total += n.weight
        if (set.has(((n.key % 12) + 12) % 12)) inSet += n.weight
      }
      const score = inSet / total
      if (!best || score > best.score) best = { emotion, root, inScale: score, notes: notes.length, score }
    }
  }
  return best ? { emotion: best.emotion, root: best.root, inScale: best.inScale, notes: best.notes } : null
}

function scaleDegrees(emotion: keyof typeof ESCALAS, root: number, pc: number): number[] {
  const scale = ESCALAS[emotion]
  return scale.map((s, i) => [((s + root) % 12 + 12) % 12, i + 1]).filter(([p]) => p === pc).map(([, d]) => d)
}

/** Versión comprimida de la progresión: grados por compás, sin repetidos, primer núcleo. */
function extractProgression(
  chords: { position: number; length: number; key: number }[],
  ppq: number,
  emotion: keyof typeof ESCALAS,
  root: number,
): Progression | null {
  const barTicks = ppq * 4
  const eff = (c: { length: number }) => c.length || ppq / 4
  const byBar = new Map<number, Set<number>>()
  let lastBar = 0
  for (const c of chords) {
    const b = Math.floor(c.position / barTicks)
    lastBar = Math.max(lastBar, b)
    if (!byBar.has(b)) byBar.set(b, new Set())
    byBar.get(b)!.add(((c.key % 12) + 12) % 12)
  }
  const degs: number[] = []
  for (let b = 0; b <= lastBar; b++) {
    const pcs = byBar.get(b)
    if (!pcs || pcs.size < 2) {
      degs.push(0)
      continue
    }
    // Grado del acorde = el que más notas del compás cubre desde su tríada.
    let best = { degree: 0, hits: 0 }
    const scale = ESCALAS[emotion]
    for (let d = 0; d < scale.length; d++) {
      const tones = new Set([0, 2, 4].map((k) => ((scale[(d + k) % scale.length] + root) % 12 + 12) % 12))
      let hits = 0
      for (const pc of pcs) if (tones.has(pc)) hits++
      if (hits > best.hits) best = { degree: d + 1, hits }
    }
    degs.push(best.hits >= 2 ? best.degree : 0)
  }
  const sig = degs.filter((d) => d !== 0)
  if (sig.length < 2) return null
  // Compactar núcleo: primer ciclo repetido (hasta 8 compases).
  let core: number[] = sig
  for (let period = 1; period <= Math.min(8, sig.length); period++) {
    const candidate = sig.slice(0, period)
    const repeats = Math.floor(sig.length / period)
    if (repeats >= 2) {
      let match = true
      for (let i = 0; i < period * repeats; i++) if (sig[i] !== candidate[i % period]) { match = false; break }
      if (match) { core = candidate; break }
    }
  }
  const unique = core.filter((d, i, a) => i === 0 || d !== a[i - 1])
  const loop = unique.length > 1 ? unique : core.slice(0, 4)
  const match = matchRule(loop)
  return { sig: loop, matchedRule: match }
}

function matchRule(loop: number[]): string | null {
  const allRules: { key: string; prog: number[] }[] = []
  for (const [emotion, p] of Object.entries(PROGRESIONES)) {
    allRules.push({ key: `${emotion}:${p.principal.join('.')}`, prog: p.principal })
    allRules.push({ key: `${emotion}:${p.alternativa.join('.')}`, prog: p.alternativa })
    for (const r of p.reales ?? [])
      allRules.push({ key: `${emotion}:${r.join('.')}`, prog: r })
  }
  for (const r of allRules) {
    if (r.prog.length > loop.length) continue
    // Progresión contenida como ciclo (rotaciones) dentro del loop.
    const doubled = [...loop, ...loop]
    for (let i = 0; i < loop.length; i++) {
      let match = true
      for (let j = 0; j < r.prog.length; j++) if (doubled[i + j] !== r.prog[j]) { match = false; break }
      if (match) return r.key
    }
  }
  return null
}

function sinceMs(): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--since='))
  if (!arg) return new Date('2024-01-01T00:00:00').getTime()
  const d = new Date(arg.slice('--since='.length))
  return Number.isNaN(d.getTime()) ? new Date('2024-01-01T00:00:00').getTime() : d.getTime()
}

function main(): void {
  const rootArg = process.argv.slice(2).find((a) => !a.startsWith('--since=') && !a.startsWith('--'))
  const root = rootArg ? resolve(rootArg) : resolve('dataset_flp')
  const since = sinceMs()
  let files = collectFlpFiles(root)
  const seen = new Set<string>()
  files = files.filter((f) => {
    const st = statSync(f)
    const k = `${f.toLowerCase().split(/[\\/]/).pop()}__${st.size}`
    if (seen.has(k)) return false
    seen.add(k)
    return st.mtimeMs >= since
  })
  console.log(`VALIDACIÓN (>= 2024): ${files.length} proyectos únicos en ${root}`)

  const refs: { file: string; emotion: string; rootName: string; inScale: number; progression: number[]; rule: string; tempo: number; bars: number; genre: string }[] = []
  const scalePass = []
  const ruleCount = new Map<string, number>()
  const notesByGenre: Record<string, number[]> = {}
  const bassByGenre: Record<string, number[]> = {}

  for (const file of files) {
    try {
      const parsed = parseFlp(file, readFileSync(file))
      const st = statSync(file)
      const modified = new Date(st.mtimeMs).toISOString()
      const split = splitNotesByRole(parsed)
      const weighted = [
        ...split.bass.map((n) => ({ key: n.key, weight: 3 })),
        ...split.chords.map((n) => ({ key: n.key, weight: 2 })),
        ...split.lead.map((n) => ({ key: n.key, weight: 1 })),
      ]
      if (weighted.length < 4) {
        console.log(`  – ${file} (sin suficiente armonía)`)
        continue
      }
      const det = detectBestScale(weighted)!
      const prog = extractProgression(split.chords, parsed.ppq, det.emotion, det.root)
      const scaleOk = det.inScale >= MIN_IN_SCALE
      const progOk = prog != null && prog.matchedRule != null

      const rootName = ROOTS[((det.root % 12) + 12) % 12]
      const genre = file.toLowerCase().includes('trap') ? 'trap'
        : file.toLowerCase().includes('rap') ? 'rap'
        : file.toLowerCase().includes('plug') ? 'plug'
        : file.toLowerCase().includes('detroit') ? 'detroit'
        : file.toLowerCase().includes('reggae') || file.toLowerCase().includes('perreo') || file.toLowerCase().includes('dembow') ? 'reggaeton'
        : 'otros'
      ;(notesByGenre[genre] ??= []).push(...split.chords.map((n) => n.key), ...split.lead.map((n) => n.key), ...split.bass.map((n) => n.key))
      bassByGenre[genre] ??= []
      ;(bassByGenre[genre]!).push(...split.bass.map((n) => n.key))

      const flag = scaleOk && progOk ? '✓' : scaleOk ? '·' : '✗'
      console.log(
        `  ${flag} ${file.split(/[\\/]/).pop()}`,
        `— ${det.emotion} ${rootName}`,
        `in-scale ${(det.inScale * 100).toFixed(0)}%`,
        prog ? `prog [${prog.sig.join('-')}] ${prog.matchedRule ?? ''}` : 'sin acordes',
        `· ${modified.slice(0, 10)}`,
      )
      if (scaleOk) scalePass.push(file)
      if (scaleOk && progOk && prog.matchedRule) {
        refs.push({ file, emotion: det.emotion, rootName, inScale: det.inScale, progression: prog.sig, rule: prog.matchedRule, tempo: parsed.tempo, bars: Math.ceil(Math.max(...parsed.notes.map((n) => n.position + (n.length || parsed.ppq / 4)), 1) / (parsed.ppq * 4)) || 1, genre })
        ruleCount.set(prog.matchedRule, (ruleCount.get(prog.matchedRule) ?? 0) + 1)
      }
    } catch (e) {
      console.warn(`  ✗ ${file}: ${String(e)}`)
    }
  }

  console.log(`\nRESULTADO — ${files.length} evaluados`)
  console.log(`  Cumplen regla de ESCALA (>= ${(MIN_IN_SCALE * 100).toFixed(0)}% in-scale): ${scalePass.length}`)
  console.log(`  Cumplen ESCALA + PROGRESIÓN (referencias): ${refs.length}`)

  console.log('\n  Progresiones del motor más presentes:')
  const sorted = [...ruleCount.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) console.log('    (ninguna coincidencia aún)')
  for (const [rule, count] of sorted.slice(0, 12)) {
    console.log(`    ${rule} × ${count}`)
  }

  console.log('\n  Referencias (top 20):')
  for (const r of refs.slice(0, 20)) console.log(`    ${r.emotion} ${r.rootName} [${r.progression.join('-')}] ${r.rule} · ${r.tempo} BPM · ${r.bars} compases · ${r.file}`)

  const range = (arr: number[]) =>
    arr.length ? { min: Math.min(...arr), max: Math.max(...arr), avg: arr.reduce((a, b) => a + b, 0) / arr.length } : null
  const genres = Object.fromEntries(
    Object.entries(bassByGenre).map(([g, arr]) => [g, { bass: range(arr), melodic: range(notesByGenre[g] ?? []) }]),
  )

  writeFileSync(
    join(process.cwd(), 'learned_flp_rules.json'),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        filter: 'desde 2024',
        evaluated: files.length,
        scaleRulePassed: scalePass.length,
        references: refs.length,
        matchedProgressions: Object.fromEntries(sorted),
        referencesDetails: refs,
        genreStats: genres,
      },
      null,
      2,
    ),
  )
  console.log('\nEscrito learned_flp_rules.json')
}

main()