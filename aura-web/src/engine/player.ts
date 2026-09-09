import * as Tone from 'tone'
import type { Genre, SongResult, SoundBundle, Track } from '../core/types'
import { buildPiano, buildPad, buildBass, buildLead } from './sounds'
import { DRUM_KITS, type DrumKitProfile } from './drumKits'
import { loadLoopBuffer, type DrumBank, type DrumKitFiles } from './loopBank'

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

export class AuraPlayer {
  private synths: Tone.ToneAudioNode[] = []
  private padSynth: Tone.ToneAudioNode | null = null
  private analyzers: Tone.Analyser[] = []
  private master = new Tone.Gain(0.9)
  private masterAnalyser = new Tone.Analyser('waveform', 1024)
  private compressor = new Tone.Compressor({
    threshold: -14,
    ratio: 3,
    attack: 0.005,
    release: 0.2,
  })
  private limiter = new Tone.Limiter(-2)
  private reverb = new Tone.Freeverb(0.42, 2800)
  private loopSec = 0
  playing = false

  constructor() {
    this.reverb.wet.value = 0.22
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
    const sampleBus: Tone.Gain[] = []
    let drumLoopPlayer: Tone.Player | null = null
    const pianoSample = await loadLoopBuffer('loops/piano.wav')
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
      const voice = this.buildVoice(track, useBundle, song.genre ?? 'trap', pianoSample)
      const analyser = new Tone.Analyser('waveform', 1024)
      const bus = new Tone.Gain(voice.gain ?? 1)
      voice.root.connect(bus)
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
              const p = new Tone.Player(buf)
              p.volume.value = SAMPLE_DB[n.note] ?? -4
              p.connect(sampleTarget)
              this.synths.push(p)
              Tone.getTransport().schedule((t) => p.start(t, 0), time)
              continue
            }
          }
          Tone.getTransport().schedule(
            (t) => this.hitDrum(kit, n.note, vel, t),
            time,
          )
        } else {
          const synth = voice.root as Tone.PolySynth
          Tone.getTransport().schedule(
            (t) => synth.triggerAttackRelease([n.note], dur, t, vel),
            time,
          )
        }
      }
    }

    if (padEnabled) {
      this.schedulePad(song.tracks[0] ?? song.tracks[1], secPerTick, useBundle.pad)
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
    pianoSample?: Tone.ToneAudioBuffer | null,
  ): { root: Tone.ToneAudioNode; kit?: DrumKit; gain?: number } {
    if (track.channel === 9) return this.buildDrumKit(DRUM_KITS[genre])
    if (track.channel === 1) return { root: buildBass(bundle.bass), gain: 1.1 }
    if (track.channel === 2) return { root: buildLead(bundle.lead), gain: 1.3 }
    if (pianoSample) {
      const sampler = new Tone.Sampler({ release: 1.2 })
      sampler.add('C4', pianoSample)
      return { root: sampler, gain: 1.9 }
    }
    return { root: buildPiano(bundle.piano), gain: 1.7 }
  }

  private schedulePad(chords: Track | undefined, secPerTick: number, padId: string): void {
    if (!chords) return
    this.padSynth = buildPad(padId)
    const synth = this.padSynth as Tone.PolySynth
    synth.fan(this.master)
    this.synths.push(this.padSynth)

    // Agrupar el acorde por onset y sostenerlo más corto que el piano.
    const sorted = [...chords.notes].sort((a, b) => a.tick - b.tick)
    let group: number[] = []
    let groupTick = 0
    let groupDur = 0
    const flush = () => {
      if (group.length === 0) return
      const at = groupTick * secPerTick
      const dur = Math.max(groupDur * secPerTick, 0.4)
      const vel = 0.24
      Tone.getTransport().schedule(
        (t) => synth.triggerAttackRelease(group, dur, t, vel),
        at,
      )
      group = []
    }
    for (const n of sorted) {
      if (group.length > 0 && n.tick - groupTick > 60) flush()
      if (group.length === 0) groupTick = n.tick
      group.push(n.note)
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
    })
    hat
      .connect(new Tone.Filter(profile.hat.filter, 'highpass'))
      .connect(new Tone.Gain(profile.hat.gain))
      .connect(bus)
    const openHat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: profile.openHat.decay, sustain: 0.0 },
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
      kit.perc.triggerAttackRelease(kit.profile.perc.note, kit.profile.perc.decay + 0.03, time, vel)
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