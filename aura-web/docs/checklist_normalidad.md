# Checklist de Normalidad para AURA

Métricas objetivas para detectar automáticamente problemas en la generación.

---

## 1. Armonía (Acordes/Piano)

| Check | Descripción | Umbral | Implementado |
|-------|-------------|--------|--------------|
| `chord_span_ok` | Span del acorde <= 21 semitonos | `max(chord) - min(chord) <= 21` | ✅ `compactVoicing` |
| `chord_range_ok` | Todas las notas en ventana P5-P95 | `RANGES[genre].chords` | ✅ `withinRange` |
| `chord_density_ok` | 3-5 notas por acorde | `len(chord) in [3,5]` | ⚠️ Validar |
| `progression_in_scale` | 100% de grados en escala | `degree <= len(scale)` | ✅ `mutateProgression` |
| `chord_inversion_varied` | Al menos 2 tipos de inversión por sección | `unique(inv) >= 2` | ❌ Pendiente |
| `chord_pulse_timing` | Si CHORD_PULSE, steps en los tiempos correctos | `step in pulse.steps` | ✅ `song.ts:76-105` |
| `chord_pulse_swing` | Si reggaetón, swing en steps 4,12 | `offset > 0` | ❌ Pendiente |

### Código para Validar

```typescript
function validateHarmony(section: Section, chord: number[]): HarmonyReport {
  const span = Math.max(...chord) - Math.min(...chord)
  const range = RANGES[section.genre].chords
  const inRange = chord.every(n => n >= range.lo && n <= range.hi)
  
  return {
    chord_span_ok: span <= 21,
    chord_range_ok: inRange,
    chord_density_ok: chord.length >= 3 && chord.length <= 5,
  }
}
```

---

## 2. Bajo (Bass)

| Check | Descripción | Umbral | Implementado |
|-------|-------------|--------|--------------|
| `bass_range_ok` | Nota en ventana P5-P95 | `RANGES[genre].bass` | ✅ `withinRange` |
| `bass_not_absent` | Al menos 1 nota por sección | `count >= 1` | ✅ Implícito |
| `bass_rhythm_ok` | Densidad >= 1 nota por compás | `count / bars >= 1` | ❌ **URGENTE** — Hoy es 1 por acorde |
| `bass_glide_ok` | Si trap/plug, al menos 1 glide por sección | `glide_count >= 1` | ❌ Pendiente |
| `bass_pattern_ok` | Notas siguen BASS_PATTERN del género | `steps match pattern` | ❌ Pendiente |

### Código para Validar

```typescript
function validateBass(section: Section, notes: Note[], bars: number): BassReport {
  const range = RANGES[section.genre].bass
  const inRange = notes.every(n => n.note >= range.lo && n.note <= range.hi)
  const density = notes.length / bars
  
  return {
    bass_range_ok: inRange,
    bass_not_absent: notes.length >= 1,
    bass_rhythm_ok: density >= 1,
    // bass_glide_ok y bass_pattern_ok requieren implementación previa
  }
}
```

---

## 3. Batería (Drums)

| Check | Descripción | Umbral | Implementado |
|-------|-------------|--------|--------------|
| `drum_pattern_coherent` | Snare/kick coinciden con GENRES_CONFIG | `coverage >= 0.6` | ✅ `rhythm_validator.ts` |
| `hat_occupancy_ok` | Densidad de hats en rango | `hat_occupancy_range` | ✅ `rhythm_validator.ts` |
| `fill_present` | Al menos 1 fill por sección (no intro) | `fill_count >= 1` | ✅ `song.ts:158-182` |
| `fill_varied` | No más del 50% de fills idénticos | `unique(fills) / total >= 0.5` | ❌ Pendiente |
| `fill_by_section` | Fills apropiados por rol (coro denso, intro sin fill) | `fill_type == role_fill` | ❌ Pendiente |
| `groove_applied` | Micro-timing aplicado según GROOVE | `offsets match config` | ✅ `microOffset` |

