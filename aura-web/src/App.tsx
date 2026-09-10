import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateSong, buildSongMidi, buildStemMidi, downloadMidi } from './core'
import { buildCasualStructure } from './core/structure'
import { MOODS_PER_GENRE } from './core/constants'
import { resolveDrumBank } from './engine/loopBank'
import type { CasualMode, Emotion, Genre, Section, SongResult, SoundBundle } from './core'
import { AuraPlayer, type TrackVoice } from './engine/player'
import { SOUND_DEFAULTS } from './engine/sounds'
import { Waveform } from './components/Waveform'
import { VUMeters } from './components/VUMeters'
import { SongEditor } from './components/SongEditor'
import { TransportControls } from './components/TransportControls'
import { CreateView } from './components/CreateView'
import { SoundSelects } from './components/SoundSelects'

const DEFAULT_SECTIONS: Section[] = [
  { name: 'intro', emotion: 'nostalgia', genre: 'trap', bars: 4 },
  { name: 'verso_1', emotion: 'tristeza', genre: 'trap', bars: 8 },
  { name: 'coro', emotion: 'ira', genre: 'detroit', bars: 8 },
  { name: 'puente', emotion: 'decepcion', genre: 'plug', bars: 4 },
  { name: 'outro', emotion: 'amor', genre: 'rap', bars: 4 },
]

function trackLabel(track: { channel: number }): string {
  switch (track.channel) {
    case 9:
      return 'Batería'
    case 1:
      return 'Bajo'
    case 2:
      return 'Melodía'
    default:
      return 'Acordes'
  }
}

