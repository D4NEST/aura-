# Registro de avance — AURA

Fecha: **2026-09-08**

## Logros
- Consolidado el motor completo en un único módulo: `aura_engine.py`.
- Emociones con escala propia: tristeza (menor natural), ira (frigio), amor
  (mayor), decepción (locrio) y nostalgia (pentatónica menor), tónica C3 (48).
- Progresiones principal + alternativa por emoción en grados, incluida la
  variante jazzista de amor `[2,5,7,1]` (ii7 - V7 - Imaj7).
- Funciones armónicas: `note_from_degree`, `chord_from_degree` (terceras
  diatónicas con 7ª/9ª opcionales), `apply_inversion` (root/first/second/open/
  drop2) y `apply_tension_rules` (power chord, sus2, maj7, caída de nota aguda,
  sin cambios).
- Batería de 16 pasos para trap, rap, plug y detroit con `DRUM_MAP` GM
  (kick 36, snare 38, hat 42, open_hat 46, perc 39).
- Exportación: MIDI completo + stems (chords/bass/drums) con creación
  automática de `generated_midi/` vía `os.makedirs(exist_ok=True)`.
- `__main__` genera las 5 emociones con género `trap` a 140 BPM.

### Sesión 2026-09-08 (integración de canción estructurada)
- **Estructura de canción**: `generate_full_song` y `export_song_stems`
  recorren secciones `(seccion, emocion, genero, compases)` alineadas en una
  línea de tiempo continua.
- **Transposición** por `root_key` usando `NOTE_OFFSETS` (semitonos sobre C).
- **Humanización**: velocities aleatorias, micro-strumming (15 ms) en acordes
  y micro-separación (0.95x) en batería.
- **Fills automáticos** de batería (redoble de snare + percusión) en las 4
  últimas semicorcheas del último compás de cada sección.
- Verificado: canción demo `['nostalgia' intro 4 / 'tristeza' verse 8 /
  'ira' coro 8 / 'decepcion' puente 4 (plug) / 'amor' outro 4]`, F#, 144 BPM,
  duración 46.67 s (28 compases), 69 notas de acordes / 19 de bajo / 489 de
  batería con 3 stems correctos.

### Sesión 2026-09-08 (motor alternativo con mido)
- Nuevo módulo **`aura_engine_mido.py`**: mismo motor (escalas, progresiones,
  armonía, estructura de canción) que escribe MIDI type 1 con `mido`
  (3 pistas: Chords ch0, Bass ch1, Drums ch9 de percusión GM).
- `requirements.txt` ahora incluye `mido` junto a `pretty_midi`.
- **Fix sobre la lógica pegada**: el silencio de batería ya no emite un
  `note_off` fantasma con note=0; se acumula en un `pending` y se aplica como
  delta del siguiente evento real.
- `mutate_progression` mantiene "un grado cambiado y distinto", acotado a la
  escala cuando se pasa.
- Verificado: interop con pretty_midi (lee el archivo mido: 144 BPM, 47.71 s),
  conteos 70 note_on de acordes / 19 de bajo / 502 de batería en el `_Full.mid`.
- Prefijo de salida `AURA_mido_{root}_{tempo}bpm` para no pisar los archivos
  del motor pretty_midi (`AURA_Song_*`).

### Sesión 2026-09-08 (motor nativo sin dependencias)
- Nuevo módulo **`aura_engine_native.py`**: escribe MIDI 1.0 binario con la
  librería estándar (`struct`): `MThd` + pistas `MTrk`, VLQ propio
  (`write_varlen`), clase `MidiTrackWriter`. Cero dependencias externas.
- Misma armonía/progresiones, con `set_tempo` + `time_signature` (4/4) en la
  pista de acordes y fills de batería al cierre de cada sección.
- **Dos bugs corregidos de la lógica pegada** (el archivo no re-parseaba):
  1. Cabecera `MThd` sin el campo `uint32` de longitud
     (`b'MThd' + pack('>HHH',6,1,3)` fecha bytes de tamaño vs. datos ->
     `b'MThd' + pack('>IHH', 6, 1, 3)`). mido lee `uint32`, se desincronizaba.
  2. Los meta `set_tempo`/`time_signature` llevaban un delta embebido
     (`b'\x00'` de más) duplicado por el delta que añade `MidiTrackWriter` ->
     stream corrupto y pretty_midi leía 120 BPM por defecto. Ahora los meta se
     pasan SIN delta.
- Verificado: con mido (tipo 1, `set_tempo` 144, 4/4, 3 pistas: 72/21/502
  note_on) y con pretty_midi (144 BPM, 46.66 s).
