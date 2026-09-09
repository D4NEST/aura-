import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSong, buildSongMidi, buildStemMidi } from '../src/core/index'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.tmp-verify')
mkdirSync(outDir, { recursive: true })

const estructura = [
  { name: 'intro', emotion: 'nostalgia', genre: 'trap', bars: 4 },
  { name: 'verso_1', emotion: 'tristeza', genre: 'trap', bars: 8 },
  { name: 'coro', emotion: 'ira', genre: 'detroit', bars: 8 },
  { name: 'puente', emotion: 'decepcion', genre: 'plug', bars: 4 },
  { name: 'outro', emotion: 'amor', genre: 'rap', bars: 4 },
] as const

const rootKey = 'F#'
const tempo = 144
const song = generateSong([...estructura], rootKey, tempo, 480)

const full = buildSongMidi(song, tempo)
writeFileSync(path.join(outDir, 'AURA_native_js_full.mid'), full)

for (const track of song.tracks) {
  const stem = buildStemMidi(track, song, tempo)
  const key = track.name.match(/^(\w+)/)?.[1]?.toLowerCase() ?? 'track'
  writeFileSync(path.join(outDir, `AURA_native_js_${key}.mid`), stem)
}

console.log('tracks:', song.tracks.map((t) => [t.name, t.notes.length]))
console.log('totalBars:', song.totalBars, '| totalTicks:', song.totalTicks)
console.log('duración (s):', (song.totalTicks / song.ticksPerBeat) / (tempo / 60))
console.log('bytes full:', full.byteLength, '| archivos en', outDir)