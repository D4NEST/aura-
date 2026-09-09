# Auditoría Técnica de AURA — 2026-09-09

**Alcance**: Motor armónico/melódico + Engine de audio + Banco de samples  
**Versión analizada**: Sesión #12, motor 5/5 coherente contra genres_config  
**Arquitecto**: Auditoría de audio/ingeniería de software senior

---

## Resumen Ejecutivo

AURA tiene un **motor sólido y bien estructurado** (5/5 géneros coherentes en el validator). Los patrones de batería están alineados con la estética métrica, las progresiones provienen del catálogo real del productor, y el pipeline de aprendizaje está funcional. Sin embargo, hay **tres capas críticas que necesitan trabajo**:

1. **Bajo estático** — nota larga por acorde, sin movimiento rítmico (808 en trap, dembow en reggaetón, boombap en rap).
2. **Batería con fills genéricos** — mismo patrón de cierre en todas las secciones, sin variación por género o rol.
3. **Lead con densidad correcta pero sin motivos melódicos** — notas sueltas sin frases, silencios arbitrarios.

Además, hay **bugs latentes** en el service worker y el fallback de samples que pueden causar fallos silenciosos.

---

## Diagnóstico por Capa y Género

### 1. Piano/Acordes (Armonía + Voicing)

#### Estado Actual

| Género | Voicing | Rango | Ritmo Armónico | CHORD_PULSE | Evaluación |
|--------|---------|-------|----------------|-------------|------------|
| **Trap** | 3-4 voces con 7ª/9ª opcional, compactación en C3-B4 | P50 motor: 60 vs catálogo: 60 ✓ | 93% 1 compás, 6% 2 compases | No (acorde sostenido) | ✅ **Correcto** — Voicing natural, rango aprendido del catálogo real |
| **Rap** | Igual que trap, con inversiones aleatorias | P50 motor: 59 vs catálogo: 59 ✓ | 98% 1 compás | No | ✅ **Correcto** — Acordes sostenidos típicos del boombap |
| **Plug** | 3-4 voces, atmósfera "vintage" | P50 motor: 58 vs catálogo: 58 ✓ | 99% 1 compás | No | ✅ **Correcto** — Acordes sostenidos con aire |
| **Detroit** | 3-4 voces, tensión mecánica | P50 motor: 64 vs catálogo: 64 ✓ | 88% 1 compás, 10% 2 compases | No | ✅ **Correcto** — Acordes sostenidos con drive |
| **Reggaetón** | 3 voces, staccato 1/32 en steps 1,4 + ciclo 9,9,7,7 | P50 motor: 59 vs catálogo: 59 ✓ | 98% 1 compás | **Sí** (implementado) | ⚠️ **Necesita ajuste** — El punteo suena mecánico, falta "swing latino" |

#### Problemas Detectados

1. **Reggaetón: Punteo sin "swing latino"** (`song.ts:76-105`)
   - Los golpes caen exactamente en steps 1 y 4, con ciclo 9,9,7,7.
   - El MIDI de referencia (`dataset/reggaeton/Bm/*.mid`) tiene **micro-desplazamientos** en el punteo que el motor no replica.
   - El staccato 1/32 es muy corto para el estilo "retorno" — suena cortado, no pulsado.
   - **Solución**: Añadir `CHORD_PULSE.swing` por género (ej: reggaetón +0.08 de paso en steps 4,12) y ajustar `dur16` a 0.75.

2. **Voicing aleatorio sin coherencia por sección** (`harmony.ts:30-56`)
   - `applyInversion` elige entre root/first/second/open/drop2 aleatoriamente.
   - En una misma sección, el acorde puede saltar de open a drop2 sin lógica armónica.
   - **Solución**: Inversiones por contexto (intro/outro → open/drop2, coro → root/first).

3. **Tensiones emocionales rígidas** (`harmony.ts:58-85`)
   - Ira siempre es power chord (root + 5ª), tristeza siempre baja la 2ª, decepción siempre baja 1 semitono el agudo.
   - Esto funciona pero es predecible — el catálogo real muestra más variación.
   - **Solución**: Sistema probabilístico (70% regla, 30% variación).

#### Verificación Cruzada

```bash
# Rangos de octava generados vs catálogo real (P5/P50/P95)
Trap bass:   36/44/46 vs 26/42/52 → generador más conservador ✓
Plug bass:   44/48/51 vs 39/46/58 → rango más estrecho pero OK ✓
Trap lead:   67/72/77 vs 64/74/92 → generador no alcanza los agudos ⚠️
Reggaeton chords: 51/59/74 vs 51/59/74 → EXACTO ✓
```

