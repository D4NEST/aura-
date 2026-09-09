import { useEffect, useRef } from 'react'
import type { TrackVoice } from '../engine/player'
import { rmsOf } from './Waveform'

export function VUMeters({ voices, labels = ['Acordes', 'Bajo', 'Melodía', 'Batería'] }: {
  voices: TrackVoice[] | null
  labels?: string[]
}) {
  const fillsRef = useRef<(HTMLDivElement | null)[]>([])
  const numsRef = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (voices) {
        voices.forEach((v, i) => {
          const lvl = rmsOf(v.analyser.getValue() as Float32Array)
          const fill = fillsRef.current[i]
          const num = numsRef.current[i]
          if (fill) fill.style.width = `${(lvl * 100).toFixed(1)}%`
          if (num) num.textContent = `${Math.round(lvl * 100)}`
        })
      }
      raf = requestAnimationFrame(tick)
    }
    if (voices) raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [voices])

  return (
    <div className="vu-strip">
      {labels.map((label, i) => (
        <div className="vu" key={label}>
          <span className="vu-label">{label}</span>
          <div className="vu-track">
            <div
              ref={(el) => {
                fillsRef.current[i] = el
              }}
              className="vu-fill"
            />
          </div>
          <span
            ref={(el) => {
              numsRef.current[i] = el
            }}
            className="vu-num"
          >
            0
          </span>
        </div>
      ))}
    </div>
  )
}