- Prefijo de salida `AURA_native_{root}_{tempo}bpm` (no pisa a los demás).
- `requirements.txt` sin cambios: el motor nativo no añade dependencias.

### Sesión 2026-09-08 (web app + core TypeScript: `aura-web/`)
- Capa **`aura-core`** en TypeScript (hermana del motor Python) en
  `aura-web/src/core/`: constantes, armonía (`noteFromDegree`,
  `chordFromDegree`, `applyInversion`, `applyTensionRules`,
  `mutateProgression` con grado distinto garantizado), `generateSong`
  (estructura completa) y `midi.ts` (escritor binario MIDI 1.0 nativo en
  TS: VLQ, MThd/MTrk, set_tempo, 4/4). Un solo cerebro para browser y Node.
- **Verificación cruzada**: `npm run verify` genera la canción F#/144bpm de
  5 secciones con el core TS; el resultado se valida con mido + pretty_midi:
  tipo 1, `set_tempo` 144, 4/4, 28 compases, 46.66 s, batería 502 note_on
  (idéntica al backend nativo Python). Meta de tempo solo en la pista 0 para
  no generar warnings en pretty_midi.
- **Stack**: Vite 5 + React 18 + TypeScript estricto + Tone.js 14 + tsx
  (verificación). Build de producción 114 KB gzip; servido y comprobado con
  `vite preview`.
- **UI dark-first** con la paleta propuesta: fondos #121820/#1A1A1E, bordes
  1px de baja opacidad, acentos cian→violeta→magenta solo para señal/CTAs,
  cards estilo dashboard, Inter, dock de transporte fijo.
- **Player**: `AuraPlayer` con Tone.js — sintetizadores por pista
  (PolySynth piano tipo triangle8, Synth sine para bajo, kit de batería
  sintetizado: MembraneSynth/noise/MetalSynth), scheduling por transport,
  AnalyserNode por pista para VU meters + waveform maestro en canvas.
- Interacción: editor de estructura (secciones con nombre/emoción/género/
  compases), tonalidad y BPM, reproducción/pausa, tap en una sección para
  escuchar desde ella, y **export .mid completo + stems** descargable.

### Sesión 2026-09-08 (PWA instalable)
- Integrado **`vite-plugin-pwa`** (generateSW): `manifest.webmanifest`, `sw.js`
  con Workbox (precache navegación + runtime cache para Google Fonts), registro
  automático con `registerSW` en un módulo aparte (`src/registerSW.ts`).
- Manifest: nombre/short_name, `display: standalone`, theme/background
  `#121820`, `lang: es`, iconos 192/512 + maskable 512.
- **Iconos generados sin dependencias** (`scripts/make_icons.py`, PNG puro
  zlib/struct): "A" geométrica con degradado cian→violeta y esquinas
  redondeadas; favicon SVG equivalente.
- Verificado vía `vite preview`: `/`, `/manifest.webmanifest`, `/sw.js`,
  `/icon-*.png` y `/favicon.svg` → 200 con MIME correctos; la lógica de
  registro de SW está embebida en el bundle de producción. El manifest quedó
  en UTF-8 correcto (los `�` vistos en consola cp1252 son solo display).
- Para instalar en el móvil: build + servir por HTTPS/LAN (ver README).
- `.gitignore` añadido en `aura-web/` (`node_modules/`, `dist/`, `.tmp-verify/`).

### Sesión 2026-09-09 (feedbacks de usuario: sonido y armonía)
- **Acotes de rango en la armonía** (`harmony.ts`): nuevas `compactVoicing`
  (tónica ~C3, span máx 21 semitonos) y límites en `applyInversion`/tensiones.
  Verificado con `scripts/verify_voicings.ts` sobre 40 generaciones F#: acordes
  42..71 (C3–B4), span medio 10.8 st, máx 19; bajo 30..40 (octava −2).
- **Mejora del sonido interno** (`player.ts`): piano eléctrico FM
  (FMSynth attack percusivo, decay largo), bajo sub con `MonoSynth` + filtro
  lowpass, y reverb ligero (`Freeverb`) en paralelo al máster.
- **Alertas**: mido+pretty_midi siguen validando el MIDI generado desde TS
  (tipo 1, 144 BPM, 46.66 s, batería 502 note_on). Build PWA intacto.
- **Pendiente del usuario**: alimentar el motor con sus +250 beats .flp
  (export a MIDI por género -> `dataset/`) para estadísticas reales de
  octavas/progresiones/patrones. (Sin desbloquear — a la espera de FL.)

### Sesión 2026-09-09 (modo Crear + bundle de sonidos + dataset pipeline)
- **Dos modos en la app**: `Crear` (tarjetas de género elegantes → Vibe/mood
  por género con BPM propio → "Crear beat" en 1 click) y `Pro` (editor técnico
  intacto: secciones, tonalidad, BPM, export .mid/stems).
