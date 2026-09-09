CARPETA DE SONIDOS DE BATERÍA PARA AURA
=======================================

Hay DOS formas de darle sonido real a la batería:

A) LOOP COMPLETO por género+mood (4 compases exactos)
-----------------------------------------------------
  Archivo: loops/<genero>/<genero>_<mood>_<bpm>bpm.wav
  Ej.:     loops/trap/trap_nostalgia_160.wav

  Requisitos: WAV que empiece en el downbeat, dure EXACTAMENTE 4 compases,
  haga loop perfecto (sin clic) al BPM indicado.

B) KIT DE ONE-SHOTS por género
------------------------------
  Archivos: loops/<genero>/kick.wav
                      snare.wav      (o clap)
                      hat.wav
                      openhat.wav
                      perc.wav       (opcional: rim/dembow/extra)

  Los one-shots se disparan a nuestra rejilla (16avos + groove). Cualquier
  BPM sirve. El que no exista usa el kit sintetizado del motor.

DECLARAR EN manifest.json
-------------------------
Loop completo:
  { "genre": "trap", "emotion": "nostalgia", "bpm": 160, "bars": 4,
    "file": "loops/trap/trap_nostalgia_160.wav" }

Kit:
  { "genre": "trap",
    "kit": { "kick": "loops/trap/kick.wav", "snare": "loops/trap/snare.wav",
             "hat": "loops/trap/hat.wav", "openhat": "loops/trap/openhat.wav",
             "perc": "loops/trap/perc.wav" } }

"emotion" = mood del selector: tristeza, ira, amor, nostalgia, decepcion.

BPM EXACTOS POR GÉNERO/MOOD (los que usa la app)
-------------------------------------------------
trap:      tristeza 140 · ira 150 · amor 128 · nostalgia 160
rap:       amor 140 · ira 145 · tristeza 120 · nostalgia 148
plug:      amor 120 · tristeza 128 · decepcion 110 · nostalgia 125
detroit:   ira 150 · amor 140 · nostalgia 155 · tristeza 132
reggaeton: amor 98 · tristeza 92 · ira 104 · nostalgia 96

Reglas:
- Loop completo gana sobre el kit cuando coincide genre+mood+bpm.
- Si un archivo no existe o el fetch falla, se usa el kit sintetizado.
- Más detalles: aura-web/docs/sample_bank.md