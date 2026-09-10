import * as Tone from 'tone'
import type { Genre, SongResult, SoundBundle, Track } from '../core/types'
import { buildPiano, buildPad, buildBass, buildLead, designExt } from './sounds'
import { DRUM_KITS, type DrumKitProfile } from './drumKits'
import { loadLoopBuffer, type DrumBank, type DrumKitFiles } from './loopBank'
import { PRODUCTION_RECIPES, type SoundDesignConfig } from '../core/constants'

export interface TrackVoice {
  analyser: Tone.Analyser
  level: number
}

const NOTE_TO_SAMPLE: Record<number, keyof DrumKitFiles> = {
  36: 'kick',
  38: 'snare',
  42: 'hat',
  46: 'openhat',
  39: 'perc',
}

const SAMPLE_DB: Record<number, number> = {
  36: 0,
  38: -2,
  42: -8,
  46: -10,
  39: -6,
}

const DEFAULT_BUNDLE: SoundBundle = {
  piano: 'rhodes',
  pad: 'warm',
  bass: 'sub',
  lead: 'pluck',
}

// Tone.js interpreta un número como frecuencia en Hz (no MIDI). Se convierte
// el MIDI de las notas a Hz reales: acorde 60 => 261.6Hz (C4), al piano se le oye.
const midiToHz = (m: number) => Tone.Frequency(Math.round(m), 'midi').toFrequency()

// Balance "quién es el protagonista" según la receta de producción del género.
// (receta detroit: el donk manda → bajo más arriba, lead más discreto)
const GENRE_BASS_GAIN: Partial<Record<Genre, number>> = { detroit: 0.95 }
const GENRE_LEAD_GAIN: Partial<Record<Genre, number>> = { detroit: 0.7 }

export class AuraPlayer {
  private synths: Tone.ToneAudioNode[] = []
  private padSynth: Tone.ToneAudioNode | null = null
  private analyzers: Tone.Analyser[] = []
  private master = new Tone.Gain(0.8)
  private masterAnalyser = new Tone.Analyser('waveform', 1024)
  private compressor = new Tone.Compressor({
    threshold: -12,
    ratio: 4,
    attack: 0.01,
    release: 0.18,
  })
  private limiter = new Tone.Limiter(-1.5)
  private reverb = new Tone.Freeverb(0.42, 2800)
  private loopSec = 0
  playing = false

  constructor() {
    this.reverb.wet.value = 0.17
    this.master.fan(this.masterAnalyser, this.reverb)
    this.reverb.connect(this.compressor)
    this.master.connect(this.compressor)
    this.compressor.connect(this.limiter)
    this.limiter.toDestination()
  }

  getMasterWaveform(): Float32Array {
    return this.masterAnalyser.getValue() as Float32Array
  }

  setLoop(durationSec: number | null): void {
    if (durationSec && durationSec > 0) {
      this.loopSec = durationSec
      Tone.getTransport().setLoopPoints(0, durationSec)
      Tone.getTransport().loop = true
    } else {
      this.loopSec = 0
      Tone.getTransport().loop = false
    }
  }

  get loopActive(): boolean {
    return this.loopSec > 0 && Tone.getTransport().loop
  }

