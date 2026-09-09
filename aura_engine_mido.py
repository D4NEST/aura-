"""
AURA - Motor generador de canciones MIDI (backend mido)
=======================================================

Variante del motor AURA que escribe archivos MIDI con la librería `mido`
(librería pegada a la especificación, sin conexión con pretty_midi).

API principal:
    generate_song_midi(song_structure, root_key, tempo, ticks_per_beat) -> mido.MidiFile
    export_aura_project(song_structure, root_key, tempo, output_dir) -> (output_dir, prefix)

Constantes (ESCALAS, PROGRESIONES, DRUM_MAP, DRUM_PATTERNS), armonía
(note_from_degree, chord_from_degree, apply_inversion, apply_tension_rules,
mutate_progression) y estructura de canción son equivalentes a
aura_engine.py; aquí la salida son pistas mido tipo 1 (3 pistas:
Chords/Bass canalizada, Drums en canal 9 de percusión GM).

Nota sobre la batería: los pasos sin golpe NO emiten eventos fantasma; el
silencio se acumula en el delta del siguiente evento real (reloj correcto y
archivos compatibles con cualquier DAW).
"""

import os
import random

import mido
from mido import MidiFile, MidiTrack, Message, MetaMessage

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

# Números de nota MIDI estándar (General MIDI, canal de percusión)
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
# 2) FUNCIONES ARMÓNICAS
# ---------------------------------------------------------------------------

def note_from_degree(scale, degree, octave_shift=0, root_offset=0):
    """Nota MIDI del grado (1-index) dentro de la escala.

    La tónica base es C3 (48) desplazada por root_offset; los grados que se
    pasan del tamaño de la escala suben de octava (apilamiento sin límite).
    """
    scale_len = len(scale)
    octave = (degree - 1) // scale_len + octave_shift
    idx = (degree - 1) % scale_len
    base_note = TONIC_BASE + root_offset
    return base_note + scale[idx] + (octave * 12)


