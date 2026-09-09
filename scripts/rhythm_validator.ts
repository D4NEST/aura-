/**
 * URA Rhythmic Engine Validator & Genre Consistency Checker.
 *
 * Uso:
 *   npx tsx scripts/rhythm_validator.ts [--flp=<root>]
 *     - Sin argumentos: valida los patrones del motor (DRUM_PATTERNS de
 *       src/core/constants.ts) contra genres_config (métrica estética).
 *     - Con --flp=<root>: además barre proyectos .flp reales y clasifica su
 *       métrica (BPM, snare 1/16, hat, bajo) contra el mismo config.
 *   Escribe learned_rhythm.json cuando hay barrido. NUNCA modifica los .flp.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DRUM_PATTERNS, MOODS_PER_GENRE } from '../src/core/constants'
import type { FlpProject } from './flp_parse'
import { parseFlp } from './flp_parse'
import { classifyChannel, collectFlpFiles, drumFamilyOf } from './flp_analysis'

type TimeMode = 'DOUBLE_TIME' | 'REAL_TIME' | 'HYBRID_DOUBLE_TIME' | 'AGGRESSIVE_DOUBLE_TIME'
type BassType = 'SUB_808_LONG_GLIDE' | 'SAMPLED_BASS_OR_SHORT_808' | 'ZAYTOVEN_808_OR_SQUARE_SYNTH' | 'FM_SYNTH_DONK_BASS' | 'SUB_SYNTH_OR_MARRONEA_808'

interface GenreMetricConfig {
  bpm_range: [number, number]
  time_mode: TimeMode
  effective_feeling_bpm: [number, number]
  snare_step_positions_16th: number[]
  kick_step_positions_16th: number[]
  hihat_subdivision: string
  hat_occupancy_range: [number, number]
  bass_type: BassType
  tags: string[]
}

export const GENRES_CONFIG: Record<string, GenreMetricConfig> = {
  trap: {
    bpm_range: [110, 160],
    time_mode: 'DOUBLE_TIME',
    effective_feeling_bpm: [55, 80],
    snare_step_positions_16th: [9],
    kick_step_positions_16th: [1, 5, 9, 13],
    hihat_subdivision: '1/32_AND_TRIPLETS',
    hat_occupancy_range: [12, 16],
    bass_type: 'SUB_808_LONG_GLIDE',
    tags: ['808', 'hi-hats', 'oscuro'],
  },
  rap: {
    bpm_range: [80, 98],
    time_mode: 'REAL_TIME',
    effective_feeling_bpm: [80, 98],
    snare_step_positions_16th: [5, 13],
    kick_step_positions_16th: [1, 5, 9, 13],
    hihat_subdivision: '1/8_AND_1/16_HUMAN_SWING',
    hat_occupancy_range: [8, 12],
    bass_type: 'SAMPLED_BASS_OR_SHORT_808',
    tags: ['flow', 'boombap', 'clásico'],
  },
  plug: {
    bpm_range: [115, 130],
    time_mode: 'HYBRID_DOUBLE_TIME',
    effective_feeling_bpm: [57, 65],
    snare_step_positions_16th: [9],
    kick_step_positions_16th: [1, 5, 9, 13],
    hihat_subdivision: '1/16_SPARSE_ROLLS',
    hat_occupancy_range: [4, 8],
    bass_type: 'ZAYTOVEN_808_OR_SQUARE_SYNTH',
    tags: ['vintage', 'air', 'sensual'],
  },
  detroit: {
    bpm_range: [160, 200],
    time_mode: 'AGGRESSIVE_DOUBLE_TIME',
    effective_feeling_bpm: [80, 100],
    snare_step_positions_16th: [9],
    kick_step_positions_16th: [1, 5, 9, 13],
    hihat_subdivision: '1/16_OFFBEAT_CLAPS_AND_FAST_HATS',
    hat_occupancy_range: [8, 14],
    bass_type: 'FM_SYNTH_DONK_BASS',
    tags: ['sintetizadores', 'crudo', 'mecánico'],
  },
  reggaeton: {
    bpm_range: [88, 96],
    time_mode: 'REAL_TIME',
    effective_feeling_bpm: [88, 96],
    snare_step_positions_16th: [4, 7, 12, 15],
    kick_step_positions_16th: [1, 5, 9, 13],
    hihat_subdivision: '1/8_MINIMAL_SHAKER',
    hat_occupancy_range: [4, 6],
    bass_type: 'SUB_SYNTH_OR_MARRONEA_808',
    tags: ['dembow', 'tropical', 'perreo'],
  },
}

export function perceivedBpmOf(bpm: number, mode: TimeMode): number {
  return mode === 'REAL_TIME' ? bpm : bpm / 2
}

export function positionsOf(pattern: number[]): number[] {
  // índice 0-based del grid 1/16 → paso 1-based (x = i+1)
  return pattern.map((v, i) => (v > 0 ? i + 1 : 0)).filter(Boolean)
}

export function coverage(actual: number[], expected: number[]): number {
  if (expected.length === 0) return 1
  const setA = new Set(actual)
  return expected.filter((p) => setA.has(p)).length / expected.length
}

export function precision(actual: number[], expected: number[]): number {
  if (actual.length === 0) return 0
  const setE = new Set(expected)
  return actual.filter((p) => setE.has(p)).length / actual.length
}

/** Densidad de hi-hat: posición ocupada del grid 1/16 (0..16). */
export function hatOccupancy(hatPattern: number[]): number {
  return hatPattern.filter((v) => v > 0).length
}

