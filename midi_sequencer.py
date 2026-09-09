"""
Secuenciador MIDI que combina progresiones por emoción y patrones de batería.

Usa las escalas/progresiones de `tabla_emociones.py` y los patrones de
`patrones_bateria.py` para generar pistas de piano, bajo y batería.
"""

import os
import random

import pretty_midi

from tabla_emociones import (
    ESCALAS,
    PROGRESIONES,
    apply_inversion,
    apply_tension_rules,
    chord_from_degree,
    note_from_degree,
)
from patrones_bateria import DRUM_PATTERNS, DRUM_MAP

# Grado "mayor" de referencia (intervalos) para resolver grados fuera de rango
# en escalas de pocas notas (p.ej. pentatónica: grado 7 -> Bb = paso 10).
_GRADO_MAYOR = [0, 2, 4, 5, 7, 9, 11]


def _resolver_grado(scale, degree):
    """Devuelve un grado (1-index) válido para la escala.

    Si `degree` cabe en la escala se usa tal cual; si no (pentatónica con
    grado 7), se elige el paso de la escala más cercano al grado mayor
    equivalente (7 -> 11 semitonos -> Bb en pentatónica menor).
    """
    if 1 <= degree <= len(scale):
        return degree
    objetivo = _GRADO_MAYOR[(degree - 1) % 7]
    idx = min(range(len(scale)), key=lambda i: abs(scale[i] - objetivo))
    return idx + 1


def mutate_progression(progression, scale):
    """Devuelve una copia de la progresión con un grado cambiado al azar.

    Elige una posición aleatoria y la sustituye por OTRO grado diatónico
    1..7 distinto del original (random.choice sobre el resto). Así el cambio
    siempre es real. Los grados fuera de la escala (pentatónica) se resuelven
    luego con _resolver_grado al construir los acordes.
    """
    nueva = list(progression)
    i = random.randrange(len(nueva))
    opciones = [g for g in range(1, 8) if g != nueva[i]]   # 1..7 menos el actual
    nueva[i] = random.choice(opciones)
    return nueva


def create_drum_track(patterns, tempo=140, start_time=0):
    """Crea un instrumento de batería (is_drum=True) a partir de un patrón.

    patterns   : dict {'kick': [...16 pasos 0/1], 'snare': [...], 'hat': [...],
                       'open_hat'?/ 'perc'?}
    tempo      : pulsos por minuto; cada paso dura una semicorchea = 60/tempo/4.
    start_time : desplazamiento en segundos hasta el primer paso.
    Devuelve un pretty_midi.Instrument listo para añadir al PrettyMIDI.
    """
    step = 60.0 / tempo / 4.0                      # duración de una semicorchea
    drums = pretty_midi.Instrument(program=0, is_drum=True, name="battery")

    for sonido, pasos in patterns.items():
        pitch = DRUM_MAP.get(sonido)
        if pitch is None:                          # sonido desconocido: se ignora
            continue
        # los acentos y los fantasmas suenan más suaves que bombos/cajas
        vel = 96 if sonido in ("open_hat", "perc") else 104
        for i, golpe in enumerate(pasos):
            if golpe:
                s = start_time + i * step
                # cada golpe ocupa toda la semicorchea
                drums.notes.append(pretty_midi.Note(
                    velocity=vel, pitch=pitch, start=s, end=s + step))
    return drums


def create_chord_track(scale, progression, emotion, tempo=140, bars_per_chord=1):
    """Crea pistas de piano (acordes) y bajo eléctrico para una progresión.

    scale      : escala de la emoción (intervalos desde la tónica).
    progression: lista de grados (1 = tónica).
    emotion    : determina la 7ª y las reglas de tensión de apply_tension_rules.
    tempo      : pulsos por minuto (1 compás = 4 tiempos).
    bars_per_chord: compases que dura cada acorde por defecto (se varía al azar
                 entre bars_per_chord y 2 compases para dar variedad rítmica).

    Variaciones: con un 30% de probabilidad la progresión se muta cambiando un
    grado al azar (mutate_progression); la duración de cada acorde se elige
    aleatoriamente: 50% bars_per_chord compases, 50% 2 compases.
    El bajo repite la fundamental una octava (-2) de la tónica.
    Devuelve (chord_instr, bass_instr).
    """
    beat = 60.0 / tempo                            # un tiempo en segundos

    # 30% de probabilidad de mutar un grado de la progresión
    if random.random() < 0.3:
        progression = mutate_progression(progression, scale)

    chords = pretty_midi.Instrument(program=0, name="chords", is_drum=False)
    bass = pretty_midi.Instrument(program=32, name="bass", is_drum=False)

    t = 0.0
    for degree in progression:
        compases = random.choice((bars_per_chord, 2))   # 50% corto, 50% largo
        dur = compases * 4 * beat                        # compás = 4 tiempos

        grado = _resolver_grado(scale, degree)       # valida grados de escalas cortas
        # 7ª solo en las emociones que la tabla marca (tristeza, amor, nostalgia)
        add_7 = emotion in ("tristeza", "amor", "nostalgia")
        acorde = chord_from_degree(scale, grado, num_notes=3, add_seventh=add_7)

        # inversión aleatoria y luego las reglas de tensión/color de la emoción
        acorde = apply_inversion(acorde, random.choice(("root", "first", "second", "open")))
        acorde = apply_tension_rules(acorde, emotion)

        for p in acorde:
            chords.notes.append(pretty_midi.Note(
                velocity=88, pitch=p, start=t, end=t + dur))

        # bajo: fundamental del grado en octava -2 (sub grave)
        baja = note_from_degree(scale, grado, octave_shift=-2)
        bass.notes.append(pretty_midi.Note(
            velocity=96, pitch=baja, start=t, end=t + dur))

        t += dur
    return chords, bass