---

### 2. Bajo (Fundamental + Articulación)

#### Estado Actual

| Género | Articulación | Rango | Movimiento | Evaluación |
|--------|--------------|-------|------------|------------|
| **Trap** | Nota larga por acorde (duración completa) | P50 motor: 44 vs catálogo: 42 ✓ | **Ninguno** | ❌ **URGENTE** — Falta 808 con glide y envelope |
| **Rap** | Nota larga por acorde | P50 motor: 48 vs catálogo: 48 ✓ | **Ninguno** | ❌ **URGENTE** — Falta bajo boombap con notas intermedias |
| **Plug** | Nota larga por acorde | P50 motor: 46 vs catálogo: 46 ✓ | **Ninguno** | ⚠️ **Mejorable** — Necesita Zaytoven-style con octavas |
| **Detroit** | Nota larga por acorde | P50 motor: 42 vs catálogo: 42 ✓ | **Ninguno** | ❌ **URGENTE** — Falta Donk bass con staccato |
| **Reggaetón** | Nota larga por acorde | P50 motor: 42 vs catálogo: 42 ✓ | **Ninguno** | ❌ **CRÍTICO** — Falta bajo dembow con patrón rítmico |

#### Problemas Detectados

1. **Bajo estático en TODOS los géneros** (`song.ts:116-122`)
   ```typescript
   // Código actual: una nota por acorde
   bass.push({
     tick: sectionTick + bassSwing,
     dur: durationTicks - 10,
     note: withinRange(bassRaw & 0x7f, ranges.bass),
     velocity: humanVelocity(vels.bass.mean, vels.bass.jitter, rng),
   })
   ```
   - El bajo es **una nota por acorde** con duración completa.
   - En el catálogo real: trap tiene 808 con glide, reggaetón tiene bajo dembow (notas en 1,4,7,10), rap tiene bajo boombap (notas intermedias).
   - **Esto es el problema #1 de musicalidad** — el beat suena incompleto.

2. **Falta de envelope para 808** (`engine/sounds.ts:145-167`)
   - El preset `sub` tiene sustain 0.45, pero el 808 real tiene **attack transitorio + decay + tail**.
   - Sin glide, los cambios de nota suenan cortados.
   - **Solución**: Implementar `BASS_PATTERN` por género + MonoSynth con portamento.

3. **Reggaetón sin bajo dembow** 
   - El patrón dembow debería aplicarse también al bajo, no solo a la batería.
   - Notas en steps 1,4,7,10 (igual que el snare) con staccato corto.
   - **Solución**: `BASS_RHYTHM` con densidad por género.

#### Ruta de Implementación

```typescript
// Propuesta: src/core/constants.ts
export const BASS_PATTERNS: Record<Genre, { steps: number[]; dur16: number; glide: boolean }> = {
  trap: { steps: [1], dur16: 4, glide: true },  // 808 largo con glide
  rap: { steps: [1, 5, 9, 13], dur16: 1, glide: false },  // boombap con notas intermedias
  plug: { steps: [1, 9], dur16: 2, glide: true },  // Zaytoven octavas
  detroit: { steps: [1, 5, 9, 13], dur16: 0.5, glide: false },  // Donk staccato
  reggaeton: { steps: [1, 4, 7, 10], dur16: 0.75, glide: false },  // dembow bajo
}
```

**Impacto**: ALTO — Es la diferencia entre un beat que suena profesional vs amateur.  
**Esfuerzo**: MEDIO — Requiere modificar `song.ts`, `constants.ts` y posiblemente `sounds.ts` para glide.

---

### 3. Batería (Patrones + Groove + Fills)

#### Estado Actual

| Género | Patrón | Groove | Fills | Coherencia | Evaluación |
|--------|--------|--------|-------|------------|------------|
| **Trap** | Snare paso 9, kick 1,5,9,13, hats 16/16 | Grid-locked (humanize 0.001) | Snare roll en últimos 4 steps | 56% catálogo | ✅ **Correcto** |
| **Rap** | Snare 5,13, kick 1,5,9,13, hats 10/16 | Swing +0.21 en offbeats | Igual que trap | 28% catálogo | ⚠️ **Mejorable** — Hats muy densos para rap boombap |
| **Plug** | Snare 9, kick 1,5,9,13, hats 5/16 | Grid-locked | Igual que trap | 15% catálogo | ✅ **Correcto** |
| **Detroit** | Snare 9, kick 1,5,9,13, hats 8/16 offbeat | -0.24 en pasos 13,15 | Igual que trap | 52% catálogo | ✅ **Correcto** |
| **Reggaetón** | Snare 4,7,12,15 (dembow), kick 1,5,9,13, hats 4/16 | -0.18 en paso 15 | Igual que trap | 17% catálogo | ⚠️ **Necesita ajuste** — Hats muy escasos, falta shaker |

