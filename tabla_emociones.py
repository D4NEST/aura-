"""
Diccionarios base extraídos de la tabla de emociones.
- ESCALAS:      emoción -> intervalos en semitonos desde la tónica (0 = tónica).
- PROGRESIONES: emoción -> grados de la progresión principal y alternativas
                (1 = tónica; los accidentes se indican en los comentarios).
"""

# ---------------------------------------------------------------------------
# ESCALAS: emoción -> intervalos en semitonos desde la tónica
# ---------------------------------------------------------------------------
ESCALAS = {
    # Menor natural (Eólico). 3ª, 6ª y 7ª menores: el sonido melancólico por
    # antonomasia (ej. La menor = La, Si, Do, Re, Mi, Fa, Sol).
    "tristeza": [0, 2, 3, 5, 7, 8, 10],

    # Frigio. Como el menor natural pero con la 2ª bemol (1 semitono):
    # tensión y oscuridad agresiva (ej. Mi frigio = Mi, Fa, Sol, La, Si, Do, Re).
    "ira": [0, 1, 3, 5, 7, 8, 10],

    # Mayor (Jónico). 3ª y 7ª mayores: brillante, cálido y resuelto
    # (ej. Do mayor = Do, Re, Mi, Fa, Sol, La, Si).
    "amor": [0, 2, 4, 5, 7, 9, 11],

    # Locrio. 2ª, 5ª y 6ª bemol: la tónica se siente inestable y sombría,
    # ideal para decepción (ej. Si locrio = Si, Do, Re, Mi, Fa, Sol, La).
    "decepcion": [0, 1, 3, 5, 6, 8, 10],

    # Pentatónica menor. Solo 5 notas (sin 2ª ni 6ª) + 7ª menor: sonido
    # flotante, chill y nostálgico (ej. Do pentatónica menor = Do, Mib, Fa, Sol, Sib).
    "nostalgia": [0, 3, 5, 7, 10],
}

# ---------------------------------------------------------------------------
# PROGRESIONES: emoción -> grados de la progresión principal y alternativas
# (1 = tónica). Grados = posición en ESCALAS (ESCALAS[grado - 1] es la raíz).
# ---------------------------------------------------------------------------
PROGRESIONES = {
    # Principal: i - bVI - bIII - bVII  (Cm - Ab - Eb - Bb sobre Do).
    # Series de 5ªs descendentes típica del menor natural.
    # Alternativa: i - iv - v - bVI  (Cm - Fm - Gm - Ab).
    "tristeza": {
        "principal": [1, 6, 3, 7],
        "alternativas": [[1, 4, 5, 6]],
    },

    # Principal: i - bII - i - bII  (Cm - Db). El semitono Db-C martillea
    # inestable; es el motivo agresivo de la fila.
    # Alternativa: i - v° - bVI - bII  (Cm - G° - Ab - Db).
    "ira": {
        "principal": [1, 2, 1, 2],
        "alternativas": [[1, 5, 6, 2]],
    },

    # Principal: I - V - vi - IV  (C - G - Am - F sobre Do): la secuencia
    # cálida más usada en música pop.
    # Alternativa: ii7 - V7 - Imaj7  (Dm7 - G7 - Cmaj7): II-V-I de jazz.
    "amor": {
        "principal": [1, 5, 6, 4],
        "alternativas": [[2, 5, 1]],
    },

    # Principal: i - v - bVI - bV - IV - i  (Cm - Gm - Ab - Gb - F - Cm):
    # el bV (Gb) destroza la cadencia y arrastra la sombra hasta el final.
    # Alternativa: bVI - bV - IV - i  (Ab - Gb - F - Cm), remate descendente.
    "decepcion": {
        "principal": [1, 5, 6, 5, 4, 1],
        "alternativas": [[6, 5, 4, 1]],
    },

    # Principal: i7 - IV7 - v7 - iv7 - i7 - bVII  (Cm7 - F7 - Gm7 - Fm7 -
    # Cm7 - Bb): movimiento suave sobre la pentatónica menor.
    # Alternativa: i7 - bVII  (Cm7 - Bb), giro mínimo de dos acordes.
    "nostalgia": {
        "principal": [1, 4, 5, 4, 1, 7],
        "alternativas": [[1, 7]],
    },
}