- **Estructuras**: templates curated `SONG_FLOW` (intro→pre→coro→estrofa→…→outro,
  52 compases) + loops 12 y 24 compases (`core/structure.ts`, `buildCasualStructure`).
- **Loop infinito**: botón ∞ (siempre en Crear, dock) = `transport.setLoopPoints`.
- **Melodía/lead**: nueva pista `Lead (Melody)` (canal 2) con `generateLead`
  (core/melody.ts): densidad por género (trap 0.28… detroit 0.5), motivos con
  silencios, tensiones del acorde, rango C4..C6. Export como 4º track; MIDI
  validado de nuevo (tipo 1, 144 BPM, 46.66 s, pistas 4, drums 502).
- **Bundle de sonidos** (`engine/sounds.ts`): 4 pianos (Rhodes FM, Acústico,
  DX, Clav), 3 pads (Warm, Sabre, Strings), 4 bajos (Sub 808, Retro, Picked,
  Dist), 4 leads (Mono, Pluck, Saw, Hover). Defaults por género + selectores
  en Pro (Señal) y en Crear (panel "Sonido ▾"). Capa de pad sostenida en el
  player (acordes alargados al 0.42 de vel), VUs ahora muestran Melodía.
- **Baterías pulidas**: matriz de cierre fija (snare+perc), velocidades más
  acotadas (kick 96-108, hats 74-86) → menos alocadas.
- **Dataset pipeline**: `dataset/<genero>/<tonalidad>/` + `scripts/ingest_dataset.ts`
  (npm run ingest, @tonejs/midi): separa batería/melodía/bajo, saca rangos de
  octava, grid de 16 pasos, BPM/duracion por género → `dataset_analysis.json`.
  Probado de punta a punta con un MIDI generado (bajo 30..39, melodía 42..73).
- Build PWA OK (435 kB JS, gzip 122 kB). Pendiente: subir los primeros beats
  reales (1 por género) y volcar las estadísticas a las constantes del motor.

## Decisiones de diseño
- **Grados 1-index** (1 = tónica) en lugar de numerales romanos como texto,
  para facilitar la aritmética de apilamiento y la mutación.
- **Apilamiento por octava**: los grados que exceden la escala se extienden a
  octavas superiores (el apilado de terceras nunca se queda corto en las
  escalas de 5 notas).
- **mutate_progression limitado a la escala**: el grado nuevo se limita a
  1..len(scale) cuando se pasa la escala (escalas cortas no producen grados
  inexistentes). Se preserva la garantía de "un solo grado cambiado y distinto".
- **Variación incorporada en el motor**: 30% de mutación de progresión y 50/50
  de duración (1 o 2 compases) por acorde -> cada generación es distinta.
- **Bajo como fundamental** a octava −2 y acordes "en bloque" con
  micro-strumming leve (15 ms) para dar vida sin romper el compás.
- **Fills automáticos** al final de cada sección (snare roll + perc) como
  marcador de transición; configurables a futuro por sección.
- **Transposición por root_key** y nombres autocontenidos
  `{prefix}_{emotion}_{genre}_{tempo}bpm` / `AURA_Song_{root}_{tempo}bpm`,
  con sanitización de nombres de archivo para Windows.

### Sesión 2026-09-08 (pipeline FLP + reggaetón)
- **Dataset por tonalidad**: 24 tonos × 5 géneros (`trap rap plug detroit reggaeton`)
  = 125 carpetas en `dataset/`, y carpeta `dataset_flp/` para proyectos .flp.
- **Reggaetón en el motor**: patrón dembow en `DRUM_PATTERNS`, moods Perreo 98 /
  Romántico 92 / Crudo 104 / Vintage 96, defaults de sonido (dx/strings/retro/pluck),
  acento magenta y `LEAD_DENSITY 0.36`.
- **Parser FLP** (`scripts/flp_parse.ts`): port del formato binario de pyflp
  (chunk `FLdt`, eventos TLV con longitud LEB128/FLP, texto UTF-16 según versión,
  notas como registros de 24 B). Validado contra fixtures reales `FL 20.8.4.flp`
  (19 canales, 5 patrones, tempo 69.420, plugins BooBass/Fruit Kick/Plucked!) y
  `multi-channel.flp` (rack_channels {0,1}), vía `npm run check:flp`.
