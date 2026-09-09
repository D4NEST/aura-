# AURA — Emotional Beat Engine
## Documento Estratégico para Inversores · v2.0

**Líder / Creador:** Néstor David Patiño Antón (Danest / GXVST)
**Fecha:** Septiembre 2026
**Estado:** MVP operativo · Motor generativo + web + ingesta FLP funcionando

---

## 1. Resumen ejecutivo

AURA es una plataforma MusicTech que genera bases rítmico-armónicas profesionales a
partir de **teoría musical emocional** (no es una caja negra de ML: cada emoción
tiene escala, progresiones y patrones propios y auditables), permite colaboración
asíncrona estilo **Git Musical** y monetiza a los productores dentro de un
marketplace con licencias claras.

Los tres frentes:

1. **Motor generativo** — expresión inmediata (Modo Crear) y canciones completas
   estructura sección por sección (Modo Pro).
2. **Colaboración estilo Git** — pull requests de audio sobre repositorios
   musicales, con reproductor multitrack y marcas de tiempo.
3. **Ingesta industrial** — lee proyectos nativos `.flp` (FL Studio) y patrones
   `.mid`, extrae groove/velocity/estructura de cada productor y elimina el caos
   del envío de maquetas por mensajería.

**Estado real hoy:** el motor está implementado y verificado (Python + web
TypeScript/React + parser FLP propio que lee el binario sin abrir FL Studio,
validado contra proyectos reales de FL 20.8.4). El software está listo; lo que
falta es tracción de usuarios y capital para acelerar.

---

## 2. Problema y propuesta de valor

**El problema:** los productores pierden horas en (a) lograr que una idea suene
"lista" mientras el bloqueo creativo persiste, (b) coordinar tomas y versiones por
chat con nombres de archivo caóticos, y (c) exportar stems a mano con errores.

**La propuesta:** un beat profesional y estructurado en segundos (BPM, escala,
género, emoción, forma), colaboración con control de versiones de audio y entrega
de stems en 1-click con `metadata.json`.

**Por qué ahora:** la generación musical asistida ya es aceptada por la industria;
lo que falta en el mercado es una herramienta **transparente, controlable y
orientada al flujo de trabajo del productor real**, no a clips aleatorios.

---

## 3. Producto y hechos verificables

> Todo lo listado abajo existe hoy y está verificado en el repositorio; no es
> roadmap especulativo.

| Módulo | Implementado | Cómo se verifica |
|---|---|---|
| Motor de armonía emocional | Sí — Python y versión TS | 5 emociones con escala propia (tristeza=menor, ira=frigio, amor=mayor, decepción=locrio, nostalgia=pentatónica menor); progresiones; inversiones; tensiones. |
| Batería por género | Sí | Grids de 16 pasos para trap, rap, plug, detroit y **reggaetón (dembow)** con acento magenta. |
| Canción estructurada (Intro/Verso/Coro/Puente/Outro) | Sí | Secciones con emoción/género/compases propios en línea de tiempo continua, humanización y fills. |
| Exportación MIDI | Sí | MIDI completo + stems por instrumento (Acordes/Bajo/Melodía/Batería) en sus canales GM. |
| Web (Modo Crear + Modo Pro) | Sí | Next-level UI: 24 tonalidades × 5 géneros, moods por género, preescucha y descarga. |
| **Parser de proyectos `.flp`** | Sí | Lector binario propio del formato FL Studio; validado contra archivos reales de FL 20.8.4 (19 canales, 5 patrones, tempo, plugins, notas). |
| Pipeline de ingesta `dataset_flp/` | Sí | Escaneo por `<genero>/<tonalidad>`, clasificación batería/bajo/acordes/lead y generación de `dataset_flp_analysis.json`. |

**Demo validada:** canción de 28 compases (nostalgia/tristeza/ira/decepción/amor),
F# 144 BPM, 46.7 s, 3 stems correctos, humanización aplicada.

