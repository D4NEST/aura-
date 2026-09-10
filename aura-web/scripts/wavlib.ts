/** Lector de WAV compartido (16/24/32-bit PCM y 32-bit float). */
import { readFileSync } from 'fs'

export interface Wav {
  sampleRate: number
  samples: Float32Array
}

export function readWav(path: string): Wav {
  const buf = readFileSync(path)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (buf.length < 44) throw new Error('WAV demasiado corto: ' + path)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('No es un WAV válido: ' + path)
  }

  let audioFormat = 1
  let channels = 1
  let sampleRate = 44100
  let bitsPerSample = 16
  let dataOffset = 44
  let dataLen = 0

  let offset = 12
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true)
      channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (id === 'data') {
      dataOffset = offset + 8
      dataLen = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (!dataLen) dataLen = buf.length - dataOffset
  const bytesPerSample = Math.max(1, bitsPerSample / 8)
  const perChannel = Math.floor(dataLen / bytesPerSample / channels)
  const mono = new Float32Array(perChannel)

  const readSample = (index: number): number => {
    if (audioFormat === 3) return view.getFloat32(dataOffset + index * bytesPerSample, true)
    if (bitsPerSample === 8) return (buf[dataOffset + index] - 128) / 128
    if (bitsPerSample === 16) return view.getInt16(dataOffset + index * 2, true) / 32768
    if (bitsPerSample === 24) {
      const b0 = buf[dataOffset + index * 3]
      const b1 = buf[dataOffset + index * 3 + 1]
      const b2 = buf[dataOffset + index * 3 + 2]
      const val = (b2 << 16) | (b1 << 8) | b0
      return val / 8388608
    }
    if (bitsPerSample === 32) return view.getInt32(dataOffset + index * 4, true) / 2147483648
    return 0
  }

  for (let i = 0; i < perChannel; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) sum += readSample(i * channels + c)
    mono[i] = sum / channels
  }
  return { sampleRate, samples: mono }
}