- **Ingesta masiva** (`scripts/ingest_flp.ts`): escanea `dataset_flp/<genero>/
  <tonalidad>/*.flp`, clasifica canales (batería/bajo/acordes/lead por nombre +
  registro), mide BPM/compases/densidad/rangos y escribe `dataset_flp_analysis.json`
  con el mismo esquema que `dataset_analysis.json`. `npm run ingest:flp`.

### Sesión 2026-09-09 (documentación de negocio v2)
- **`docs/business/aura_documento_inversores_v2.md`**: documento estratégico para
  inversores con hechos verificados (módulos reales y demo validada), pricing por
  fases — **Founder Program $25/año para los primeros 1.000 usuarios** (capital
  inicial + validación), luego **$79/año** (margen), packs $4 y marketplace 10–15% —
  proyecciones a 3 años etiquetadas como hipótesis, plan de ronda y sección
  legal/privacidad completa.
- **`docs/business/aura_pipeline_y_privacidad_v2.md`**: reemplaza la v1 de
  pipeline/seguridad. Elimina el *security theater* (bloqueo F12, fingerprinting y
  geolocalización de usuario) y lo sustituye por watermarking servidor-side,
  control de acceso RBAC/R2 con Chroot Jail, política de privacidad GDPR/LGPD/LATAM,
  derechos del usuario, DPA y procedimiento DMCA/takedown, licencias marketplace
  (lease/exclusiva) con splits 85/15 y tabla v1→v2 para auditoría.

### Sesión 2026-09-09 (validación de reglas con catálogo real)
- **`scripts/flp_analysis.ts`**: módulo compartido de análisis (clasificación de
  roles, grids, rangos) usado por el ingest y el validador.
- **`scripts/validate_progressions.ts`** (`npm run validate:flp`): somete los
  `.flp` de `C:\Users\Yamileth\Documents\MUSA` (>= 2024) a las reglas del motor:
  detección automática de tonalidad (5 escalas emocionales × 12 tonos, ponderando
  bajo>acordes>melodía), extracción de la progresión por compases y comparación
  contra `PROGRESIONES`. Guarda las referencias en `learned_flp_rules.json`.
- **Resultado real**: 363 proyectos evaluados → 230 cumplen la regla de escala
  (>= 90% in-scale) → **23 cumplen escala + progresión**. Progresiones validadas
  presentes en el catálogo: `nostalgia 1.4.5.1` ×11, `ira 1.2.1.2` ×7,
  `nostalgia 4.1.7.1` ×3, `tristeza 1.6.3.7` ×2 — confirma que las progresiones
  del motor existen en la música real del productor.

### Sesión 2026-09-09 (aprendizaje de progresiones reales)
- **`PROGRESIONES` ampliadas** (`src/core/constants.ts`): cada emoción ahora tiene
  `reales: number[][]` — progresiones descubiertas en el catálogo real. tristeza:
  `[3-1-4-7]`, `[1-4-7-1]`, `[4-1-4-2]`, `[1-7-1-6]`, `[5-3-1]`; ira: `[1-2-1-6]`,
  `[1-2-1-7]`; nostalgia: `[1-4-5-4]`, `[4-1-4-5]`.
- **Selección ponderada** (`harmony.selectProgression`): el motor elige principal
  50% / reales 30% / alternativa 20%, con 30% de mutación. `song.ts` ahora usa
  `selectProgression` (antes solo `principal`).
- **Validador sin duplicación**: `scripts/validate_progressions.ts` importa
  `ESCALAS`/`PROGRESIONES`/`ROOTS` desde el motor (una sola fuente de verdad) y
  matchea también las `reales`.
- **Resultado con el cambio**: 363 proyectos ≥2024 → 230 escala ✓ → **44
  referencias** (antes 23). Ranking: `1.4.5.1` ×11, `1.2.1.2` ×7, y las nuevas
  `5.3.1` ×7, `4.1.4.2` ×6, `1.4.7.1` ×4 — confirma que las aprendidas son las
  más usadas por el productor. `npm run verify` OK, build OK, typecheck OK.

### Sesión 2026-09-09 (velocity humana real)
- **`scripts/learn_velocities.ts`** (`npm run learn:velocities`): mide velocities
  del catálogo (>= 2024) por rol × género, con **jitter intra-proyecto** (cuánto
  varía la velocity dentro de un mismo beat). Escribe `learned_velocities.json`.
  Resultados clave: trap acordes 94±19, plug acordes 75±25, snare jitter ~10,
  kick trap 101.7±7.2.
- **`src/core/humanize.ts`**: `humanVelocity(mean, jitter, rng)` — Box-Muller
  normal, acotada a [1,127].
- **`src/core/constants.ts`**: `VELOCITIES` por género (chords/bass/lead/kick/
  snare/hat/perc) con las medias y jitters aprendidos.
