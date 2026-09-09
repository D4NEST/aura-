# AURA · Web App (PWA)

Generador de beats emocionales. Mismo motor que el backend Python, portado a
TypeScript (`src/core/`) y reproducido en el navegador con Web Audio (Tone.js).

## Requisitos
- Node.js ≥ 20 (probado con v22) y npm.

## Instalar dependencias
```bash
npm install
```

## Desarrollo (en caliente)
```bash
npm run dev
```
Abre la URL que muestra (normalmente `http://localhost:5173`). El Service
Worker **no** corre en modo `dev` (solo en producción), pero la app funciona
igual.

## Verificación del core (genera .mid en TS y valida mido/pretty_midi)
```bash
npm run verify
```
```bash
npm run typecheck   # chequeo de tipos
```

## Modos de la app
- **Crear** (simple): tarjeta de género → vibe (mood/BPM) → "Crear beat".
  Bucles de 12 o 24 compases, Flow completo (52 compases, hasta ~2.5 min) y
  botón **∞** para loop infinito. Tonalidad accesible y un panel "Sonido ▾"
  para quien quiera tintear el timbre.
- **Pro** (técnico): estructura por secciones (name/emoción/género/compases),
  tonalidad, BPM, sonidos por pista (piano/pad/bajo/lead), exportar .mid
  completo o stems por pista (acordes, bajo, melodía, batería).

## Alimentar el motor con beats reales (`dataset/`)
1. Exportá tus mejores beats a MIDI desde FL (Archivo → Exportar → MIDI).
2. Ordenalos por género y tonalidad:
   `dataset/<genero>/<tonalidad>/<genero>_<tonalidad>_<vibe>_<nombre>.mid`
3. Analizalos:
   ```bash
   npm run ingest     # lee dataset/ y escribe dataset_analysis.json
   ```
   El extractor separa batería/melodía/bajo, mide rangos de octava, patrones de
   batería (16 pasos), BPM y duración por género. Esa estadística afinará las
   constantes del motor en una fase próxima.

## Producción
```bash
npm run build
```
Genera `dist/` con el **manifest PWA** y el **service worker** (Workbox).
Esto ya es instalable.

### Probar la build (local)
```bash
npm run preview
```
Abre `http://localhost:4173`. El SW se registra al primer acceso; la segunda
carga ya sirve en offline.

## Instalar en el teléfono (PWA)
1. Genera la build: `npm run build`.
2. Sirve `dist/` por **HTTPS** (el SW requiere contexto seguro) y accesible
   desde el móvil. Ejemplos:
   - **Vercel / Netlify / Cloudflare Pages / GitHub Pages**: sube la carpeta
     `aura-web/` y listo (HTTPS automático).
   - **Local con tu celular en la misma red** (Android): sirve por HTTPS local
     p. ej. `npx serve` + túnel con `cloudflared`, u `npx vite preview --host`
     (pero nota que en `localhost`/LAN sin HTTPS el SW puede no activarse en
     algunos navegadores).
3. Abre la URL en el móvil, toca el menú del navegador → **"Añadir a pantalla
   de inicio" / "Instalar app"**.

> Para probarlo cómodo y de verdad como app, lo más simple es desplegarla en
> Vercel/Netlify (gratis): `npm run build` y arrastras la carpeta `dist`.

## Estructura
```
src/
  core/        # motor TS puro (sin deps): armonía, melodía + escritor MIDI binario
  engine/      # AuraPlayer (Tone.js): sintetizadores, bundle de sonidos, VU, waveform
  components/  # CreateView, SongEditor, VUMeters, Waveform, TransportControls, SoundSelects
  styles/      # theme.css (paleta dark-first)
scripts/
  verify_core.ts   # genera .mid TS y se valida en Python
  ingest_dataset.ts# estadísticas de dataset/ -> dataset_analysis.json
  make_icons.py    # genera los iconos PWA (PNG puro)
public/        # manifest icons + favicon (copiados a dist)
dataset/       # beats reales del artista por genero/tonalidad
```