export function hatSubdivisionName(occ: number): string {
  if (occ >= 13) return 'Denso (1/16 continuo o más)'
  if (occ >= 9) return 'Medio (1/16 con gaps)'
  if (occ >= 5) return 'Rol 1/8 con acentos'
  return 'Minimal (1/8 o menos)'
}

export interface GenreReport {
  genre: string
  engine_bpm: number
  config_bpm_range: [number, number]
  bpm_in_range: boolean
  engine_snare: number[]
  config_snare: number[]
  snare_coverage: number
  snare_precision: number
  engine_hat_occupancy: number
  hat_describe: string
  config_hat: string
  engine_kick: number[]
  config_kick: number[]
  kick_coverage: number
  perceived_bpm: number
  is_coherent: boolean
  engine_adjustments: string[]
}

export function engineTempoOf(genre: string): number {
  const moods = MOODS_PER_GENRE[genre as keyof typeof MOODS_PER_GENRE] ?? []
  if (moods.length === 0) return 0
  return Math.round(moods.reduce((a, m) => a + m.tempo, 0) / moods.length)
}

export function validateEngineGenre(genre: string): GenreReport {
  const cfg = GENRES_CONFIG[genre]
  const patterns = DRUM_PATTERNS[genre as keyof typeof DRUM_PATTERNS] ?? DRUM_PATTERNS.trap
  const snare = positionsOf(patterns.snare)
  const kick = positionsOf(patterns.kick)
  const hatOcc = hatOccupancy(patterns.hat)
  const bpm = engineTempoOf(genre)
  const covSnare = coverage(snare, cfg.snare_step_positions_16th)
  const precSnare = precision(snare, cfg.snare_step_positions_16th)
  const covKick = coverage(kick, cfg.kick_step_positions_16th)
  const bpmOk = bpm >= cfg.bpm_range[0] && bpm <= cfg.bpm_range[1]

  const adjustments: string[] = []
  if (!bpmOk) {
    adjustments.push(
      `BPM fuera de rango [${cfg.bpm_range[0]}–${cfg.bpm_range[1]}]: motor usa ${bpm} → en ${cfg.time_mode.toLowerCase().replace(/_/g, ' ')} el pulso percibido es ${perceivedBpmOf(bpm, cfg.time_mode)}. ${cfg.time_mode === 'REAL_TIME' ? 'Divide el tempo (o mueve el snare) para entrar en rango.' : 'Ajusta tempo del mood o reinterpreta como half-time.'}`,
    )
  }
  if (covSnare < 0.6) {
    adjustments.push(
      `Snare en pasos ${snare.join(', ')} (esperado ${cfg.snare_step_positions_16th.join(', ')}): cobertura ${Math.round(covSnare * 100)}%. Reposiciona la caja.`,
    )
  }
  if (covKick < 0.6) {
    adjustments.push(
      `Kick en pasos ${kick.join(', ')} (esperado ${cfg.kick_step_positions_16th.join(', ')}): cobertura ${Math.round(covKick * 100)}%. Re-cuantiza el bombo.`,
    )
  }
  const hatOk = hatOcc >= cfg.hat_occupancy_range[0] && hatOcc <= cfg.hat_occupancy_range[1]

  if (!hatOk) {
    adjustments.push(
      `Hi-hats ocupación ${hatOcc}/16 (${hatSubdivisionName(hatOcc)}) vs config ${cfg.hihat_subdivision} (rango ${cfg.hat_occupancy_range.join('–')}). Ajusta densidad/subdivisión.`,
    )
  }

  const isCoherent = bpmOk && covSnare >= 0.6 && covKick >= 0.5 && hatOk

  return {
    genre,
    engine_bpm: bpm,
    config_bpm_range: cfg.bpm_range,
    bpm_in_range: bpmOk,
    engine_snare: snare,
    config_snare: cfg.snare_step_positions_16th,
    snare_coverage: Number(covSnare.toFixed(2)),
    snare_precision: Number(precSnare.toFixed(2)),
    engine_hat_occupancy: hatOcc,
    hat_describe: hatSubdivisionName(hatOcc),
    config_hat: cfg.hihat_subdivision,
    engine_kick: kick,
    config_kick: cfg.kick_step_positions_16th,
    kick_coverage: Number(covKick.toFixed(2)),
    perceived_bpm: perceivedBpmOf(bpm, cfg.time_mode),
    is_coherent: isCoherent,
    engine_adjustments: adjustments,
  }
}