---

## 4. Arquitectura y costos

Jamstack / serverless / edge, con **privacidad por diseño** (ver sección 8).

```
CLIENTE (navegador)
  Frontend: React/TS · Web Audio API (AudioWorklet)
  Motor local WASM (a futuro)

CAPA SERVERLESS / EDGE
  Vercel / Cloudflare Pages ($0–$20/mes)
  Serverless Functions (TS/Python)

DATOS
  Supabase (PostgreSQL) — usuarios, roles, commits/PRs musicales
  Cloudflare R2 — stems WAV/MIDI (sin cargo de egress)
  Render/Fly.io — motor DSP Python (ingesta FLP/MIDI)

PAGOS
  Stripe / Merchant of Record (3.4% + $0.30)
```

| Componente | Proveedor | MVP (0–500) | Comercial (~5.000) |
|---|---|---|---|
| Frontend | Vercel / Cloudflare Pages | $0 | $20 |
| BD + Auth | Supabase | $0 (gratis) | $25 |
| Storage stems | Cloudflare R2 | $0 (10 GB) | $5 |
| Backend motor | Render / Fly.io | $0–$5 | $15–$30 |
| Pagos | Stripe | 3.4% + $0.30 | comisión por venta |
| **Total** | | **~$0–$5/mes** | **~$65/mes** |

Margen bruto estimado >90% por diseño.

---

## 5. Modelo de negocio y precios

### 5.1 Pricing por fases (decisión estratégica)

**Fase 1 — Founder Program (primeros 1.000 usuarios): $25 USD/año.**
- Precio de lanzamiento con beneficio congelado mientras la suscripción siga activa.
- Objetivo: **capital inicial inmediato**, primeras 1.000 validaciones y
  testimonios reales para la ronda semilla.
- 1.000 suscriptores × $25 = **$25.000 USD/año de ingreso recurrente** con costos
  de ~$60 USD/año de infraestructura.
- La liquidez temprana se reinvierte en servicio (más géneros, mejorar motor,
  soporte, legal y contratos de los primeros productores asociados).

**Fase 2 — Precio regular (a partir del suscriptor 1.001): $79 USD/año.**
- Una vez establecida la base y validado el producto, el precio sube a valores de
  mercado (el benchmark de la industria es US$5–15/mes).
- Se mantiene el descuento Founder como beneficio vitalicio para los primeros.

**Fase 3 — Ingresos complementarios (todas las fases):**
- **Packs de expansión:** módulos de géneros emergentes (Afro House, Drill,
  Synthwave), kits de samples y presets — $4 USD/pack.
- **Marketplace:** comisión del **10%–15%** por venta de licencias de beats y
  stems entre usuarios de la comunidad.

> **Por qué subir después del primer millar:** el pricing de lanzamiento es una
> herramienta de adquisición y capital, no un compromiso de precio. Hablamos con
> inversores **con hechos**: primero tracción y retención a $25, después margen a
> $79. Un inversor quiere ver una curva de ARPU creciente, no un techo de $25.

### 5.2 Programa de referidos (afiliación)

Redistribución del margen hacia la comunidad de creadores (TikTok, YouTube,
educadores musicales) para adquisición orgánica.

| Nivel | Requisito | Comisión (sobre $25) | Comisión (sobre $79) | Incentivos extra |
|---|---|---|---|---|
| 1 · Usuario Afiliado | Suscriptor activo | 15% = $3.75 | 15% = $11.85 | 1 mes gratis por referido |
| 2 · Creador Pro | 10+ referidos activos | 20% = $5.00 | 20% = $15.80 | Insignia verificada + status |
| 3 · Partner AURA | 50+ referidos / influencers | 30% = $7.50 | 30% = $23.70 | Co-creación de Sound Kits (70/30) |

---

## 6. Proyecciones financieras (hipótesis a validar)

