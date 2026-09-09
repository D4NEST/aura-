/**
 * Parser binario de archivos FL Studio (.flp) — port a TypeScript de pyflp
 * (demberto/PyFLP, GPL-3.0). Lee el stream de eventos TLV del chunk 'FLdt':
 *   - id < 64   → dato de 1 byte
 *   - 64 ≤ id  < 128 → dato de 2 bytes
 *   - 128 ≤ id < 192 → dato de 4 bytes
 *   - id ≥ 192  → longitud variable + dato (TEXT/DATA)
 * Notas = evento DATA+16 (224): registros de 24 bytes.
 */
import { inflateSync } from 'node:zlib'

const ID_WORD = 64
const ID_DWORD = 128
const ID_TEXT = 192
const ID_DATA = 208

// IDs relevantes
const EV_CHANNEL_NEW = ID_WORD // 64  ChannelID.New (u16, iid del canal)
const EV_PATTERN_NEW = ID_WORD + 1 // 65  PatternID.New (u16, iid del patrón)
const EV_PATTERN_NAME = ID_TEXT + 1 // 193
const EV_CHANNEL_NAME = ID_TEXT // 192  ChannelID._Name
const EV_CHANNEL_TYPE = 21 // ChannelID.Type (u8)
const EV_TEMPO_DWORD = ID_DWORD + 28 // 156  ProjectID.Tempo (u32, bpm*1000)
const EV_TEMPO_COARSE = ID_WORD + 2 // 66
const EV_TEMPO_FINE = ID_WORD + 29 // 93
const EV_FL_VERSION = ID_TEXT + 7 // 199
const EV_TITLE = ID_TEXT + 2 // 194
const EV_GENRE = ID_TEXT + 14 // 206
const EV_PLUGIN_INTERNAL = ID_TEXT + 9 // 201  PluginID.InternalName
const EV_PLUGIN_NAME = ID_TEXT + 11 // 203  PluginID.Name
const EV_NOTES = ID_DATA + 16 // 224  PatternID.Notes

const NOTE_RECORD_SIZE = 24

export interface FlpNote {
  position: number
  length: number
  key: number
  rackChannel: number
  group: number
  finePitch: number
  release: number
  midiChannel: number
  pan: number
  velocity: number
  modX: number
  modY: number
  slide: boolean
}

export interface FlpChannel {
  iid: number
  type: number
  name?: string
  internalName?: string
  pluginName?: string
}

export interface FlpPattern {
  iid: number
  name?: string
  noteCount: number
}

export interface FlpProject {
  format: number
  channelCount: number
  ppq: number
  version?: string
  title?: string
  genre?: string
  tempo: number
  channels: Map<number, FlpChannel>
  notes: FlpNote[]
  patterns: FlpPattern[]
  eventCount: number
}

type VarintScheme = 'leb128' | 'flp2'

function decodeString(raw: Buffer, utf16: boolean): string {
  if (utf16) {
    let end = raw.length
    if (end % 2 !== 0) end -= 1
    for (let i = 0; i + 1 < end; i += 2) {
      if (raw[i] === 0 && raw[i + 1] === 0) {
        end = i
        break
      }
    }
    return raw.subarray(0, end).toString('utf16le')
  }
  let end = raw.indexOf(0)
  if (end === -1) end = raw.length
  return raw.subarray(0, end).toString('latin1')
}

/** Longitud variable: primer byte con bit 0x80 → sigue 1 byte más (esquema FLP). */
function readVarintFlp2(buf: Buffer, pos: number): { value: number; next: number } {
  const b = buf[pos++]
  if (b >= 0x80) {
    const lo = buf[pos++]
    return { value: ((b & 0x7f) << 8) | lo, next: pos }
  }
  return { value: b, next: pos }
}

/** Longitud variable LEB128 (base 128 little-endian, bit alto = continúa). */
function readVarintLeb128(buf: Buffer, pos: number): { value: number; next: number } {
  let value = 0
  let shift = 0
  for (;;) {
    const b = buf[pos++]
    value |= (b & 0x7f) << shift
    if (b < 0x80) break
    shift += 7
    if (shift > 21) throw new Error('varint demasiado largo')
  }
  return { value, next: pos }
}