#### Problemas Detectados

1. **Fills idénticos en todas las secciones** (`song.ts:158-182`)
   ```typescript
   if (isLastBar && step >= 12) {
     // Snare roll + perc en los últimos 4 steps de CADA sección
     drums.push({ tick: stepTick, dur: ticksPer16th - 5, note: snare, ... })
     if (step % 2 === 0) drums.push({ tick: stepTick, ..., note: perc, ... })
   }
   ```
   - **Todos los géneros tienen el mismo fill**: snare roll en steps 12-15 + perc en pasos pares.
   - No hay fills por género (trap → roll rápido, detroit → clap triple, reggaetón → break con silencio).
   - No hay fills por sección (coro → fill denso, verso → fill sutil, intro → sin fill).
   - **Solución**: `FILL_PATTERNS` por género y rol de sección.

2. **Rap: Hats demasiado densos** (`constants.ts:40-48`)
   - El patrón de rap tiene hats en 10/16 pasos.
   - El catálogo real muestra hats más espaciados (8-12/16 con swing).
   - El swing actual (+0.21 en offbeats) es correcto, pero la densidad hace que suene más trap que boombap.
   - **Solución**: Reducir hat density a 8/16 con patrón específico (pasos 1,3,5,7,9,11,13,15).

3. **Reggaetón: Falta shaker/ghost notes** (`constants.ts:85-93`)
   - El patrón dembow (snare 4,7,12,15) es correcto.
   - Pero el hat está solo en 4/16 pasos (kick positions).
   - El reggaetón real tiene **shaker en 8avos o 16avos** + ghost notes en el snare.
   - **Solución**: Añadir `shaker` como instrumento opcional o aumentar hat density.

4. **Detroit: Snare en offbeat no es "offbeat" real** (`constants.ts:61-69`)
   - El patrón tiene snare en paso 9 (correcto).
   - Pero el "offbeat" real de detroit es **clap en 2 y 4**, con hat rápido en offbeats.
   - El groove actual (-0.24 en pasos 13,15) aplica a hats, no al snare.
   - **Solución**: Añadir clap en pasos 5,13 como layer opcional.

#### Histograma de Snare del Catálogo Real

```
Trap:      9:71 hits | 5,13:26-28 hits → el motor coincide ✓
Detroit:   9:26 hits | 5,13:10 hits → el motor coincide ✓
Reggaeton: 4:21 | 7:23 | 12:21 | 15:23 → el motor coincide ✓
Rap:       5:26 | 13:29 → el motor coincide ✓
```

El motor está alineado con el catálogo real. El problema no es el patrón base, sino la **falta de variación** y los fills genéricos.

---

### 4. Lead/Melodía

#### Estado Actual

| Género | Densidad | Rango | Tensiones | Evaluación |
|--------|----------|-------|-----------|------------|
| **Trap** | 0.28 (28% de 16 pasos) | 67-77 generado vs 64-92 catálogo | 60% notas del acorde | ⚠️ **Mejorable** — Falta agresividad en ira |
| **Rap** | 0.40 | 68-82 generado vs 68-82 catálogo ✓ | 60% notas del acorde | ✅ **Correcto** |
| **Plug** | 0.34 | 64-87 generado vs 64-87 catálogo ✓ | 60% notas del acorde | ✅ **Correcto** |
| **Detroit** | 0.50 | 63-80 generado vs 63-80 catálogo ✓ | 60% notas del acorde | ✅ **Correcto** |
| **Reggaetón** | 0.36 | 63-93 generado vs 63-93 catálogo ✓ | 60% notas del acorde | ✅ **Correcto** |

#### Problemas Detectados

1. **Melodía sin frases melódicas** (`melody.ts:36-75`)
   - El motor elige notas aleatoriamente con densidad por género.
   - Hay "motivos" (silencios cada 6 notas) pero no **frases melódicas repetidas**.
   - El resultado: notas sueltas sin coherencia, como alguien tocando al azar.
   - **Solución**: Sistema de motivos (frase de 4-8 notas que se repite con variaciones).