# ---------------------------------------------------------------------------
# Funciones sobre escalas y grados
# ---------------------------------------------------------------------------

TONIC_BASE = 48  # C3: tónica de referencia (MIDI)

def note_from_degree(scale, degree, octave_shift=0):
    """Nota MIDI (int) del grado (1-index) dentro de una escala.

    scale        : lista de intervalos en semitonos desde la tónica (0 = tónica)
    degree       : grado, 1 = tónica (1 <= degree <= len(scale))
    octave_shift : cuántas octavas (12 semitonos) sumar sobre la base

    La tónica base es C3 (MIDI 48); p.ej. note_from_degree(ESCALAS['amor'], 5)
    devuelve 55 (G3), la quinta de Do mayor.
    """
    if not 1 <= degree <= len(scale):
        raise ValueError(f"degree fuera de rango: {degree} (escala de {len(scale)} notas)")
    return TONIC_BASE + scale[degree - 1] + 12 * octave_shift


def chord_from_degree(scale, degree, num_notes=3, add_seventh=False, add_ninth=False):
    """Acorde diatónico por apilamiento de terceras desde un grado.

    Apila pasos alternos de la escala (0, +2, +4, ...): 1ª, 3ª, 5ª, 7ª, 9ª.
    Los intervalos 6 y 8 se cuentan en PASOS DE ESCALA (no semitonos), como
    pide la especificación: 6 = 7ª, 8 = 9ª. Las notas que "dan la vuelta"
    suben una octava para mantener el acorde ascendente.

    add_seventh : añade la 7ª (paso 6) si aún no está en el acorde.
    add_ninth   : añade la 9ª (paso 8) si aún no está en el acorde.
    Devuelve una lista de notas MIDI ascendentes desde la fundamental.
    """
    pasos = list(range(0, 2 * num_notes, 2))      # 0, 2, 4, ... (terceras)
    if add_seventh and 6 not in pasos:
        pasos.append(6)
    if add_ninth and 8 not in pasos:
        pasos.append(8)
    pasos.sort()

    n = len(scale)
    acorde = []
    for paso in pasos:
        pos = degree - 1 + paso                    # posición en la escala (cíclica)
        idx = pos % n
        octava = pos // n                          # vueltas a la octava superior
        acorde.append(TONIC_BASE + scale[idx] + 12 * octava)
    return acorde


def apply_inversion(chord, inversion_type="root"):
    """Aplica una inversión/vozaje a un acorde (lista de notas MIDI).

    'root'   : sin cambios.
    'first'  : sube la fundamental una octava (primera inversión).
    'second' : sube fundamental y tercera una octava (segunda inversión).
    'open'   : separa voces subiendo la segunda voz una octava.
    'drop2'  : baja la segunda voz desde arriba una octava (solo si hay >= 4
               notas; en caso contrario devuelve el acorde sin cambios).
    La lista se devuelve reordenada de menor a mayor para facilitar su uso.
    """
    voces = list(chord)
    if inversion_type == "root":
        return voces
    if inversion_type == "first":
        voces[0] += 12                              # fundamental -> 8ª superior
    elif inversion_type == "second":
        voces[0] += 12                              # fundamental y 3ª -> octava
        voces[1] += 12
    elif inversion_type == "open":
        voces[1] += 12                              # abre hueco entre 1ª y 2ª voz
    elif inversion_type == "drop2":
        if len(voces) >= 4:
            voces[-2] -= 12                         # la 2ª voz desde arriba baja
        else:
            return voces                            # drop2 requiere 4+ notas
    else:
        raise ValueError(f"inversion_type inválido: {inversion_type!r}")
    return sorted(set(voces))


