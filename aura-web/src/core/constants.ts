export type { Genre as GenreType } from './types'
import type { Emotion, Genre, Mode, Mood } from './types'

export const DRUM_MAP: Record<string, number> = {
  kick: 36,
  snare: 38,
  hat: 42,
  open_hat: 46,
  perc: 39,
}

export const ESCALAS: Record<Emotion, number[]> = {
  tristeza: [0, 2, 3, 5, 7, 8, 10],
  ira: [0, 1, 3, 5, 7, 8, 10],
  amor: [0, 2, 4, 5, 7, 9, 11],
  decepcion: [0, 1, 3, 5, 6, 8, 10],
  nostalgia: [0, 3, 5, 7, 10],
}

/**
 * Modo explícito del motor (en qué tono estamos trabajando):
 * - menor = menor natural (línea base del catálogo: tristeza/trap/rap/detroit/reggaetón)
 * - mayor = mayor natural (base de plug y de los tonos alegres)
 * Modo detectado con `scripts/analyze_key.ts` (tónica + mayor/menor) se alimenta directo aquí.
 */
export const MODE_SCALES: Record<Mode, number[]> = {
  mayor: [0, 2, 4, 5, 7, 9, 11], // mayor natural
  menor: [0, 2, 3, 5, 7, 8, 10], // menor natural
}

/** Modo por defecto de cada género (matriz de producción del productor). */
export const GENRE_DEFAULT_MODE: Record<Genre, Mode> = {
  trap: 'menor', // menor natural/harmónica/frigia
  rap: 'menor', // menor dórica/natural/pentatónica
  plug: 'mayor', // mayor natural/dórica/lidia
  detroit: 'menor', // menor natural/cromática/locria
  reggaeton: 'menor', // menor/mayor natural
}

export const PROGRESIONES: Record<
  Emotion,
  { principal: number[]; alternativa: number[]; reales: number[][] }
> = {
  tristeza: {
    principal: [1, 6, 3, 7],
    alternativa: [1, 4, 5, 6],
    reales: [[3, 1, 4, 7], [1, 4, 7, 1], [4, 1, 4, 2], [1, 7, 1, 6], [5, 3, 1]],
  },
  ira: {
    principal: [1, 2, 1, 2],
    alternativa: [1, 6, 2, 1],
    reales: [[1, 2, 1, 6], [1, 2, 1, 7]],
  },
  amor: {
    principal: [1, 5, 6, 4],
    alternativa: [2, 5, 7, 1],
    reales: [],
  },
  decepcion: {
    principal: [1, 5, 6, 4],
    alternativa: [1, 5, 2, 6],
    reales: [],
  },
  nostalgia: {
    principal: [1, 4, 5, 1],
    alternativa: [4, 1, 7, 1],
    reales: [[1, 4, 5, 4], [4, 1, 4, 5]],
  },
}

/**
 * Progresiones "clave" por género, de la matriz de producción del productor
 * (grados de escala: i=1, bII=2, III=3, iv=4, v=5, bVI/VI=6, bVII/VII=7).
 * Se integran como fuente de selección con peso, junto a principal/alternativa/reales.
 */
export const GENRE_PROGRESSIONS: Record<Genre, number[][]> = {
  trap: [[1, 6], [1, 2, 1], [1, 5, 6, 4]], // i-VI · i-bII-i · i-v-VI-IV
  rap: [[2, 5, 1], [1, 4]], // ii7-V7-i7 · i7-IV7
  plug: [[4, 3, 6], [4, 5, 3, 6]], // IVmaj7-iii7-vi7 · IVmaj7-V7-iii7-vi7
  detroit: [[1, 6, 7], [1, 2, 1]], // i-bVI-bVII · riff cromático i-bII-i
  reggaeton: [[1, 6, 3, 7], [1, 4, 7, 3], [1, 7, 6, 5]], // i-VI-III-VII · i-iv-VII-III · i-VII-VI-V
}

export const DRUM_PATTERNS: Record<Genre, Record<string, number[]>> = {
  trap: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    open_hat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    perc: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  },
  rap: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
    open_hat: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    perc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  plug: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    open_hat: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    perc: [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  },
  detroit: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    open_hat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    perc: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  },
  reggaeton: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    hat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    open_hat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    perc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  },
}

