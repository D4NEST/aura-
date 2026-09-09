import type { Emotion, Genre, Section } from '../core/types'
import { EMOTION_LABELS, GENRE_LABELS } from '../core/constants'

const EMOTION_COLORS: Record<Emotion, string> = {
  tristeza: '#60a5fa',
  ira: '#f87171',
  amor: '#e879f9',
  decepcion: '#9aa4b2',
  nostalgia: '#fbbf24',
}

const EMOTIONS = Object.keys(EMOTION_LABELS) as Emotion[]
const GENRES = Object.keys(GENRE_LABELS) as Genre[]
const BAR_OPTIONS = [2, 4, 8, 12, 16]

interface Props {
  sections: Section[]
  playingSection?: number | null
  onChange: (sections: Section[]) => void
  onTap: (index: number) => void
}

export function SongEditor({ sections, playingSection, onChange, onTap }: Props) {
  const update = (index: number, patch: Partial<Section>) => {
    const next = sections.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange(next)
  }

  return (
    <section className="card">
      <div className="card-title">
        <h2>Estructura de canción</h2>
        <span className="chip">
          {sections.reduce((a, s) => a + s.bars, 0)} compases
        </span>
      </div>

      <div className="section-list">
        {sections.map((s, i) => (
          <div
            key={i}
            className={`section-row${playingSection === i ? ' is-playing' : ''}`}
            onClick={() => onTap(i)}
          >
            <span className="section-index">{i + 1}</span>
            <span
              className="section-emotion"
              style={{ background: EMOTION_COLORS[s.emotion] }}
            />
            <div className="section-fields">
              <input
                className="section-name"
                value={s.name}
                aria-label="nombre de sección"
                onChange={(e) => {
                  e.stopPropagation()
                  update(i, { name: e.target.value })
                }}
              />
              <select
                className="select"
                value={s.emotion}
                aria-label="emoción"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => update(i, { emotion: e.target.value as Emotion })}
              >
                {EMOTIONS.map((em) => (
                  <option key={em} value={em}>
                    {EMOTION_LABELS[em]}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={s.genre}
                aria-label="género"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => update(i, { genre: e.target.value as Genre })}
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {GENRE_LABELS[g]}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={s.bars}
                aria-label="compases"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => update(i, { bars: Number(e.target.value) })}
              >
                {BAR_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b} compases
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-ghost btn-danger section-delete"
              onClick={(e) => {
                e.stopPropagation()
                onChange(sections.filter((_, j) => j !== i))
              }}
              aria-label="eliminar sección"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn btn-ghost"
        style={{ marginTop: 12, width: '100%' }}
        onClick={() =>
          onChange([
            ...sections,
            { name: 'nuevo', emotion: 'tristeza', genre: 'trap', bars: 4 },
          ])
        }
      >
        + Agregar sección
      </button>
    </section>
  )
}