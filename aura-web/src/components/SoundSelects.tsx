import type { SoundBundle } from '../core/types'
import { PRESET_GROUPS } from '../engine/sounds'

const KIND_LABELS: Record<keyof SoundBundle, string> = {
  piano: 'Piano',
  pad: 'Pad',
  bass: 'Bajo',
  lead: 'Lead',
}

interface Props {
  bundle: SoundBundle
  onChange: (bundle: SoundBundle) => void
}

export function SoundSelects({ bundle, onChange }: Props) {
  return (
    <div className="sound-selects">
      {(['piano', 'pad', 'bass', 'lead'] as (keyof SoundBundle)[]).map((kind) => (
        <div className="field" key={kind}>
          <label>{KIND_LABELS[kind]}</label>
          <select
            className="select"
            value={bundle[kind]}
            onChange={(e) => onChange({ ...bundle, [kind]: e.target.value })}
          >
            {PRESET_GROUPS[kind].map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}