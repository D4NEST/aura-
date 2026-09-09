# AURA — Universo Rítmico Automatizado

> **Este repositorio contiene TODO el proyecto AURA** (su raíz es la carpeta
> `AURA` completa, prototipo + motor web).

```
Estructura:
├── aura-web/               → MOTOR ACTUAL: app React + TypeScript + Tone.js
│                             (genera y reproduce los beats en el navegador).
│                             Es donde se trabaja hoy → ver aura-web/README.md
├── *.py                    → Prototipo v1 (Python): DEPRECADO, referencia
│                             histórica del motor (armonía/rítmica/export MIDI).
├── docs/progress_log.md    → Bitácora del proyecto (sesión por sesión).
├── generated_midi/, midi/  → Salidas generadas por el prototipo Python.
└── (samples con licencia de packs NO están en el repo: el sistema cae al
    kit sintetizado; cada productor usa su banco local si lo tiene).
```

**Dónde se trabaja hoy:** `aura-web/` — motor en React + TypeScript + Tone.js
que conserva la misma armonía/rítmica del prototipo pero generando y
reproduciendo audio en tiempo real, con validator rítmico, banco de samples
y BPM editable. Lo que sigue a continuación describe el **prototipo v1
(Python, legado)** y se mantiene como referencia/evolución.

---

## Prototipo v1 (Python) — LEGADO

**Arranque de Universo Rítmico Automatizado** — motor generador de *beats*
emocionales en Python que convierte emociones en progresiones armónicas y
patrones de batería, exportados a MIDI (archivo completo + stems por pista).

## Descripción

AURA mapea cinco emociones (`tristeza`, `ira`, `amor`, `decepcion`,
`nostalgia`) a escalas modales y progresiones de grados. A partir de ahí
construye acordes diatónicos, les aplica inversiones y reglas de tensión,
muta la progresión para variar cada toma y añade una batería rítmica por
género. Puede generar tanto *beats* individuales (MIDI + stems) como canciones
completas con estructura de secciones (intro, verso, coro, puente, outro),
transpuestas a cualquier tonalidad. El resultado son archivos MIDI listos para
DAWs (FL Studio, Ableton, Logic) en formato General MIDI.

## Características actuales

- 5 escalas modales (menor natural, frigio, mayor, locrio, pentatónica menor)
  sobre una tónica central C3 (MIDI 48).
- 10 progresiones definidas por emoción (principal + alternativa) en grados.
- Acentos: inversiones (`root`, `first`, `second`, `open`, `drop2`) y reglas
  de tensión (power chords en ira, sus2 en tristeza, 7ª mayor en amor, nota
  aguda descendente en decepción, voicings especiales en nostalgia).
- Variación: 30% de mutar un grado de la progresión y duración aleatoria de
  los acordes (1 o 2 compases).
- 4 patrones de batería de 16 pasos (`trap`, `rap`, `plug`, `detroit`) con
  mapeo General MIDI (kick 36, snare 38, hat 42, open hat 46, perc 39).
- Exportación del MIDI completo + stems separados (acordes, bajo, batería) con
  creación automática de carpetas.
- **Canción estructurada**: composición multi-sección (intro, verso, coro,
  puente, outro) alineada en una línea de tiempo continua.
- Transposición a cualquier tonalidad (`root_key`, p. ej. `'F#'`).
- Humanización: velocities aleatorias y micro-strumming (15 ms/nota) en
  acordes, y micro-separación en la batería.
- Fills automáticos de batería (redoble de snare + percusión) en las últimas
  4 semicorcheas de cada sección.

## Instalación y uso

Requisitos: Python 3.10+.

```bash
pip install -r requirements.txt
python aura_engine.py
```

Por defecto se generan las 5 emociones con género `trap` a 140 BPM, guardando
en `generated_midi/`. Para una generación a medida se puede usar el motor
desde un script:

```python
from aura_engine import export_stems, export_song_stems

export_stems("amor", "rap", 150, output_prefix="generated_midi")

# Canción completa: (seccion, emocion, genero, compases)
cancion = [
    ("intro", "nostalgia", "trap", 4),
    ("verso", "tristeza", "trap", 8),
    ("coro", "ira", "trap", 8),
    ("outro", "amor", "trap", 4),
]
export_song_stems(cancion, root_key="C", tempo=144, output_dir="generated_midi")
```

### Motores alternativos

Existen dos variantes del motor que escriben MIDI sin pretty_midi:

- **`aura_engine_mido.py`** — MIDI de bajo nivel con la librería `mido`
  (misma armonía, progresiones y estructura de canción).
