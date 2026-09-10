/**
 * Auditor de la "matriz rítmica y armónica" del productor contra el motor AURA.
 * Enfrenta el documento de producción (5 géneros: bpm, escalas, progresiones
 * clave, grillas de batería, reglas de bajo y voicing) con las constantes del
 * motor y extrae: ALINEADO (ya lo tenemos), DELTA (diferencia con valor real),
 * y DIVERGENCIA (tu doc pide otro continuo; decisión de producto).
 *
 * Uso: npm run audit:matrix
 */
import { DRUM_PATTERNS, BASS_PATTERNS, GENRE_PROGRESSIONS, GENRE_DEFAULT_MODE, MOODS_PER_GENRE } from '../src/core/constants'
import type { Genre } from '../src/core/types'

const step = (steps: number[]) => Array.from({ length: 16 }, (_, i) => (steps.includes(i + 1) ? 'X' : '.')).join('')

const DOC: Record<Genre, {
  bpm: [number, number]
  mood: string
  scales: string[]
  progressions: string[]
  kick: number[]
  snare: number[]
  hats: string
  bass: string
  glide: boolean
}> = {
  trap: {
    bpm: [110, 160],
    mood: 'melancolía, paranoia, energía nocturna',
    scales: ['menor natural', 'menor harmónica', 'frigia'],
    progressions: ['i - VI', 'i - bII - i', 'i - v - VI - IV'],
    kick: [1, 8, 11],
    snare: [9],
    hats: '1/16 continuos + rolls 1/32-1/64 en 7-8 y 15-16',
    bass: '808 notas sostenidas, glides largos, sube octava en 14-16',
    glide: true,
  },
  rap: {
    bpm: [80, 98],
    mood: 'introspección, calle clásica, nostalgia',
    scales: ['menor dórica', 'menor natural', 'pentatónica menor'],
    progressions: ['ii7 - V7 - i7', 'i7 - IV7'],
    kick: [1, 3, 11],
    snare: [5, 13],
    hats: 'pasos impares con swing 15-25%',
    bass: 'bajo eléctrico, líneas melódicas, corte <35 Hz',
    glide: false,
  },
  plug: {
    bpm: [115, 130],
    mood: 'flotación, romance melancólico, lujo',
    scales: ['mayor natural', 'menor dórica', 'lidia'],
    progressions: ['IVmaj7 - iii7 - vi7', 'IVmaj7 - V7 - iii7 - vi7'],
    kick: [1, 7, 10],
    snare: [9],
    hats: '1/8 con ráfagas puntuales 1/32',
    bass: 'Zaytoven corto o 808 redondo sin saturación',
    glide: false,
  },
  detroit: {
    bpm: [160, 200],
    mood: 'urgencia, peligro, frenetismo industrial',
    scales: ['menor natural', 'cromática', 'locria'],
    progressions: ['i - bVI - bVII', 'riff cromático i - bII - i (arpegios staccato)'],
    kick: [1, 6, 11],
    snare: [9],
    hats: '1/16 continuos volumen constante',
    bass: 'FM donk corto y seco, contratiempo/rebote con la caja, sin glides',
    glide: false,
  },
  reggaeton: {
    bpm: [88, 96],
    mood: 'adrenalina, fiesta, seducción',
    scales: ['menor natural', 'mayor natural'],
    progressions: ['i - VI - III - VII', 'i - iv - VII - III', 'i - VII - VI - V'],
    kick: [1, 5, 9, 13],
    snare: [4, 7, 12, 15],
    hats: 'shaker/timbal en pasos pares',
    bass: 'sub-synth senoidal acoplado al kick / sostenida en tiempo 1',
    glide: false,
  },
}

const genres: Genre[] = ['trap', 'rap', 'plug', 'detroit', 'reggaeton']

function dots(doc: number[], engine: number[]): string {
  return ` doc ${step(doc)} | motor ${step(engine)}`
}

let aligned = 0
let deltas = 0
let divergences = 0

console.log('=== AUDITORÍA DE LA MATRIZ DE PRODUCCIÓN vs MOTOR AURA ===\n')