/**
 * Variantes "dark" de batería (moods oscuros/textura: tristeza, decepción,
 * nostalgia) con kicks sincopados del type-beat moderno (matriz del productor).
 * La base queda four-on-floor (verificada 100% coherente contra el catálogo
 * real) y se usa para moods de energía (ira, amor). Celdas ausentes = base.
 */
export const DRUM_VARIANTS: Partial<Record<Genre, Record<'dark', Record<string, number[]>>>> = {
  trap: {
    dark: { kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0] }, // 1, 8, 11
  },
  rap: {
    dark: { kick: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0] }, // 1, 3, 11
  },
  plug: {
    dark: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0], // 1, 7, 10
      perc: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], // rimshots 4, 8, 12
    },
  },
  detroit: {
    dark: {
      kick: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], // 1, 6, 11
      snare: [0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0], // clap 9 + offbeat 4, 8, 12, 15
    },
  },
}

export const NOTE_OFFSETS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

export const ROOTS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#',
  'G', 'G#', 'A', 'A#', 'B',
]

export const EMOTION_LABELS: Record<Emotion, string> = {
  tristeza: 'Tristeza',
  ira: 'Ira',
  amor: 'Amor',
  decepcion: 'Decepción',
  nostalgia: 'Nostalgia',
}

export const GENRE_LABELS: Record<Genre, string> = {
  trap: 'Trap',
  rap: 'Rap',
  plug: 'Plug',
  detroit: 'Detroit',
  reggaeton: 'Reggaetón',
}

export const GENRE_DESCRIPTIONS: Record<Genre, string> = {
  trap: '808s profundos, hi-hats ágiles y aire oscuro.',
  rap: 'Pulso directo y cómodo, ideal para fluir encima.',
  plug: 'Espaciado y sensual, acordes vintage con aire.',
  detroit: 'Mecánico y firme, fuego de sintetizadores.',
  reggaeton: 'Dembow, brillo tropical y carne en la melodía.',
}

export const MOODS_PER_GENRE: Record<Genre, Mood[]> = {
  trap: [
    { emotion: 'tristeza', label: 'Melancólico', description: 'Oscuro, espaciado, emocional', tempo: 140 },
    { emotion: 'ira', label: 'Agresivo', description: 'Pesado, tenso, con golpes duros', tempo: 150 },
    { emotion: 'amor', label: 'Romántico', description: 'Suave y con groove sensual', tempo: 128 },
    { emotion: 'nostalgia', label: 'Nostálgico', description: 'Frío, humeante, de madrugada', tempo: 160 },
  ],
  rap: [
    { emotion: 'amor', label: 'Alegre', description: 'Brillante, para flotar encima', tempo: 92 },
    { emotion: 'ira', label: 'Firme', description: 'Con actitud y puño cerrado', tempo: 95 },
    { emotion: 'tristeza', label: 'Sentimental', description: 'Reflexivo, para contar algo', tempo: 85 },
    { emotion: 'nostalgia', label: 'Vintage', description: 'Boombap clásico con alma', tempo: 88 },
  ],
  plug: [
    { emotion: 'amor', label: 'Sensual', description: 'Acordes cálidos, mucho aire', tempo: 120 },
    { emotion: 'tristeza', label: 'Bittersweet', description: 'Suave y con melancolía dulce', tempo: 128 },
    { emotion: 'decepcion', label: 'Frío', description: 'Distante, minimalista, nocturno', tempo: 110 },
    { emotion: 'nostalgia', label: 'Onírico', description: 'Nublado y soñador', tempo: 125 },
  ],
  detroit: [
    { emotion: 'ira', label: 'Crudo', description: 'Potente, sintetizado, frontal', tempo: 176 },
    { emotion: 'amor', label: 'Mecánico', description: 'Frío pero con flow melódico', tempo: 168 },
    { emotion: 'nostalgia', label: 'Gritty', description: 'Pesado, texturas y piedra', tempo: 172 },
    { emotion: 'tristeza', label: 'Tenue', description: 'Apagado y reflexivo', tempo: 160 },
  ],
  reggaeton: [
    { emotion: 'amor', label: 'Perreo', description: "Vibrante, brillante, pa' bailar", tempo: 96 },
    { emotion: 'tristeza', label: 'Romántico', description: 'Sentimental, de noche y bajo', tempo: 92 },
    { emotion: 'ira', label: 'Crudo', description: 'Duro, sintetizado, en la cara', tempo: 94 },
    { emotion: 'nostalgia', label: 'Vintage', description: 'Old-school, minimalista', tempo: 88 },
  ],
}

