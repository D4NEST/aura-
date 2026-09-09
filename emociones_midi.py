"""
Generador de progresiones armónicas por emoción -> MIDI (pretty_midi).

Tu tabla (TABLA_EMOCIONES) es totalmente editable: cada emoción define el/los
modos, una o varias progresiones en números romanos, y la regla de inversión.

Interpretación de los números romanos:
  Notación estándar: el grado se calcula sobre la escala mayor de la tónica y los
  accidentes se aplican de forma explícita (sobre Do: bVI = La bemol, V = Sol,
  bV = Sol bemol). El modo de cada fila (eólico, frigio, locrio...) define el
  carácter/color (inversiones, extensiones, trundo), no el cálculo de notas.
  Por eso tristeza se anota como  i - bVI - bIII - bVII  (Cm - Ab - Eb - Bb).

Sintaxis de numerales soportada:
  i I ii II iii III iv IV v V vi VI vii VII
  con accidentes: b/♭ y #/♯  ->  bII, bVI, bVII, bV ...
  con extensiones: 7, maj7/M7/Δ7, 9/add9, sus2, sus4, °/dim, m7b5/ø, 6 ...
  Ejemplos: i, VI, bII, v°, ii7, V7, Imaj7, i7, iv7, bVII.
"""

import os
import re
from dataclasses import dataclass

import pretty_midi

# -------------------------------------------------------------------------
# 1) MATERIAS PRIMAS: grados, escalas y notas
# -------------------------------------------------------------------------

GRADOS = ["I", "II", "III", "IV", "V", "VI", "VII"]
GRADO_MAYOR = {"I": 0, "II": 2, "III": 4, "IV": 5, "V": 7, "VI": 9, "VII": 11}

ESCALAS = {
    "eolio":       [0, 2, 3, 5, 7, 8, 10],   # Menor natural
    "menor_arm":   [0, 2, 3, 5, 7, 8, 11],   # Menor armónica
    "frigio":      [0, 1, 3, 5, 7, 8, 10],
    "mayor":       [0, 2, 4, 5, 7, 9, 11],
    "dorico":      [0, 2, 3, 5, 7, 9, 10],
    "lidio":       [0, 2, 4, 6, 7, 9, 11],
    "locrio":      [0, 1, 3, 5, 6, 8, 10],
    "menor_melod": [0, 2, 3, 5, 7, 9, 11],   # Menor melódica
    "pent_menor":  [0, 3, 5, 7, 10],         # Pentatónica menor + 7ma
}

NOMBRES_B = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
NOMBRES_SOST = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
PCS = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
       "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10,
       "Bb": 10, "B": 11}

# -------------------------------------------------------------------------
# 2) TU TABLA DE EMOCIONES (editable)
# -------------------------------------------------------------------------

TABLA_EMOCIONES = {
    "tristeza": {
        "modo": ["eolio"],
        "progresiones": [
            ["i", "♭VI", "♭III", "♭VII"],
            ["i", "iv", "v", "♭VI"],
        ],
        "regla": "Inversiones en 1ª y 2ª voz; notas de paso (9na, m7); sus2.",
        "voz": "tristeza",
        "embellecer": "tristeza",
        "velocidad": 80,
        "programa": 0,
    },
    "ira": {
        "modo": ["frigio", "menor_arm"],
        "progresiones": [
            ["i", "♭II", "i", "♭II"],
            ["i", "v°", "♭VI", "♭II"],
        ],
        "regla": "Acordes cerrados (raíz + 5ª / powerchords), bajo grave sin 3ª, inversiones de raíz.",
        "voz": "ira",
        "embellecer": "ira",
        "velocidad": 104,
        "programa": 0,
    },
    "amor": {
        "modo": ["mayor", "dorico", "lidio"],
        "progresiones": [
            ["I", "V", "vi", "IV"],
            ["ii7", "V7", "Imaj7"],
        ],
        "regla": "Tríadas con 7ma mayor y 9na; inversiones abiertas (drop 2), movimiento suave de voces.",
        "voz": "amor",
        "embellecer": "amor",
        "velocidad": 86,
        "programa": 0,
    },
    "decepcion": {
        "modo": ["locrio", "menor_melod"],
        "progresiones": [
            ["i", "v", "♭VI", "♭V", "IV", "i"],
            ["♭VI", "♭V", "IV", "i"],
        ],
        "regla": "Tensiones no resueltas, nota disonante sostenida, inversiones donde la voz superior cae medio tono.",
        "voz": "decepcion",
        "embellecer": "decepcion",
        "velocidad": 72,
        "programa": 0,
    },
    "nostalgia": {
        "modo": ["pent_menor"],
        "progresiones": [
            ["i7", "IV7", "v7", "iv7", "i7", "♭VII"],
            ["i7", "♭VII"],
        ],
        "regla": "Voz superior acentuando la 7ª o 9ª; acordes invertidos sobre la fundamental del acorde siguiente.",
        "voz": "nostalgia",
        "embellecer": "nostalgia",
        "velocidad": 84,
        "programa": 0,
    },
}

