# AURA — Estado actual del motor

Fecha: 2026-09-09. Documento vivo; se actualiza junto al `progress_log.md`
(hito por hito, hasta la sesión #12).

## Qué es

AURA es un generador de beats **emocionales** (trap, rap, plug, detroit,
reggaetón). Cada emoción tiene su escala y sus progresiones; cada género su
estética rítmica, su kit de batería y su melodía. El usuario elige
género + vibe (mood) + tonalidad y AURA genera, toca en loop y exporta el MIDI
completo y por stems.

## Arquitectura

```
src/core/        Motor (genera el arreglo: armonía, bajo, lead, batería)
src/engine/      Audio/playback (Tone.js, kits, loops, voces, MIDI)
src/components/  UI (Crear, Pro, transporte, señal VU/waveform)
src/styles/      theme.css
scripts/         Pipeline de aprendizaje sobre el catálogo real (FLP/MIDI)
public/loops/    Banco de samples reales (kits one-shot + loops por mood)
docs/            sample_bank.md (banco) · estado_actual.md (este)
```

### Motor (`src/core/`)

| Módulo | Rol |
| --- | --- |
| `constants.ts` | Escalas, progresiones, patrones de batería por género (`DRUM_PATTERNS`), BPM por mood (`MOODS_PER_GENRE`), velocidades, groove/micro-timing, rangos de octava, ritmo armónico (`HARMONIC_RHYTHM`) y **punteo de piano** (`CHORD_PULSE`) |
| `harmony.ts` | Acordes por grado (`chordFromDegree`), inversiones, tensiones por emoción, selección de progresión (principal 50% / real 30% / alternativa 20% + 30% mutación) |
| `melody.ts` | Lead sobre rejilla 1/16 con densidad por género (`LEAD_DENSITY`) |
| `humanize.ts` | Velocity humana (Box-Muller), micro-timing (swing sistemático + jitter), rango de octava, elección ponderada |
| `song.ts` | Orquesta el arreglo: acordes (+punteo), bajo, lead, batería; progresión y ritmo armónico por sección |
| `structure.ts` | Estructura casual (loop 12/24 / canción "Flow") y estructura Pro (intro/verso/coro/… con roles) |

### BPM por género y mood (los que usa la app)

| género | moods (BPM) |
| --- | --- |
| trap | tristeza 140 · ira 150 · amor 128 · nostalgia 160 |
| rap | amor 92 · ira 95 · tristeza 85 · nostalgia 88 |
| plug | amor 120 · tristeza 128 · decepcion 110 · nostalgia 125 |
| detroit | ira 176 · amor 168 · nostalgia 172 · tristeza 160 |
| reggaeton | amor 96 · tristeza 92 · ira 94 · nostalgia 88 |

El BPM se puede **editar en cualquier momento** (input numérico + slider +
presets en Crear y Pro). Si el usuario lo toca, "Crear beat" lo respeta; si
no, usa el del mood automáticamente.

### Punteo de piano (nuevo, reggaetón)

Antes el acorde era **un bloque sostenido**; ahora los géneros con
`CHORD_PULSE` tocan **golpes cortos del mismo voicing** (estilo "punteo/
retorno" de reggaetón):

- `steps`: golpes fijos del compás (1 y 4 → downbeat + "y" de la negra).
- `cycle4`: golpe extra por compás dentro de un ciclo de 4 (reggaetón:
  `9,9,7,7`), avanzando con el compás absoluto de la sección.
- `dur16`: duración en 1/16 (0.5 → staccato 1/32).
- `accentVel`: refuerzo de velocity para que corte sobre el dembow.

Regla aprendida del MIDI de referencia en `dataset/reggaeton/Bm/` (98 BPM,
B menor, 84 compases). Verificado: en 24 compases generados los golpes caen en
steps 1 y 4 en todos los compases y 7/9 en ciclo 9,9,7,7 (288 notas, dur
24–60 ticks, vel 65–127).

## Batería real: 3 capas (ver `docs/sample_bank.md`)

1. **Loop completo por mood** → reemplaza toda la batería con audio real
   (`public/loops/<genre>/<genre>_<mood>_<bpm>bpm.wav`). Hoy: trap 140/150,
   reggaetón 92.
2. **Kit de one-shots por género** → cada instrumento con muestra real
   manteniendo nuestros patrones/groove: trap (Dope Drums), rap (707/BBox),
   reggaetón (DJ_NELSON Panama), detroit (909), plug (Filtered/Ekit).
3. **Kit sintetizado** (`drumKits.ts`) → fallback por instrumento.

Precedencia en runtime: loop → kit one-shots → sintetizado. Mapeo MIDI:
kick 36 · snare 38 · hat 42 · openhat 46 · perc 39.

## Estética rítmica (validator en verde)

`scripts/rhythm_validator.ts` (`npm run validate:rhythm`) compara el motor
contra `genres_config` (una sola fuente de verdad):

| género | time_mode | snare (1/16) | kick (1/16) | hats | perceived BPM |
| --- | --- | --- | --- | --- | --- |
| trap | DOUBLE_TIME | 9 | 1,5,9,13 | densas 16/16 | BPM/2 |
| rap | REAL_TIME | 5,13 | 1,5,9,13 | 8–12 | BPM |
| plug | HYBRID_DOUBLE_TIME | 9 | 1,5,9,13 | sparse | BPM/2 |
| detroit | AGGRESSIVE_DOUBLE_TIME | 9 (offbeat) | 1,5,9,13 | 8/16 | BPM/2 |
| reggaeton | REAL_TIME (dembow) | 4,7,12,15 | 1,5,9,13 | shaker 1/8 | BPM |

Motor: **5/5 géneros coherentes**. El validator también barre el catálogo real
de FLP (`C:\Users\Yamileth\Documents\MUSA`, 462 proyectos) y escribe
`learned_rhythm.json` con histogramas: trap 56% coherente, detroit 52%,
rap 28%, reggaetón 17%, plug 15% (el dembow real varía mucho).

## Aprendizaje del catálogo (pipeline)

- `scripts/ingest_dataset.ts` → `dataset/` (MIDI para melodía/armonía).
- `scripts/ingest_flp.ts` + `check_flp.ts` + `validate_progressions.ts` →
  análisis de FLP reales (familia de grids por instrumento, progresiones).
- `learn_{velocities,groove,ranges,harmony}.ts` → los `learned_*.json` en raíz:
  velocidades, micro-timing (~99.5% cuantizado), rangos de octava (P5–P95),
  ritmo armónico (peso por compases por acorde), reglas FLP y análisis.

## UI

- **Crear**: elegí género → vibe (pill con BPM del mood) → tonalidad → modo
  (loop 12/24 / canción Flow) → loop infinito → sonido (selects) → "Crear beat".
- **Pro**: editor de secciones (arrastra/reordena), transporte con tonalidad/BPM
  editables, generar, señal (VU, waveform, progresiones con origen real en
  magenta), exportar MIDI completo y por stems.
- PWA instalable (vite-plugin-pwa, service worker).

## Próximos pasos

- Escuchar el reggaetón a 98 BPM en B menor contra el MIDI de referencia y
  afinar voicing/articulación del punteo (el "retorno").
- Aplicar `CHORD_PULSE` a más géneros (trap/plug) con reglas propias.
- Bajo con movimiento rítmico por género (hoy es nota larga por acorde).
- Fills variados por sección; compás "bailado" (desplazamiento del downbeat).
- Render a audio (WAV/MP3) desde el MIDI.