- **`song.ts` / `melody.ts`**: reemplazan el random plano (`70+rng()*26` etc.)
  por `humanVelocity` con perfil por género (lead mantiene +6 de punch en ira).
  Verificado: medias generadas trap acordes 95 vs 94.2 reales, plug 74 vs 74.7.
- `npm run verify` y build OK, typecheck OK.

### Sesión 2026-09-09 (groove / micro-timing)
- **`scripts/learn_groove.ts`** (`npm run learn:groove`): mide el desvío de cada
  nota respecto al grid de 1/16 por paso (0..15) y por género, con media
  robusta (±0.6 de paso) y tasa de notas libres. Escribe `learned_groove.json`.
- **Conclusión del catálogo**: ~99.5% cuantizado al grid (las notas libres son
  ≤2%). Donde hay swing es sistemático en offbeats: **rap** los atrasa ~+5
  ticks, **detroit** adelanta pasos 13/15 (~−5), **reggaetón** adelanta el paso
  15 (~−4), **trap/plug** están grid-locked.
- **`constants.ts`**: `GROOVE` = { groove: {harmony, drums}[16] en fracciones de
  1/16, humanize: tasa de nota libre por género }, fiel a lo medido.
- **`humanize.ts`**: `microOffset(groove, stepInBar, ticksPer16th, humanize,
  rng)` — swing sistemático + jitter humano esporádico en ticks.
- **`song.ts` / `melody.ts`**: batería, acordes, bajo y lead aplican
  `microOffset`. Verificado en ppq 480 (1/16 = 120 ticks): rap offbeat = 145
  (120+25), detroit open_hat 336 (360−24).
- `npm run verify` y build OK, typecheck OK.

### Sesión 2026-09-09 (rangos de octava reales por género)
- **`scripts/learn_ranges.ts`** (`npm run learn:ranges`): percentiles
  P1/P5/P25/P50/P75/P95/P99 de altura de nota por rol (chords/bass/lead) ×
  género sobre el catálogo (>= 2024). Escribe `learned_ranges.json`.
- **Datos reales**: bajo P50 42–48 (trap 42, plug 46, rap 48), lead P50 71–74,
  acordes P50 58–64. El bass del motor estaba una octava abajo (30..40) y el
  lead en C3; ambos se ajustaron al catálogo.
- **`constants.ts`**: `RANGES` por género { chords, bass, lead } (ventanas
  P5..P95). **`humanize.ts`**: `withinRange(pitch, window)` — transpose ±12
  robusto (evita oscilación con ventanas < octava).
- **`song.ts`**: bajo a octava −1 y clamp en ventana por género; acordes
  clamp. **`melody.ts`**: lead en tónica 60 (C4) + clamp.
- **Verificado (P5/P50/P95 generado vs catálogo)**: trap bass 36/44/46 vs
  26/42/52, plug bass 44/48/51 vs 39/46/58, trap lead 67/72/77 vs 64/74/92.
- `npm run verify` y build OK, typecheck OK.

### Sesión 2026-09-09 (ritmo armónico real por sección)
- **`scripts/learn_harmony.ts`** (`npm run learn:harmony`): detecta cambios de
  acorde por el bajo (nuevo pitch-class = nuevo acorde; si no hay bajo, usa los
  acordes) y mide cuántos compases aguanta cada acorde, por género. Escribe
  `learned_harmony.json`.
- **Dato real**: el catálogo cambia de acorde casi cada compás — trap 1b 93% /
  2b 6%, detroit 1b 88% / 2b 10%, rap/plug/reggaetón 1b 98-99%.
- **`constants.ts`**: `HARMONIC_RHYTHM` (pesos por compás por género).
  **`humanize.ts`**: `pickWeighted(weights, rng)`.
- **`song.ts`**: la duración del acorde se elige con el ritmo del género real y
  se modula por sección (`Section.role` añadido a `types.ts`): intro/outro
  tienden a 2 compases, coro a 1 (stacatto), pre/estrofa neutro (género).
  Antes era un 50/50 plano de 1-2 compases.
- Verificado: intro primer acorde 2 compases, coro 1 compás. `npm run verify` y
  build OK.

## Pendientes
- Melodía/plomo generado a partir de la armonía.
- *Scales por acorde* derivadas de la melodía (no solo la escala de la emoción).
- Fills variados y dirigidos por sección (breaks sin batería, címbolos, swing).
- Armonía alternativa por sección (usar 'alternativas' del diccionario).
- Renderizado a audio (WAV/MP3) desde el MIDI.
- Web: manifest PWA + instalable en el teléfono; sampleado de batería real en
  vez de síntesis; visualización de acordes/progresión en vivo; controles
  táctiles (knobs/faders) con el estilo skeuomórfico; transporte con seek
  sobre la waveform.