ALIASES = {
    "tristeza": ["tristeza", "melancolia", "melanconia", "triste"],
    "ira": ["ira", "agresividad", "enojo", "rabia", "irritacion"],
    "amor": ["amor", "calidez", "carino", "ternura", "dulzura"],
    "decepcion": ["decepcion", "sombra", "desilusion", "frustracion"],
    "nostalgia": ["nostalgia", "chill", "anhelo", "introspeccion"],
}

_STRIP = str.maketrans("áéíóúüÁÉÍÓÚÜ", "aeiouuAEIOUU")

def _norm(s):
    return s.translate(_STRIP).strip().lower()

def emocion_normalizada(texto):
    """Devuelve la clave interna ('tristeza', ...) a partir de cualquier alias."""
    t = _norm(texto)
    for clave, aliases in ALIASES.items():
        if t in aliases or t.startswith(clave):
            return clave
    raise ValueError(
        "Emoción no encontrada. Prueba con: " + ", ".join(ALIASES))

# -------------------------------------------------------------------------
# 3) ANÁLISIS DE NÚMEROS ROMANOS
# -------------------------------------------------------------------------

@dataclass
class Numeral:
    original: str
    grado_idx: int        # 0..6 (I..VII)
    acc: int              # -1/0/+1
    mayus: bool
    intervals: list       # intervalos en semitonos desde la fundamental

def parsear_numeral(num):
    num = str(num).strip()
    num = num.replace("b", "♭").replace("Δ", "maj").replace("∆", "maj")
    num = num.replace("♯", "#")
    acc = 0
    while num and num[0] in "♭#":
        acc += -1 if num[0] == "♭" else 1
        num = num[1:]
    m = re.match(r"[ivIV]{1,3}", num)
    if not m:
        raise ValueError(f"Numeral inválido: {num!r}")
    rom = m.group(0)
    resto = num[len(rom):]
    mayus = rom.isupper()
    grado_idx = GRADOS.index(rom.upper())
    q = "mayor" if mayus else "menor"

    if resto == "":
        intervals = [0, 4, 7] if q == "mayor" else [0, 3, 7]
    elif resto.startswith("maj7") or resto.startswith("M7"):
        intervals = [0, 4, 7, 11]
    elif resto.startswith("dim7") or resto.startswith("°7"):
        intervals = [0, 3, 6, 9]
    elif resto.startswith("ø") or resto.startswith("m7b5"):
        intervals = [0, 3, 6, 10]
    elif resto.startswith("°") or resto.startswith("dim"):
        intervals = [0, 3, 6]
    elif resto.startswith("maj") or resto.startswith("M"):
        intervals = [0, 4, 7]
    elif resto.startswith("6"):
        intervals = [0, 4, 7, 9] if q == "mayor" else [0, 3, 7, 9]
    elif resto.startswith("sus2"):
        intervals = [0, 2, 7]
    elif resto.startswith("sus"):
        intervals = [0, 5, 7]
    elif resto.startswith("add9") or resto.startswith("9"):
        intervals = [0, 4, 7, 14] if q == "mayor" else [0, 3, 7, 14]
    elif resto.startswith("7"):
        intervals = [0, 4, 7, 10] if q == "mayor" else [0, 3, 7, 10]
    elif resto.startswith("m"):
        intervals = [0, 3, 7]
    else:
        raise ValueError(f"Sufijo inválido en numeral {num!r}")
    return Numeral(original=str(num), grado_idx=grado_idx, acc=acc,
                   mayus=mayus, intervals=sorted(set(intervals)))

# -------------------------------------------------------------------------
# 4) CONSTRUCCIÓN DE ACORDES (escala + accidente + embellecimiento)
# -------------------------------------------------------------------------

@dataclass
class Acorde:
    numeral: str
    root_pc: int            # clase de tono de la fundamental (0..11)
    root_nombre: str
    intervals: list         # intervalos en semitonos
    bass_idx: int           # índice del bajo dentro de los intervalos (o -1 si bajo externo)
    voces: list             # alturas MIDI finales
    bajo_nombre: str

def _calcula_raiz(spec):
    """Aritmética estándar de numerales: grado mayor + accidente explícito.

    La columna 'modo' describe el carácter tonal (eólico, frigio, locrio...),
    pero los numerales se leen en notación estándar: sobre Do, 'VI' es A y
    'bVI' es Ab. Por eso tristeza se escribe i - bVI - bIII - bVII.
    """
    return (GRADO_MAYOR[GRADOS[spec.grado_idx]] + spec.acc) % 12

