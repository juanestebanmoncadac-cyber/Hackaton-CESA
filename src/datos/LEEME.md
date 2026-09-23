# Datos (dueña: Angie)

- `pensum.json` — malla de Administración de Empresas (74 materias, prerrequisitos por validar con Registro Académico).
- `oferta.json` — oferta de grupos 2027-1 **simulada**, con cruces a propósito, bienestar por actividad, electivas por tema y selecciones deportivas.

Los dos se generan con `npm run datos` (script `scripts/generar-datos.mjs`) y se crean solos si faltan.
Cuando llegue la oferta real desde Oracle, se pone aquí como `oferta.json` con el mismo formato (`Oferta` en `src/types.ts`).