2. **Trap: Falta agresividad en ira** (`melody.ts:55`)
   - La velocity del lead en ira tiene +6 de punch.
   - Pero el estilo trap ira necesita **notas más staccato, rangos más amplios**.
   - **Solución**: Aumentar densidad en ira (0.28 → 0.35) y staccato (durSteps 1 → 0.5).

3. **Lead no sigue la progresión** (`melody.ts:28-35`)
   - `chordTones` se calcula una vez por acorde.
   - Pero cuando el acorde cambia, las notas del lead no se ajustan.
   - **Solución**: Recalcular `chordTones` dinámicamente en cada paso.

---

### 5. Estructura (Intro/Verso/Coro/Outro)

#### Estado Actual

- **Flow clásico** (`SONG_FLOW`): 52 compases, intro → pre → coro → verso → pre → coro → verso → pre → outro.
- **Loop 12**: 12 compases, intro 4 + coro 8.
- **Loop 24**: 24 compases, intro 4 + pre 4 + coro 8 + verso 8.
- **Ritmo armónico por rol**: intro/outro tienden a 2 compases, coro a 1 compás.

#### Problemas Detectados

1. **Transiciones sin breaks** (`song.ts:158-210`)
   - Cada sección termina con el mismo fill de batería.
   - No hay **silencios dramáticos** (breaks) en transiciones clave (pre → coro, verso → coro).
   - **Solución**: Secciones con `drums: false` en config, o fills con silencio en step 16.

2. **Intro y outro demasiado similares** (`structure.ts:14-23`)
   - `ROLE_EMOTION` hace que intro sea nostalgia/tristeza y outro sea tristeza/nostalgia.
   - Pero el **carácter musical** es idéntico: mismos acordes, misma densidad.
   - **Solución**: Intro con menos instrumentos (solo piano + pad), outro con fade-out.

3. **Pre-coro sin tensión creciente** (`constants.ts:231-245`)
   - El pre-coro tiene la misma instrumentación que el verso.
   - Debería tener **densidad creciente** (más hats, fills más frecuentes, lead más presente).
   - **Solución**: Modificar `LEAD_DENSITY` y `hat_occupancy` por rol de sección.

---

### 6. Estabilidad y Rendimiento

#### Problemas Detectados

1. **Service Worker con caché vieja** (`vite-plugin-pwa`)
   - El SW se genera automáticamente con `generateSW`.
   - Si se actualiza el manifest o los samples, el SW puede servir archivos viejos.
   - **Síntoma**: Usuario escucha samples antiguos incluso después de actualizar.
   - **Solución**: Añadir `skipWaiting` y `clientsClaim` en config de Vite PWA.

2. **Fallos silenciosos al cargar samples** (`loopBank.ts:61-71`)
   ```typescript
   try {
     const decoded = await Tone.ToneAudioBuffer.load(`${baseUrl()}${file}`)
     // ...
   } catch {
     return null  // ← Fallo silencioso
   }
   ```
   - Si un sample no carga, el motor continúa sin notificar.
   - **Solución**: Log de warnings + evento de UI para informar al usuario.

3. **Buffer cache sin límite** (`loopBank.ts:28`)
   ```typescript
   const bufferCache = new Map<string, Tone.ToneAudioBuffer>()
   ```
   - Los buffers de audio se cachean indefinidamente.
   - Con muchos loops, puede causar **memory leak** en sesiones largas.
   - **Solución**: Límite de cache (ej: 10 buffers) + LRU eviction.

4. **Tone.js sin polyfill para Safari/iOS** (`player.ts:15-45`)
   - Tone.js usa `AudioContext` moderno.
   - Safari/iOS requieren polyfill para algunas features (ej: `AnalyserNode`).
   - **Solución**: Añadir `standardized-audio-context` polyfill en `main.tsx`.

---

## Mejoras de Alto Impacto Priorizadas

### Prioridad 1: Bajo Rítmico por Género (IMPACTO ALTO, ESFUERZO MEDIO)

**Problema**: El bajo es una nota por acorde, suena estático y amateur.  
**Solución**: Implementar `BASS_PATTERNS` con pasos, duración y glide por género.

**Archivos a modificar**:
- `src/core/constants.ts` → añadir `BASS_PATTERNS`
- `src/core/song.ts` → generar múltiples notas de bajo por acorde
- `src/engine/sounds.ts` → configurar MonoSynth con portamento para glide