def _embellecer(estrategia, intervals, numeral, pos, spec):
    out = sorted(set(intervals))
    if estrategia == "tristeza":
        # sus2 sobre tónica/subdominante en posiciones pares; 9na en posiciones impares
        if spec.grado_idx in (0, 3) and pos % 2 == 0 and len(out) == 3:
            out = [0, 2, 7]
        if pos % 2 == 1 and 14 not in out:
            out.append(14)
    elif estrategia == "amor":
        if 14 not in out:
            out.append(14)                # 9na
    elif estrategia == "decepcion":
        if numeral.replace("♭", "b").lower() == "bv":
            if 13 not in out:
                out.append(13)            # 9na bemol sobre bV (tensión)
    return sorted(set(out))

# --- voces (inversiones) por regla de la tabla --------------------------

def _voces_cerrada(bass_pitch, bass_idx, intervals):
    n = len(intervals)
    root = bass_pitch - intervals[bass_idx]
    out = [bass_pitch]
    cur = bass_pitch
    for k in range(1, n):
        t = root + intervals[(bass_idx + k) % n]
        while t <= cur:
            t += 12
        out.append(t)
        cur = t
    return out

def _voces_sobre_bajo(bass_pitch, root_pitch, intervals):
    """Coloca las voces por encima de un bajo dado (que puede ser no armónico)."""
    out = [bass_pitch]
    cur = bass_pitch
    for iv in sorted(intervals):
        if iv == 0:
            continue
        t = root_pitch + iv
        while t <= cur:
            t += 12
        out.append(t)
        cur = t
    return out

def _drop2(voces):
    if len(voces) >= 4:
        v = list(voces)
        v[-2] -= 12
        return v
    return list(voces)

def _acento_top(voces, pc_obj):
    out = list(voces)
    top = out[-1]
    if top % 12 == pc_obj:
        return out
    pen = out[-2] if len(out) >= 2 else top - 12
    t = top + ((pc_obj - top) % 12)
    if t - pen < 1:
        t += 12
    out[-1] = t
    return out

def _voz(estrategia, intervals, root_pc, pos, prev_voces, bajo_proximo_pc):
    """Devuelve (bass_idx, voces). Una voz por cada regla de la tabla."""
    if estrategia == "tristeza":
        n = len(intervals)
        bass_idx = 1 if pos % 2 == 0 else 2        # alterna 1ª y 2ª inversión
        bass_idx = min(bass_idx, n - 1)
        bajo = 4 * 12 + root_pc + intervals[bass_idx]
        return bass_idx, _voces_cerrada(bajo, bass_idx, intervals)

    if estrategia == "ira":
        power = [0, 7, 12]                          # raíz + 5ª, sin 3ª, octava grave
        return 0, _voces_cerrada(3 * 12 + root_pc, 0, power)

    if estrategia == "amor":
        if prev_voces is None:
            coche = _drop2(_voces_cerrada(4 * 12 + root_pc, 0, intervals))
            return 0, coche
        mejores = []
        for i in range(len(intervals)):
            cand = _drop2(_voces_cerrada(4 * 12 + root_pc + intervals[i],
                                         i, intervals))
            score = sum(abs(a - b) for a, b in zip(sorted(cand), sorted(prev_voces)))
            mejores.append((score, i, cand))
        _, bi, v = min(mejores, key=lambda x: x[0])
        return bi, v

    if estrategia == "decepcion":
        cands = [(i, _voces_cerrada(4 * 12 + root_pc + intervals[i],
                                    i, intervals))
                 for i in range(len(intervals))]
        if prev_voces is not None:
            bi, v = min(cands, key=lambda c: abs(c[1][-1] - (prev_voces[-1] - 1)))
            return bi, v
        return len(intervals) - 1, cands[-1][1]

    if estrategia == "nostalgia":
        objetivo = (root_pc + 14 if (root_pc + 14) % 12 not in intervals
                    else root_pc + 10)
        if bajo_proximo_pc is None:
            bajo_proximo_pc = root_pc
        v = _voces_sobre_bajo(4 * 12 + bajo_proximo_pc, 4 * 12 + root_pc, intervals)
        v = _acento_top(v, objetivo % 12)
        return -1, v

    return 0, _voces_cerrada(4 * 12 + root_pc, 0, intervals)

