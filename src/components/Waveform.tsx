import { useEffect, useRef } from 'react'

export function Waveform({ getWaveform }: { getWaveform: () => Float32Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const W = canvas.width
          const H = canvas.height
          ctx.clearRect(0, 0, W, H)
          const data = getWaveform()
          const n = data.length
          if (n === 0) {
            raf = requestAnimationFrame(draw)
            return
          }
          const mid = H / 2
          const grad = ctx.createLinearGradient(0, 0, W, 0)
          grad.addColorStop(0, '#22d3ee')
          grad.addColorStop(1, '#a78bfa')
          ctx.strokeStyle = grad
          ctx.lineWidth = 2
          ctx.shadowColor = 'rgba(34,211,238,0.45)'
          ctx.shadowBlur = 8
          ctx.beginPath()
          for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * W
            const y = mid + data[i] * mid * 0.92
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [getWaveform])

  return <canvas ref={canvasRef} className="wave-canvas" width={800} height={200} />
}

export function rmsOf(a: Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i]
  const rms = Math.sqrt(sum / a.length)
  return Math.min(rms * 3.2, 1)
}