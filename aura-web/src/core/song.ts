import type { Section, SectionProgression, SongResult, Track, Note, Rng, Mode } from './types'
import { ESCALAS, DRUM_PATTERNS, DRUM_VARIANTS, DRUM_MAP, NOTE_OFFSETS, VELOCITIES, GROOVE, RANGES, HARMONIC_RHYTHM, CHORD_PULSE, BASS_PATTERNS, FILL_PATTERNS, FILL_WEIGHT_BY_ROLE, PRODUCTION_RECIPES, MODE_SCALES, GENRE_DEFAULT_MODE, GENRE_MODE_OVERRIDE, VOICE_VELOCITY_DEFAULT } from './constants'
import type { PatternPreset } from './constants'
import {
  noteFromDegree,
  chordFromDegree,
  applyInversion,
  applyTensionRules,
  selectProgression,
  nearestInversion,
  rootlessVoicing,
  voiceVelocityFor,
} from './harmony'
import { generateLead } from './melody'
import { humanVelocity, microOffset, withinRange, pickWeighted } from './humanize'

export function generateSong(
  songStructure: Section[],
  rootKey = 'C',
  _tempo = 140,
  ticksPerBeat = 480,
  mode?: Mode,
  preset?: PatternPreset,
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
    // Modo explícito del motor: preset > parámetro > override por (género,emoción) > default.
    const effectiveMode: Mode =
      mode ?? preset?.scaleMode ??
      GENRE_MODE_OVERRIDE[section.genre]?.[section.emotion] ??
      GENRE_DEFAULT_MODE[section.genre]
    const scale = MODE_SCALES[effectiveMode] ?? ESCALAS[section.emotion]
    const pick = selectProgression(section.emotion, rng, { mode: effectiveMode, genre: section.genre })
    // Un preset fija la progresión literal (sin mutación armónica aleatoria).
    let progression = preset ? [...preset.harmony.progression] : pick.progression
    const recipe = PRODUCTION_RECIPES[section.genre]
    if (!preset && recipe?.alternate2 && progression.length > 2) {
      // Receta Detroit: 2 acordes que alternan (I–V). El loop de compases
      // recorre la progresión cíclicamente, así [A, B] → A B A B ...
      progression = progression.slice(0, 2)
    }
    progressions.push({
      name: section.name,
      role: section.role,
      emotion: section.emotion,
      genre: section.genre,
      bars: section.bars,
      progression: [...progression],
      source: preset ? 'preset' : pick.source,
      mutated: preset ? false : pick.mutated,
    })
    const vels = VELOCITIES[section.genre]
    const groove = GROOVE[section.genre]
    const ranges = RANGES[section.genre]
    const harmonic =
      preset?.harmony.chordBars ??
      recipe?.chordBarsOverride ??
      chordBarsByRole[section.role ?? ''] ??
      HARMONIC_RHYTHM[section.genre]

    let barCount = 0
    let sectionTick = currentSectionTick
    let absBar = 0
    let prevChord: number[] | undefined = undefined

    while (barCount < section.bars) {
      for (const degree of progression) {
        if (barCount >= section.bars) break

        let chordBars = pickWeighted(harmonic, rng) + 1
        if (chordBars > 4) chordBars = 4
        if (barCount + chordBars > section.bars) chordBars = section.bars - barCount
        const durationTicks = chordBars * ticksPerBar

        // Compás de paso/girarrondo (barra 4 de la frase): 9na/11na +10% de volumen.
        const isTurnaround = barCount % 4 === 3
        const wantTurnaround = recipe?.turnaroundExtension ?? true
        const add11 = isTurnaround && wantTurnaround
        const velBoost = isTurnaround && wantTurnaround ? 10 : 0

        const add7 = preset ? preset.harmony.addSeventh : section.emotion === 'amor' || section.emotion === 'nostalgia'
        const add9 = preset ? preset.harmony.addNinth : section.emotion === 'tristeza' || section.emotion === 'amor'
        const rawChord = chordFromDegree(scale, degree, rootOffset, add7, add9, add11)
        // Preset: voicing fijo (OPEN_DROP_2 → drop2 en acordes de 4+, open en triadas).
        // Normal: voice leading con el mínimo movimiento de semitonos desde el previo.
        const voicingStyle = preset?.harmony.voicingStyle
        const voiced = preset && voicingStyle
          ? applyInversion(rawChord, voicingStyle === 'OPEN_DROP_2'
              ? rawChord.length >= 4 ? 'drop2' : 'open'
              : voicingStyle === 'DROP2' ? 'drop2'
              : voicingStyle === 'OPEN' ? 'open'
              : 'root')
          : nearestInversion(rawChord, prevChord, rng)
        const invChord = applyTensionRules(voiced, section.emotion)
        const rootMidi = rawChord[0] & 0x7f
        // Rootless: el bajo/sub-synth sostiene la fundamental; no duplicarla en el acorde.
        const rootless = preset ? preset.harmony.rootlessHarmonicInstrument : (recipe?.rootlessVoicing ?? false)
        const playChord = rootless
          ? rootlessVoicing(invChord, rootMidi)
          : invChord
        prevChord = playChord
        const rootClass = rootMidi % 12
        const velProf = recipe?.velocityProfile ?? VOICE_VELOCITY_DEFAULT
        const strumTicks = recipe?.strumTicks ?? 12

        const pulse = CHORD_PULSE[section.genre]
        if (pulse) {
          // Punteo: golpes cortos del mismo voicing sobre la rejilla de 1/16;
          // `cycle4` avanza con el compás absoluto de la sección.
          for (let barIdx = 0; barIdx < chordBars; barIdx++) {
            const extra = pulse.cycle4[(absBar + barIdx) % pulse.cycle4.length] ?? 0
            const steps = extra ? [...pulse.steps, extra] : pulse.steps
            for (const step of steps) {
              playChord.forEach((note, i) => {
                const strum = i * strumTicks
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
                  velocity: Math.min(
                    127,
                    voiceVelocityFor(note, i === playChord.length - 1, rootClass, velProf, rng) +
                      pulse.accentVel + velBoost,
                  ),
                })
              })
            }
          }
        } else {
          playChord.forEach((note, i) => {
            const strum = i * strumTicks
            const swing = microOffset(groove.groove.harmony, 0, ticksPer16th, groove.humanize, rng)
            chords.push({
              tick: sectionTick + swing + strum,
              dur: durationTicks - 20 - strum,
              note: withinRange(note & 0x7f, ranges.chords),
              velocity: Math.min(
                127,
                voiceVelocityFor(note, i === playChord.length - 1, rootClass, velProf, rng) + velBoost,
              ),
            })
          })
        }

        const bassRaw = noteFromDegree(scale, degree, -1, rootOffset)
        const bassPattern = BASS_PATTERNS[section.genre] ?? BASS_PATTERNS.trap
        const presetBass = preset?.bass
        const bassNotes = presetBass?.notes === 'ROOTS'
          ? [bassRaw]
          : presetBass && Array.isArray(presetBass.notes)
            ? presetBass.notes.map((n) => n & 0x7f)
            : null

        // Generar notas de bajo según el patrón del género
        for (let barIdx = 0; barIdx < chordBars; barIdx++) {
          const stepList = presetBass ? [1] : bassPattern.steps
          for (const step of stepList) {
            const bassSwing = microOffset(groove.groove.harmony, step - 1, ticksPer16th, groove.humanize, rng)
            const base = presetBass
              ? (bassNotes as number[])[barIdx % (bassNotes as number[]).length]
              : bassPattern.octaveJump && step > 8
                ? withinRange((bassRaw + 12) & 0x7f, ranges.bass)
                : withinRange(bassRaw & 0x7f, ranges.bass)
            bass.push({
              tick: sectionTick + barIdx * ticksPerBar + (step - 1) * ticksPer16th + bassSwing,
              dur: Math.max(1, (presetBass?.dur16 ?? bassPattern.dur16) * ticksPer16th),
              note: withinRange(base, ranges.bass),
              velocity: humanVelocity(vels.bass.mean, vels.bass.jitter, rng),
              // glide se maneja en el engine de audio (MonoSynth portamento)
            })
          }
        }

        lead.push(
          ...generateLead(
            scale, degree, sectionTick, durationTicks, ticksPerBar,
            section.genre, section.emotion, rootOffset, barCount % 4, rng,
          ),
        )

        sectionTick += durationTicks
        barCount += chordBars
        absBar += chordBars
      }
    }

    const darkMood = section.emotion === 'tristeza' || section.emotion === 'decepcion' || section.emotion === 'nostalgia'
    // No tan cuadrados: los moods oscuros usan sincopado casi siempre (80%),
    // pero los de energía también caen en la estética sincopada a veces (25%).
    const flavorRoll = rng()
    const useDark = darkMood ? flavorRoll < 0.8 : flavorRoll < 0.25
    const variant = useDark ? DRUM_VARIANTS[section.genre]?.dark : undefined
    const drumRows = preset?.drums
    let pattern: Record<string, number[]>
    if (drumRows) {
      // Preset: grilla de batería literal (pasos → rejilla de 16).
      const stepRow = (steps?: number[]) =>
        Array.from({ length: 16 }, (_, i) => (steps?.includes(i + 1) ? 1 : 0) as number)
      pattern = {
        kick: stepRow(drumRows.kick),
        snare: stepRow(drumRows.snare),
        hat: stepRow(drumRows.hat),
        open_hat: stepRow(drumRows.open_hat),
      }
    } else {
      pattern = { ...(DRUM_PATTERNS[section.genre] ?? DRUM_PATTERNS.trap), ...(variant ?? {}) }
    }
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