export interface TemplateSpec {
  name: string
  role: 'intro' | 'pre' | 'coro' | 'estrofa' | 'outro'
  bars: number
}

/** Flujo clásico de canción que se repite en la industria. */
export const SONG_FLOW: TemplateSpec[] = [
  { name: 'intro', role: 'intro', bars: 4 },
  { name: 'pre-coro', role: 'pre', bars: 4 },
  { name: 'coro', role: 'coro', bars: 8 },
  { name: 'estrofa', role: 'estrofa', bars: 8 },
  { name: 'pre-coro', role: 'pre', bars: 4 },
  { name: 'coro', role: 'coro', bars: 8 },
  { name: 'estrofa', role: 'estrofa', bars: 8 },
  { name: 'pre-coro', role: 'pre', bars: 4 },
  { name: 'outro', role: 'outro', bars: 4 },
]

/** Bucles cortos para improvisar (modo Crear). */
export const LOOP_12: TemplateSpec[] = [
  { name: 'intro', role: 'intro', bars: 4 },
  { name: 'coro', role: 'coro', bars: 8 },
]

export const LOOP_24: TemplateSpec[] = [
  { name: 'intro', role: 'intro', bars: 4 },
  { name: 'pre-coro', role: 'pre', bars: 4 },
  { name: 'coro', role: 'coro', bars: 8 },
  { name: 'estrofa', role: 'estrofa', bars: 8 },
]

export const GENRE_TAGS: Record<Genre, string[]> = {
  trap: ['808', 'hi-hats', 'oscuro'],
  rap: ['flow', 'boombap', 'clásico'],
  plug: ['vintage', 'air', 'sensual'],
  detroit: ['sintetizadores', 'crudo', 'mecánico'],
  reggaeton: ['dembow', 'tropical', 'perreo'],
}

/** Densidad de melodía/lead por género (16 pasos por compás). */
export const LEAD_DENSITY: Record<Genre, number> = {
  trap: 0.28,
  rap: 0.4,
  plug: 0.34,
  detroit: 0.4, // el protagonista es el donk; el lead acompaña
  reggaeton: 0.36,
}

export interface VelocityProfile {
  mean: number
  jitter: number
}

/** Velocities aprendidas del catálogo real del productor (learned_velocities.json). */
export const VELOCITIES: Record<
  Genre,
  {
    chords: VelocityProfile
    bass: VelocityProfile
    lead: VelocityProfile
    drums: Partial<
      Record<'kick' | 'snare' | 'hat' | 'open_hat' | 'perc', VelocityProfile>
    >
  }
> = {
  trap: {
    chords: { mean: 94.2, jitter: 18.5 },
    bass: { mean: 94.7, jitter: 15.2 },
    lead: { mean: 96.8, jitter: 17.4 },
    drums: {
      kick: { mean: 101.7, jitter: 7.2 },
      snare: { mean: 100.4, jitter: 1.4 },
      hat: { mean: 108.5, jitter: 12.7 },
      perc: { mean: 79.2, jitter: 28.5 },
    },
  },
  rap: {
    chords: { mean: 92.8, jitter: 24.2 },
    bass: { mean: 87.7, jitter: 16.8 },
    lead: { mean: 99.2, jitter: 7.1 },
    drums: {
      kick: { mean: 75.9, jitter: 35.9 },
      snare: { mean: 77.1, jitter: 17.3 },
      hat: { mean: 95.9, jitter: 15.5 },
      perc: { mean: 95.3, jitter: 17.4 },
    },
  },
  plug: {
    chords: { mean: 74.7, jitter: 25.1 },
    bass: { mean: 78.8, jitter: 33.7 },
    lead: { mean: 76.9, jitter: 24.9 },
    drums: {
      kick: { mean: 83, jitter: 22.6 },
      snare: { mean: 100, jitter: 10 },
      hat: { mean: 93.7, jitter: 17.1 },
      perc: { mean: 83.7, jitter: 19.3 },
    },
  },
  detroit: {
    chords: { mean: 73.4, jitter: 28.8 },
    bass: { mean: 97.1, jitter: 25.6 },
    lead: { mean: 81.3, jitter: 28.2 },
    drums: {
      kick: { mean: 83.2, jitter: 25.3 },
      snare: { mean: 101.5, jitter: 2.3 },
      hat: { mean: 95.9, jitter: 15.5 },
      perc: { mean: 95.3, jitter: 17.4 },
    },
  },
  reggaeton: {
    chords: { mean: 92, jitter: 18 },
    bass: { mean: 78.5, jitter: 28 },
    lead: { mean: 82.4, jitter: 23.6 },
    drums: {
      kick: { mean: 87.1, jitter: 19.1 },
      snare: { mean: 100, jitter: 10 },
      hat: { mean: 95.9, jitter: 15.5 },
      perc: { mean: 95.3, jitter: 17.4 },
    },
  },
}