**Estimación**: 4-6 horas de desarrollo + testing.

---

### Prioridad 2: Fills por Género y Sección (IMPACTO ALTO, ESFUERZO BAJO)

**Problema**: Todos los géneros usan el mismo fill genérico.  
**Solución**: `FILL_PATTERNS` con variaciones por género y rol de sección.

**Archivos a modificar**:
- `src/core/constants.ts` → añadir `FILL_PATTERNS`
- `src/core/song.ts` → seleccionar fill según género y sección

**Estimación**: 2-3 horas.

---

### Prioridad 3: Mejorar Punteo de Reggaetón (IMPACTO MEDIO, ESFUERZO BAJO)

**Problema**: El punteo suena mecánico, sin "swing latino".  
**Solución**: Ajustar `CHORD_PULSE.dur16` a 0.75 y añadir swing en steps 4,12.

**Archivos a modificar**:
- `src/core/constants.ts` → ajustar `CHORD_PULSE.reggaeton`
- `src/core/song.ts` → aplicar swing en punteo

**Estimación**: 1-2 horas.

---

### Prioridad 4: Motivos Melódicos en Lead (IMPACTO MEDIO, ESFUERZO MEDIO)

**Problema**: El lead son notas sueltas sin frases coherentes.  
**Solución**: Sistema de motivos (frase base + variaciones) por género.

**Archivos a modificar**:
- `src/core/melody.ts` → nuevo sistema de motivos
- `src/core/constants.ts` → añadir `MOTIF_TEMPLATES` por género

**Estimación**: 4-5 horas.

---

### Prioridad 5: Render a WAV/MP3 (IMPACTO ALTO, ESFUERZO ALTO)

**Problema**: Solo se puede exportar MIDI.  
**Solución**: Usar `OfflineAudioContext` de Web Audio API para renderizar audio.

**Archivos a crear**:
- `src/engine/renderer.ts` → clase `AudioRenderer` con `renderToWav(song, tempo)`
- `src/components/ExportButton.tsx` → UI de exportación

**Estimación**: 8-10 horas (incluye testing cross-browser).

---

### Prioridad 6: Buses y Compresión por Género (IMPACTO MEDIO, ESFUERZO MEDIO)

**Problema**: La mezcla es plana, sin carácter por género.  
**Solución**: Configurar buses con compresión, EQ y reverb por género.

**Archivos a modificar**:
- `src/engine/player.ts` → añadir buses de mezcla
- `src/engine/sounds.ts` → configurar presets de bus por género

**Estimación**: 5-6 horas.

---

### Prioridad 7: CHORD_PULSE para más Géneros (IMPACTO BAJO, ESFUERZO BAJO)

**Problema**: Solo reggaetón tiene punteo de piano.  
**Solución**: Añadir `CHORD_PULSE` para trap (stabs) y plug (arpegios).

**Archivos a modificar**:
- `src/core/constants.ts` → añadir `CHORD_PULSE` para trap/plug
- `src/core/song.ts` → aplicar a los nuevos géneros

**Estimación**: 2-3 horas.

---

## Checklist de Normalidad Automática

Métricas objetivas para detectar problemas en el validator:

### 1. Armonía

- [ ] `chord_span_ok`: Span del acorde <= 21 semitonos (VOICE_SPAN)
- [ ] `chord_range_ok`: Todas las notas del acorde en ventana P5-P95 del género
- [ ] `chord_density_ok`: 3-5 notas por acorde (no power chords en amor/nostalgia)
- [ ] `progression_in_scale`: 100% de grados en escala (o mutación documentada)

### 2. Bajo

- [ ] `bass_range_ok`: Nota en ventana P5-P95 del género
- [ ] `bass_not_absent`: Al menos 1 nota de bajo por sección
- [ ] `bass_rhythm_ok` (NUEVO): Densidad de notas de bajo >= 1 por compás (o BASS_PATTERN definido)
- [ ] `bass_glide_ok` (NUEVO): Si trap/plug, al menos 1 glide por sección

### 3. Batería

- [ ] `drum_pattern_coherent`: Snare/kick positions coinciden con GENRES_CONFIG (validator actual)
- [ ] `hat_occupancy_ok`: Densidad de hats en rango por género
- [ ] `fill_present`: Al menos 1 fill por sección (no obligatorio en intro)
- [ ] `fill_varied` (NUEVO): No más del 50% de fills idénticos por canción

### 4. Lead

