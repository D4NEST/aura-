/**
 * SINTETIZADOR DE LOOP DE PRUEBA (ground truth para el analizador).
 *
 * Mezcla los one-shots del banco (kick/snare/hat/perc) sobre una rejilla
 * CONOCIDA (el patrón real de reggaetón) y escribe un WAV. Así el
 * analizador de batería se mide contra la verdad absoluta, no contra un
 * loop mezclado de ground truth desconocido.
 *
 * Uso:
 *   npm run synth:test-loop
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import { readWav } from './wavlib'

const SAMPLE_RATE = 44100
const BPM = 92
const BARS = 4
const SEC_PER_BAR = (60 / BPM) * 4
const SEC_PER_16 = SEC_PER_BAR / 16
const TOTAL_SAMPLES = Math.floor(SEC_PER_BAR * BARS * SAMPLE_RATE)

interface Hit { step: number; file: string; gain: number }

// Patrón reggaetón del motor (ground truth):
const PATTERN: Hit[] = [
  ...[1, 5, 9, 13].map((s) => ({ step: s, file: 'kick.wav', gain: 0.9 })),
  ...[4, 7, 12, 15].map((s) => ({ step: s, file: 'snare.wav', gain: 0.55 })),
  ...[1, 3, 5, 7, 9, 11, 13, 15].map((s) => ({ step: s, file: 'hat.wav', gain: 0.4 })),
  { step: 13, file: 'openhat.wav', gain: 0.35 },
  { step: 3, file: 'perc.wav', gain: 0.3 },
]

function main(): void {
  const genre = process.argv.slice(2).find((a) => a.startsWith('--genre'))?.split('=')[1] ?? 'reggaeton'
  const dir = join('public/loops', genre)
  const mixed = new Float32Array(TOTAL_SAMPLES)
  let peak = 0

  for (let bar = 0; bar < BARS; bar++) {
    for (const hit of PATTERN) {
      const wav = readWav(join(dir, hit.file))
      const start = Math.floor((bar * SEC_PER_BAR + (hit.step - 1) * SEC_PER_16) * SAMPLE_RATE)
      for (let i = 0; i < wav.samples.length && start + i < TOTAL_SAMPLES; i++) {
        mixed[start + i] += wav.samples[i] * hit.gain
      }
    }
  }

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    if (Math.abs(mixed[i]) > peak) peak = Math.abs(mixed[i])
  }
  if (peak > 0.9) for (let i = 0; i < TOTAL_SAMPLES; i++) mixed[i] /= peak / 0.9

  const outPath = join('.tmp-verify', `synth_${genre}_${BPM}.wav`)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + TOTAL_SAMPLES * 2, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(TOTAL_SAMPLES * 2, 40)

  const pcm = Buffer.alloc(TOTAL_SAMPLES * 2)
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const s = Math.max(-1, Math.min(1, mixed[i]))
    pcm.writeInt16LE(Math.round(s * 32767), i * 2)
  }
  writeFileSync(outPath, Buffer.concat([header, pcm]))
  console.log(`loop sintético ${genre} @${BPM} → ${outPath} (${TOTAL_SAMPLES} muestras, ${BARS} compases)`)
}

main()