export interface GrooveVec {
  harmony: number[]
  drums: number[]
}

export interface GrooveProfile {
  groove: GrooveVec
  humanize: number
}

const ZERO_GROOVE: number[] = new Array(16).fill(0)

/** Micro-timing aprendido del catálogo: desvío por paso de 1/16 (fracción del paso); el catálogo es ~99.5% cuantizado. */
export const GROOVE: Record<Genre, GrooveProfile> = {
  trap: { groove: { harmony: ZERO_GROOVE, drums: ZERO_GROOVE }, humanize: 0.001 },
  rap: {
    groove: {
      harmony: ZERO_GROOVE,
      drums: [0, 0.21, 0, 0.21, 0, 0.21, 0, 0.21, 0, 0.21, 0, 0.21, 0, 0.21, 0, 0.21],
    },
    humanize: 0.02,
  },
  plug: { groove: { harmony: ZERO_GROOVE, drums: ZERO_GROOVE }, humanize: 0.001 },
  detroit: {
    groove: {
      harmony: ZERO_GROOVE,
      drums: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.24, 0, -0.2],
    },
    humanize: 0.01,
  },
  reggaeton: {
    groove: {
      harmony: ZERO_GROOVE,
      drums: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.18],
    },
    humanize: 0.005,
  },
}

export interface RangeWindow {
  lo: number
  hi: number
}

/** Rangos de octava (P5..P95) del catálogo real por género x rol (learned_ranges.json). */
export const RANGES: Record<
  Genre,
  { chords: RangeWindow; bass: RangeWindow; lead: RangeWindow }
> = {
  trap: {
    chords: { lo: 55, hi: 84 },
    bass: { lo: 36, hi: 50 },
    lead: { lo: 66, hi: 90 },
  },
  rap: {
    chords: { lo: 55, hi: 87 },
    bass: { lo: 40, hi: 54 },
    lead: { lo: 68, hi: 82 },
  },
  plug: {
    chords: { lo: 48, hi: 82 },
    bass: { lo: 42, hi: 52 },
    lead: { lo: 64, hi: 87 },
  },
  detroit: {
    chords: { lo: 54, hi: 87 },
    bass: { lo: 38, hi: 48 },
    lead: { lo: 63, hi: 80 },
  },
  reggaeton: {
    chords: { lo: 58, hi: 84 },
    bass: { lo: 36, hi: 50 },
    lead: { lo: 63, hi: 93 },
  },
}

/** Ritmo armónico del catálogo real: peso de aguantar N compases por acorde (índice = compases-1). */
export const HARMONIC_RHYTHM: Record<Genre, number[]> = {
  trap: [93, 6, 0, 1],
  rap: [98, 2, 0, 0],
  plug: [99, 1, 0, 0],
  detroit: [88, 10, 1, 1],
  reggaeton: [98, 2, 0, 0],
}

/**
 * Punteo del piano/acorde: en vez de un acorde sostenido, golpes cortos del
 * mismo voicing sobre una rejilla de 1/16. `steps` = golpes fijos del compás;
 * `cycle4` = golpe extra por compás dentro de un ciclo de 4 (0 = ninguno);
 * `dur16` = longitud del golpe en 1/16; `sustain` = si además mantener el
 * acorde largo; `accentVel` = refuerzo de velocity para que corte.
 * Regla aprendida del MIDI de referencia (reggeaton, Bm, 98 BPM): golpes en
 * 1 y 4 ("y" de la negra) + variante 9,9,7,7 en el ciclo de 4 compases.
 */
export interface ChordPulseConfig {
  steps: number[]
  cycle4: number[]
  dur16: number
  sustain: boolean
  accentVel: number
  swing?: Record<number, number> // step -> fracción de 1/16 de swing adicional
}

