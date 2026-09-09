# Banco de samples por género

AURA usa **tres capas de batería**, de más a menos realista:

1. **Loop completo por mood** (4 compases exactos, BPM fijo): reemplaza TODA la
   batería por un loop de audio real.
2. **Kit de one-shots por género**: reemplaza cada instrumento (kick, snare,
   hat, openhat, perc) por una muestra real, manteniendo NUESTROS patrones,
   humanización y groove aprendidos del catálogo.
3. **Kit sintetizado** (por defecto, `drumKits.ts`): siempre disponible como
   fallback si faltan las capas 1 y 2.

Todo vive en `public/loops/`, declarado en `public/loops/manifest.json`.

## 1) Loop completo

```
loops/<genero>/<genero>_<mood>_<bpm>bpm.wav
```

- Duración EXACTA de 4 compases, bucle perfecto, empieza en el 1.
- Manifest:

```json
{ "genre": "trap", "emotion": "nostalgia", "bpm": 160, "bars": 4,
  "file": "loops/trap/trap_nostalgia_160.wav" }
```

BPM por genre/mood (los que usa la app):

| género | moods (BPM) |
| --- | --- |
| trap | tristeza 140 · ira 150 · amor 128 · nostalgia 160 |
| rap | amor 92 · ira 95 · tristeza 85 · nostalgia 88 |
| plug | amor 120 · tristeza 128 · decepcion 110 · nostalgia 125 |
| detroit | ira 176 · amor 168 · nostalgia 172 · tristeza 160 |
| reggaeton | amor 96 · tristeza 92 · ira 94 · nostalgia 88 |

## 2) Kit de one-shots por género

Archivos (todos opcionales, el que falta usa el sintetizado):

```
loops/<genero>/kick.wav
loops/<genero>/snare.wav     (o clap)
loops/<genero>/hat.wav
loops/<genero>/openhat.wav
loops/<genero>/perc.wav      (rim / dembow / extra)
```

Manifest (una sola entrada por género):

```json
{ "genre": "trap",
  "kit": {
    "kick": "loops/trap/kick.wav",
    "snare": "loops/trap/snare.wav",
    "hat": "loops/trap/hat.wav",
    "openhat": "loops/trap/openhat.wav",
    "perc": "loops/trap/perc.wav"
  } }
```

**Mapeo MIDI** (nota de batería → instrumento):

| nota | 36 | 38 | 42 | 46 | 39 |
| --- | --- | --- | --- | --- | --- |
| instrumento | kick | snare | hat | openhat | perc |

Mix sugerido (dB): kick 0 · snare −2 · hat −8 · openhat −10 · perc −6.

Sin BPM: los one-shots se disparan sincronizados a nuestra rejilla (16avos +
groove aprendido), así que cualquier BPM sirve.

## Carácter por género (one-shots o loop)

- **Trap**: kick tipo 808 (body grave, cola larga, ~C1–C2), snare/clap oscuro y
  seco con cuerpo, hats ultra cortas (30–80 ms) y agudas, openhat con aire
  (300–400 ms), perc tipo "police" corta.
- **Reggaetón**: kick punchy en el tiempo 1, snare tipo rim corto brillante
  (el sello), hats presentes en 16avos, perc dembow (madera/stick) protagonista.
- **Rap**: kick boom-bap redondo, snare carnosa estilo boombap, hats cuando el
  groove (pasos 5 y 14), openhat ocasional.
- **Detroit**: clap mecánico seco, kick firme con ataque, hats limpias, poca
  coda, todo apretado y frontal.
- **Plug**: kick suave redondo sin pegada dura, snare delicada, hats brillantes
  espaciadas, sensación de aire.

## Precedencia en la app

`loop completo (genre+mood+bpm)` → `kit de one-shots (genre)` → `kit
sintetizado`. Si un archivo no existe o el fetch falla, se cae a la capa
siguiente sin romper nada.