/**
 * Check del preset romantic_trap: validación contra la especificación del
 * productor (progresión, voicings, raíces de bajo y grilla). Imprime el
 * contenido real del motor para verificación audible/armónica.
 *
 * Uso: npm run preset:check [romantic_trap_mayor|romantic_trap_menor]
 */
import { PATTERN_PRESETS, MODE_SCALES, NOTE_OFFSETS, ROOTS } from '../src/core/constants'
import { generateSong } from '../src/core/song'
import type { Section } from '../src/core/types'

const NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const clip = NAME[0]

const which = process.argv[2] ?? 'romantic_trap_mayor'
const preset = PATTERN_PRESETS[which]
if (!preset) {
  console.error('Preset no encontrado. Opciones:', Object.keys(PATTERN_PRESETS).join(', '))
  process.exit(1)
}

const rootKey = preset.scaleMode === 'mayor' ? 'A' : 'A' // tonalidad A del productor
const rootOffset = NOTE_OFFSETS[rootKey]
const scale = MODE_SCALES[preset.scaleMode]
const noteName = (n: number) => `${NAME[n % 12]}${Math.floor((n - 12) / 12)}`

console.log(`=== PRESET ${which} ===`)
console.log(`género: ${preset.genre} · bpm: ${preset.bpm} · tonalidad A ${preset.scaleMode}`)

// Progresión → acordes por grado
const chords = preset.harmony.progression.map((deg, i) => {
  const root = 60 + rootOffset + scale[(deg - 1) % 7] + Math.floor((deg - 1) / 7) * 12
  const third = root + scale[(deg + 1) % 7] + Math.floor((deg + 1) / 7) * 12 - scale[(deg - 1) % 7] - Math.floor((deg - 1) / 7) * 12
  const fifth = root + scale[(deg + 3) % 7] + Math.floor((deg + 3) / 7) * 12 - scale[(deg - 1) % 7] - Math.floor((deg - 1) / 7) * 12
  const seventh = preset.harmony.addSeventh
    ? root + scale[(deg + 5) % 7] + Math.floor((deg + 5) / 7) * 12 - scale[(deg - 1) % 7] - Math.floor((deg - 1) / 7) * 12
    : null
  return { root: root % 12, name: `${noteName(root)}${preset.harmony.roman?.[i] ? '' : ''}`, third: third % 12, fifth: fifth % 12, seventh }
})
const roman = preset.harmony.roman ?? []
console.log(`progresión: ${preset.harmony.progression.join(' - ')} (${roman.join(' - ')})`)
chords.forEach((c, i) => {
  console.log(`  grado ${preset.harmony.progression[i]} → raíz en escala ${noteName(c.root)} (${roman[i] ?? c.name})`)
})

const bass = (preset.bass.notes as number[]) ?? []
console.log(`\nbajo (808, rootless exhibitado): ${bass.map((n) => noteName(n)).join(' ')} · glide: ${preset.bass.glide} · dur16: ${preset.bass.dur16}`)

const d = preset.drums
const row = (steps?: number[]) =>
  Array.from({ length: 16 }, (_, i) => (steps?.includes(i + 1) ? 'X' : '.')).join('')
if (d) {
  console.log(`\nbatería (128 bpm double time, percibido 64):`)
  console.log(`  kick   ${row(d.kick)}`)
  console.log(`  snare  ${row(d.snare)}`)
  console.log(`  hat    ${row(d.hat)} (1/8 + mini rolls 1/32 en ${d.open_hat?.join(', ') ?? '—'})`)
}

// Generar con el motor y reportar conteo real
const structure: Section[] = [
  { name: 'Intro', emotion: 'amor', genre: 'trap', bars: 4, role: 'intro' },
  { name: 'Coro', emotion: 'amor', genre: 'trap', bars: 8, role: 'coro' },
]
const song = generateSong(structure, rootKey, 128, 480, undefined, preset)
const drumsByRow = song.tracks.find((t) => t.name.startsWith('Drums'))
const kickSet = new Set<number>()
for (const n of drumsByRow?.notes ?? []) {
  if (n.note === 36) kickSet.add((n.tick % 1920) / 120 + 1)
}
console.log(`\nMOTOR: ${song.tracks.map((t) => `${t.name}: ${t.notes.length}`).join(' · ')}`)
console.log(`kicks del motor en el compás (patrón preset): ${[...kickSet].sort((a, b) => a - b).join(', ')}`)