export function validateEngine(): GenreReport[] {
  return Object.keys(GENRES_CONFIG).map(validateEngineGenre)
}

// ---------------------------------------------------------------------------
// Barrido del catálogo (.flp)
// ---------------------------------------------------------------------------

interface FamilyGrid {
  kick: number[]
  snare: number[]
  hat: number[]
  perc: number[]
}

export function familyGrids(p: FlpProject): FamilyGrid {
  const grid: FamilyGrid = { kick: new Array(16).fill(0), snare: new Array(16).fill(0), hat: new Array(16).fill(0), perc: new Array(16).fill(0) }
  const notesByChannel = new Map<number, typeof p.notes>()
  for (const n of p.notes) {
    const list = notesByChannel.get(n.rackChannel) ?? []
    list.push(n)
    notesByChannel.set(n.rackChannel, list)
  }
  const barTicks = p.ppq * 4
  const stepTicks = p.ppq / 4
  for (const ch of p.channels.values()) {
    const notes = notesByChannel.get(ch.iid) ?? []
    if (notes.length === 0) continue
    const family = drumFamilyOf(ch)
    if (family === 'other') continue
    const target = grid[family === 'kick' ? 'kick' : family === 'snare' ? 'snare' : family === 'hat' ? 'hat' : 'perc']
    for (const n of notes) {
      const step = Math.floor((n.position % barTicks) / stepTicks)
      if (step >= 0 && step < 16) target[step]++
    }
  }
  return grid
}

export function significantSteps(grid: number[]): number[] {
  const max = Math.max(...grid, 1)
  const threshold = Math.max(1, Math.round(max * 0.3))
  return grid.map((v, i) => (v >= threshold ? i + 1 : 0)).filter(Boolean)
}

interface FlpBassStat {
  count: number
  avgKey: number
  avgSixteenths: number
  describe: string
}

function bassStat(p: FlpProject): FlpBassStat | null {
  const notesByChannel = new Map<number, typeof p.notes>()
  for (const n of p.notes) {
    const list = notesByChannel.get(n.rackChannel) ?? []
    list.push(n)
    notesByChannel.set(n.rackChannel, list)
  }
  const bass: typeof p.notes = []
  for (const ch of p.channels.values()) {
    const notes = notesByChannel.get(ch.iid) ?? []
    if (notes.length === 0) continue
    if (classifyChannel(ch, notes) === 'bass') bass.push(...notes)
  }
  if (bass.length === 0) return null
  const avgKey = bass.reduce((a, n) => a + n.key, 0) / bass.length
  const avgLen = bass.reduce((a, n) => a + n.length, 0) / bass.length
  const avgSixteenths = (avgLen / (p.ppq / 4))
  const describe =
    avgKey <= 38 && avgSixteenths >= 2
      ? 'SUB_808_LONG_GLIDE'
      : avgKey <= 38
        ? 'SUB_808_SHORT'
        : 'SAMPLED_ORGANIC'
  return { count: bass.length, avgKey: Number(avgKey.toFixed(1)), avgSixteenths: Number(avgSixteenths.toFixed(2)), describe }
}