- VST: definir arquitectura (fase 2) — ruta utilidad/generador MIDI
  (JUCE/Rust) vs. instrumento que sintetiza audio.
- **Ingesta FLP**: exportar MIDI por instrumento (stems) desde los FLP del
  artista, y afinar la clasificación batería/bajo/acordes/lead con proyectos
  reales una vez subidos a `dataset_flp/`.

## Siguiente paso
Generar una pista melódica ligada a la progresión (selección de notas de la
escala sobre el acorde activo con probabilidades ponderadas) e integrarla en
`generate_full_song` como cuarto instrumento (plomo), validando la canción demo.
## Sesi�n #6 � App: Crear reproduce, cadena de audio, progresiones verificables
- 'Crear' ahora genera Y reproduce autom�ticamente (auto-play) con el bundle/loop seleccionado.
- El tempo del mood elegido se aplica al generar (trap 140, nost�lgico 110, etc.) en lugar de 144 fijo.
- buildCasualStructure propaga section.role ? ritmo arm�nico por secci�n tambi�n en modo casual.
- Cadena de audio: compresor (-22dB) + limiter (-2dB) + reverb al compresor; master 0.9; pad 0.34. Menos recorte/distorsi�n ('se interrumpe la se�al').
- selectProgression devuelve { progression, source, mutated }; SongResult.progressions por secci�n.
- Panel Se�al muestra los grados por secci�n (reales en magenta) ? se verifica visualmente que los FLP se asignan.
- Verificado: 1500 secciones simuladas ? 50% principal / 21% alternativa / 26% real (pesos 50/20/30; reales en nostalgia/tristeza/ira).
- tsc --noEmit + npm run build + npm run verify OK.
- Decisi�n: se mantiene el kit de bater�a sintetizado (DRUM_PATTERNS reales + Tone.js); loops de muestra por g�nero quedan como entrega futura.


## Sesi�n #7 � Crear sin cables cruzados + bater�a por g�nero
- Corregido: tocar g�nero/vibe/tonalidad mientras suena DETIENE la reproducci�n (nada se cambia a medias). Solo 'Crear beat' genera todo desde el principio (para el playback y reproduce).
- createCasual ahora para cualquier reproducci�n previa antes de generar.
- Bater�a: kit de sonidos por g�nero en src/engine/drumKits.ts (kick pitch/decay, snare filtro/ruido, hats, percussi�n metal, ganancias y bus por g�nero); trap 808 grave, reggaet�n dembow agudo, plug suave, detroit seco, rap cl�sico. Player aplica perfil v�a SongResult.genre.
- Fix de nota MIDI del kick (Tone.Frequency(midi).toNote()).
- tsc --noEmit + build + verify OK. Patr�n y fills ya ven�an y se mantienen (el fill seco al final de cada secci�n).


## Sesi�n #8 � Banco de samples por g�nero + motor de samples
- Doc: docs/sample_bank.md (3 capas: loop por mood, kit one-shots por g�nero, kit sintetizado; car�cter por g�nero; mapeo MIDI; BPM exactos).
- public/loops/ con README.txt y manifest.json (lista vac�a, lista para llenar).
- loopBank.ts: resolveDrumBank(genre,emotion,bpm) ? loop completo y/o kit one-shots; buffer cache.
- player.play(drumLoop?drums:DrumBank): loop completo reemplaza la bater�a; one-shots disparan Tone.Player por instrumento (nota 36/38/42/46/39) con gains sugeridos; fallback al kit sintetizado por instrumento.
- App.tsx: loopKeyRef guarda genre/mood/bpm del �ltimo Crear; usa resolveDrumBank en crear y reproducir (solo modo crear).
- Crash TDZ corregido (stopPlayback movido antes de createCasual); ErrorBoundary; tabs elegantes; ganancia piano 1.25 / lead 1.15.
- tsc --noEmit + build + verify OK.

## Sesi�n #9 � Banco de samples real desde packs de FL Studio
- Extra�dos 32 archivos desde 'Program Files (x86)\Image-Line\FL Studio 21\Data\Patches\Packs' ? public/loops/<genero>/
- Kits one-shot por g�nero: trap (Dope Drums: Kick Sturdy, Snare Sniper, Hihat Traplord, Open Hat Clank + 808_Rim), rap (707 Kick, BBox Snare, AMX hats, DNC Clap), reggaeton (DJ_NELSON Panama Kick/Snare, Famous_Palo, 707 hats), detroit (familia 909), plug (Filtered kick/snare, Ekit hats, Grv Clap).
- Loops completos por mood (BPM en el nombre): trap tristeza 140 + ira 150 (Dope Drum Loops, 12 compases), rap amor 140 + nostalgia 148, reggaeton tristeza 92 (DJ_NELSON The_Girla, 8 compases).
- manifest.json con kits y loops; validate de duraciones y compases (12/12/12/12/8).
- FIX real: Tone.ToneAudioBuffer.load devuelve AudioBuffer ? envuelto en new ToneAudioBuffer (el dist viejo enmascaraba el error).
- Build OK; dist/loops con 32 archivos.