### Código para Validar

```typescript
function validateDrums(section: Section, notes: Note[]): DrumsReport {
  const config = GENRES_CONFIG[section.genre]
  const pattern = DRUM_PATTERNS[section.genre]
  
  const snareSteps = positionsOf(pattern.snare)
  const kickSteps = positionsOf(pattern.kick)
  const hatOcc = hatOccupancy(pattern.hat)
  
  const snareCov = coverage(snareSteps, config.snare_step_positions_16th)
  const kickCov = coverage(kickSteps, config.kick_step_positions_16th)
  const hatOk = hatOcc >= config.hat_occupancy_range[0] && hatOcc <= config.hat_occupancy_range[1]
  
  // Detectar fills (notas extra en últimos 4 steps)
  const fills = notes.filter(n => {
    const stepInBar = (n.tick % (PPQ * 4)) / (PPQ / 4)
    return stepInBar >= 12
  })
  
  return {
    drum_pattern_coherent: snareCov >= 0.6 && kickCov >= 0.5,
    hat_occupancy_ok: hatOk,
    fill_present: fills.length > 0 || section.role === 'intro',
    // fill_varied requiere contexto global de la canción
  }
}
```

---

## 4. Lead (Melodía)

| Check | Descripción | Umbral | Implementado |
|-------|-------------|--------|--------------|
| `lead_range_ok` | Todas las notas en P5-P95 | `RANGES[genre].lead` | ✅ `withinRange` |
| `lead_density_ok` | Densidad real dentro de LEAD_DENSITY ± 0.1 | `abs(density - expected) <= 0.1` | ⚠️ Validar |
| `lead_not_absent` | Al menos 10 notas por sección (si densidad >= 0.3) | `count >= 10` | ⚠️ Validar |
| `lead_motifs_present` | Al menos 1 motivo repetido por sección | `motif_count >= 1` | ❌ Pendiente |
| `lead_chord_tones` | >= 60% notas son tensiones del acorde | `chord_tones / total >= 0.6` | ⚠️ Validar |
| `lead_phrase_coherent` | No más de 6 notas seguidas sin silencio | `max_consecutive <= 6` | ✅ `melody.ts:44-46` |

### Código para Validar

```typescript
function validateLead(section: Section, notes: Note[], bars: number): LeadReport {
  const range = RANGES[section.genre].lead
  const expectedDensity = LEAD_DENSITY[section.genre]
  const steps = bars * 16
  const actualDensity = notes.length / steps
  
  const inRange = notes.every(n => n.note >= range.lo && n.note <= range.hi)
  
  // Detectar notas consecutivas sin silencio
  let maxConsecutive = 0
  let current = 0
  const sorted = [...notes].sort((a, b) => a.tick - b.tick)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].tick - sorted[i-1].tick < PPQ / 4) {
      current++
    } else {
      maxConsecutive = Math.max(maxConsecutive, current)
      current = 0
    }
  }
  
  return {
    lead_range_ok: inRange,
    lead_density_ok: Math.abs(actualDensity - expectedDensity) <= 0.1,
    lead_not_absent: notes.length >= 10 || expectedDensity < 0.3,
    lead_phrase_coherent: maxConsecutive <= 6,
  }
}
```

---

## 5. Estructura (Sections)

| Check | Descripción | Umbral | Implementado |
|-------|-------------|--------|--------------|
| `section_bars_ok` | Compases por sección en rangos esperados | `intro:4, coro:8, etc.` | ✅ `SONG_FLOW` |
| `no_silent_sections` | Al menos 2 pistas activas por sección | `active_tracks >= 2` | ⚠️ Validar |
| `transition_ok` | Al menos 1 fill o break entre secciones | `has_fill || has_break` | ⚠️ Validar |
| `emotion_varied` | Al menos 2 emociones por canción | `unique(emotions) >= 2` | ✅ `ROLE_EMOTION` |
| `structure_complete` | Tiene intro, coro y outro | `has_intro && has_coro && has_outro` | ✅ `SONG_FLOW` |

