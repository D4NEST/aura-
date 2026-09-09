import type { Note, SongResult, Track } from './types'

export function writeVarlen(value: number): Uint8Array {
  const buffer: number[] = []
  while (true) {
    let toWrite = value & 0x7f
    value >>= 7
    if (buffer.length > 0) toWrite |= 0x80
    buffer.unshift(toWrite)
    if (value === 0) break
  }
  return Uint8Array.from(buffer)
}

export function buildTrack(
  name: string,
  channel: number,
  program: number,
  notes: Note[],
  metaAtZero: Uint8Array[] = [],
): Uint8Array {
  const body: number[] = []

  const nameBytes = new TextEncoder().encode(name)
  body.push(0x00, 0xff, 0x03)
  body.push(...writeVarlen(nameBytes.length))
  body.push(...nameBytes)

  if (channel !== 9) {
    body.push(0x00, 0xc0 | (channel & 0x0f), program & 0x7f)
  }

  const events: { tick: number; bytes: number[] }[] = []
  for (const meta of metaAtZero) {
    events.push({ tick: 0, bytes: Array.from(meta) })
  }
  for (const n of notes) {
    events.push({
      tick: n.tick,
      bytes: [0x90 | (channel & 0x0f), n.note & 0x7f, n.velocity & 0x7f],
    })
    events.push({
      tick: n.tick + n.dur,
      bytes: [0x80 | (channel & 0x0f), n.note & 0x7f, 0x00],
    })
  }
  events.sort((a, b) => a.tick - b.tick)

  let lastTick = 0
  for (const ev of events) {
    const delta = ev.tick - lastTick
    body.push(...writeVarlen(delta))
    body.push(...ev.bytes)
    lastTick = ev.tick
  }

  body.push(0x00, 0xff, 0x2f, 0x00)

  const data = Uint8Array.from(body)
  const head = new Uint8Array(8)
  head.set([0x4d, 0x54, 0x72, 0x6b], 0) // MTrk
  const dv = new DataView(head.buffer)
  dv.setUint32(4, data.length, false)
  const out = new Uint8Array(8 + data.length)
  out.set(head, 0)
  out.set(data, 8)
  return out
}

export function buildHeader(format: number, tracks: number, ticksPerBeat: number): Uint8Array {
  const out = new Uint8Array(14)
  out.set([0x4d, 0x54, 0x68, 0x64], 0) // MThd
  const dv = new DataView(out.buffer)
  dv.setUint32(4, 6, false)
  dv.setUint16(8, format, false)
  dv.setUint16(10, tracks, false)
  dv.setUint16(12, ticksPerBeat, false)
  return out
}

export function tempoMeta(tempo: number): Uint8Array {
  const usPerBeat = Math.round(60000000 / tempo)
  const raw = new DataView(new ArrayBuffer(4))
  raw.setUint32(0, usPerBeat, false)
  const bytes = new Uint8Array(raw.buffer).slice(1)
  return Uint8Array.from([0xff, 0x51, 0x03, ...bytes])
}

export const TIME_SIG_META = Uint8Array.from([0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08])

export function buildSongMidi(song: SongResult, tempo: number): Uint8Array {
  const header = buildHeader(1, song.tracks.length, song.ticksPerBeat)
  const parts = [header]
  song.tracks.forEach((t, i) => {
    const meta = i === 0 ? [tempoMeta(tempo), TIME_SIG_META] : []
    parts.push(buildTrack(t.name, t.channel, t.program, t.notes, meta))
  })
  return concat(parts)
}

export function buildStemMidi(track: Track, song: SongResult, tempo: number): Uint8Array {
  const meta = [tempoMeta(tempo), TIME_SIG_META]
  const header = buildHeader(1, 1, song.ticksPerBeat)
  return concat([header, buildTrack(track.name, track.channel, track.program, track.notes, meta)])
}

export function concat(parts: Uint8Array[]): Uint8Array {
  let size = 0
  for (const p of parts) size += p.length
  const out = new Uint8Array(size)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

export function downloadMidi(data: Uint8Array, filename: string): void {
  const blob = new Blob([data as BlobPart], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}