export const CHORD_PULSE: Partial<Record<Genre, ChordPulseConfig>> = {
  reggaeton: {
    steps: [1, 4],
    cycle4: [9, 9, 7, 7],
    dur16: 0.75, // más largo que 0.5 para que suene "pulsado" no cortado
    sustain: false,
    accentVel: 14,
    swing: { 4: 0.08, 12: 0.08 }, // swing en los golpes "y" para feel latino
  },
  // Detroit (receta del productor): acordes a contratiempo ("y" de cada negra),
  // el toque offbeat es lo que hace caminar el house; el pad aporta el sostenido.
  detroit: {
    steps: [3, 7, 11, 15],
    cycle4: [0, 0, 0, 0],
    dur16: 2, // punteado corto pero con cuerpo
    sustain: false,
    accentVel: 12,
  },
}

/**
 * Recetas de producción por género (extraídas de entrevista con el productor).
 * Cada receta traduce decisiones musicales a parámetros del motor:
 * - `chordBarsOverride`: duración fija de cada acorde (pesos de 1 a 4 compases).
 * - `alternate2`: progresión de 2 acordes que alternan (feel I–V, frase 4-8 compases).
 * - `leadDensity`: densidad del lead (menos con 1 = más protagonista el bajo).
 * - `genreGains`: balance de mezcla por género (qué instrumento manda).
 */
export interface ProductionRecipe {
  chordBarsOverride?: number[]
  alternate2?: boolean
  leadDensity?: number
  genreGains?: { bass?: number; lead?: number; piano?: number }
  strumTicks?: number
  rootlessVoicing?: boolean
  turnaroundExtension?: boolean
  velocityProfile?: VoiceVelocityProfile
  soundDesign?: SoundDesignConfig
}

/** Perfil por defecto de jerarquía de velocidades de las voces del acorde. */
export interface VoiceVelocityProfile {
  root: number
  inner: number
  extension: number
  top: number
  jitter: number
}

export const VOICE_VELOCITY_DEFAULT: VoiceVelocityProfile = {
  root: 75, // 70-80%: peso del acorde
  inner: 60, // 50-65%: armónica sin saturar
  extension: 85, // 80-90%: acentúa la tensión
  top: 95, // 90-100%: guía el oído
  jitter: 5, // ±5% de variación
}

/** Matriz de definición de sonido (backend JSON): ataque, cuerpo, textura, espacio. */
export interface SoundDesignConfig {
  transient_attack: 'SHARP' | 'SOFT' | 'PADDED'
  body: 'BRIGHT' | 'WARM_SATURATED' | 'DARK_FILTERED'
  texture: 'CLEAN' | 'VINYL_CRACKLE' | 'TAPE_DETUNE' | 'BITCRUSHED'
  cutoff_hz?: number
  detune_lfo_depth?: 'NONE' | 'LOW' | 'MEDIUM'
}

export const PRODUCTION_RECIPES: Partial<Record<Genre, ProductionRecipe>> = {
  trap: {
    rootlessVoicing: true, // 808 marca la fundamental; el piano no la duplica
    turnaroundExtension: true,
    soundDesign: { transient_attack: 'SHARP', body: 'DARK_FILTERED', texture: 'CLEAN', cutoff_hz: 3000 },
  },
  rap: {
    turnaroundExtension: true,
    soundDesign: { transient_attack: 'SOFT', body: 'WARM_SATURATED', texture: 'TAPE_DETUNE', cutoff_hz: 3500 },
  },
  plug: {
    strumTicks: 12,
    turnaroundExtension: true,
    soundDesign: { transient_attack: 'SOFT', body: 'WARM_SATURATED', texture: 'TAPE_DETUNE', detune_lfo_depth: 'LOW', cutoff_hz: 3500 },
  },
  detroit: {
    chordBarsOverride: [0, 100, 0, 0], // 2 compases por acorde: frase espaciosa
    alternate2: true, // 2 acordes que alternan (I–V), frase de 4-8 compases
    leadDensity: 0.4,
    genreGains: { bass: 0.95, lead: 0.7 }, // "el donk manda" = protagonista
    rootlessVoicing: true,
    soundDesign: { transient_attack: 'SHARP', body: 'BRIGHT', texture: 'CLEAN' },
  },
  reggaeton: {
    rootlessVoicing: true, // sub-synth senoidal apoya al kick; no duplicar raíz
    soundDesign: { transient_attack: 'SHARP', body: 'WARM_SATURATED', texture: 'CLEAN' },
  },
}

