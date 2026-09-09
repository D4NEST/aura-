import type { CasualMode, Emotion, Genre, SoundBundle } from '../core/types'
import {
  GENRE_LABELS,
  GENRE_DESCRIPTIONS,
  GENRE_TAGS,
  MOODS_PER_GENRE,
  ROOTS,
} from '../core/constants'
import { SoundSelects } from './SoundSelects'

const GENRES = Object.keys(GENRE_LABELS) as Genre[]
const MODES: { id: CasualMode; label: string; hint: string; bars: number }[] = [
  { id: '12', label: '12', hint: 'loop corto', bars: 12 },
  { id: '24', label: '24', hint: 'loop medio', bars: 24 },
  { id: 'full', label: 'Flow', hint: 'canción completa', bars: 52 },
]

const ACCENTS: Record<Genre, string> = {
  trap: 'var(--cyan)',
  rap: 'var(--orange)',
  plug: 'var(--magenta)',
  detroit: 'var(--violet)',
  reggaeton: 'var(--magenta)',
}

interface Props {
  genre: Genre
  mood: Emotion
  root: string
  tempo: number
  mode: CasualMode
  loop: boolean
  bundle: SoundBundle
  onGenre: (g: Genre) => void
  onMood: (e: Emotion) => void
  onRoot: (r: string) => void
  onTempo: (t: number) => void
  onMode: (m: CasualMode) => void
  onLoop: (v: boolean) => void
  onBundle: (b: SoundBundle) => void
  onGenerate: () => void
  generating: boolean
}

export function CreateView(props: Props) {
  const moods = MOODS_PER_GENRE[props.genre]

  return (
    <main className="create-view">
      <section className="genre-picker">
        <div className="card-title">
          <h2>Elegí tu género</h2>
          <span className="chip">{GENRE_LABELS[props.genre]}</span>
        </div>
        <div className="genre-grid">
          {GENRES.map((g) => {
            const accent = ACCENTS[g]
            const active = props.genre === g
            return (
              <button
                key={g}
                className={`genre-card${active ? ' is-active' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${accent}1f, var(--surface) 55%)`,
                  borderColor: active ? accent : 'var(--border)',
                }}
                onClick={() => props.onGenre(g)}
              >
                <div className="genre-card-head">
                  <span
                    className="genre-dot"
                    style={{ background: accent, boxShadow: `0 0 14px ${accent}` }}
                  />
                  <span className="genre-name">{GENRE_LABELS[g]}</span>
                </div>
                <p className="genre-desc">{GENRE_DESCRIPTIONS[g]}</p>
                <div className="genre-tags">
                  {GENRE_TAGS[g].map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Vibe</h2>
          <span className="chip">{moods.find((m) => m.emotion === props.mood)?.label}</span>
        </div>
        <div className="mood-pills">
          {moods.map((m) => (
            <button
              key={m.emotion}
              className={`mood-pill${props.mood === m.emotion ? ' is-active' : ''}`}
              onClick={() => {
                props.onMood(m.emotion)
              }}
            >
              <span className="mood-label">{m.label}</span>
              <span className="mood-tempo">{m.tempo} BPM</span>
            </button>
          ))}
        </div>

        <div className="create-row">
          <div className="field">
            <label>Tonalidad</label>
            <select
              className="select"
              value={props.root}
              onChange={(e) => props.onRoot(e.target.value)}
            >
              {ROOTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-bpm">
            <label>BPM</label>
            <div className="bpm-row">
              <input
                className="bpm-num"
                type="number"
                min={40}
                max={220}
                step={1}
                value={props.tempo}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= 40 && v <= 220) props.onTempo(Math.round(v))
                }}
              />
              <input
                className="bpm-range"
                type="range"
                min={40}
                max={220}
                step={1}
                value={props.tempo}
                onChange={(e) => props.onTempo(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="mode-segmented" role="group" aria-label="duración">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`seg-btn${props.mode === m.id ? ' is-active' : ''}`}
                onClick={() => props.onMode(m.id)}
                title={`${m.hint} · ${m.bars} compases`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            className={`loop-btn${props.loop ? ' is-active' : ''}`}
            title="Repetir en loop infinito"
            onClick={() => props.onLoop(!props.loop)}
          >
            ∞ Loop
          </button>
        </div>

        <details className="sound-details">
          <summary>Sonido ▾</summary>
          <SoundSelects bundle={props.bundle} onChange={props.onBundle} />
        </details>

        <button
          className="btn btn-primary create-cta"
          onClick={props.onGenerate}
          disabled={props.generating}
        >
          <span aria-hidden>◆</span>
          {props.generating ? 'Creando…' : 'Crear beat'}
        </button>
      </section>
    </main>
  )
}