> Etiquetadas como hipótesis. Los costos son reales y medidos; el resto son
> supuestos de mercado que la ronda debe validar.

**Supuestos base:** churn anual de suscripción 20%; packs: 20% de usuarios activos
compran 2 packs/año; marketplace: take-rate 12% sobre ventas P2P.

| Hito | Año 1 | Año 2 | Año 3 |
|---|---|---|---|
| Suscriptores | 300 → 1.000 (Founder $25) | 1.000 → 5.000 (mix $25/$79) | 5.000 → 15.000 (precio regular) |
| ARPU anual (blend) | $25 | ~$50 | ~$72 |
| ARR | $7.5k → $25k | ~$100k–$250k | ~$360k–$1.1M |
| Packs + marketplace | $0–$5k | $30k–$80k | $120k–$300k |
| Infraestructura | <$100/año | ~$1.5k/año | ~$3.5k/año |
| Comisiones afiliados + Stripe | ~15–25% de ARR | ~15–25% de ARR | ~15–25% de ARR |
| **Neto estimado** | **$15k–$20k** | **$90k–$240k** | **$330k–$1.0M** |

**Lectura honesta para inversión:** AURA es un negocio indie **rentable desde el
día uno** (cash-flow positivo en soles de infraestructura). El capital semilla
sirve para **acelerar** adquisición, integrar B2B/licencias y market fit — no para
sobrevivir.

---

## 7. Plan de ronda y uso de capital

Ronda semilla enfocada en **tracción LATAM + primeros acuerdos B2B**:

| Uso | % |
|---|---|
| Adquisición inicial (Founder Program + red de productores) | 35% |
| Contratación (1 full-stack + 1 community/partnerships) | 30% |
| B2B e integraciones (producer tactic: suites, escuelas, sellos) | 15% |
| Legal, licencias y cumplimiento | 12% |
| Reserva operativa | 8% |

**Inversionistas objetivo:** fondos SaaS-for-creators, aceleradoras de música
(Techstars Music, Abbey Road Red) e inversionistas ángeles de la industria
musical/audio. Empresas estratégicas futuras (LANDR/Splice, BandLab, Image-Line)
como **salida potencial**, no como plan.

---

## 8. Legal, privacidad y propiedad intelectual

### 8.1 Principios de privacidad y datos

1. **Minimización:** solo se recopilan los datos necesarios (cuenta, obras
   subidas, actividad de suscripción). Nada de fingerprinting de navegador,
   geolocalización persistente ni rastreo pasivo de usuarios como funcionalidad.
2. **Transparencia y consentimiento:** el productor otorga consentimiento
   explícito para procesar sus archivos (`.flp`/`.mid`) y para que su obra
   alimente métricas agregadas del motor. Rechazo de analítica opcional por perfil.
3. **Protección en tránsito y reposo:** HTTPS/WSS en todo el trayecto; cifrado en
   reposo en Cloudflare R2 y Supabase (At-Rest).
4. **Derechos del usuario:** acceso, rectificación, portabilidad y borrado
   ("derecho al olvido"); plazo máximo de respuesta 30 días; canal de contacto
   exclusivo (privacidad@auraengine.com).
5. **Analítica:** agregada y anonimizada (para productividad del estudio), nunca
   venta de datos a terceros. Cumplimiento GDPR (SIY) + marcos LATAM (ej. Ley de
   Protección de Datos de Argentina, Brasil LGPD) en la medida aplicable.
6. **Retención:** obras y metadatos se conservan mientras la cuenta esté activa o
   el productor lo solicite; no se retiene información biométrica.

### 8.2 Seguridad (protección de obras, sin security theater)

- **Watermarking dinámico del lado servidor:** las preescuchas llevan una marca
  de agua auditiva imperceptible e **inalterable en origen** (generada por backend,
  asociada a la sesión). Si se graba externamente, la marca permite trazar la
  licencia/el usuario — sin bloquear a usuarios legítimos.