### Código para Validar

```typescript
function validateStructure(sections: Section[]): StructureReport {
  const roles = sections.map(s => s.role)
  const emotions = [...new Set(sections.map(s => s.emotion))]
  
  return {
    section_bars_ok: sections.every(s => s.bars >= 4 && s.bars <= 16),
    no_silent_sections: true, // Requiere análisis de tracks por sección
    emotion_varied: emotions.length >= 2,
    structure_complete: roles.includes('intro') && roles.includes('coro') && roles.includes('outro'),
  }
}
```

---

## 6. Audio/Engine

| Check | Descripción | Umbral | Implementado |
|-------|-------------|--------|--------------|
| `samples_loaded` | Todos los samples del manifest cargaron | `load_errors == 0` | ❌ Fallo silencioso |
| `buffer_cache_ok` | Cache de buffers no excede límite | `cache_size <= 10` | ❌ Sin límite |
| `no_clipping` | Pico de amplitud < 0.95 | `max(waveform) < 0.95` | ⚠️ Compresor activo |
| `tempo_stable` | BPM del transport coincide con config | `transport.bpm == config` | ✅ `player.ts` |

### Código para Validar

```typescript
async function validateEngine(): Promise<EngineReport> {
  // Verificar samples cargados
  const manifest = await loadManifest()
  let loadErrors = 0
  for (const entry of manifest) {
    if (entry.file) {
      const buf = await loadLoopBuffer(entry.file)
      if (!buf) loadErrors++
    }
  }
  
  // Verificar cache
  const cacheSize = bufferCache.size
  
  // Verificar clipping (requiere análisis de waveform)
  const analyser = player.getMasterWaveform()
  const maxAmplitude = Math.max(...analyser)
  
  return {
    samples_loaded: loadErrors === 0,
    buffer_cache_ok: cacheSize <= 10,
    no_clipping: maxAmplitude < 0.95,
    tempo_stable: true, // Verificado en runtime
  }
}
```

---

## Integración con `rhythm_validator.ts`

Para añadir estas checks al validator existente:

```typescript
// Añadir a scripts/rhythm_validator.ts

export interface NormalityReport {
  harmony: HarmonyReport
  bass: BassReport
  drums: DrumsReport
  lead: LeadReport
  structure: StructureReport
  engine: EngineReport
  is_normal: boolean
  warnings: string[]
}

export function validateNormality(song: SongResult): NormalityReport {
  const warnings: string[] = []
  
  const harmony = validateHarmony(song)
  const bass = validateBass(song)
  const drums = validateDrums(song)
  const lead = validateLead(song)
  const structure = validateStructure(song)
  
  if (!bass.bass_rhythm_ok) warnings.push('Bajo con densidad muy baja (1 nota por acorde)')
  if (!drums.fill_varied) warnings.push('Fills repetitivos')
  if (!lead.lead_motifs_present) warnings.push('Lead sin motivos melódicos')
  
  const isNormal = 
    harmony.chord_span_ok && 
    harmony.chord_range_ok &&
    bass.bass_range_ok &&
    bass.bass_not_absent &&
    drums.drum_pattern_coherent &&
    drums.hat_occupancy_ok &&
    lead.lead_range_ok &&
    structure.structure_complete
  
  return {
    harmony,
    bass,
    drums,
    lead,
    structure,
    engine: { samples_loaded: true, buffer_cache_ok: true, no_clipping: true, tempo_stable: true },
    is_normal: isNormal,
    warnings,
  }
}
```

---

## Próximos Pasos

1. Implementar `validateNormality()` en `scripts/rhythm_validator.ts`.
2. Añadir `npm run validate:normality` al `package.json`.
3. Ejecutar en cada build para detectar regresiones.
4. Añadir métricas que aún faltan (bass_rhythm_ok, fill_varied, lead_motifs_present).

---

*Checklist generada el 2026-09-09 como parte de la auditoría técnica.*