## Sesi�n #10 � Validator r�tmico (URA Rhythmic Engine Validator)
- Nuevo scripts/rhythm_validator.ts + npm run validate:rhythm (npm: validate:rhythm).
- genres_config propio de AURA (time_mode, snare/kick 1/16, hihat, bass, tags) en una sola fuente de verdad.
- Chequeo MOTOR: compara DRUM_PATTERNS/tempos reales contra el config. Hallazgos: snare motor [5,13] vs est�tica [9] en trap/plug/detroit; reggaeton kick [4,6,11,14] vs [1,5,9,13]; rap bpm 138 fuera de [80-98]; detroit bpm 144 fuera de [160-200].
- Barrido cat�logo MUSA (462 .flp): trap 56% coherente (snare paso 9 confirmado en cat�logo real), detroit 52%, rap 28%, reggaeton 17%, plug 15%. learned_rhythm.json con histogramas de snare.


## Sesi�n #11 � Motor alineado a la est�tica m�trica (validator en verde)
- DRUM_PATTERNS (constants.ts): trap/plug/detroit snare -> paso 9, kick -> [1,5,9,13]; reggaeton kick -> [1,5,9,13] y snare dembow [4,7,12,15]; hats recalibrados por densidad (trap 16/16, plug sparse, detroit offbeat 8/16, reggaeton shaker 1/8). rap sin cambios de patr�n.
- Tempos por mood: rap REAL_TIME -> amor 92 / ira 95 / tristeza 85 / nostalgia 88; detroit AGGRESSIVE_DOUBLE_TIME -> ira 176 / amor 168 / nostalgia 172 / tristeza 160; reggaeton -> amor 96 / ira 94 / nostalgia 88.
- Validator: agregado hat_occupancy_range por g�nero; motor del 0% al 100% coherente (5/5 g�neros).
- manifest.json: quitados loops rap (140/148 ya no se alcanzan); quedan trap 140/150 y reggaeton 92.
- docs/sample_bank.md actualizado con los nuevos BPM.
- typecheck/build/verify OK; learned_rhythm.json regenerado (cat�logo real se mantiene: trap 56%, detroit 52%).


## Sesion #12 - Punteo del piano (reggaeton) + BPM editable
- CHORD_PULSE (constants.ts): en vez de acorde sostenido, golpes cortos del mismo voicing en rejilla 1/16. steps fijos + cycle4 (golpe extra por compas en ciclo de 4) + dur16 + accentVel. Regla aprendida del MIDI de referencia (dataset/reggaeton/Bm, 98 BPM, B menor): golpes en 1 y 4 ("y" de la negra) en todos los compases y variante 9,9,7,7 en ciclo de 4 compases.
- song.ts: rama de punteo para generos con CHORD_PULSE (absBar global por seccion para que el cycle4 avance), stabs stacatto ~1/32 con strum y groove; sinonimo: sin pulse, acorde sostenido como antes.
- Velocity de acordes reggaeton subida a mean 92 (antes 75.8) para que el piano corte sobre el dembow.
- Verificado: 24 compases reeggaeton tristeza = 288 notas de acorde, golpes en step 1 y 4 en TODOS los compases + extras 7/9 en ciclo 9,9,7,7, duraciones 24-60 ticks, vel 65-127.
- BPM editable: TransportControls y CreateView con input numerico + slider (40-220) + presets (80/92/98/120/140/160). App.tsx: tempoTouchedRef hace que 'Crear beat' respete el BPM manual; si no se toca, usa el del mood como antes.
- typecheck + build + verify OK. Cleanup de _dbg_midi.ts y script temporal.

## Sesión #13 (2026-09-09) — Auditoría y mejoras prioritarias

### Auditoría técnica completa
- **Documento**: `aura-web/docs/auditoria_2026-09-09.md` — diagnóstico por capa y género.
- **Checklist**: `aura-web/docs/checklist_normalidad.md` — métricas objetivas para validación automática.
- **Hallazgos principales**:
  - Motor 5/5 coherente contra genres_config (validator en verde).
  - Patrones de batería alineados con catálogo real (trap 56%, detroit 52%).
  - Bajo estático (1 nota por acorde) → **problema #1 de musicalidad**.
  - Fills genéricos (mismo patrón en todas las secciones).
  - Lead sin frases melódicas (notas sueltas sin motivos).
  - Punteo de reggaetón mecánico (falta swing latino).
  - Fallos silenciosos en carga de samples.

