import type { CasualMode, Emotion, Genre, Section } from './types'
import { SONG_FLOW, LOOP_12, LOOP_24, MOODS_PER_GENRE } from './constants'

const ROLE_EMOTION: (emotion: Emotion) => Record<TemplateRole, Emotion> = (emotion) => {
  const intro = emotion === 'nostalgia' || emotion === 'tristeza'
    ? 'tristeza'
    : 'nostalgia'
  return {
    intro,
    pre: emotion,
    coro: emotion,
    estrofa: emotion === 'ira' ? 'decepcion' : emotion,
    outro: emotion === 'nostalgia' ? 'tristeza' : 'nostalgia',
  }
}

export function buildCasualStructure(
  genre: Genre,
  emotion: Emotion,
  mode: CasualMode,
): Section[] {
  const moods = MOODS_PER_GENRE[genre]
  const mood = moods.find((m) => m.emotion === emotion) ?? moods[0]
  const specs = mode === '12' ? LOOP_12 : mode === '24' ? LOOP_24 : SONG_FLOW
  const byRole = ROLE_EMOTION(mood.emotion)
  return specs.map((s) => ({
    name: s.name,
    role: s.role,
    emotion: byRole[s.role],
    genre,
    bars: s.bars,
  }))
}

type TemplateRole = 'intro' | 'pre' | 'coro' | 'estrofa' | 'outro'