def create_midi(emotion, genre, tempo=140):
    """Genera un PrettyMIDI completo para una emoción + género.

    Pasos:
      1. Escala y progresión desde ESCALAS/PROGRESIONES.
      2. Pistas de acordes + bajo (create_chord_track) y batería
         (create_drum_track) con el patrón del género.
      3. PrettyMIDI con el tempo inicial y los tres instrumentos añadidos.
    """
    scale = ESCALAS[emotion]                              # 1. escalas y progresión
    progression = PROGRESIONES[emotion]["principal"]

    chords, bass = create_chord_track(                    # 2. acordes y bajo
        scale, progression, emotion, tempo=tempo)
    drums = create_drum_track(DRUM_PATTERNS[genre], tempo=tempo)  # 2. batería

    midi = pretty_midi.PrettyMIDI(initial_tempo=tempo)    # 3. objeto con tempo
    midi.instruments.extend([chords, bass, drums])        # 3. 3 instrumentos
    return midi


def _nombre_valido(texto):
    """Convierte un texto en un nombre de archivo válido en Windows.

    Conserva los segmentos de directorio ('/'-'\\') sanitizando cada parte y
    uniéndolos con el separador del sistema.
    """
    import re
    segmentos = re.split(r"[\\/]+", str(texto))
    limpios = [re.sub(r'[<>:"|?*\x00-\x1f]', "_", s) for s in segmentos]
    limpios = ["".join(c for c in s if c.isprintable()).strip().strip(".")
               for s in limpios]
    limpios = [s or "beat" for s in limpios]
    if len(limpios) == 1:
        return limpios[0]
    return os.path.join(limpios[0], limpios[1]) if len(limpios) == 2 \
        else os.path.join(*limpios)


def export_stems(emotion, genre, tempo, output_prefix="beat"):
    """Guarda el MIDI completo y un stem (pista) por instrumento.

    Pasos:
      1. create_midi(emotion, genre, tempo) -> PrettyMIDI completo.
      2. Guarda el archivo completo como
         '{prefix}_{emotion}_{genre}_{tempo}bpm.mid'.
      3. Por cada instrumento crea un PrettyMIDI con el mismo tempo, le añade
         solo ese instrumento y lo guarda como
         '{prefix}_{...}_{tempo}bpm_{chords|bass|drums}.mid'.

    El prefijo y los nombres se sanean para ser válidos en Windows.
    Devuelve la lista de rutas escritas.
    """
    full = create_midi(emotion, genre, tempo)                    # 1. objeto completo

    prefix = _nombre_valido(output_prefix)
    base = f"{prefix}_{emotion}_{genre}_{tempo}bpm"

    ruta = f"{base}.mid"
    _mdir(ruta)
    full.write(ruta)                                             # 2. archivo completo

    etiquetas = {"chords": "chords", "bass": "bass", "battery": "drums"}
    escritos = [ruta]
    for inst in full.instruments:                                # 3. stems
        etiqueta = _nombre_valido(etiquetas.get(inst.name, inst.name))
        stem = pretty_midi.PrettyMIDI(initial_tempo=tempo)       # mismo tempo
        # conserva la signatura de tiempo del original para que sigan alineados
        stem.time_signature_changes = list(full.time_signature_changes)
        stem.instruments.append(inst)
        ruta_stem = f"{base}_{etiqueta}.mid"
        _mdir(ruta_stem)
        stem.write(ruta_stem)
        escritos.append(ruta_stem)

    return escritos


def _mdir(ruta):
    """Crea el directorio padre de una ruta si es necesario."""
    padre = os.path.dirname(ruta)
    if padre:
        os.makedirs(padre, exist_ok=True)


if __name__ == "__main__":
    os.makedirs("midi", exist_ok=True)
    combinaciones = [
        ("tristeza", "trap"),
        ("ira", "detroit"),
        ("amor", "rap"),
        ("decepcion", "plug"),
        ("nostalgia", "rap"),
    ]
    for emocion, genero in combinaciones:
        midi_obj = create_midi(emocion, genero, tempo=150)
        salida = os.path.join("midi", f"{emocion}_{genero}.mid")
        midi_obj.write(salida)
        n_chords = len(midi_obj.instruments[0].notes)
        n_bass = len(midi_obj.instruments[1].notes)
        n_drums = len(midi_obj.instruments[2].notes)
        print(f"{emocion:<10} + {genero:<8} -> {salida}  "
              f"(piano {n_chords}, bajo {n_bass}, batería {n_drums})")

    print("\n-- Stems --")
    for ruta in export_stems("amor", "rap", 150, output_prefix="midi/beat"):
        print(" ", ruta)