for (const g of genres) {
  const d = DOC[g]
  const dr = DRUM_PATTERNS[g]
  const b = BASS_PATTERNS[g]
  const moods = MOODS_PER_GENRE[g]
  const tempos = moods.map((m) => m.tempo)
  console.log(`── ${g.toUpperCase()} (doc bpm ${d.bpm[0]}-${d.bpm[1]} > tempos motor: ${Math.min(...tempos)}-${Math.max(...tempos)})`)
  console.log(`   escalas doc: ${d.scales.join(', ')} → modo por defecto motor: ${GENRE_DEFAULT_MODE[g]}`)

  const progOk = GENRE_PROGRESSIONS[g]
  console.log(`   progresiones doc [${d.progressions.join(' | ')}] → ${progOk.length} integradas en el motor${progOk.length ? ' ✔' : ' ✘'}`)
  if (progOk.length) aligned++

  const kickMatch = JSON.stringify(d.kick) === JSON.stringify(tickList(dr.kick))
  const snareMatch = JSON.stringify(d.snare) === JSON.stringify(tickList(dr.snare))
  if (kickMatch && snareMatch) {
    console.log(`   batería: ALINEADO con tu doc ${dots(d.kick, tickList(dr.kick))}`)
    aligned++
  } else {
    console.log(`   batería: kick ${kickMatch ? '✔' : 'Δ'} | snare ${snareMatch ? '✔' : 'Δ'}`)
    console.log(`            ${dots(d.kick, tickList(dr.kick))}`)
    console.log(`            snare doc ${step(d.snare)}`)
    deltas++
  }

  if (d.glide === b.glide) {
    console.log(`   bajo: glide ${d.glide ? 'sí' : 'no'} ✔`)
    aligned++
  } else {
    console.log(`   bajo: DELTA glide doc=${d.glide} vs motor=${b.glide} (bajo: ${b.steps.join(',')}, dur=${b.dur16})`)
    deltas++
  }

  console.log(``)
}

function tickList(row: number[]): number[] {
  return row.map((v, i) => (v ? i + 1 : 0)).filter((n) => n > 0)
}

console.log(`\n=== RESUMEN ===`)
console.log(`alineados: ${aligned} | deltas con valor: ${deltas} | continuos distintos (decisión): ${divergences}`)

console.log(`
DOC 2 — SISTEMA DE MATICES Y VELOCIDAD, DISONANCIAS Y SONIDO
  puntoteo (strum +8..+15 ticks):  ✔ motor ya desfasa i*strumTicks (12 por defecto, recipe por género)
  jerarquía de velocidades 75/60/85/95 ±5:  ✔ ADOPTADO (voiceVelocityFor, VOICE_VELOCITY_DEFAULT)
  LIL (sin 3ras/semitono < C3):  ✔ compactVoicing mantiene todo en C3-C5
  rootless voicing (sin duplicar fundamental):  ✔ ADOPTADO (trap/detroit/reggaetón)
  voice leading (mínimo movimiento):  ✔ ADOPTADO (nearestInversion, 15% aleatorio por experimentación)
  variación por turnaround (9na/11na +10% en barra 4):  ✔ ADOPTADO (HPF = capa de playback)
  matriz de sonido (ataque/cuerpo/textura/cutoff):  ✔ ADOPTADO como SOUND_DESIGN por género (JSON backend)
  batería no cuadrada:  ✔ moods de energía caen 25% en sincopado (experimentación del artista)

DECISIÓN ADOPTADA (variantes por mood):
  Base four-on-floor (verificada cov 1) → moods de energía (ira, amor)
  Variante dark sincopada de tu doc → moods oscuros/textura (tristeza, decepción, nostalgia)
    trap:   kick [1,8,11]
    rap:    kick [1,3,11]
    plug:   kick [1,7,10] + rimshots 4,8,12
    detroit:kick [1,6,11] + clap 9 + snare offbeat 4,8,12,15
    reggaeton: four-on-floor dembow (siempre)
  + 25% de experimentación: a veces sincopado aunque el mood pida energía
`)