export interface FlpRhythmReport {
  file: string
  folder_genre: string
  bpm: number
  snare_steps: number[]
  kick_steps: number[]
  hat_occupancy: number
  hat_subdivision: string
  bass: FlpBassStat | null
  detected_genre: string
  is_coherent: boolean
  perceived_bpm: number
  engine_adjustments: string[]
}

export function detectGenre(r: Omit<FlpRhythmReport, 'detected_genre' | 'is_coherent' | 'perceived_bpm' | 'engine_adjustments'>): { genre: string; coherence: boolean; perceived: number; adjustments: string[] } {
  let best: { genre: string; score: number; cov: number; bpmOk: boolean } = { genre: '', score: -1, cov: 0, bpmOk: false }
  const hatOcc = r.hat_occupancy
  const bass = r.bass
  for (const [genre, cfg] of Object.entries(GENRES_CONFIG)) {
    const covSnare = coverage(r.snare_steps, cfg.snare_step_positions_16th)
    const precSnare = precision(r.snare_steps, cfg.snare_step_positions_16th)
    const covKick = coverage(r.kick_steps, cfg.kick_step_positions_16th)
    const bpmOk = r.bpm >= cfg.bpm_range[0] && r.bpm <= cfg.bpm_range[1]
    let bonus = 0
    if (genre === 'detroit' && r.snare_steps.length > 0 && r.snare_steps.some((s) => s % 2 === 0)) bonus += 0.04
    if (genre === 'plug' && hatOcc <= 9) bonus += 0.06
    if (genre === 'plug' && bass && bass.avgKey > 38) bonus += 0.03
    if (genre === 'trap' && hatOcc >= 10) bonus += 0.04
    if (genre === 'detroit' && hatOcc >= 5) bonus += 0.03
    if (genre === 'reggaeton' && hatOcc <= 8) bonus += 0.04
    const score = covSnare * 0.45 + precSnare * 0.2 + (bpmOk ? 0.2 : 0) + covKick * 0.1 + bonus
    if (score > best.score) best = { genre, score, cov: covSnare, bpmOk }
  }
  const cfg = GENRES_CONFIG[best.genre]
  const perceived = perceivedBpmOf(r.bpm, cfg.time_mode)
  const coherent = best.cov >= 0.6 && best.bpmOk
  const adjustments: string[] = []
  if (!coherent) {
    adjustments.push(
      `Detectado como ${best.genre} pero incoherente: BPM ${r.bpm}${best.bpmOk ? '' : ` fuera de [${cfg.bpm_range[0]}–${cfg.bpm_range[1]}]`}, snare ${r.snare_steps.join(', ') || '—'} vs config [${cfg.snare_step_positions_16th.join(', ')}].`,
    )
    if (!best.bpmOk && cfg.time_mode !== 'REAL_TIME') {
      adjustments.push(`Sugerido: aplicar ${cfg.time_mode.toLowerCase()} → sensación ${Math.round(perceived)} BPM.`)
    }
    if (best.cov < 0.6 && r.snare_steps.length > 0) {
      adjustments.push(`Re-cuantizar snare a pasos ${cfg.snare_step_positions_16th.join(', ')} (caja en ${[...new Set(cfg.snare_step_positions_16th.filter((s) => r.snare_steps.includes(s)))]} ya presente).`)
    }
  }
  return { genre: best.genre, coherence: coherent, perceived: Math.round(perceived), adjustments }
}