export default function App() {
  const [mode, setMode] = useState<'crear' | 'pro'>('crear')
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS)
  const [root, setRoot] = useState('F#')
  const [tempo, setTempo] = useState(144)
  const [genre, setGenre] = useState<Genre>('trap')
  const [mood, setMood] = useState<Emotion>('tristeza')
  const [casualMode, setCasualMode] = useState<CasualMode>('24')
  const [loop, setLoop] = useState(true)
  const [bundle, setBundle] = useState<SoundBundle>({ ...SOUND_DEFAULTS.trap })
  const [song, setSong] = useState<SongResult | null>(null)
  const [voices, setVoices] = useState<TrackVoice[] | null>(null)
  const [labels, setLabels] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lengthSec, setLengthSec] = useState(0)
  const [sampleWarning, setSampleWarning] = useState<string | null>(null)
  const playerRef = useRef<AuraPlayer | null>(null)
  const songRef = useRef<SongResult | null>(null)
  const tempoRef = useRef(tempo)
  tempoRef.current = tempo
  const tempoTouchedRef = useRef(false)
  const bundleRef = useRef(bundle)
  bundleRef.current = bundle
  const lengthRef = useRef(0)
  const loopKeyRef = useRef<{ genre: Genre; mood: Emotion; bpm: number } | null>(null)

  const player = useMemo(() => {
    const p = new AuraPlayer()
    playerRef.current = p
    return p
  }, [])

  useEffect(() => {
    const onSampleError = (ev: Event) => {
      const file = (ev as CustomEvent).detail?.file
      setSampleWarning(
        `Algunos samples no cargaron (${file ?? 'desconocido'}) — se usa el kit sintetizado.`,
      )
    }
    window.addEventListener('aura:sample-error', onSampleError)
    return () => window.removeEventListener('aura:sample-error', onSampleError)
  }, [])

  const prepareSong = useCallback((s: SongResult, t: number) => {
    songRef.current = s
    setSong(s)
    setPlaying(false)
    setVoices(null)
    const sec = (s.totalTicks / s.ticksPerBeat) / (t / 60)
    lengthRef.current = sec
    setLengthSec(sec)
    setLabels(s.tracks.map((tk) => trackLabel(tk)))
  }, [])

  const applyLoop = useCallback(
    (on: boolean) => {
      player.setLoop(on ? lengthRef.current : null)
    },
    [player],
  )

  const stopPlayback = useCallback(async () => {
    await player.stop()
    setPlaying(false)
    setVoices(null)
  }, [player])

  const changeGenre = useCallback(
    (g: Genre) => {
      setGenre(g)
      setBundle({ ...SOUND_DEFAULTS[g] })
      void stopPlayback()
    },
    [stopPlayback],
  )

  const changeMood = useCallback(
    (e: Emotion) => {
      setMood(e)
      void stopPlayback()
    },
    [stopPlayback],
  )

  const changeRoot = useCallback(
    (r: string) => {
      setRoot(r)
      void stopPlayback()
    },
    [stopPlayback],
  )

  const handleTempo = useCallback((t: number) => {
    tempoTouchedRef.current = true
    setTempo(Math.max(40, Math.min(220, t)))
  }, [])

  const createCasual = useCallback(async () => {
    setGenerating(true)
    setSampleWarning(null)
    try {
      await stopPlayback()
      const structure = buildCasualStructure(genre, mood, casualMode)
      const moodTempo =
        MOODS_PER_GENRE[genre].find((m: { emotion: Emotion }) => m.emotion === mood)
          ?.tempo ?? tempoRef.current
      const t = tempoTouchedRef.current ? tempoRef.current : moodTempo
      if (!tempoTouchedRef.current) setTempo(moodTempo)
      const s = generateSong(structure, root, t, 480)
      prepareSong(s, t)
      if (loop) applyLoop(true)
      loopKeyRef.current = { genre, mood, bpm: t }
      const v = await player.play(
        s,
        t,
        bundleRef.current,
        true,
        await resolveDrumBank(genre, mood, t),
      )
      if (loop) player.setLoop(lengthRef.current)
      setVoices(v)
      setPlaying(true)
    } catch (e) {
      console.error('[AURA] createCasual falló:', e)
      await player.stop()
    } finally {
      setGenerating(false)
    }
  }, [genre, mood, casualMode, root, loop, prepareSong, applyLoop, player, stopPlayback])

  const regenerate = useCallback(() => {
    const s = generateSong(sections, root, tempo, 480)
    prepareSong(s, tempo)
  }, [sections, root, tempo, prepareSong])

  const togglePlay = useCallback(async () => {
    const s = songRef.current
    if (!s) return
    if (playing) {
      await player.stop()
      setPlaying(false)
      setVoices(null)
      return
    }
    setSampleWarning(null)
    try {
      const v = await player.play(
        s,
        tempoRef.current,
        bundle,
        true,
        mode === 'crear' && loopKeyRef.current
          ? await resolveDrumBank(
              loopKeyRef.current.genre,
              loopKeyRef.current.mood,
              loopKeyRef.current.bpm,
            )
          : null,
      )
      if (loop) player.setLoop(lengthRef.current)
      setVoices(v)
      setPlaying(true)
    } catch (e) {
      console.error('[AURA] togglePlay falló:', e)
      await player.stop()
    }
  }, [playing, player, bundle, loop, mode])

  const tap = useCallback(async (index: number) => {
    const s = songRef.current
    if (!s) return
    const startBar = sections.slice(0, index).reduce((a, sec) => a + sec.bars, 0)
    const startTick = startBar * s.ticksPerBeat * 4
    await player.stop()
    const single = {
      ...s,
      tracks: s.tracks.map((t) => ({
        ...t,
        notes: t.notes
          .filter((n) => n.tick >= startTick)
          .map((n) => ({ ...n, tick: n.tick - startTick })),
      })),
    }
    const v = await player.play(single, tempoRef.current, bundle)
    setVoices(v)
    setPlaying(true)
  }, [player, sections, bundle])

  const getWaveform = useCallback(
    () => player.getMasterWaveform(),
    [player],
  )

  const exportFull = useCallback(() => {
    if (!songRef.current) return
    const data = buildSongMidi(songRef.current, tempoRef.current)
    downloadMidi(data, `AURA_${root}_${tempoRef.current}bpm_Full.mid`)
  }, [root])

  const exportStems = useCallback(() => {
    const s = songRef.current
    if (!s) return
    for (const track of s.tracks) {
      const key = track.name.match(/^(\w+)/)?.[1]?.toLowerCase() ?? 'track'
      downloadMidi(
        buildStemMidi(track, s, tempoRef.current),
        `AURA_${root}_${tempoRef.current}bpm_stem_${key}.mid`,
      )
    }
  }, [root])

  const signalSection = (
    <>
      <section className="card">
        <div className="card-title">
          <h2>Señal</h2>
          <span className="chip">{song ? `${lengthSec.toFixed(1)}s` : '—'}</span>
        </div>

        {song ? (
          <div className="signal-grid">
            <SoundSelects bundle={bundle} onChange={setBundle} />
            <VUMeters voices={voices} labels={labels} />
            <Waveform getWaveform={getWaveform} />
            <div className="stat-row">
              <div className="stat">
                <div className="k">Compases</div>
                <div className="v">{song.totalBars}</div>
              </div>
              <div className="stat">
                <div className="k">BPM</div>
                <div className="v">{tempo}</div>
              </div>
              <div className="stat">
                <div className="k">Notas</div>
                <div className="v">
                  {song.tracks.reduce((a, t) => a + t.notes.length, 0)}
                </div>
              </div>
            </div>
            <div className="prog-list">
              {song.progressions.map((p, i) => (
                <div key={i} className="prog-item">
                  <span className="prog-name">
                    {p.name}
                    <em>{p.genre}</em>
                  </span>
                  <span className="prog-degrees">
                    {p.progression.map((d, j) => (
                      <b
                        key={j}
                        className={p.source === 'real' ? 'is-real' : undefined}
                        title={`acorde ${d}`}
                      >
                        {d}
                      </b>
                    ))}
                  </span>
                  <span
                    className={`prog-source${p.source === 'real' ? ' is-real' : ''}`}
                    title={p.mutated ? 'con 1 grado mutado' : undefined}
                  >
                    {p.source}
                    {p.mutated ? '·mut' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportFull} disabled={!song}>
                Exportar .mid (completo)
              </button>
              <button className="btn" onClick={exportStems} disabled={!song}>
                Exportar stems
              </button>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-faint)', padding: '12px 0', textAlign: 'center' }}>
            Generá tu beat para escucharlo y ver la señal.
          </p>
        )}
      </section>
    </>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            AURA
            <small>Emotional Beat Engine</small>
          </div>
        </div>
        <nav className="mode-tabs" aria-label="modo">
          <button
            className={`mode-tab${mode === 'crear' ? ' is-active' : ''}`}
            onClick={() => setMode('crear')}
          >
            Crear
          </button>
          <button
            className={`mode-tab${mode === 'pro' ? ' is-active' : ''}`}
            onClick={() => setMode('pro')}
          >
            Pro
          </button>
        </nav>
        {mode === 'pro' && (
          <TransportControls
            root={root}
            tempo={tempo}
            onRoot={setRoot}
            onTempo={handleTempo}
            onRegenerate={regenerate}
            generating={false}
          />
        )}
      </header>

      {mode === 'crear' ? (
        <CreateView
          genre={genre}
          mood={mood}
          root={root}
          tempo={tempo}
          mode={casualMode}
          loop={loop}
          bundle={bundle}
          onGenre={changeGenre}
          onMood={changeMood}
          onRoot={changeRoot}
          onTempo={handleTempo}
          onMode={setCasualMode}
          onLoop={(v) => {
            setLoop(v)
            applyLoop(v)
          }}
          onBundle={setBundle}
          onGenerate={createCasual}
          generating={generating}
        />
      ) : (
        <div className="grid">
          <SongEditor
            sections={sections}
            playingSection={null}
            onChange={setSections}
            onTap={tap}
          />
          {signalSection}
        </div>
      )}

      <div className="dock">
        {sampleWarning && (
          <span className="dock-warn">{sampleWarning}</span>
        )}
        <span className="dock-status">
          {playing
            ? `${mode === 'crear' ? `${genre} · ${mood}` : ''} ${root} · ${tempo} BPM`
            : 'Detenido'}
        </span>
        {mode === 'crear' && (
          <button
            className={`loop-btn dock-loop${loop ? ' is-active' : ''}`}
            title="Loop infinito"
            onClick={() => {
              const next = !loop
              setLoop(next)
              applyLoop(next)
            }}
          >
            ∞
          </button>
        )}
        <button
          className={`play-btn${playing ? ' is-playing' : ''}`}
          onClick={togglePlay}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
      </div>
    </div>
  )
}