"""
AURA - Motor generador de beats emocionales
===========================================

Genera progresiones armónicas y pistas MIDI (pretty_midi) a partir de emociones
y géneros, combinando escalas modales, inversiones, reglas de tensión,
mutación de progresiones y patrones de batería de 16 pasos.

Capacidades:
- Beats por emoción: MIDI completo + stems (chords, bass, drums) por archivo.
- Canción completa con estructura de secciones: transposición (root_key),
  humanización de velocities, micro-arpegiado, fills de batería al final de
  cada sección y exportación de stems por instrumento.
"""

import os
import random
import re

import pretty_midi

# ---------------------------------------------------------------------------
# 1) MATERIAS PRIMAS
# ---------------------------------------------------------------------------

TONIC_BASE = 48  # C3: tónica de referencia para todo el motor (MIDI)

# Nota -> semitonos por encima de C (para transposición 'root_key')
NOTE_OFFSETS = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

# Emoción -> intervalos de la escala en semitonos desde la tónica (0 = tónica)
ESCALAS = {
    'tristeza':  [0, 2, 3, 5, 7, 8, 10],      # Menor Natural (Eólico)
    'ira':       [0, 1, 3, 5, 7, 8, 10],      # Frigio
    'amor':      [0, 2, 4, 5, 7, 9, 11],      # Mayor (Jónico)
    'decepcion': [0, 1, 3, 5, 6, 8, 10],      # Locrio
    'nostalgia': [0, 3, 5, 7, 10],            # Pentatónica Menor
}

# Emoción -> progresiones en grados (1 = tónica). La primera es la "principal".
PROGRESIONES = {
    'tristeza': {
        'principal': [1, 6, 3, 7],               # i - bVI - bIII - bVII
        'alternativas': [[1, 4, 5, 6]],          # i - iv - v - bVI
    },
    'ira': {
        'principal': [1, 2, 1, 2],               # i - bII - i - bII
        'alternativas': [[1, 5, 6, 2]],          # i - v° - bVI - bII
    },
    'amor': {
        'principal': [1, 5, 6, 4],               # I - V - vi - IV
        'alternativas': [[2, 5, 7, 1]],          # ii7 - V7 - Imaj7
    },
    'decepcion': {
        'principal': [1, 5, 6, 1],               # i - v - bVI - i
        'alternativas': [[1, 4, 5, 1]],          # i - iv - v - i
    },
    'nostalgia': {
        'principal': [1, 4, 5, 7],               # i7 - IV7 - v7 - bVII
        'alternativas': [[4, 7, 1, 6]],          # IV7 - bVII - i7 - bVI
    },
}

# Números de nota MIDI estándar (General MIDI, canal de batería)
DRUM_MAP = {
    'kick': 36, 'snare': 38, 'hat': 42,
    'open_hat': 46, 'perc': 39,
}