export function sweepCatalog(root: string): FlpRhythmReport[] {
  const files = collectFlpFiles(root)
  const reports: FlpRhythmReport[] = []
  for (const file of files) {
    try {
      const size = statSync(file).size
      const p = parseFlp(file, readFileSync(file))
      const grids = familyGrids(p)
      const snareSteps = significantSteps(grids.snare)
      const kickSteps = significantSteps(grids.kick)
      const hatOcc = hatOccupancy(grids.hat)
      const bass = bassStat(p)
      const folder = file.split(/[\\/]/).filter((s) => s).reverse().slice(1).find((s) => {
        const l = s.toLowerCase()
        return Object.keys(GENRES_CONFIG).some((g) => l.includes(g))
      }) ?? 'otros'
      const base: Omit<FlpRhythmReport, 'detected_genre' | 'is_coherent' | 'perceived_bpm' | 'engine_adjustments'> = {
        file,
        folder_genre: folder,
        bpm: Math.round(p.tempo),
        snare_steps: snareSteps,
        kick_steps: kickSteps,
        hat_occupancy: hatOcc,
        hat_subdivision: hatSubdivisionName(hatOcc),
        bass,
      }
      const verdict = detectGenre(base)
      reports.push({
        ...base,
        detected_genre: verdict.genre,
        is_coherent: verdict.coherence,
        perceived_bpm: verdict.perceived,
        engine_adjustments: verdict.adjustments,
      })
      if (reports.length % 50 === 0 || reports.length === files.length) {
        process.stdout.write(`\ranalizados ${reports.length}/${files.length}`)
      }
    } catch {
      // proyectos corruptos o con estructuras no soportadas: se omiten
    }
  }
  process.stdout.write('\n')
  return reports
}

function main(): void {
  const flpArg = process.argv.slice(2).find((a) => a.startsWith('--flp='))
  const positional = process.argv.slice(2).find((a) => !a.startsWith('--'))
  const root = flpArg ? flpArg.slice('--flp='.length) : positional

  const engine = validateEngine()

  console.log('=== VALIDADOR RÍTMICO AURA: patrón del motor vs estética ===\n')
  for (const r of engine) {
    console.log(`[${r.genre.toUpperCase()}] ${r.is_coherent ? 'COHERENTE' : 'incoherente → ajustar'}`)
    console.log(`  BPM motor ${r.engine_bpm} (rango ${r.config_bpm_range.join('–')}) · percibido ${r.perceived_bpm} · kick ${r.engine_kick.join(',')} (cov ${r.kick_coverage}) · snare ${r.engine_snare.join(',')} (cov ${r.snare_coverage}) · hats ${r.hat_describe}`)
    for (const a of r.engine_adjustments) console.log(`  ✎ ${a}`)
    console.log('')
  }

  if (root) {
    const absRoot = resolve(root)
    console.log(`=== BARRIDO CATÁLOGO: ${absRoot} ===\n`)
    const reports = sweepCatalog(absRoot)
    const byGenre = new Map<string, FlpRhythmReport[]>()
    for (const r of reports) {
      const key = Object.keys(GENRES_CONFIG).includes(r.detected_genre) ? r.detected_genre : 'otros'
      const list = byGenre.get(key) ?? []
      list.push(r)
      byGenre.set(key, list)
    }
    const summary: Record<string, unknown> = {}
    let coherentTotal = 0
    for (const [genre, list] of byGenre) {
      const coherent = list.filter((r) => r.is_coherent).length
      coherentTotal += coherent
      const avgBpm = Math.round(list.reduce((a, r) => a + r.bpm, 0) / list.length)
      const perceived = Math.round(list.reduce((a, r) => a + r.perceived_bpm, 0) / list.length)
      const snareHist: Record<number, number> = {}
      for (const r of list) for (const s of r.snare_steps) snareHist[s] = (snareHist[s] ?? 0) + 1
      console.log(
        `[${genre.toUpperCase()}] ${list.length} proyectos · coherentes ${coherent} (${Math.round((100 * coherent) / list.length)}%) · BPM medio ${avgBpm} · percibido medio ${perceived} · hits snare ${Object.entries(snareHist).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join(' ')}`,
      )
      summary[genre] = {
        files: list.length,
        coherent,
        coherent_pct: Number(((100 * coherent) / list.length).toFixed(1)),
        avg_bpm: avgBpm,
        avg_perceived_bpm: perceived,
        snare_histogram: snareHist,
      }
    }
    writeFileSync('learned_rhythm.json', JSON.stringify({ generated: new Date().toISOString(), engine: engine.map((e) => ({ genre: e.genre, is_coherent: e.is_coherent, engine_adjustments: e.engine_adjustments })), catalog: summary, total_files: reports.length, total_coherent: coherentTotal }, null, 2))
    console.log(`\nTotal: ${reports.length} proyectos · coherentes ${coherentTotal} · learned_rhythm.json escrito`)
  }
}

main()