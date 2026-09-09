# AURA — Pipeline Operativo, Seguridad y Privacidad · v2.0

**Líder del Proyecto:** Néstor David Patiño Antón (Danest / GXVST)
**Fecha:** Septiembre 2026 · **Reemplaza a:** "Pipeline & Seguridad v1.0"
**Motivo de la v2:** la v1 incluía medidas de *security theater* (bloqueo de
DevTools, fingerprinting y geolocalización de usuarios) incompatibles con
privacidad y que no detienen copia no autorizada. Esta versión las reemplaza por
protección del lado servidor + privacidad por diseño.

---

## 1. Ingesta de productores y portal personalizado

Para escalar el catálogo del motor AURA con recursos de productores asociados.

1. **Portal por productor:** subdominio propio (`productor.auraengine.com`) con su
   catálogo interactivo y preescucha.
2. **Ingesta segura SFTP/R2:** credenciales restringidas por productor con
   **Chroot Jail** (cada productor ve solo su bucket). Sube sus maquetas desde su
   DAW/terminal; procesamiento automatizado en Python.
3. **Procesamiento:** el pipeline `database_flp/ingest` extrae → parsea →
   analiza (ver §3).
4. **Consentimiento explícito:** al darse de alta, el productor acepta el acuerdo
   de procesamiento (DPA) y los términos del catálogo; su obra nunca se usa para
   entrenar/analizar fuera de métricas agregadas sin su consentimiento.

---

## 2. Seguridad activa (lado servidor, sin bloquear UX)

### 2.1 Protección de obras

- **Watermarking dinámico servidor-side:** la preescucha se genera en backend con
  marca de audio imperceptible vinculada a la sesión/licencia. Si se filtra, la
  marca traza la licencia. No degrada la experiencia del usuario legítimo ni
  requiere bloquear DevTools.
- **Exportación condicionada:** stems completos y MIDI crudo se emiten solo con
  suscripción/licencia activa y verificación de asignación (lease/exclusiva).
- **Transporte cifrado:** HTTPS/WSS en toda la app; firmas de transacción en
  pagos (Stripe MoR).
- **Egress controlado:** emisión de archivos vía enlaces firmados de corta
  duración a Cloudflare R2.

### 2.2 Control de acceso y auditoría

- **RBAC en Supabase:** roles usuario–productor–admin; políticas RLS por tenant.
- **Logs de operación** (subidas, exportaciones, pagos, cambios de licencia):
  con IP y eventos firmados, **con consentimiento informado del productor** y
  retención definida (máx. 180 días salvo obligación legal).
- **Detección de abuso:** revisión automatizada (hash de contenidos, límites de
  descarga) + canal de reporte; alertas de incidentes con registro de
  investigación.
- **Backups** cifrados con retención 30 días; destrucción al cierre de cuenta.

> **Eliminado de la v1 (no debe volver al documento público):** bloqueo de
> DevTools/F12, fingerprint de navegador y geolocalización de usuarios como
> funcionalidad de plataforma. Son incompatibles con GDPR/LGPD, degradan UX y no
> detienen copia real.

---

## 3. Pipeline industrial de trabajo

Estandariza de la maqueta a la postproducción.

| Fase | Industria tradicional (caótica) | Pipeline AURA |
|---|---|---|
| Maquetación | Notas de voz y audios desfasados por mensajería | Composición estructurada en la web con BPM y escala fijos |
| Colaboración | Archivos renombrados erróneamente | Git Musical (PRs de audio, versionado) |
| Entrega de stems | Exportación manual propensa a cortes/FX | Export 1-click desde 0:00 con `metadata.json` |
| Mezcla y máster | Horas configurando sesión en el DAW | Importación limpia a Pro Tools / FL Studio |
| **Ingesta FLP** | Catálogos en carpetas sin estandarizar | `dataset_flp/<genero>/<tonalidad>/*.flp` → analizado automáticamente |

### 3.1 Parser FLP (detalle técnico, interno)

- Lector binario propio del formato FL Studio (chunks `FLhd`/`FLdt`, eventos TLV,
  notas de 24 B, textos UTF-16/ASCII, varint LEB128 con fallback FLP).
- Probado contra archivos reales de FL 20.8.4 (validación automática con fixtures
  de referencia: canales, patrones, tempo, plugins, notas).