  async play(
    song: SongResult,
    tempo: number,
    bundle?: SoundBundle,
    padEnabled = true,
    drums: DrumBank | null = null,
  ): Promise<TrackVoice[]> {
    await this.stop()
    await Tone.start()
    const voices: TrackVoice[] = []
    const tpb = song.ticksPerBeat
    const secPerTick = 1 / tpb / (tempo / 60)
    const useBundle = bundle ?? DEFAULT_BUNDLE
    const design = PRODUCTION_RECIPES[song.genre ?? 'trap']?.soundDesign
    const sampleBus: Tone.Gain[] = []
    let drumLoopPlayer: Tone.Player | null = null
    // Un solo Tone.Player por archivo de sample (reusado en todos los golpes).
    // Antes se creaba un Player por nota -> cientos de nodos por vuelta del loop,
    // underruns, clicks y caída del audio al reproducir varias cosas.
    const drumPlayers = new Map<string, Tone.Player>()
    if (drums?.loop) {
      const buf = await loadLoopBuffer(drums.loop.file)
      if (buf) {
        const barSec = 4 * (60 / tempo)
        const loopEnd = Math.min(buf.duration, drums.loop.bars * barSec)
        if (loopEnd > 0.5) {
          drumLoopPlayer = new Tone.Player({
            url: buf,
            loop: true,
            loopStart: 0,
            loopEnd,
          })
          drumLoopPlayer.volume.value = -2
          this.synths.push(drumLoopPlayer)
        }
      }
    }

    for (const track of song.tracks) {
      const voice = this.buildVoice(track, useBundle, song.genre ?? 'trap', design)
      const analyser = new Tone.Analyser('waveform', 1024)
      const bus = new Tone.Gain(voice.gain ?? 1)
      // Con diseño de sonido por género, la señal sale por el último nodo de la
      // cadena (saturación/filtro); el instrumento sigue siendo el disparable.
      const ext = designExt(voice.root)
      if (ext) {
        for (const n of ext.dispose) this.synths.push(n)
        ext.out.connect(bus)
      } else {
        voice.root.connect(bus)
      }
      bus.fan(analyser, this.master)
      this.synths.push(voice.root, bus)
      this.analyzers.push(analyser)
      voices.push({ analyser, level: 0 })

      if (track.channel === 9 && drumLoopPlayer) {
        Tone.getTransport().schedule((t) => {
          drumLoopPlayer.start(t, 0)
        }, 0)
        continue
      }

      if (track.channel === 9 && drums?.kit && voice.kit) {
        sampleBus.push(voice.root as Tone.Gain)
      }

      for (const n of track.notes) {
        const at = n.tick * secPerTick
        const dur = Math.max(n.dur * secPerTick, 0.02)
        const time = at
        const vel = n.velocity / 127
        if (voice.kit) {
          const kit = voice.kit
          const instName = NOTE_TO_SAMPLE[n.note]
          const sampleFile = drums?.kit && instName ? drums.kit[instName] : undefined
          const sampleTarget = sampleBus[sampleBus.length - 1]
          if (sampleFile) {
            const buf = await loadLoopBuffer(sampleFile)
            if (buf && sampleTarget) {
              let p = drumPlayers.get(sampleFile)
              if (!p) {
                p = new Tone.Player(buf)
                p.volume.value = SAMPLE_DB[n.note] ?? -4
                p.connect(sampleTarget)
                this.synths.push(p)
                drumPlayers.set(sampleFile, p)
              }
              const player = p
              Tone.getTransport().schedule(
                (t) => {
                  try {
                    player.start(t, 0)
                  } catch (e) {
                    console.warn('[AURA] start fallido:', e)
                  }
                },
                time,
              )
              continue
            }
          }
          Tone.getTransport().schedule(
            (t) => {
              try {
                this.hitDrum(kit, n.note, Math.max(0.05, vel * 0.8), t)
              } catch (e) {
                console.warn('[AURA] drum fallido:', e)
              }
            },
            time,
          )
        } else {
          const synth = voice.root as unknown as Tone.PolySynth
          Tone.getTransport().schedule(
            (t) => {
              try {
                synth.triggerAttackRelease(midiToHz(n.note), dur, t, vel)
              } catch (e) {
                console.warn('[AURA] nota fallida:', e)
              }
            },
            time,
          )
        }
      }
    }

    if (padEnabled) {
      this.schedulePad(song.tracks[0] ?? song.tracks[1], secPerTick, useBundle.pad, design)
    }

    if (this.loopSec > 0) {
      Tone.getTransport().setLoopPoints(0, this.loopSec)
      Tone.getTransport().loop = true
    }

    Tone.getTransport().position = 0
    Tone.getTransport().start()
    this.playing = true
    return voices
  }

  async stop(): Promise<void> {
    Tone.getTransport().cancel()
    Tone.getTransport().stop()
    for (const s of this.synths) s.dispose()
    if (this.padSynth) {
      this.padSynth.dispose()
      this.padSynth = null
    }
    for (const a of this.analyzers) a.dispose()
    this.synths = []
    this.analyzers = []
    this.playing = false
  }

  dispose(): void {
    void this.stop()
    this.master.dispose()
    this.masterAnalyser.dispose()
    this.reverb.dispose()
  }

  private buildVoice(
    track: Track,
    bundle: SoundBundle,
    genre: Genre,
    design?: SoundDesignConfig,
  ): { root: Tone.ToneAudioNode; kit?: DrumKit; gain?: number } {
    if (track.channel === 9) return this.buildDrumKit(DRUM_KITS[genre])
    if (track.channel === 1) return { root: buildBass(bundle.bass, design), gain: GENRE_BASS_GAIN[genre] ?? 0.72 }
    if (track.channel === 2) return { root: buildLead(bundle.lead, design), gain: GENRE_LEAD_GAIN[genre] ?? 1.1 }
    // NOTA: el piano.wav actual (grabado saturado, sin decaimiento: RMS plano -4.8dB
    // y sin fundamental clara) no sirve como nota de sampler; se usa el piano sintetizado.
    return { root: buildPiano(bundle.piano, design), gain: 1.5 }
  }

