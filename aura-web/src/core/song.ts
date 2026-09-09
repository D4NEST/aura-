import type { Section, SectionProgression, SongResult, Track, Note, Rng } from './types'
import { ESCALAS, DRUM_PATTERNS, DRUM_MAP, NOTE_OFFSETS, VELOCITIES, GROOVE, RANGES, HARMONIC_RHYTHM, CHORD_PULSE, BASS_PATTERNS, FILL_PATTERNS, FILL_WEIGHT_BY_ROLE } from './constants'
import {
  noteFromDegree,
  chordFromDegree,
  applyInversion,
  applyTensionRules,
  selectProgression,
} from './harmony'
import { generateLead } from './melody'
import { humanVelocity, microOffset, withinRange, pickWeighted } from './humanize'

export function generateSong(
  songStructure: Section[],
  rootKey = 'C',
  _tempo = 140,
  ticksPerBeat = 480,
  rng: Rng = Math.random,
): SongResult {
  const ticksPer16th = ticksPerBeat / 4
  const ticksPerBar = ticksPerBeat * 4

  const chords: Note[] = []
  const bass: Note[] = []
  const drums: Note[] = []
  const lead: Note[] = []
  const progressions: SectionProgression[] = []

  const rootOffset = NOTE_OFFSETS[rootKey] ?? 0
  let currentSectionTick = 0
  let totalBars = 0

  const chordBarsByRole: Record<string, number[]> = {
    intro: [2, 2, 1, 1],
    outro: [2, 2, 1, 1],
    coro: [1, 1, 1, 2],
  }

  for (const section of songStructure) {
    const scale = ESCALAS[section.emotion]
    const pick = selectProgression(section.emotion, rng)
    let progression = pick.progression
    progressions.push({
      name: section.name,
      role: section.role,
      emotion: section.emotion,
      genre: section.genre,
      bars: section.bars,
      progression: [...progression],
      source: pick.source,
      mutated: pick.mutated,
    })
    const vels = VELOCITIES[section.genre]
    const groove = GROOVE[section.genre]
    const ranges = RANGES[section.genre]
    const harmonic = chordBarsByRole[section.role ?? ''] ?? HARMONIC_RHYTHM[section.genre]

    let barCount = 0
    let sectionTick = currentSectionTick
    let absBar = 0

    while (barCount < section.bars) {
      for (const degree of progression) {
        if (barCount >= section.bars) break

        let chordBars = pickWeighted(harmonic, rng) + 1
        if (chordBars > 4) chordBars = 4
        if (barCount + chordBars > section.bars) chordBars = section.bars - barCount
        const durationTicks = chordBars * ticksPerBar

        const add7 = section.emotion === 'amor' || section.emotion === 'nostalgia'
        const add9 = section.emotion === 'tristeza' || section.emotion === 'amor'
        const rawChord = chordFromDegree(scale, degree, rootOffset, add7, add9)
        const invPool: ('root' | 'first' | 'second' | 'open' | 'drop2')[] = [
          'root', 'first', 'second', 'open', 'drop2',
        ]
        const invType = invPool[Math.floor(rng() * invPool.length)]
        const invChord = applyInversion(rawChord, invType)
        const finalChord = applyTensionRules(invChord, section.emotion)

        const pulse = CHORD_PULSE[section.genre]
        if (pulse) {
          // Punteo: golpes cortos del mismo voicing sobre la rejilla de 1/16;
          // `cycle4` avanza con el compás absoluto de la sección.
          for (let barIdx = 0; barIdx < chordBars; barIdx++) {
            const extra = pulse.cycle4[(absBar + barIdx) % pulse.cycle4.length] ?? 0
            const steps = extra ? [...pulse.steps, extra] : pulse.steps
            for (const step of steps) {
              finalChord.forEach((note, i) => {
                const strum = i * 12
                // Swing adicional por step (para feel latino en reggaetón)
                const pulseSwing = pulse.swing?.[step] ? pulse.swing[step] * ticksPer16th : 0
                const swing = microOffset(
                  groove.groove.harmony,
                  step - 1,
                  ticksPer16th,
                  groove.humanize,
                  rng,
                ) + pulseSwing
                chords.push({
                  tick:
                    sectionTick + barIdx * ticksPerBar +
                    (step - 1) * ticksPer16th + swing + strum,
                  dur: Math.max(1, pulse.dur16 * ticksPer16th - strum),
                  note: withinRange(note & 0x7f, ranges.chords),
                  velocity: humanVelocity(
                    vels.chords.mean + pulse.accentVel,
                    vels.chords.jitter,
                    rng,
                  ),
                })
              })
            }
          }
        } else {
          finalChord.forEach((note, i) => {
            const strum = i * 12
            const swing = microOffset(groove.groove.harmony, 0, ticksPer16th, groove.humanize, rng)
            chords.push({
              tick: sectionTick + swing + strum,
              dur: durationTicks - 20 - strum,
              note: withinRange(note & 0x7f, ranges.chords),
              velocity: humanVelocity(vels.chords.mean, vels.chords.jitter, rng),
            })
          })
        }

        const bassRaw = noteFromDegree(scale, degree, -1, rootOffset)
        const bassPattern = BASS_PATTERNS[section.genre] ?? BASS_PATTERNS.trap

        // Generar notas de bajo según el patrón del género
        for (let barIdx = 0; barIdx < chordBars; barIdx++) {
          for (const step of bassPattern.steps) {
            const bassSwing = microOffset(groove.groove.harmony, step - 1, ticksPer16th, groove.humanize, rng)
            const bassNote = bassPattern.octaveJump && step > 8
              ? withinRange((bassRaw + 12) & 0x7f, ranges.bass)
              : withinRange(bassRaw & 0x7f, ranges.bass)
            bass.push({
              tick: sectionTick + barIdx * ticksPerBar + (step - 1) * ticksPer16th + bassSwing,
              dur: Math.max(1, bassPattern.dur16 * ticksPer16th),
              note: bassNote,
              velocity: humanVelocity(vels.bass.mean, vels.bass.jitter, rng),
              // glide se maneja en el engine de audio (MonoSynth portamento)
            })
          }
        }

        lead.push(
          ...generateLead(
            scale, degree, sectionTick, durationTicks, ticksPerBar,
            section.genre, section.emotion, rootOffset, rng,
          ),
        )

        sectionTick += durationTicks
        barCount += chordBars
        absBar += chordBars
      }
    }

    const pattern = DRUM_PATTERNS[section.genre] ?? DRUM_PATTERNS.trap
    const fillsByGenre = FILL_PATTERNS[section.genre] ?? FILL_PATTERNS.trap
    const fillWeight = FILL_WEIGHT_BY_ROLE[section.role ?? 'estrofa'] ?? 0.5
    const drumTick = currentSectionTick
    for (let bar = 0; bar < section.bars; bar++) {
      const isLastBar = bar === section.bars - 1
      for (let step = 0; step < 16; step++) {
        const stepTick =
          drumTick + bar * ticksPerBar + step * ticksPer16th +
          microOffset(groove.groove.drums, step, ticksPer16th, groove.humanize, rng)

        // Fill dinámico según género y rol
        if (isLastBar && step >= 12 && rng() < fillWeight) {
          // Elegir un fill del género basado en peso
          const fillNames = Object.keys(fillsByGenre)
          const fillKey = fillNames[Math.floor(rng() * fillNames.length)]
          const fill = fillsByGenre[fillKey]

          // Aplicar hits del fill que coinciden con el step actual
          for (const hit of fill.hits) {
            if (hit.step === step) {
              const pitch = DRUM_MAP[hit.inst]
              const baseVel = vels.drums[hit.inst === 'snare' ? 'snare' : hit.inst === 'kick' ? 'kick' : hit.inst === 'hat' ? 'hat' : 'perc']?.mean ?? 96
              const jitter = vels.drums[hit.inst === 'snare' ? 'snare' : hit.inst === 'kick' ? 'kick' : hit.inst === 'hat' ? 'hat' : 'perc']?.jitter ?? 10
              drums.push({
                tick: stepTick,
                dur: ticksPer16th - 5,
                note: pitch,
                velocity: humanVelocity(baseVel + hit.velBoost, jitter, rng),
              })
            }
          }
        } else if (!isLastBar || step < 12) {
          // Patrón normal de batería
          for (const [inst, pat] of Object.entries(pattern)) {
            if (pat[step] === 1) {
              const prof = vels.drums[inst as 'kick' | 'snare' | 'hat' | 'open_hat' | 'perc']
              const pitch = DRUM_MAP[inst]
              drums.push({
                tick: stepTick,
                dur: ticksPer16th - 5,
                note: pitch,
                velocity: humanVelocity(
                  prof?.mean ?? 96,
                  (prof?.jitter ?? 12) + 2,
                  rng,
                ),
              })
            }
          }
        }
      }
    }

    currentSectionTick += section.bars * ticksPerBar
    totalBars += section.bars
  }

  const tracks: Track[] = [
    { name: 'Chords (Piano)', channel: 0, program: 0, notes: chords },
    { name: 'Bass (Electric)', channel: 1, program: 32, notes: bass },
    { name: 'Lead (Melody)', channel: 2, program: 80, notes: lead },
    { name: 'Drums (Percussion)', channel: 9, program: 0, notes: drums },
  ]

  return {
    tracks,
    ticksPerBeat,
    totalBars,
    totalTicks: currentSectionTick,
    progressions,
    genre: songStructure[0]?.genre ?? 'trap',
  }
}