def chord_from_degree(scale, degree, root_offset=0, add_seventh=False,
                      add_ninth=False):
    """Construye un acorde apilando terceras diatónicas desde el grado."""
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
    """Aplica inversión o voicing al acorde (lista de notas MIDI)."""
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

    'ira' power chord; 'tristeza' sus2; 'amor' 7ª mayor; 'decepcion' la nota
    más aguda cae medio tono; el resto queda sin cambios.
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

    Con la escala, el grado nuevo se limita a 1..len(scale) (escalas cortas
    como la pentatónica no producen grados inexistentes).
    """
    mutated = list(progression)
    idx = random.randrange(len(mutated))
    max_grado = len(scale) if scale is not None else 7
    opciones = [g for g in range(1, max_grado + 1) if g != mutated[idx]]
    mutated[idx] = random.choice(opciones)
    return mutated


# ---------------------------------------------------------------------------
# 3) CONSTRUCTOR DE EVENTOS MIDI (MIDO)
# ---------------------------------------------------------------------------

def generate_song_midi(song_structure, root_key='C', tempo=140,
                       ticks_per_beat=480):
    """Genera un MidiFile (type 1) con la estructura de canción.

    song_structure: lista de tuplas
        [('intro', 'nostalgia', 'trap', 4), ('verso', 'ira', 'trap', 8), ...]
    Cada tupla es (nombre_seccion, emocion, genero, num_compases). La pista de
    batería usa el canal 9 (percusión GM); acordes y bajo los canales 0 y 1.
    """
    mid = MidiFile(ticks_per_beat=ticks_per_beat)

    track_chords = MidiTrack()
    track_bass = MidiTrack()
    track_drums = MidiTrack()
    mid.tracks.extend([track_chords, track_bass, track_drums])

    # Cabeceras de pista e instrumentos GM
    track_chords.append(MetaMessage('track_name', name='Chords', time=0))
    track_chords.append(Message('program_change', channel=0, program=0, time=0))
    track_chords.append(MetaMessage('time_signature',
                                    numerator=4, denominator=4, time=0))
    track_chords.append(MetaMessage('set_tempo',
                                    tempo=mido.bpm2tempo(tempo), time=0))

    track_bass.append(MetaMessage('track_name', name='Bass', time=0))
    track_bass.append(Message('program_change', channel=1, program=32, time=0))

    track_drums.append(MetaMessage('track_name', name='Drums', time=0))
    # Canal 9 es percusión MIDI General: no hace falta program_change.

    t16 = ticks_per_beat // 4          # ticks por semicorchea
    tbar = ticks_per_beat * 4          # ticks por compás (4/4)
    root_offset = NOTE_OFFSETS.get(root_key, 0)

    for section_name, emotion, genre, total_bars in song_structure:
        scale = ESCALAS[emotion]
        progression = PROGRESIONES[emotion]['principal']

        # 30% de probabilidad de mutar la progresión
        if random.random() < 0.3:
            progression = mutate_progression(progression, scale)

        # --- ARMONÍA: acordes (ch 0) y bajo (ch 1) de la sección ---
        bar_count = 0
        while bar_count < total_bars:
            for degree in progression:
                if bar_count >= total_bars:
                    break

                # Duración aleatoria (1 o 2 compases) sin pasarse de la sección
                chord_bars = random.choice([1, 2])
                if bar_count + chord_bars > total_bars:
                    chord_bars = total_bars - bar_count
                duration_ticks = chord_bars * tbar

                add_7 = emotion in ('amor', 'nostalgia')
                add_9 = emotion in ('tristeza', 'amor')
                raw_chord = chord_from_degree(scale, degree,
                                              root_offset=root_offset,
                                              add_seventh=add_7,
                                              add_ninth=add_9)
                inv_chord = apply_inversion(
                    raw_chord, random.choice(('root', 'first', 'second',
                                              'open', 'drop2')))
                final_chord = apply_tension_rules(inv_chord, emotion)

                # Note ON con micro-arpegiado (10 ticks entre notas)
                for i, note in enumerate(final_chord):
                    delta = 10 if i > 0 else 0
                    track_chords.append(Message(
                        'note_on', channel=0, note=note,
                        velocity=random.randint(70, 95), time=delta))

                # Note OFF: el primero lleva la duración restante del acorde
                for i, note in enumerate(final_chord):
                    delta = (duration_ticks - (len(final_chord) - 1) * 10
                             if i == 0 else 0)
                    track_chords.append(Message(
                        'note_off', channel=0, note=note, velocity=0,
                        time=delta))

                # Bajo: fundamental a octava -2
                bass_note = note_from_degree(scale, degree, octave_shift=-2,
                                             root_offset=root_offset)
                track_bass.append(Message(
                    'note_on', channel=1, note=bass_note,
                    velocity=random.randint(90, 110), time=0))
                track_bass.append(Message(
                    'note_off', channel=1, note=bass_note, velocity=0,
                    time=duration_ticks))

                bar_count += chord_bars

        # --- BATERÍA (canal 9) de la sección ---
        pattern_data = DRUM_PATTERNS.get(genre, DRUM_PATTERNS['trap'])
        pending = 0   # silencio acumulado en ticks (sin eventos fantasma)

        for bar in range(total_bars):
            is_last_bar = (bar == total_bars - 1)
            for step in range(16):
                # FILL: redoble de snare + percusión en las 4 últimas
                # semicorcheas del último compás de la sección
                if is_last_bar and step >= 12:
                    track_drums.append(Message(
                        'note_on', channel=9, note=DRUM_MAP['snare'],
                        velocity=random.randint(95, 120), time=pending))
                    track_drums.append(Message(
                        'note_off', channel=9, note=DRUM_MAP['snare'],
                        velocity=0, time=t16))
                    if step % 2 == 0:
                        track_drums.append(Message(
                            'note_on', channel=9, note=DRUM_MAP['perc'],
                            velocity=100, time=0))
                        track_drums.append(Message(
                            'note_off', channel=9, note=DRUM_MAP['perc'],
                            velocity=0, time=t16))
                    pending = 0

                else:
                    active_notes = [
                        (DRUM_MAP[inst], random.randint(80, 110))
                        for inst, pat in pattern_data.items()
                        if pat[step] == 1
                    ]
                    if active_notes:
                        for j, (pitch, vel) in enumerate(active_notes):
                            track_drums.append(Message(
                                'note_on', channel=9, note=pitch, velocity=vel,
                                time=pending if j == 0 else 0))
                        for j, (pitch, vel) in enumerate(active_notes):
                            track_drums.append(Message(
                                'note_off', channel=9, note=pitch, velocity=0,
                                time=t16 if j == 0 else 0))
                        pending = 0
                    else:
                        pending += t16   # silencio: se pasa al siguiente evento

    return mid


# ---------------------------------------------------------------------------
# 4) EXPORTACIÓN: MIDI COMPLETO + STEMS
# ---------------------------------------------------------------------------

def export_aura_project(song_structure, root_key='C', tempo=140,
                        output_dir='generated_midi'):
    """Guarda el MIDI completo y un stem por instrumento.

    Crea output_dir con os.makedirs si no existe. Devuelve (output_dir, prefix).
    El prefijo ('AURA_mido_{root}_{tempo}bpm') diferencia los archivos del
    motor pretty_midi (AURA_Song_*) para no pisarlos.
    """
    os.makedirs(output_dir, exist_ok=True)
    full_mid = generate_song_midi(song_structure, root_key=root_key, tempo=tempo)

    prefix = f"AURA_mido_{root_key}_{tempo}bpm"

    # 1. MIDI completo
    full_path = os.path.join(output_dir, f"{prefix}_Full.mid")
    full_mid.save(full_path)

    # 2. Stems separados (Chords, Bass, Drums)
    stem_names = ['chords', 'bass', 'drums']
    for track, stem_name in zip(full_mid.tracks, stem_names):
        stem_mid = MidiFile(ticks_per_beat=full_mid.ticks_per_beat)
        stem_mid.tracks.append(track)
        stem_path = os.path.join(output_dir, f"{prefix}_stem_{stem_name}.mid")
        stem_mid.save(stem_path)

    return output_dir, prefix


# ---------------------------------------------------------------------------
# 5) PRUEBA Y GENERACIÓN DEL EJEMPLO
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    # Trabaja siempre junto al módulo (AURA/) para no depender del CWD.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    estilo_cancion = [
        ('intro', 'nostalgia', 'trap', 4),
        ('verso', 'tristeza', 'trap', 8),
        ('coro', 'ira', 'detroit', 8),
        ('puente', 'decepcion', 'plug', 4),
        ('outro', 'amor', 'rap', 4),
    ]

    folder, prefix = export_aura_project(estilo_cancion, root_key='F#',
                                         tempo=144)
    print(f"Archivos MIDI (mido) generados exitosamente en: {folder}")
    print(f"Prefijo: {prefix}")