def apply_tension_rules(chord, emotion):
    """Aplica la regla de tensión/color de una emoción a un acorde (MIDI).

    La fundamental se toma como la nota más grave (chord[0]); el resultado se
    devuelve ordenado y sin duplicados.

    - 'ira'      : power chord. Se conserva solo la fundamental y la quinta
                   justa (fundamental + 7 semitonos), eliminando la 3ª. Da el
                   sonido crudo y frío descrito en la tabla (sin 3ª).
    - 'tristeza' : sus2. La 3ª (2ª nota, índice 1) se baja 2 semitonos para
                   convertirse en la 2ª. Ojo: la aproximación funciona mejor
                   sobre tríadas mayorees; sobre una 3ª menor da como resultado
                   una 2ª bemol (curiosidad modal, igualmente melancólica).
    - 'amor'     : se asegura una 7ª mayor añadiendo 11 semitonos sobre la
                   fundamental si aún no está en el acorde.
    - 'decepcion': la nota más aguda baja medio tono, simulando la "caída"
                   de la voz superior descrita en la tabla.
    - 'nostalgia': no se modifica el acorde; aquí se aplicarán voicings
                   especiales (voz superior en 7ª/9ª, bajos sobre la
                   fundamental del siguiente acorde) en una fase posterior.
    """
    if len(chord) == 0:
        return []
    raiz = chord[0]

    if emotion == "ira":
        # Solo raíz + quinta justa (raíz + 7); se descarta cualquier otra nota.
        return sorted(set([raiz, raiz + 7]))

    if emotion == "tristeza":
        out = list(chord)
        if len(out) >= 3:
            out[1] -= 2                       # 3ª -> 2ª (sus2)
        return sorted(set(out))

    if emotion == "amor":
        septima = raiz + 11                    # 7ª mayor sobre la fundamental
        return sorted(set(chord + [septima])) if septima not in chord else sorted(chord)

    if emotion == "decepcion":
        out = list(chord)
        if len(out) >= 2:
            out[-1] -= 1                      # la nota más alta cae medio tono
        return sorted(set(out))

    if emotion == "nostalgia":
        # Sin cambios por ahora: los voicings específicos llegan más adelante.
        return list(chord)

    raise ValueError(f"emoción no soportada por apply_tension_rules: {emotion!r}")


if __name__ == "__main__":
    # Verificación rápida: grados -> notas sobre Do (0 = Do).
    N = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
    # Grados "mayores" de referencia para desambiguar accidentes (7 = Bb en nostalgia).
    MAYOR = [0, 2, 4, 5, 7, 9, 11]

    def raiz(g, escala):
        return min(escala, key=lambda i: abs(i - MAYOR[g - 1]))

    for emocion, escala in ESCALAS.items():
        notas = " ".join(N[i] for i in escala)
        prog = PROGRESIONES[emocion]["principal"]
        raices = " - ".join(N[raiz(g, escala)] for g in prog)
        print(f"{emocion:<10} escala: [{', '.join(map(str, escala))}] "
              f"({notas})  |  progresión {prog} -> {raices}")

    print("\n-- Funciones: notas, acordes e inversiones --")
    may = ESCALAS["amor"]
    print("Grado 5 en Do mayor:", note_from_degree(may, 5),
          "(G3, octava +1:", note_from_degree(may, 5, octave_shift=1), ")")

    C = chord_from_degree(may, 1)                      # I: 1ª, 3ª, 5ª
    Cmaj7 = chord_from_degree(may, 1, add_seventh=True)
    Cmaj9 = chord_from_degree(may, 1, add_seventh=True, add_ninth=True)
    print("I (triada):", C)
    print("Imaj7    :", Cmaj7, "-> first:", apply_inversion(Cmaj7, "first"),
          "| second:", apply_inversion(Cmaj7, "second"),
          "| open:", apply_inversion(Cmaj7, "open"))
    print("Imaj9    :", Cmaj9, "-> drop2:", apply_inversion(Cmaj9, "drop2"))

    men = ESCALAS["tristeza"]
    tm = chord_from_degree(men, 1)
    print("i en menor natural:", tm, "-> first:", apply_inversion(tm, "first"),
          "| second:", apply_inversion(tm, "second"))
    print("drop2 en triada (sin efecto):", apply_inversion(tm, "drop2"))

    print("\n-- apply_tension_rules por emoción (tónica en C3) --")
    for em in ESCALAS:
        escala = ESCALAS[em]
        base = chord_from_degree(escala, 1, num_notes=3)   # I o i según emoción
        print(f"{em:<10} {base} -> {apply_tension_rules(base, em)}")