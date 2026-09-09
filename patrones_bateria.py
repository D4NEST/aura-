"""
Patrones de batería de 16 pasos por género + mapa de notas MIDI estándar.

Convención: cada patrón es una lista de 16 enteros (pasos de semicorchea),
1 = golpe, 0 = silencio. Índice 0 = tiempo 1 del compás.
"""

# ---------------------------------------------------------------------------
# DRUM_MAP: números de nota MIDI estándar (General MIDI)
# ---------------------------------------------------------------------------
DRUM_MAP = {
    "kick":      36,   # Bombo (B1)
    "snare":     38,   # Caja (D2)
    "hat":       42,   # Hi-hat cerrado (F#2)
    "open_hat":  46,   # Hi-hat abierto (A#2)
    "perc":      39,   # Percusión/clap secundario (D2 - hand clap alt)
}

# ---------------------------------------------------------------------------
# DRUM_PATTERNS: género -> patrones de 16 pasos
# ---------------------------------------------------------------------------
DRUM_PATTERNS = {
    # TRAP -- 808 con la negra descolocada.
    #   Kick: en 1, 8 y 11 (índices 0, 7 y 10); cuidado de no pisar la caja.
    #   Snare: en 5 y 13 (índices 4 y 12), el groove característico del trap.
    #   Hat: en todas las corcheas (índices pares), para empuje constante.
    "trap": {
        "kick":      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        "snare":     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        "hat":       [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },

    # RAP -- cuartos marcados + caja en 2 y 4.
    #   Kick: en cada negra (1, 5, 9, 13 -> índices 0, 4, 8, 12).
    #   Snare: en 5 y 13 (backbeat).
    #   Hat: corcheas con variación: se omite el paso del final para abrir
    #        espacio al open hat en el offbeat 13.
    "rap": {
        "kick":      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        "snare":     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        "hat":       [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
        "open_hat":  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    },

    # PLUG -- "riddim" suelto con hats a 16 y ghost notes.
    #   Kick: solo en 1 y 11 (índices 0 y 10), muy espaciado.
    #   Snare: en 5 y 13.
    #   Hat: en TODAS las semicorcheas (16 pasos llenos).
    #   open_hat: acentos en los pasos 6 y 14 (hats abiertos fantasmas).
    #   perc: ghost notes (clap/snap suaves) en 3, 6, 11 y 14.
    "plug": {
        "kick":      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        "snare":     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        "hat":       [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        "open_hat":  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        "perc":      [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    },

    # DETROIT -- four-on-the-floor con la caja encima y hats en offbeats.
    #   Kick: en cada negra (1, 5, 9, 13).
    #   Snare: en 5 y 13 (backbeat constante).
    #   Hat: en los offbeats (los "&" de cada negra: índices 1, 5, 9, 13),
    #        dándole el balanceo típico del techno de Detroit.
    "detroit": {
        "kick":      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        "snare":     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        "hat":       [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    },
}

if __name__ == "__main__":
    # Verificación: todos los patrones deben tener 16 pasos.
    for genero, pat in DRUM_PATTERNS.items():
        for nombre, pasos in pat.items():
            largo = len(pasos)
            assert largo == 16, f"{genero}/{nombre} tiene {largo} pasos"
        print(f"{genero:<8}", "kick:", DRUM_PATTERNS[genero]["kick"],
              "| snare:", DRUM_PATTERNS[genero]["snare"],
              "| hat:", DRUM_PATTERNS[genero]["hat"])
    print("DRUM_MAP:", DRUM_MAP)