- **`aura_engine_native.py`** — MIDI 1.0 binario escrito a mano con
  `struct`, **cero dependencias** (solo librería estándar).

```bash
python aura_engine_mido.py
python aura_engine_native.py
```

```python
from aura_engine_mido import export_aura_project
from aura_engine_native import export_aura_song

cancion = [
    ("intro", "nostalgia", "trap", 4),
    ("coro", "ira", "detroit", 8),
]
export_aura_project(cancion, root_key="C", tempo=144, output_dir="generated_midi")
export_aura_song(cancion, root_key="C", tempo=144, output_dir="generated_midi")
```

Cada motor usa su propio prefijo de salida para no pisarse entre sí:
`AURA_Song_*` (pretty_midi), `AURA_mido_*` y `AURA_native_*`.

### Convenciones de salida

```
generated_midi/
├── generated_midi_{emocion}_{genero}_{tempo}bpm.mid          # completo
├── generated_midi_{emocion}_{genero}_{tempo}bpm_chords.mid   # acordes (program 0)
├── generated_midi_{emocion}_{genero}_{tempo}bpm_bass.mid     # bajo (program 32)
├── generated_midi_{emocion}_{genero}_{tempo}bpm_drums.mid    # batería (percusiones)
├── AURA_Song_{root}_{tempo}bpm_Full.mid                      # canción completa
├── AURA_Song_{root}_{tempo}bpm_stem_chords.mid               # stem de canción
├── AURA_Song_{root}_{tempo}bpm_stem_bass.mid
├── AURA_Song_{root}_{tempo}bpm_stem_drums.mid
├── AURA_mido_{root}_{tempo}bpm_Full.mid                      # versión mido
├── AURA_mido_{root}_{tempo}bpm_stem_chords.mid
├── AURA_mido_{root}_{tempo}bpm_stem_bass.mid
├── AURA_mido_{root}_{tempo}bpm_stem_drums.mid
├── AURA_native_{root}_{tempo}bpm_Full.mid                    # versión nativa
├── AURA_native_{root}_{tempo}bpm_stem_chords.mid
├── AURA_native_{root}_{tempo}bpm_stem_bass.mid
└── AURA_native_{root}_{tempo}bpm_stem_drums.mid
```

## Cómo funciona (resumen técnico)

1. **Escalas y progresiones.** Cada emoción tiene una escala (intervalos en
   semitonos) y una o más progresiones expresadas en grados (1 = tónica).
2. **Armonía.** `chord_from_degree` apila terceras diatónicas (1ª-3ª-5ª y
   opcionalmente 7ª/9ª) desde el grado, con extensión por octava automática.
3. **Tonalidad.** `root_key` transpone todo el conjunto con `NOTE_OFFSETS`
   (semitonos sobre C) sumados a la tónica base C3 (48).
4. **Color.** `apply_inversion` reubica las voces (octavas) y
   `apply_tension_rules` aplica la sonoridad característica de la emoción.
5. **Variación.** `mutate_progression` cambia un grado aleatorio (limitado a la
   escala si es corta); cada acorde tiene duración 50/50 de 1 o 2 compases.
6. **Ritmo.** `create_drum_track`/`create_drum_track_for_section` traducen
   patrones de 16 pasos a percusión MIDI sobre un reloj de semicorcheas
   `60/tempo/4`; la versión de sección añade fills y humanización.
7. **Canción.** `generate_full_song` recorre la estructura (secciones con
   emoción, género y compases), crea sus pistas con `create_section_tracks`
   y las alinea en una línea de tiempo continua; `export_song_stems`
   escribe el MIDI completo y los stems por instrumento.
8. **Mezcla y exportación.** `create_chord_track` produce piano (program 0,
   acordes) y bajo eléctrico (program 32, fundamental a octava -2); todo se
   escribe a disco creando los directorios con `os.makedirs(..., exist_ok=True)`.

## Limitaciones y próximos pasos

- **Harmonía por acorde única.** Las secciones usan una escala por emoción y
  la progresión principal; no hay *scales por acorde* derivadas de la melodía.
- **Sin melodía.** El motor genera armonía, bajo y batería, pero ninguna pista
  melódica/seudoplomo vinculada a la progresión.
- **Fills estándar.** El fill es siempre redoble de snare + percusión; faltan
  variantes (breaks, címbolos, rellenos dirigidos por sección).
- **MIDI sin renderizar.** No hay síntesis ni exportación a WAV/MP3.
- **Próximos pasos sugeridos:** melodía generada a partir de la armonía,
  *scales por acorde*, fills variados y una sección de swing/humanización más
  profunda, y renderizado a audio.