def construir_acordes(emocion="tristeza", tonic="C", progresion=None,
                      indice_progresion=0, sostenidos=None):
    clave = emocion_normalizada(emocion)
    info = TABLA_EMOCIONES[clave]
    if progresion is None:
        progresion = info["progresiones"][indice_progresion]
    tonic_pc = PCS[tonic]
    if sostenidos is None:
        sostenidos = tonic_pc in (2, 4, 7, 9, 11, 6)
    nombres = NOMBRES_SOST if sostenidos else NOMBRES_B

    specs = [parsear_numeral(n) for n in progresion]
    roots = [(tonic_pc + _calcula_raiz(sp)) % 12 for sp in specs]

    voces_prev = None
    acordes = []
    for i, (sp, num) in enumerate(zip(specs, progresion)):
        root_pc = roots[i]
        bajo_proximo = roots[i + 1] if i + 1 < len(roots) else root_pc
        intervals = _embellecer(info["embellecer"], sp.intervals, num, i, sp)
        bass_idx, v = _voz(info["voz"], intervals, root_pc, i,
                           voces_prev, bajo_proximo)
        voces_prev = v
        acordes.append(Acorde(
            numeral=num, root_pc=root_pc, root_nombre=nombres[root_pc],
            intervals=intervals, bass_idx=bass_idx, voces=v,
            bajo_nombre=nombres[v[0] % 12]))
    return acordes, progresion, clave, info

# -------------------------------------------------------------------------
# 5) EXPORTACIÓN A MIDI (pretty_midi)
# -------------------------------------------------------------------------

def exportar_midi(emocion="tristeza", tonic="C", archivo="salida.mid",
                  bpm=112, indice_progresion=0):
    acordes, progresion, clave, info = construir_acordes(
        emocion, tonic, indice_progresion=indice_progresion)
    tonic_pc = PCS[tonic]

    midi = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    inst = pretty_midi.Instrument(program=info.get("programa", 0))
    seg_compas = 60.0 / bpm * 4
    vel = info.get("velocidad", 88)
    start = 0.0
    dur_total = 0.0

    for i, ac in enumerate(acordes):
        end = start + seg_compas
        for p in ac.voces:
            inst.notes.append(pretty_midi.Note(
                velocity=vel, pitch=int(round(p)), start=start, end=end))
        if i > 0 and clave == "tristeza":                    # nota de paso: 9na previa
            pas = 48 + ac.root_pc + 14
            d = 0.5 * 60.0 / bpm
            inst.notes.append(pretty_midi.Note(
                velocity=int(vel * 0.6), pitch=pas, start=start - d, end=start))
        start = end
        dur_total = end

    if clave == "decepcion":                                 # nota disonante sostenida
        drone = 2 * 12 + (tonic_pc + 6) % 12                 # tritono / b5 de la tónica
        inst.notes.append(pretty_midi.Note(
            velocity=42, pitch=drone, start=0.0, end=dur_total))

    midi.instruments.append(inst)
    directorio = os.path.dirname(os.path.abspath(archivo))
    os.makedirs(directorio, exist_ok=True)
    midi.write(archivo)
    return acordes, progresion, clave, archivo

# -------------------------------------------------------------------------
# 6) CONSULTA Y DEMO
# -------------------------------------------------------------------------

INVERSIONS = ["estado fundamental", "1ª inversión", "2ª inversión", "3ª inversión"]

def progresion_por_emocion(emocion="tristeza", indice_progresion=0):
    clave = emocion_normalizada(emocion)
    return TABLA_EMOCIONES[clave]["progresiones"][indice_progresion]

def _ascii(s):
    return s.replace("♭", "b").replace("♯", "#").replace("♮", "=")

def _label_inv(a):
    bajo = min(a.voces)
    semis = (bajo % 12 - a.root_pc) % 12
    for k, iv in enumerate(a.intervals):
        if iv % 12 == semis:
            return INVERSIONS[k] if k < len(INVERSIONS) else INVERSIONS[-1]
    return f"bajo: {a.bajo_nombre}"

def main():
    try:
        import sys
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    os.makedirs("midi", exist_ok=True)
    for emocion in TABLA_EMOCIONES:
        acordes, prog, clave, info = construir_acordes(emocion, "C")
        archivo = exportar_midi(emocion, "C", os.path.join("midi", f"{clave}.mid"))[3]
        nombres = NOMBRES_B
        print(f"\n=== {_ascii(emocion.upper())}  |  {_ascii(info['regla'])}")
        print("    Progresión:", " - ".join(_ascii(x) for x in prog))
        for a in acordes:
            octs = " ".join(f"{nombres[p % 12]}{p // 12 - 1}" for p in a.voces)
            inv = _label_inv(a)
            print(f"      {_ascii(a.numeral):<5} {a.root_nombre+':':<5} [{octs}]  {inv}")
        print(f"    -> {archivo}")

if __name__ == "__main__":
    main()