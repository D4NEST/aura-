import { ROOTS } from '../core/constants'

interface Props {
  root: string
  tempo: number
  onRoot: (r: string) => void
  onTempo: (t: number) => void
  onRegenerate: () => void
  generating: boolean
}

export function TransportControls({ root, tempo, onRoot, onTempo, onRegenerate, generating }: Props) {
  const presets = [80, 92, 98, 120, 140, 160]
  return (
    <div className="top-controls">
      <div className="field">
        <label>Tonalidad</label>
        <select className="select" value={root} onChange={(e) => onRoot(e.target.value)}>
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
            value={tempo}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v) && v >= 40 && v <= 220) onTempo(Math.round(v))
            }}
          />
          <input
            className="bpm-range"
            type="range"
            min={40}
            max={220}
            step={1}
            value={tempo}
            onChange={(e) => onTempo(Number(e.target.value))}
          />
        </div>
        <div className="bpm-presets">
          {presets.map((p) => (
            <button
              key={p}
              className={`chip${tempo === p ? ' chip-on' : ''}`}
              type="button"
              onClick={() => onTempo(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" onClick={onRegenerate} disabled={generating}>
        <span aria-hidden>◆</span>
        {generating ? 'Generando…' : 'Generar'
          }
      </button>
    </div>
  )
}