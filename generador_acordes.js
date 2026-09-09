/*
 * Lógica de generación de acordes y progresiones por emoción (JavaScript/Node).
 * Espejo de las funciones Python de tabla_emociones.py y midi_sequencer.py.
 *
 * Sin dependencias externas y sin código de audio: solo devuelve arrays de
 * números MIDI. CommonJS: importar con require('generador_acordes').
 *
 * Nota: para las escalas cortas (pentatónica, 5 notas) el grado 7 se resuelve
 * al paso más cercano del grado mayor equivalente (7 -> Bb), igual que en el
 * secuenciador Python.
 */

// ---------------------------------------------------------------------------
// Escalas y progresiones (mismas que en Python)
// ---------------------------------------------------------------------------

const ESCALAS = {
    tristeza:  [0, 2, 3, 5, 7, 8, 10],   // Menor natural (Eólico)
    ira:       [0, 1, 3, 5, 7, 8, 10],   // Frigio
    amor:      [0, 2, 4, 5, 7, 9, 11],   // Mayor (Jónico)
    decepcion: [0, 1, 3, 5, 6, 8, 10],   // Locrio
    nostalgia: [0, 3, 5, 7, 10],         // Pentatónica menor
};

const PROGRESIONES = {
    tristeza:  { principal: [1, 6, 3, 7],     alternativas: [[1, 4, 5, 6]] },
    ira:       { principal: [1, 2, 1, 2],     alternativas: [[1, 5, 6, 2]] },
    amor:      { principal: [1, 5, 6, 4],     alternativas: [[2, 5, 1]] },
    decepcion: { principal: [1, 5, 6, 5, 4, 1], alternativas: [[6, 5, 4, 1]] },
    nostalgia: { principal: [1, 4, 5, 4, 1, 7], alternativas: [[1, 7]] },
};

const TONIC_BASE = 48;              // C3: tónica de referencia (MIDI)
const GRADO_MAYOR = [0, 2, 4, 5, 7, 9, 11];   // intervalos del grado "mayor"

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------

// Devuelve un array numérico único y ordenado (equivalente a sorted(set(...)))
function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort((a, b) => a - b);
}

// Resuelve un grado (1-index) a un grado válido dentro de la escala:
// si cabe se usa tal cual; si no (pentatónica con grado 7), se elige el paso
// más cercano al intervalo del grado mayor equivalente.
function resolverGrado(scale, degree) {
    if (degree >= 1 && degree <= scale.length) return degree;
    const objetivo = GRADO_MAYOR[(degree - 1 + 7) % 7];
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < scale.length; i++) {
        const d = Math.abs(scale[i] - objetivo);
        if (d < best) { best = d; idx = i; }
    }
    return idx + 1;
}

// ---------------------------------------------------------------------------
// Funciones principales
// ---------------------------------------------------------------------------

// Nota MIDI del grado (1-index) dentro de la escala. octaveShift suma octavas
// sobre la base C3 (48). P. ej. grado 5 en ESCALAS.amor -> 55 (G3).
function noteFromDegree(scale, degree, octaveShift = 0) {
    if (degree < 1 || degree > scale.length) {
        throw new Error(
            `degree fuera de rango: ${degree} (escala de ${scale.length} notas)`);
    }
    return TONIC_BASE + scale[degree - 1] + 12 * octaveShift;
}

// Acorde diatónico apilando terceras desde el grado: pasos de escala
// 0, 2, 4, ... (1ª, 3ª, 5ª, 7ª, 9ª). Los intervalos 6 y 8 son PASOS DE
// ESCALA: 6 = 7ª, 8 = 9ª. Devuelve notas MIDI ascendentes desde la fundamental.
function chordFromDegree(scale, degree, numNotes = 3, addSeventh = false, addNinth = false) {
    let pasos = [];
    for (let k = 0; k < numNotes; k++) pasos.push(2 * k);   // 0, 2, 4, ...
    if (addSeventh && !pasos.includes(6)) pasos.push(6);    // 7ª (paso 6)
    if (addNinth && !pasos.includes(8)) pasos.push(8);      // 9ª (paso 8)
    pasos.sort((a, b) => a - b);

    // escala corta: el grado puede no caber (pentatónica + grado 7)
    const grado = resolverGrado(scale, degree);
    const n = scale.length;
    return pasos.map((paso) => {
        const pos = grado - 1 + paso;
        const octava = Math.floor(pos / n);                 // vueltas de octava
        const idx = ((pos % n) + n) % n;
        return TONIC_BASE + scale[idx] + 12 * octava;
    });
}

