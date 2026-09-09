"""
AURA - Motor generador de canciones MIDI (backend nativo, sin dependencias)
===========================================================================

Genera archivos MIDI 1.0 escribiendo los bytes binarios directamente, según
la especificación estándar (MThd + pistas MTrk, valores de longitud variable).
No usa pretty_midi ni mido: solo la librería estándar (os, random, struct).

API principal:
    generate_song_tracks(song_structure, root_key, tempo, ticks_per_beat)
        -> (writer_chords, writer_bass, writer_drums, ticks_per_beat)
    export_aura_song(song_structure, root_key, tempo, output_dir)
        -> (output_dir, prefix)

Escalas, progresiones, armonía (note_from_degree, chord_from_degree,
apply_inversion, apply_tension_rules, mutate_progression) y estructura de
canción son equivalentes a aura_engine.py/aura_engine_mido.py, pero la salida
es MIDI 1.0 nativo: pista 0 Chords (canal 0, piano GM) con tempo global,
pista Bass (canal 1), pista Drums (canal 9, percusión GM) con fills.
"""

import os
import random
import struct

# ---------------------------------------------------------------------------
# 1) MATERIAS PRIMAS (iguales al resto del proyecto)
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
# 2) ESCRIBANO DE MIDI BINARIO (FORMATO MIDI 1.0 NATIVO)
# ---------------------------------------------------------------------------

def write_varlen(value):
    """Convierte un entero a longitud variable (spec MIDI, VLQ)."""
    buffer = bytearray()
    while True:
        to_write = value & 0x7F
        value >>= 7
        if len(buffer) > 0:
            to_write |= 0x80
        buffer.insert(0, to_write)
        if value == 0:
            break
    return bytes(buffer)


class MidiTrackWriter:
    """Acumula eventos en ticks absolutos y serializa una pista MTrk."""

    def __init__(self):
        self.events = []   # lista de tuplas (abs_tick, bytearray_msg)

    def add_event(self, abs_tick, msg_bytes):
        self.events.append((abs_tick, msg_bytes))

    def get_track_bytes(self, track_name=None, program=None, channel=0):
        """Devuelve bytes 'MTrk + len + datos' ordenados por tiempo."""
        self.events.sort(key=lambda x: x[0])

        track_data = bytearray()

        # Nombre de la pista (meta error de delta 0)
        if track_name:
            name_bytes = track_name.encode('utf-8')
            track_data.extend(b'\x00\xFF\x03'
                              + write_varlen(len(name_bytes)) + name_bytes)

        # Program Change (instrumento General MIDI); canal 9 no usa programa
        if program is not None and channel != 9:
            track_data.extend(b'\x00'
                              + bytes([0xC0 | (channel & 0x0F),
                                       program & 0x7F]))

        last_tick = 0
        for abs_tick, msg_bytes in self.events:
            delta_tick = abs_tick - last_tick
            track_data.extend(write_varlen(delta_tick))
            track_data.extend(msg_bytes)
            last_tick = abs_tick

        # End of Track meta event
        track_data.extend(b'\x00\xFF\x2F\x00')

        return b'MTrk' + struct.pack('>I', len(track_data)) + track_data


# ---------------------------------------------------------------------------
# 3) FUNCIONES ARMÓNICAS
# ---------------------------------------------------------------------------

def note_from_degree(scale, degree, octave_shift=0, root_offset=0):
    """Nota MIDI del grado (1-index) dentro de la escala (tónica C3 base)."""
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
# 4) MOTOR DE COMPOSICIÓN Y CONSTRUCCIÓN DE CANCIÓN COMPLETA
# ---------------------------------------------------------------------------