/**
 * Patrones de bajo por género: steps = pasos del compás donde suena el bajo,
 * dur16 = duración en 1/16, glide = si usa portamento entre notas.
 * Aprendido del catálogo real: trap 808 largo con glide, reggaetón dembow,
 * rap boombap con notas intermedias, detroit donk staccato, plug Zaytoven octavas.
 */
export interface BassPatternConfig {
  steps: number[]
  dur16: number
  glide: boolean
  octaveJump?: boolean
}

export const BASS_PATTERNS: Record<Genre, BassPatternConfig> = {
  trap: { steps: [1], dur16: 4, glide: true }, // 808 largo con glide entre acordes
  rap: { steps: [1, 5, 9, 13], dur16: 1, glide: false }, // boombap con notas intermedias
  plug: { steps: [1, 9], dur16: 2, glide: true, octaveJump: true }, // Zaytoven octavas
  detroit: { steps: [1, 5, 9, 13], dur16: 0.5, glide: false }, // donk staccato
  reggaeton: { steps: [1, 4, 7, 10], dur16: 0.75, glide: false }, // bajo dembow
}

/**
 * Patrones de fill de batería por género y rol de sección.
 * Cada fill es un array de {step, instrumento, velocity} en los últimos 4 pasos del compás.
 * El rol define qué tan denso es el fill (coro denso, verso sutil, intro sin fill).
 */
export interface FillHit {
  step: number // 12-15 (últimos 4 pasos del compás)
  inst: 'snare' | 'kick' | 'hat' | 'perc'
  velBoost: number // incremento de velocity
}

export interface FillPatternConfig {
  hits: FillHit[]
  weight: number // peso para que el fill se use en ciertos roles
}

export const FILL_PATTERNS: Record<Genre, Record<string, FillPatternConfig>> = {
  trap: {
    roll: {
      hits: [
        { step: 12, inst: 'snare', velBoost: 8 },
        { step: 13, inst: 'snare', velBoost: 12 },
        { step: 14, inst: 'snare', velBoost: 16 },
        { step: 15, inst: 'snare', velBoost: 20 },
        { step: 13, inst: 'hat', velBoost: 4 },
        { step: 15, inst: 'hat', velBoost: 4 },
      ],
      weight: 1,
    },
    minimal: {
      hits: [
        { step: 15, inst: 'snare', velBoost: 10 },
        { step: 14, inst: 'perc', velBoost: 6 },
      ],
      weight: 0.3,
    },
  },
  rap: {
    classic: {
      hits: [
        { step: 12, inst: 'snare', velBoost: 6 },
        { step: 14, inst: 'snare', velBoost: 8 },
        { step: 15, inst: 'hat', velBoost: 4 },
      ],
      weight: 1,
    },
    ghost: {
      hits: [
        { step: 13, inst: 'snare', velBoost: -10 },
        { step: 15, inst: 'kick', velBoost: 4 },
      ],
      weight: 0.4,
    },
  },
  plug: {
    soft: {
      hits: [
        { step: 14, inst: 'snare', velBoost: 6 },
        { step: 15, inst: 'hat', velBoost: 3 },
      ],
      weight: 1,
    },
    none: {
      hits: [],
      weight: 0.5,
    },
  },
  detroit: {
    aggressive: {
      hits: [
        { step: 12, inst: 'snare', velBoost: 15 },
        { step: 13, inst: 'snare', velBoost: 15 },
        { step: 14, inst: 'snare', velBoost: 15 },
        { step: 15, inst: 'snare', velBoost: 20 },
        { step: 12, inst: 'hat', velBoost: 8 },
        { step: 14, inst: 'hat', velBoost: 8 },
      ],
      weight: 1,
    },
    triple: {
      hits: [
        { step: 13, inst: 'snare', velBoost: 12 },
        { step: 14, inst: 'snare', velBoost: 12 },
        { step: 15, inst: 'snare', velBoost: 16 },
      ],
      weight: 0.6,
    },
  },
  reggaeton: {
    break: {
      hits: [
        { step: 12, inst: 'perc', velBoost: 10 },
        { step: 14, inst: 'perc', velBoost: 10 },
      ],
      weight: 1,
    },
    silence: {
      hits: [], // el fill es silencio dramático
      weight: 0.7,
    },
  },
}

// Pesos de fill por rol de sección (qué tan probable es usar fill denso)
export const FILL_WEIGHT_BY_ROLE: Record<string, number> = {
  intro: 0.1, // casi sin fills
  pre: 0.6,
  coro: 1.0, // fills densos
  estrofa: 0.4,
  outro: 0.8,
}