// Inversión/vozaje de un acorde (lista de notas MIDI):
// 'root' sin cambios; 'first' sube la fundamental; 'second' sube fundamental y
// 3ª; 'open' sube la 2ª voz (abre el hueco); 'drop2' baja la 2ª voz desde
// arriba (solo con >= 4 notas). Se devuelve ordenado y sin duplicados.
function applyInversion(chord, inversionType = "root") {
    const voces = chord.slice();
    switch (inversionType) {
        case "root":  return voces;
        case "first": voces[0] += 12; break;
        case "second": voces[0] += 12; voces[1] += 12; break;
        case "open":  voces[1] += 12; break;
        case "drop2":
            if (voces.length >= 4) { voces[voces.length - 2] -= 12; break; }
            return voces;
        default:
            throw new Error(`inversionType inválido: ${inversionType}`);
    }
    return uniqueSorted(voces);
}

// Reglas de tensión/color por emoción (la fundamental es la nota más grave):
// 'ira'       -> power chord (raíz + 5ª justa, sin 3ª)
// 'tristeza'  -> sus2: la 3ª (2ª nota) baja 2 semitonos
// 'amor'      -> añade 7ª mayor (+11) si no está
// 'decepcion' -> la nota más aguda cae medio tono
// 'nostalgia' -> sin cambios (voicings especiales llegan en otra fase)
function applyTensionRules(chord, emotion) {
    if (chord.length === 0) return [];
    const raiz = chord[0];

    switch (emotion) {
        case "ira":
            return uniqueSorted([raiz, raiz + 7]);

        case "tristeza": {
            const out = chord.slice();
            if (out.length >= 3) out[1] -= 2;               // 3ª -> 2ª (sus2)
            return uniqueSorted(out);
        }
        case "amor": {
            const septima = raiz + 11;
            const out = chord.includes(septima) ? chord.slice() : chord.concat(septima);
            return uniqueSorted(out);
        }
        case "decepcion": {
            const out = chord.slice();
            if (out.length >= 2) out[out.length - 1] -= 1;  // cae medio tono
            return uniqueSorted(out);
        }
        case "nostalgia":
            return chord.slice();                           // sin cambios
        default:
            throw new Error(`emoción no soportada: ${emotion}`);
    }
}

// Copia de la progresión con UN grado cambiado al azar por otro grado
// diatónico 1..7 distinto del actual. Los grados fuera de la escala se
// resuelven luego con resolverGrado al construir los acordes.
function mutateProgression(progression, scale) {
    const nueva = progression.slice();
    const i = Math.floor(Math.random() * nueva.length);
    const opciones = [];
    for (let g = 1; g <= 7; g++) if (g !== nueva[i]) opciones.push(g);
    nueva[i] = opciones[Math.floor(Math.random() * opciones.length)];
    return nueva;
}

module.exports = {
    ESCALAS,
    PROGRESIONES,
    TONIC_BASE,
    noteFromDegree,
    chordFromDegree,
    applyInversion,
    applyTensionRules,
    mutateProgression,
    resolverGrado,
};

// ---------------------------------------------------------------------------
// Demo (solo se ejecuta al correr este archivo, no al importarlo)
// ---------------------------------------------------------------------------
if (require.main === module) {
    const may = ESCALAS.amor;
    console.log("Grado 5 en Do mayor:", noteFromDegree(may, 5));

    const Cmaj7 = chordFromDegree(may, 1, 3, true);
    console.log("Imaj7:", Cmaj7, "-> first:", applyInversion(Cmaj7, "first"),
        "| second:", applyInversion(Cmaj7, "second"),
        "| open:", applyInversion(Cmaj7, "open"));

    const Cmaj9 = chordFromDegree(may, 1, 3, true, true);
    console.log("Imaj9:", Cmaj9, "-> drop2:", applyInversion(Cmaj9, "drop2"));

    for (const em of Object.keys(ESCALAS)) {
        const escala = ESCALAS[em];
        const prog = PROGRESIONES[em].principal;
        const acorde = chordFromDegree(escala, 1);
        console.log(`${em.padEnd(10)} base ${acorde} -> ` +
            `${applyTensionRules(acorde, em)}  |  progresión ` +
            `${JSON.stringify(prog)} -> ${JSON.stringify(mutateProgression(prog, escala))}`);
    }
}