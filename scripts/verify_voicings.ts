import { generateSong } from '../src/core/index'
import type { Section } from '../src/core/index'

const estructura: Section[] = [
  { name: 'intro', emotion: 'nostalgia', genre: 'trap', bars: 4 },
  { name: 'verso_1', emotion: 'tristeza', genre: 'trap', bars: 8 },
  { name: 'coro', emotion: 'ira', genre: 'detroit', bars: 8 },
  { name: 'puente', emotion: 'decepcion', genre: 'plug', bars: 4 },
  { name: 'outro', emotion: 'amor', genre: 'rap', bars: 4 },
]

let minChord = Infinity
let maxChord = -Infinity
let minBass = Infinity
let maxBass = -Infinity
const spans: number[] = []

for (let k = 0; k < 40; k++) {
  const song = generateSong(estructura, 'F#', 120, 480)
  const chords = song.tracks[0].notes
  const bass = song.tracks[1].notes
  let groupStart = -1
  let group: number[] = []
  const flush = () => {
    if (group.length > 0) {
      const s = Math.max(...group) - Math.min(...group)
      spans.push(s)
      for (const n of group) {
        if (n < minChord) minChord = n
        if (n > maxChord) maxChord = n
      }
    }
  }
  for (let i = 0; i < chords.length; i++) {
    if (groupStart < 0 || chords[i].tick - groupStart > 100) {
      flush()
      groupStart = chords[i].tick
      group = [chords[i].note]
    } else {
      group.push(chords[i].note)
    }
  }
  flush()
  for (const n of bass) {
    if (n.note < minBass) minBass = n.note
    if (n.note > maxBass) maxBass = n.note
  }
}

const avgSpan = spans.reduce((a, b) => a + b, 0) / spans.length
const maxSpan = Math.max(...spans)
console.log(`Chords notas: ${minChord}..${maxChord} (previo esperado ~42..72)`)
console.log(`Span medio por acorde: ${avgSpan.toFixed(1)} semitonos | max ${maxSpan}`)
console.log(`Bass notas: ${minBass}..${maxBass}`)
console.log(`OK si maxChord <= 72 y maxSpan <= 21 (VOICE_SPAN)`)