# Género -> patrón de batería de 16 pasos (1 = golpe, 0 = silencio)
DRUM_PATTERNS = {
    'trap': {
        'kick':     [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        'snare':    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        'hat':      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        'open_hat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        'perc':     [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    },
    'rap': {
        'kick':     [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        'snare':    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        'hat':      [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
        'open_hat': [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        'perc':     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    'plug': {
        'kick':     [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        'snare':    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        'hat':      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        'open_hat': [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        'perc':     [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    },
    'detroit': {
        'kick':     [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        'snare':    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        'hat':      [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        'open_hat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        'perc':     [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    },
}


# ---------------------------------------------------------------------------
# 2) AYUDANTES
# ---------------------------------------------------------------------------

def _nombre_valido(texto):
    """Convierte un texto en un nombre de archivo válido en Windows.

    Conserva los segmentos de directorio ('/'-'\\') sanitizando cada parte.
    """
    segmentos = re.split(r"[\\/]+", str(texto))
    limpios = []
    for s in segmentos:
        s2 = re.sub(r'[<>:"|?*\x00-\x1f]', "_", s)
        s2 = "".join(c for c in s2 if c.isprintable()).strip().strip(".")
        limpios.append(s2 or "beat")
    return os.path.join(*limpios)


def _crear_directorio(ruta):
    """Crea el directorio padre de una ruta si no existe."""
    padre = os.path.dirname(os.path.abspath(ruta))
    os.makedirs(padre, exist_ok=True)


# ---------------------------------------------------------------------------
# 3) NOTAS, ACORDES, INVERSIONES Y TENSIONES
# ---------------------------------------------------------------------------

def note_from_degree(scale, degree, octave_shift=0, root_offset=0):
    """Nota MIDI del grado (1-index) dentro de la escala.

    La tónica base es C3 (MIDI 48) desplazada por root_offset (transposición).
    Los grados que se pasan del tamaño de la escala se desplazan a octavas
    superiores (apilamiento de terceras sin límite).
    """
    scale_len = len(scale)
    octave = (degree - 1) // scale_len + octave_shift
    idx = (degree - 1) % scale_len
    base_note = TONIC_BASE + root_offset
    return base_note + scale[idx] + (octave * 12)


def chord_from_degree(scale, degree, root_offset=0, add_seventh=False,
                      add_ninth=False):
    """Construye un acorde apilando terceras diatónicas desde el grado.

    Tríada (grados 1-3-5) con 7ª (grado 7) y 9ª (grado 9) opcionales.
    Devuelve notas MIDI ascendentes desde la fundamental.
    """
    chord = [
        note_from_degree(scale, degree, root_offset=root_offset),
        note_from_degree(scale, degree + 2, root_offset=root_offset),
        note_from_degree(scale, degree + 4, root_offset=root_offset),
    ]
    if add_seventh:
        chord.append(note_from_degree(scale, degree + 6, root_offset=root_offset))
    if add_ninth:
        chord.append(note_from_degree(scale, degree + 8, root_offset=root_offset))
    return chord


def apply_inversion(chord, inversion_type='root'):
    """Aplica inversión o voicing al acorde (lista de notas MIDI).

    'root'   : sin cambios.
    'first'  : sube la fundamental una octava.
    'second' : sube fundamental y 3ª una octava.
    'open'   : sube la 2ª voz (abre el espacio entre voces).
    'drop2'  : baja la 2ª voz desde arriba (solo con >= 4 notas).
    """
    chord = sorted(chord)
    if inversion_type == 'first' and len(chord) >= 1:
        return chord[1:] + [chord[0] + 12]
    elif inversion_type == 'second' and len(chord) >= 2:
        return chord[2:] + [chord[0] + 12, chord[1] + 12]
    elif inversion_type == 'open' and len(chord) >= 2:
        chord_copy = list(chord)
        chord_copy[1] += 12
        return sorted(chord_copy)
    elif inversion_type == 'drop2' and len(chord) >= 4:
        chord_copy = list(chord)
        drop_note = chord_copy.pop(-2) - 12
        return sorted([drop_note] + chord_copy)
    return chord


def apply_tension_rules(chord, emotion):
    """Aplica modificaciones de tensión/color según la emoción.

    - 'ira'      : power chord (raíz + 5ª justa, se elimina la 3ª).
    - 'tristeza' : sus2 (reemplaza la 3ª por la 2ª, raíz + 2 semitonos).
    - 'amor'     : asegura la 7ª mayor (raíz + 11 semitonos).
    - 'decepcion': la nota más aguda cae medio tono.
    - resto      : sin cambios (p.ej. nostalgia: voicings especiales).
    """
    chord = sorted(chord)
    if emotion == 'ira':
        return [chord[0], chord[0] + 7]
    elif emotion == 'tristeza' and len(chord) >= 3:
        chord[1] = chord[0] + 2
        return chord
    elif emotion == 'amor':
        seventh = chord[0] + 11
        if seventh not in chord:
            chord.append(seventh)
        return sorted(chord)
    elif emotion == 'decepcion' and len(chord) > 0:
        chord[-1] -= 1
        return chord
    return chord


def mutate_progression(progression, scale=None):
    """Muta UN grado de la progresión a otro diatónico distinto.

    Si se pasa la escala, el grado nuevo se limita a 1..len(scale)
    (escalas cortas como la pentatónica no producen grados inexistentes).
    """
    mutated = list(progression)
    idx = random.randrange(len(mutated))
    max_grado = len(scale) if scale is not None else 7
    opciones = [g for g in range(1, max_grado + 1) if g != mutated[idx]]
    mutated[idx] = random.choice(opciones)
    return mutated


# ---------------------------------------------------------------------------
# 4) PISTAS MIDI (acordes, bajo y batería) — beats por emoción
# ---------------------------------------------------------------------------

def create_drum_track(patterns, tempo, start_time=0):
    """Crea un Instrument de batería (is_drum=True) de UN compás/loop.

    Cada paso dura una semicorchea: 60/tempo/4 segundos.
    """
    step = 60.0 / tempo / 4.0
    drums = pretty_midi.Instrument(program=0, is_drum=True, name="battery")
    for sonido, pasos in patterns.items():
        pitch = DRUM_MAP.get(sonido)
        if pitch is None:
            continue
        velocidad = 96 if sonido in ("open_hat", "perc") else 104
        for i, golpe in enumerate(pasos):
            if golpe:
                s = start_time + i * step
                drums.notes.append(pretty_midi.Note(
                    velocity=velocidad, pitch=pitch, start=s, end=s + step))
    return drums


def create_chord_track(scale, progression, emotion, tempo=140, bars_per_chord=1):
    """Crea las pistas de piano (acordes) y bajo de una progresión en loop.

    Variaciones: 30% de probabilidad de mutar la progresión y duración
    aleatoria de cada acorde (50% bars_per_chord compases, 50% 2 compases).
    Devuelve (chord_instr, bass_instr).
    """
    beat = 60.0 / tempo

    if random.random() < 0.3:                      # 30% de mutar la progresión
        progression = mutate_progression(progression, scale)

    chords = pretty_midi.Instrument(program=0, name="chords", is_drum=False)
    bass = pretty_midi.Instrument(program=32, name="bass", is_drum=False)

    t = 0.0
    for degree in progression:
        compases = random.choice((bars_per_chord, 2))   # 50% corto, 50% largo
        dur = compases * 4 * beat                        # compás = 4 tiempos

        add_7 = emotion in ("amor", "nostalgia")
        add_9 = emotion in ("tristeza", "amor")
        acorde = chord_from_degree(scale, degree, add_seventh=add_7,
                                   add_ninth=add_9)
        acorde = apply_inversion(
            acorde, random.choice(("root", "first", "second", "open", "drop2")))
        acorde = apply_tension_rules(acorde, emotion)

        for p in acorde:
            chords.notes.append(pretty_midi.Note(
                velocity=88, pitch=p, start=t, end=t + dur))

        baja = note_from_degree(scale, degree, octave_shift=-2)
        bass.notes.append(pretty_midi.Note(
            velocity=96, pitch=baja, start=t, end=t + dur))

        t += dur
    return chords, bass


def create_midi(emotion, genre, tempo=140):
    """Compone el PrettyMIDI completo (loop): acordes, bajo y batería."""
    scale = ESCALAS[emotion]
    progression = PROGRESIONES[emotion]["principal"]
    chords, bass = create_chord_track(scale, progression, emotion, tempo=tempo)
    drums = create_drum_track(DRUM_PATTERNS.get(genre, DRUM_PATTERNS["trap"]),
                              tempo=tempo)
    midi = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    midi.instruments.extend([chords, bass, drums])
    return midi


def export_stems(emotion, genre, tempo, output_prefix="beat"):
    """Guarda el MIDI completo y un stem por instrumento (loop por emoción).

    Nombres: '{prefix}_{emotion}_{genre}_{tempo}bpm.mid' y
    '{prefix}_{...}_{tempo}bpm_{chords|bass|drums}.mid'. Los directorios del
    prefijo se crean automáticamente (os.makedirs). Devuelve lista de rutas.
    """
    full = create_midi(emotion, genre, tempo)
    prefix = _nombre_valido(output_prefix)
    base = f"{prefix}_{emotion}_{genre}_{tempo}bpm"

    rutas = []
    ruta_full = f"{base}.mid"
    _crear_directorio(ruta_full)
    full.write(ruta_full)
    rutas.append(ruta_full)

    etiquetas = {"chords": "chords", "bass": "bass", "battery": "drums"}
    for inst in full.instruments:
        etiqueta = _nombre_valido(etiquetas.get(inst.name, inst.name))
        stem = pretty_midi.PrettyMIDI(initial_tempo=tempo)
        stem.time_signature_changes = list(full.time_signature_changes)
        stem.instruments.append(inst)
        ruta = f"{base}_{etiqueta}.mid"
        _crear_directorio(ruta)
        stem.write(ruta)
        rutas.append(ruta)
    return rutas


# ---------------------------------------------------------------------------
# 5) CANCIÓN COMPLETA CON ESTRUCTURA (secciones, fills, humanización)
# ---------------------------------------------------------------------------

def create_drum_track_for_section(genre, total_bars, tempo=140, is_fill=False):
    """Genera la pista de batería de una sección de varios compases.

    Repite el patrón del género y en el último compás aplica un FILL
    (redoble de snare + percusión) en las últimas 4 semicorcheas.
    """
    pattern_data = DRUM_PATTERNS.get(genre, DRUM_PATTERNS['trap'])
    drum_instr = pretty_midi.Instrument(program=0, is_drum=True, name="Drums")

    step_duration = (60.0 / tempo) / 4.0   # una semicorchea en segundos
    bar_duration = step_duration * 16

    for bar in range(total_bars):
        bar_start_time = bar * bar_duration
        is_last_bar = (bar == total_bars - 1)

        for step in range(16):
            time = bar_start_time + (step * step_duration)

            if is_last_bar and step >= 12:
                # FILL: redoble de snare + percusión en las 4 últimas semicorcheas
                drum_instr.notes.append(pretty_midi.Note(
                    velocity=random.randint(90, 115),
                    pitch=DRUM_MAP['snare'],
                    start=time,
                    end=time + step_duration,
                ))
                if step % 2 == 0:
                    drum_instr.notes.append(pretty_midi.Note(
                        velocity=100,
                        pitch=DRUM_MAP['perc'],
                        start=time,
                        end=time + step_duration,
                    ))
            else:
                # Patrón estándar con humanización ligera de velocity
                for sonido, pattern in pattern_data.items():
                    if pattern[step] == 1:
                        pitch = DRUM_MAP[sonido]
                        vel = (random.randint(85, 115) if sonido == 'kick'
                               else random.randint(70, 105))
                        drum_instr.notes.append(pretty_midi.Note(
                            velocity=vel,
                            pitch=pitch,
                            start=time,
                            end=time + step_duration * 0.95,   # micro separación
                        ))

    return drum_instr


def create_section_tracks(emotion, genre, total_bars=4, root_key='C', tempo=140):
    """Crea los instrumentos (acordes, bajo) de una sección estructurada.

    Usa la progresión principal de la emoción, con transposición root_key,
    duración aleatoria por acorde (1-2 compases), micro-strumming en acordes,
    inversión aleatoria y reglas de tensión. Devuelve (chord_instr, bass_instr).
    """
    scale = ESCALAS[emotion]
    progression = PROGRESIONES[emotion]['principal']

    # 30% de probabilidad de mutar la progresión
    if random.random() < 0.3:
        progression = mutate_progression(progression, scale)

    root_offset = NOTE_OFFSETS.get(root_key, 0)
    chord_instr = pretty_midi.Instrument(program=0, name="Chords")    # Piano
    bass_instr = pretty_midi.Instrument(program=32, name="Bass")      # Bajo Eléc.

    sec_seconds = (60.0 / tempo) * 4.0    # duración de 1 compás en segundos
    current_time = 0.0
    bar_count = 0

    while bar_count < total_bars:
        for degree in progression:
            if bar_count >= total_bars:
                break

            # Duración aleatoria (1 o 2 compases) sin pasarse de la sección
            chord_bars = random.choice([1, 2])
            if bar_count + chord_bars > total_bars:
                chord_bars = total_bars - bar_count

            duration = chord_bars * sec_seconds

            # Construir acorde diatónico con extensiones según la emoción
            add_7 = emotion in ('amor', 'nostalgia')
            add_9 = emotion in ('tristeza', 'amor')
            raw_chord = chord_from_degree(
                scale, degree, root_offset=root_offset,
                add_seventh=add_7, add_ninth=add_9)

            # Inversión aleatoria y reglas de tensión
            inv_type = random.choice(['root', 'first', 'second', 'open', 'drop2'])
            inv_chord = apply_inversion(raw_chord, inv_type)
            final_chord = apply_tension_rules(inv_chord, emotion)

            # Acordes con micro-strumming (arpegiado leve) + velocity variada
            for i, note in enumerate(final_chord):
                strum_delay = i * 0.015
                chord_instr.notes.append(pretty_midi.Note(
                    velocity=random.randint(70, 95),
                    pitch=note,
                    start=current_time + strum_delay,
                    end=current_time + duration - 0.05,
                ))

            # Bajo: fundamental a octava -2
            bass_note = note_from_degree(scale, degree, octave_shift=-2,
                                         root_offset=root_offset)
            bass_instr.notes.append(pretty_midi.Note(
                velocity=random.randint(90, 110),
                pitch=bass_note,
                start=current_time,
                end=current_time + duration - 0.02,
            ))

            current_time += duration
            bar_count += chord_bars

    return chord_instr, bass_instr


def generate_full_song(song_structure, root_key='C', tempo=140):
    """Genera un PrettyMIDI recorriendo la estructura de la canción.

    song_structure: lista de tuplas
        [('intro', 'nostalgia', 'trap', 4), ('verse', 'ira', 'trap', 8), ...]
    Cada tupla es (nombre_seccion, emocion, genero, num_compases). Todas las
    secciones se alinean en una línea de tiempo continua.
    """
    midi_master = pretty_midi.PrettyMIDI(initial_tempo=tempo)

    master_chords = pretty_midi.Instrument(program=0, name="Chords")
    master_bass = pretty_midi.Instrument(program=32, name="Bass")
    master_drums = pretty_midi.Instrument(program=0, is_drum=True, name="Drums")

    timeline_seconds = 0.0

    for section_name, emotion, genre, bars in song_structure:
        chord_sec, bass_sec = create_section_tracks(
            emotion, genre, total_bars=bars, root_key=root_key, tempo=tempo)
        drum_sec = create_drum_track_for_section(genre, total_bars=bars,
                                                 tempo=tempo)

        # Desplazar las notas de la sección al tiempo global del timeline
        for note in chord_sec.notes:
            master_chords.notes.append(pretty_midi.Note(
                note.velocity, note.pitch,
                note.start + timeline_seconds, note.end + timeline_seconds))
        for note in bass_sec.notes:
            master_bass.notes.append(pretty_midi.Note(
                note.velocity, note.pitch,
                note.start + timeline_seconds, note.end + timeline_seconds))
        for note in drum_sec.notes:
            master_drums.notes.append(pretty_midi.Note(
                note.velocity, note.pitch,
                note.start + timeline_seconds, note.end + timeline_seconds))

        section_duration = bars * ((60.0 / tempo) * 4.0)
        timeline_seconds += section_duration

    midi_master.instruments.extend([master_chords, master_bass, master_drums])
    return midi_master


def export_song_stems(song_structure, root_key='C', tempo=140,
                      output_dir='generated_midi'):
    """Exporta el MIDI completo de la canción y sus stems por instrumento.

    Crea output_dir con os.makedirs si no existe. Devuelve la carpeta de salida.
    """
    os.makedirs(output_dir, exist_ok=True)

    midi_master = generate_full_song(song_structure, root_key=root_key,
                                     tempo=tempo)
    prefix = f"AURA_Song_{root_key}_{tempo}bpm"

    # Exportar archivo completo
    master_path = os.path.join(output_dir, f"{prefix}_Full.mid")
    midi_master.write(master_path)

    # Exportar un stem por instrumento
    for instr in midi_master.instruments:
        stem_midi = pretty_midi.PrettyMIDI(initial_tempo=tempo)
        stem_midi.instruments.append(instr)
        stem_name = instr.name.lower().replace(" ", "_")
        stem_path = os.path.join(output_dir, f"{prefix}_stem_{stem_name}.mid")
        stem_midi.write(stem_path)

    return output_dir


# ---------------------------------------------------------------------------
# 6) PRUEBA Y GENERACIÓN DEL EJEMPLO
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    # Trabaja siempre junto al módulo (AURA/) para no depender del CWD.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Especificación base: beats de las 5 emociones, género 'trap', 140 BPM.
    for emocion in ESCALAS:
        archivos = export_stems(emocion, 'trap', 140,
                                output_prefix='generated_midi/beat')
        for ruta in archivos:
            print(f"[OK] Exportado: {ruta}")

    # Nueva capacidad: canción completa con estructura de secciones.
    cancion_ejemplo = [
        ('intro', 'nostalgia', 'trap', 4),
        ('verso_1', 'tristeza', 'trap', 8),
        ('coro', 'ira', 'trap', 8),
        ('puente', 'decepcion', 'plug', 4),
        ('outro', 'amor', 'trap', 4),
    ]

    out_folder = export_song_stems(cancion_ejemplo, root_key='F#', tempo=144)
    print(f"¡Canción y stems estructurados generados con éxito en la carpeta "
          f"'{out_folder}'!")