def generate_song_tracks(song_structure, root_key='C', tempo=140,
                         ticks_per_beat=480):
    """Genera los 3 MidiTrackWriter de la canción (acordes, bajo, batería).

    song_structure: lista de tuplas
        [('intro', 'nostalgia', 'trap', 4), ('verso', 'ira', 'trap', 8), ...]
    La pista de acordes lleva el tempo global (y el compás 4/4); la de batería
    añade un FILL (roll de snare + percusión) en las 4 últimas semicorcheas
    del último compás de cada sección.
    """
    ticks_per_16th = ticks_per_beat // 4
    ticks_per_bar = ticks_per_beat * 4

    writer_chords = MidiTrackWriter()
    writer_bass = MidiTrackWriter()
    writer_drums = MidiTrackWriter()

    # Tempo global (FF 51 03) y compás 4/4 (FF 58 04) en la pista 0.
    # MidiTrackWriter añade su propio delta, así que los meta van SIN delta.
    us_per_beat = int(60000000 / tempo)
    tempo_meta = b'\xFF\x51\x03' + struct.pack('>I', us_per_beat)[1:]
    time_sig = b'\xFF\x58\x04\x04\x02\x18\x08'
    writer_chords.add_event(0, tempo_meta)
    writer_chords.add_event(0, time_sig)

    current_section_tick = 0

    for section_name, emotion, genre, total_bars in song_structure:
        scale = ESCALAS[emotion]
        progression = PROGRESIONES[emotion]['principal']

        # 30% de probabilidad de mutar la progresión
        if random.random() < 0.3:
            progression = mutate_progression(progression, scale)

        root_offset = NOTE_OFFSETS.get(root_key, 0)

        # --- ARMONÍA (ACORDES y BAJO) de la sección ---
        bar_count = 0
        section_tick = current_section_tick

        while bar_count < total_bars:
            for degree in progression:
                if bar_count >= total_bars:
                    break

                # Duración aleatoria (1 o 2 compases) sin pasarse de la sección
                chord_bars = random.choice([1, 2])
                if bar_count + chord_bars > total_bars:
                    chord_bars = total_bars - bar_count
                duration_ticks = chord_bars * ticks_per_bar

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

                # Acordes (canal 0): micro-strumming de 12 ticks entre notas
                for i, note in enumerate(final_chord):
                    strum_delay = i * 12
                    note_on = bytes([0x90, note & 0x7F,
                                     random.randint(70, 95)])
                    note_off = bytes([0x80, note & 0x7F, 0])
                    writer_chords.add_event(section_tick + strum_delay, note_on)
                    writer_chords.add_event(section_tick
                                            + duration_ticks - 20, note_off)

                # Bajo (canal 1): fundamental a octava -2
                bass_note = note_from_degree(scale, degree, octave_shift=-2,
                                             root_offset=root_offset)
                writer_bass.add_event(
                    section_tick, bytes([0x91, bass_note & 0x7F,
                                         random.randint(90, 110)]))
                writer_bass.add_event(
                    section_tick + duration_ticks - 10,
                    bytes([0x81, bass_note & 0x7F, 0]))

                section_tick += duration_ticks
                bar_count += chord_bars

        # --- BATERÍA (canal 9) de la sección, con fills ---
        pattern_data = DRUM_PATTERNS.get(genre, DRUM_PATTERNS['trap'])
        drum_tick = current_section_tick

        for bar in range(total_bars):
            is_last_bar = (bar == total_bars - 1)
            for step in range(16):
                step_tick = (drum_tick + (bar * ticks_per_bar)
                             + (step * ticks_per_16th))

                # FILL en las 4 últimas semicorcheas del último compás
                if is_last_bar and step >= 12:
                    snare_pitch = DRUM_MAP['snare']
                    perc_pitch = DRUM_MAP['perc']
                    writer_drums.add_event(
                        step_tick, bytes([0x99, snare_pitch,
                                          random.randint(100, 125)]))
                    writer_drums.add_event(
                        step_tick + ticks_per_16th - 5,
                        bytes([0x89, snare_pitch, 0]))
                    if step % 2 == 0:
                        writer_drums.add_event(
                            step_tick, bytes([0x99, perc_pitch, 110]))
                        writer_drums.add_event(
                            step_tick + ticks_per_16th - 5,
                            bytes([0x89, perc_pitch, 0]))
                else:
                    for inst, pat in pattern_data.items():
                        if pat[step] == 1:
                            pitch = DRUM_MAP[inst]
                            vel = (random.randint(85, 115) if inst == 'kick'
                                   else random.randint(70, 105))
                            writer_drums.add_event(
                                step_tick, bytes([0x99, pitch, vel]))
                            writer_drums.add_event(
                                step_tick + ticks_per_16th - 5,
                                bytes([0x89, pitch, 0]))

        current_section_tick += (total_bars * ticks_per_bar)

    return writer_chords, writer_bass, writer_drums, ticks_per_beat