- **Exportación restringida:** MIDI crudo y stems completos solo para cuentas
  autenticadas con suscripción/licencia activa y asignación de licencia verificada.
- **Control de acceso:** credenciales SFTP/R2 por productor con **Chroot Jail** —
  cada productor ve solo su bucket; roles RBAC en Supabase.
- **Auditoría operativa:** logs de operación (subidas, exportaciones, pagos) para
  detección de abuso e incidentes de seguridad; solo IP + firma de transacción,
  con consentimiento y política de retención definida.
- **Policy de abuso:** revisión manual + automatizada de contenido subido y
  reportes de infracciones; canal DMCA/takedown.

### 8.3 Propiedad intelectual y licencias de obras

1. **El productor es dueño de su obra.** AURA obtiene una licencia limitada para
   procesar, analizar y publicar la preescucha en su portal; nunca reventa ni cede
   los archivos fuente sin contrato de asignación.
2. **Licencias del marketplace** (las define el productor):

   | Tipo | Alcance | Conserva propiedad fuente |
   |---|---|---|
   | Lease básica | Estremering/YouTube con crédito; sin revender stems | Sí |
   | Lease premium | Streaming + podcast/video hasta cierto límite de streams | Sí |
   | Exclusiva | Derechos cedidos (master + catálogo) al comprador | No (transferencia) |
   | Asignación | Todas las obras de un productor a AURA/editorial (contrato separado) | No |

3. **Splits transparentes:** por defecto el productor recibe **85%** de la venta
   (y 85%–70% en co-creaciones de Sound Kits según nivel Partner); AURA se queda
   con su comisión de marketplace (10%–15%) y costos de procesamiento de pagos.
4. **Ingesta de `.flp`/`.mid`:** el ingreso al catálogo implica aceptar los
   términos de procesamiento y la licencia de preescucha; el análisis agregado
   del motor usa **solo métricas** (groove, velocity, rangos, estructura), nunca
   el patrón literal de un tercero.

### 8.4 Términos de servicio (resumen)

- Cuentas, suscripciones con renovación anual, reembolsos dentro de 14 días.
- Prohibiciones: revender stems licenciados como lease, ELU no autorizada,
  contenido infractor, scraping/extracción masiva de preescuchas.
- Moderación y takedown (DMCA-style) con procedimiento de aviso/contraaviso.
- División de responsabilidad: AURA provee el motor y hosting; el productor
  responde por la titularidad y el contenido de sus obras.
- Jurisdicción: ley aplicable LATAM con arbitraje de bajo costo; indemnización
  mutua por incumplimiento de garantías de titularidad.

---

## 9. Próximos hitos (roadmap 12 meses)

1. **Founder Program abierto** — canales: red del creador (productores de
   reggaetón/trap LATAM), comunidades de educación musical, TikTok/YouTube.
2. **100 productores con `dataset_flp/` ingerido** — los beats reales reemplazan
   los defaults del motor (micro-timing, velocity humana).
3. **Git Musical v1** — repositorios, commits y PRs de audio con reproductor
   multitrack.
4. **Marketplace y pasarela de pagos** — licencias lease/exclusiva con splits
   automáticos.
5. **Packs de expansión** (Afro House, Drill, Synthwave) y kits de samples.
6. **Medición** — encuestas de retención, CAC real por canal, y validación del
   modelo de pricing antes de la subida a $79.

---

## 10. Lo que pedimos

**Capital semilla para adquirir los primeros 1.000 usuarios en Founder Program
($25/año) y validar el modelo — con un producto ya funcionando.** A cambio: una
plataforma que crece con cada productor (cada uno trae a sus 4 artistas principales
→ crecimiento exponencial con CAC orgánico), márgenes superiores al 90% y un
diferenciador técnico (Git Musical + parser FLP) que nadie más tiene empaquetado.

AURA Engine — Documento Estratégico para Inversores · © 2026