- Clasificación por rol (batería/bajo/acordes/lead) y generación de
  `dataset_flp_analysis.json` con el mismo esquema que `dataset_analysis.json`.

---

## 4. Política de privacidad (resumen operativo)

Aplica al sitio, a la API y a los portales de productores.

### 4.1 Datos que se recopilan

- **Cuenta:** email, nombre de usuario, hash de password, país (optativo).
- **Suscripción:** estado, plan, fecha de renovación, historial de pagos (via
  MoR/Stripe, sin tarjeta en servidores de AURA).
- **Obras subidas:** archivos `.flp`/`.mid`/WAV del productor (para procesamiento
  y catálogo), con consentimiento del acuerdo de procesamiento.
- **Red/análisis:** logs de operación con IP y user-agent **solo para seguridad y
  mantenimiento**, agregados y sin perfilado del usuario; analítica opcional
  desactivada por defecto en perfiles de productores.

### 4.2 Derechos del usuario (acceso, borrado, portabilidad)

- Solicitudes vía `privacidad@auraengine.com`, respuesta ≤ 30 días.
- Derecho al olvido: borrado de cuenta + destrucción de backups dentro de 30 días
  (excepto obligación legal de retención).
- Exportación de obra: el productor puede descargar sus propias obras en todo
  momento; portabilidad de metadatos en formato abierto.

### 4.3 Cumplimiento y marcos

- **GDPR (SIY)** y **LGPD (Brasil)**: base legal = contrato + interés legítimo;
  DPA firmado con productores y procesadores.
- **Leyes LATAM** aplicables (Argentina, Colombia, México): inscripción AEPD-
  style donde corresponda; encargado de tratamiento designado.
- **Proveedores:** Supabase, Cloudflare R2, Vercel/Cloudflare Pages, Render/Fly,
  Stripe — todos con DPA vigente y región de datos configurable.

---

## 5. Propiedad intelectual y licencias (resumen contractual)

1. **Titularidad del productor:** quien sube la obra declara ser titular o contar
   con derechos; AURA no adquiere derechos de explotación por la mera ingesta.
2. **Licencia de preescucha:** limitada a la publicación en su portal y demo.
3. **Licencias marketplace** que el productor puede asignar:

   | Tipo | Alcance | Fuente exclusiva |
   |---|---|---|
   | Lease básica | Streaming/YouTube con crédito; sin revender stems | Sí |
   | Lease premium | Streaming + podcast/video hasta N streams | Sí |
   | Exclusiva | Derechos cedidos al comprador (master + catálogo) | No |
   | Asignación total | Todas las obras a AURA/editorial (contrato aparte) | No |

4. **Splits:** productor 85% de venta (70% en co-creación Sound Kits con Partner);
   AURA comisión marketplace 10–15%; el resto cubre procesamiento de pagos.
5. **Análisis agregado:** el motor usa métricas (groove, velocity, rangos,
   estructura), nunca copia patrones literales de un tercero en la obra de otro.

---

## 6. Infracciones y takedown (procedimiento)

- Canal único de reporte: `legal@auraengine.com`.
- Proceso DMCA-style: aviso → retención inmediata de la obra → notificación al
  subidor → contraaviso → resolución en ≤ 7 días hábiles.
- **Tres strikes** de infracción de contenido → suspensión de cuenta.
- Moderación automatizada (hash de contenido o reventa) + revisión humana.

---

## 7. Capacitación y cumplimiento interno

- Checklist de *privacy-by-design* obligatoria en cada PR de funcionalidad.
- Revisión legal trimestral de términos y políticas.
- Plan de respuesta a incidentes (PRI) con notificación en ≤ 72 h cuando la ley lo
  exija.

---

## 8. Cambios respecto de la v1 (para auditoría interna)

| Tema | v1 | v2 |
|---|---|---|
| Bloqueo de DevTools/F12 | Sí | **Eliminado** |
| Fingerprint + geolocalización de usuario | Sí (feature) | **Eliminado**; solo IP/user-agent en logs de operación con consentimiento |
| Watermarking | No especificado | Servidor-side, impermeable en origen, atado a sesión |
| Cumplimiento normativo | No mencionado | GDPR/LGPD/LATAM + DPA + PRI |
| Licencias y splits | No definidos | Tabla lease/exclusiva + 85/15 |

AURA Engine — Pipeline Operativo, Seguridad y Privacidad · © 2026