function parseEvents(
  stream: Buffer,
  scheme: VarintScheme,
  ppq: number,
): FlpProject {
  const readVarint = scheme === 'flp2' ? readVarintFlp2 : readVarintLeb128

  const project: FlpProject = {
    format: 0,
    channelCount: 0,
    ppq,
    tempo: 0,
    channels: new Map(),
    notes: [],
    patterns: [],
    eventCount: 0,
  }

  let pos = 0
  let utf16 = false
  let openChannel: FlpChannel | undefined
  let openPattern: FlpPattern | undefined
  let coarseTempo: number | undefined
  let fineTempo: number | undefined

  const getChannel = (iid: number): FlpChannel => {
    let ch = project.channels.get(iid)
    if (!ch) {
      ch = { iid, type: -1 }
      project.channels.set(iid, ch)
    }
    return ch
  }

  while (pos < stream.length) {
    const id = stream[pos++]
    let value: Buffer
    if (id < ID_WORD) {
      value = stream.subarray(pos, pos + 1)
      pos += 1
    } else if (id < ID_DWORD) {
      value = stream.subarray(pos, pos + 2)
      pos += 2
    } else if (id < ID_TEXT) {
      value = stream.subarray(pos, pos + 4)
      pos += 4
    } else {
      const { value: len, next } = readVarint(stream, pos)
      pos = next
      value = stream.subarray(pos, pos + len)
      pos += len
    }
    project.eventCount++

    switch (id) {
      case EV_CHANNEL_NEW:
        openChannel = getChannel(value.readUInt16LE(0))
        break
      case EV_CHANNEL_TYPE:
        if (openChannel) openChannel.type = value[0]
        break
      case EV_CHANNEL_NAME: {
        const name = decodeString(value, utf16)
        if (openChannel) openChannel.name = name
        break
      }
      case EV_PLUGIN_INTERNAL: {
        const str = decodeString(value, utf16)
        if (openChannel) openChannel.internalName = str
        break
      }
      case EV_PLUGIN_NAME: {
        const str = decodeString(value, utf16)
        if (openChannel) openChannel.pluginName = str
        break
      }
      case EV_PATTERN_NEW: {
        const iid = value.readUInt16LE(0)
        openPattern = project.patterns.find((p) => p.iid === iid)
        if (!openPattern) {
          openPattern = { iid, noteCount: 0 }
          project.patterns.push(openPattern)
        }
        break
      }
      case EV_PATTERN_NAME:
        if (openPattern) openPattern.name = decodeString(value, utf16)
        break
      case EV_FL_VERSION:
        project.version = decodeString(value, false)
        if (project.version) {
          const parts = project.version.split('.')
          if (parseInt(parts[0], 10) * 1000 + parseInt(parts[1], 10) >= 11005) {
            utf16 = true
          }
        }
        break
      case EV_TITLE:
        project.title = decodeString(value, utf16)
        break
      case EV_GENRE:
        project.genre = decodeString(value, utf16)
        break
      case EV_TEMPO_DWORD:
        project.tempo = value.readUInt32LE(0) / 1000
        break
      case EV_TEMPO_COARSE:
        coarseTempo = value.readUInt16LE(0)
        break
      case EV_TEMPO_FINE:
        fineTempo = value.readUInt16LE(0)
        break
      case EV_NOTES: {
        const count = Math.floor(value.length / NOTE_RECORD_SIZE)
        for (let i = 0; i < count; i++) {
          const o = i * NOTE_RECORD_SIZE
          const flags = value.readUInt16LE(o + 4)
          project.notes.push({
            position: value.readUInt32LE(o),
            rackChannel: value.readUInt16LE(o + 6),
            length: value.readUInt32LE(o + 8),
            key: value.readUInt16LE(o + 12),
            group: value.readUInt16LE(o + 14),
            finePitch: value[o + 16],
            release: value[o + 18],
            midiChannel: value[o + 19],
            pan: value[o + 20],
            velocity: value[o + 21],
            modX: value[o + 22],
            modY: value[o + 23],
            slide: (flags & (1 << 3)) !== 0,
          })
          if (openPattern) openPattern.noteCount++
        }
        break
      }
    }
  }

  if (project.tempo === 0 && coarseTempo !== undefined) {
    project.tempo = coarseTempo + (fineTempo ?? 0) / 1000
  }

  return project
}

export function parseFlp(filePath: string, buf: Buffer): FlpProject {
  if (buf.length < 14) throw new Error('archivo demasiado corto')
  const magic = buf.subarray(0, 4).toString('latin1')
  if (magic !== 'FLhd') {
    if (magic === 'FLCh' || magic === 'FSCd') throw new Error('FST/score no soportado')
    throw new Error('cabecera FLP no reconocida')
  }
  const headerSize = buf.readUInt32LE(4)
  if (headerSize !== 6) throw new Error(`cabecera corrupta (size ${headerSize})`)
  const format = buf.readInt16LE(8)
  const channelCount = buf.readUInt16LE(10)
  const ppq = buf.readUInt16LE(12)

  if (buf.subarray(14, 18).toString('latin1') !== 'FLdt') {
    throw new Error('chunk de datos no encontrado (FLdt)')
  }
  const eventsSize = buf.readUInt32LE(18)

  let stream = buf.subarray(22, 22 + eventsSize)
  if (stream.length !== eventsSize) {
    try {
      const inflated = inflateSync(buf.subarray(22, 22 + eventsSize))
      if (inflated.length > 0) stream = inflated
    } catch {
      throw new Error('chunk de datos incompleto')
    }
  }

  let lastError: unknown
  for (const scheme of ['leb128', 'flp2'] as const) {
    try {
      const project = parseEvents(stream, scheme, ppq)
      project.format = format
      project.channelCount = channelCount
      return project
    } catch (e) {
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}