### BASS_PATTERNS por género (impacto ALTO)
- **Archivo**: `src/core/constants.ts` — nueva constante `BASS_PATTERNS`.
- **Patrones implementados**:
  - Trap: 808 largo con glide (`steps: [1], dur16: 4, glide: true`).
  - Rap: boombap con notas intermedias (`steps: [1,5,9,13], dur16: 1`).
  - Plug: Zaytoven octavas (`steps: [1,9], dur16: 2, octaveJump: true`).
  - Detroit: donk staccato (`steps: [1,5,9,13], dur16: 0.5`).
  - Reggaeton: bajo dembow (`steps: [1,4,7,10], dur16: 0.75`).
- **song.ts**: bucle por pasos del patrón en lugar de nota única.
- **Resultado**: bajo pasó de 27 a 68 notas en verify (2.5x más movimiento).

### FILL_PATTERNS por género y sección (impacto ALTO)
- **Archivo**: `src/core/constants.ts` — nueva constante `FILL_PATTERNS` y `FILL_WEIGHT_BY_ROLE`.
- **Patrones por género**:
  - Trap: `roll` (snare creciente + hats) y `minimal` (solo final).
  - Rap: `classic` (snare + hat) y `ghost` (notas suaves).
  - Plug: `soft` (sutil) y `none` (sin fill).
  - Detroit: `aggressive` (ametralladora) y `triple` (tres golpes).
  - Reggaeton: `break` (perc) y `silence` (silencio dramático).
- **Pesos por rol**: intro 0.1, pre 0.6, coro 1.0, estrofa 0.4, outro 0.8.
- **song.ts**: selección aleatoria ponderada de fills según género y sección.
- **Resultado**: batería de 581 a 561 notas (fills más variados, a veces silencio).

### CHORD_PULSE mejorado para reggaetón (impacto MEDIO)
- **Archivo**: `src/core/constants.ts` — `dur16: 0.5 → 0.75` (más pulsado).
- **Añadido swing latino**: `swing: { 4: 0.08, 12: 0.08 }` en steps 4 y 12.
- **Interfaz actualizada**: `ChordPulseConfig.swing` opcional.
- **song.ts**: aplica swing adicional en punteo de reggaetón.

### Motivos melódicos en lead (impacto MEDIO)
- **Archivo**: `src/core/melody.ts` — nuevo sistema de motivos por género.
- **MOTIF_PATTERNS**:
  - Trap: arpegios cortos `[0,2,4,2]`, `[0,4,7,4]`.
  - Rap: frases de 5 notas `[0,2,4,5,4]`, `[0,4,2,0]`.
  - Plug: acordes arpegiados `[0,4,7,4]`.
  - Detroit: escalas rápidas `[0,3,5,7,5]`, `[0,7,5,3]`.
  - Reggaeton: patrones latinos `[0,4,5,4]`, `[0,2,4,2,0]`.
- **Lógica**: elegir motivo por peso, aplicar al acorde, variaciones ocasionales (15%).
- **Resultado**: lead de 147 a 165 notas con frases más coherentes.

### Manejo de errores en samples (impacto BAJO, estabilidad ALTA)
- **Archivo**: `src/engine/loopBank.ts`.
- **Logging**: `console.warn` cuando samples no cargan.
- **Tracking**: `failedLoads` Set para evitar reintentos.
- **Evento**: `window.dispatchEvent('aura:sample-error')` para UI.
- **Gestión de memoria**: `clearBufferCache(keepRecent)` y `getBufferStats()`.

### Verificación final
```
npm run typecheck  → OK
npm run verify     → 97 acordes / 68 bajo / 165 lead / 563 drums
npm run build      → 449KB gzip 126KB
npm run validate:rhythm → 5/5 COHERENTE
```

### Archivos modificados
- `src/core/constants.ts` (BASS_PATTERNS, FILL_PATTERNS, CHORD_PULSE, MOTIF_PATTERNS)
- `src/core/song.ts` (bajo rítmico, fills dinámicos, swing en punteo)
- `src/core/melody.ts` (motivos melódicos)
- `src/engine/loopBank.ts` (manejo de errores)

### Próximos pasos sugeridos
- Render a WAV/MP3 (OfflineAudioContext).
- Buses y compresión por género.
- CHORD_PULSE para trap/plug (stabs, arpegios).
- Integrar checklist de normalidad al validator.