  private schedulePad(chords: Track | undefined, secPerTick: number, padId: string, design?: SoundDesignConfig): void {
    if (!chords) return
    this.padSynth = buildPad(padId, design)
    const synth = this.padSynth as Tone.PolySynth
    // Con diseño de sonido, conectar la salida de la cadena al master.
    const ext = designExt(this.padSynth)
    if (ext) {
      for (const n of ext.dispose) this.synths.push(n)
      ext.out.fan(this.master)
    } else {
      synth.fan(this.master)
    }
    this.synths.push(this.padSynth)

    // Agrupar el acorde por onset y sostenerlo más corto que el piano.
    // Umbral de 120 ticks (1 beat): el pad dispara en cambios de acorde,
    // no en cada golpe del punteo (evita "wash" opaco en reggaetón).
    const sorted = [...chords.notes].sort((a, b) => a.tick - b.tick)
    let group: number[] = []
    let groupTick = 0
    let groupDur = 0
    const flush = () => {
      if (group.length === 0) return
      const at = groupTick * secPerTick
      const dur = Math.max(groupDur * secPerTick, 0.4)
      const vel = 0.1
      Tone.getTransport().schedule(
        (t) => synth.triggerAttackRelease(group, dur, t, vel),
        at,
      )
      group = []
    }
    for (const n of sorted) {
      if (group.length > 0 && n.tick - groupTick > 120) flush()
      if (group.length === 0) groupTick = n.tick
      // El pad suena una octava arriba del acorde (evita el "muro grave": bajo+piano+pad).
      group.push(midiToHz(n.note + 12))
      groupDur = Math.max(groupDur, n.dur)
    }
    flush()
  }

  private buildDrumKit(profile: DrumKitProfile): { root: Tone.ToneAudioNode; kit: DrumKit } {
    const bus = new Tone.Gain(profile.bus)
    const kick = new Tone.MembraneSynth({
      pitchDecay: profile.kick.pitchDecay,
      octaves: profile.kick.octaves,
      envelope: {
        attack: 0.001,
        decay: profile.kick.decay,
        sustain: 0.01,
      },
      volume: profile.kick.gain,
    })
    kick.connect(bus)
    const snare = new Tone.NoiseSynth({
      noise: { type: profile.snare.noise },
      envelope: {
        attack: 0.001,
        decay: profile.snare.decay,
        sustain: 0.01,
      },
    })
    snare
      .connect(new Tone.Filter(profile.snare.filter, 'bandpass'))
      .connect(new Tone.Gain(profile.snare.gain))
      .connect(bus)
    const hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: profile.hat.decay, sustain: 0.0 },
      volume: -6,
    })
    hat
      .connect(new Tone.Filter(profile.hat.filter, 'highpass'))
      .connect(new Tone.Gain(profile.hat.gain))
      .connect(bus)
    const openHat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: profile.openHat.decay, sustain: 0.0 },
      volume: -8,
    })
    openHat
      .connect(new Tone.Filter(profile.openHat.filter, 'highpass'))
      .connect(new Tone.Gain(profile.openHat.gain))
      .connect(bus)
    const perc = new Tone.MetalSynth({
      harmonicity: profile.perc.harmonicity,
      resonance: profile.perc.resonance,
      envelope: { attack: 0.001, decay: profile.perc.decay, sustain: 0.0 },
      volume: profile.perc.gain,
    })
    perc.connect(bus)
    return { root: bus, kit: { kick, snare, hat, openHat, perc, profile } }
  }

  private hitDrum(kit: DrumKit, note: number, vel: number, time: number): void {
    const targets: Record<number, Tone.ToneAudioNode | undefined> = {
      36: kit.kick,
      38: kit.snare,
      42: kit.hat,
      46: kit.openHat,
      39: kit.perc,
    }
    const node = targets[note]
    if (!node) return
    if (node === kit.kick) {
      kit.kick.triggerAttackRelease(
        Tone.Frequency(kit.profile.kick.note, 'midi').toNote(),
        kit.profile.kick.dur,
        time,
        vel,
      )
    } else if (node === kit.perc) {
      kit.perc.triggerAttackRelease(midiToHz(kit.profile.perc.note), kit.profile.perc.decay + 0.03, time, vel)
    } else {
      const synth = node as Tone.NoiseSynth
      const isHat = note === 42
      const isOpen = note === 46
      const tail = isOpen ? kit.profile.openHat.decay : isHat ? kit.profile.hat.decay : kit.profile.snare.decay
      synth.triggerAttackRelease(Math.max(tail, 0.03), time, vel)
    }
  }
}

interface DrumKit {
  kick: Tone.MembraneSynth
  snare: Tone.NoiseSynth
  hat: Tone.NoiseSynth
  openHat: Tone.NoiseSynth
  perc: Tone.MetalSynth
  profile: DrumKitProfile
}