# ---------------------------------------------------------------------------
# 5) FUNCIÓN PRINCIPAL DE EXPORTACIÓN
# ---------------------------------------------------------------------------

def export_aura_song(song_structure, root_key='C', tempo=140,
                     output_dir='generated_midi'):
    """Escribe el MIDI 1.0 completo y los 3 stems (sin dependencias).

    Crea output_dir con os.makedirs si no existe. Prefijo de salida
    'AURA_native_{root}_{tempo}bpm' (no pisa al motor pretty_midi ni mido).
    Devuelve (output_dir, prefix).
    """
    os.makedirs(output_dir, exist_ok=True)

    writer_chords, writer_bass, writer_drums, ticks_per_beat = \
        generate_song_tracks(song_structure, root_key=root_key, tempo=tempo)

    prefix = f"AURA_native_{root_key}_{tempo}bpm"

    # Bytes de cada pista
    chords_bytes = writer_chords.get_track_bytes(
        track_name="Chords (Piano)", program=0, channel=0)
    bass_bytes = writer_bass.get_track_bytes(
        track_name="Bass (Electric)", program=32, channel=1)
    drums_bytes = writer_drums.get_track_bytes(
        track_name="Drums (Percussion)", program=0, channel=9)

    # 1. Canción COMPLETA: MThd (formato 1, 3 pistas) + MTrk x3.
    #    Cabecera SMF correcta: 'MThd' + uint32 longitud(=6) + datos.
    header_full = (b'MThd' + struct.pack('>IHH', 6, 1, 3)
                   + struct.pack('>H', ticks_per_beat))
    full_path = os.path.join(output_dir, f"{prefix}_Full.mid")
    with open(full_path, 'wb') as f:
        f.write(header_full + chords_bytes + bass_bytes + drums_bytes)

    # 2. Stems individuales (una pista por archivo)
    stems = [
        ('chords', chords_bytes),
        ('bass', bass_bytes),
        ('drums', drums_bytes),
    ]
    header_stem = (b'MThd' + struct.pack('>IHH', 6, 1, 1)
                   + struct.pack('>H', ticks_per_beat))
    for stem_name, track_b in stems:
        stem_path = os.path.join(output_dir, f"{prefix}_stem_{stem_name}.mid")
        with open(stem_path, 'wb') as f:
            f.write(header_stem + track_b)

    return output_dir, prefix


# ---------------------------------------------------------------------------
# 6) DEMOSTRACIÓN DEL MOTOR
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    # Trabaja siempre junto al módulo (AURA/) para no depender del CWD.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Definición de la canción: (Sección, Emoción, Género de batería, Compases)
    cancion_demostracion = [
        ('intro', 'nostalgia', 'trap', 4),
        ('verso_1', 'tristeza', 'trap', 8),
        ('coro', 'ira', 'detroit', 8),
        ('puente', 'decepcion', 'plug', 4),
        ('outro', 'amor', 'rap', 4),
    ]

    directorio, prefijo = export_aura_song(cancion_demostracion,
                                           root_key='F#', tempo=144)
    print("¡Archivos MIDI (backend nativo) exportados con éxito!")
    print(f"Directorio: {directorio}")
    print("Archivos creados:")
    print(f" - {prefijo}_Full.mid (canción completa arreglada)")
    print(f" - {prefijo}_stem_chords.mid")
    print(f" - {prefijo}_stem_bass.mid")
    print(f" - {prefijo}_stem_drums.mid")