- [ ] `lead_range_ok`: Todas las notas en ventana P5-P95 del género
- [ ] `lead_density_ok`: Densidad real (notas/steps) dentro de LEAD_DENSITY ± 0.1
- [ ] `lead_not_absent`: Al menos 10 notas por sección en géneros con densidad >= 0.3

### 5. Estructura

- [ ] `section_bars_ok`: Compases por sección dentro de rangos esperados (intro 4, coro 8, etc.)
- [ ] `no_silent_sections`: Al menos 2 pistas activas por sección
- [ ] `transition_ok`: Al menos 1 fill o break en transiciones entre secciones

---

## Pruebas Auditivas Guiadas

### Reggaetón Bm 98 BPM (referencia: `dataset/reggaeton/Bm/*.mid`)

1. **Generar**: Crear beat reggaetón tristeza, tonalidad B, BPM 98.
2. **Comparar con MIDI de referencia**:
   - Punteo: ¿Los golpes caen en 1 y 4? ¿Hay ciclo 9,9,7,7?
   - Bajo: ¿Es una nota por acorde o tiene patrón dembow?
   - Melodía: ¿Las notas están en rango 63-93?
3. **Evaluar**:
   - ¿El punteo tiene "swing latino" o suena mecánico?
   - ¿El bajo tiene cuerpo o falta peso?
   - ¿La melodía es coherente o son notas sueltas?

### Trap F# 140 BPM

1. **Generar**: Crear beat trap tristeza, tonalidad F#, BPM 140.
2. **Verificar**:
   - Snare en paso 9 (downbeat del 3er tiempo)
   - Hats densos (16/16 pasos)
   - Bajo 808 largo (una nota por acorde con sustain)
3. **Evaluar**:
   - ¿El 808 tiene glide entre notas?
   - ¿El lead tiene densidad 0.28?
   - ¿El fill del final de sección es apropiado?

### Rap C 92 BPM

1. **Generar**: Crear beat rap amor, tonalidad C, BPM 92.
2. **Verificar**:
   - Snare en pasos 5 y 13 (backbeat clásico)
   - Swing en offbeats (+0.21 de paso)
   - Hats con gaps (no densos como trap)
3. **Evaluar**:
   - ¿El bajo tiene notas intermedias o es una nota por acorde?
   - ¿El swing se siente natural?
   - ¿La densidad del lead (0.40) es apropiada?

### Detroit G# 176 BPM

1. **Generar**: Crear beat detroit ira, tonalidad G#, BPM 176.
2. **Verificar**:
   - Snare en paso 9 (offbeat double-time)
   - Hats en offbeats (8/16 pasos)
   - Groove: -0.24 en pasos 13,15
3. **Evaluar**:
   - ¿El tempo percibido es ~88 BPM (double-time)?
   - ¿El bajo tiene staccato o es nota larga?
   - ¿El lead tiene densidad alta (0.50)?

---

## Comandos de Verificación

```bash
# Validar coherencia rítmica del motor
npm run validate:rhythm

# Verificar tipos y compilación
npm run typecheck

# Construir para producción
npm run build

# Verificar generación de canción
npm run verify

# Aprender velocities del catálogo real
npm run learn:velocities

# Aprender groove/micro-timing
npm run learn:groove

# Aprender rangos de octava
npm run learn:ranges

# Validar progresiones contra catálogo
npm run validate:flp
```

---

## Conclusión

AURA tiene una base sólida. El motor está alineado con el catálogo real, los patrones de batería son correctos, y el pipeline de aprendizaje es robusto. Los problemas principales son:

1. **Bajo estático** → Solucionar esto mejorará drásticamente la calidad musical.
2. **Fills genéricos** → Añadir variedad por género y sección.
3. **Lead sin frases** → Sistema de motivos melódicos.
4. **Punteo de reggaetón mecánico** → Ajustar duración y swing.

La arquitectura está bien diseñada para implementar estas mejoras de forma incremental. Recomiendo priorizar el bajo rítmico (impacto más alto) y luego los fills (esfuerzo más bajo).

---

**Próximos pasos inmediatos**:
1. Implementar `BASS_PATTERNS` por género.
2. Añadir `FILL_PATTERNS` con variación.
3. Ajustar `CHORD_PULSE` para reggaetón.
4. Añadir checklist de normalidad al validator.
5. Documentar cambios en `progress_log.md`.

---

*Auditoría generada el 2026-09-09 por arquitecto de audio/ingeniería de software senior.*
