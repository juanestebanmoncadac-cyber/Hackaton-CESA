# HorarioCESA — Plataforma de Horarios con IA

Prototipo del Hackatón CESA (entrega: jueves 24 de septiembre de 2026). En línea: https://horariocesa.vercel.app

El estudiante marca las materias que ya aprobó, elige qué quiere inscribir y con qué profesores, ordena sus prioridades y recibe **3 opciones de horario sin cruces**.

## Cómo correrlo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas del motor y los datos
npm run build      # carpeta dist/ (lo que publica Vercel)
npm run build:demo # un solo archivo dist-demo/index.html para compartir
```

`src/datos/pensum.json` y `src/datos/oferta.json` se generan automáticamente en `dev`, `build` y `test`. La oferta de prueba se construye desde `scripts/cesa-backtest.json`: 232 secciones regulares y 28 actividades de Bienestar con NRC, profesores, aulas y horarios **simulados**. Los nombres del pénsum y de las actividades de Bienestar se basan en fuentes CESA; esta oferta no corresponde a un periodo real de matrícula.

## Flujo (4 pasos)

1. **Aprobadas** — pensum interactivo con el diseño de la malla oficial. Atajo "marcar hasta el semestre N", prerrequisitos en cascada y tres estados (aprobada, disponible, bloqueada). Al pasar el mouse se resaltan los prerrequisitos.
2. **Materias** — solo las disponibles. "La necesito" o "Me gustaría"; profesores con ★ preferido / ✕ evitar; al pasar el mouse se ven los grupos de cada profesor y se puede **fijar un grupo (candado)**. Bienestar se elige por actividad; las selecciones deportivas solo si el estudiante declara que pertenece.
3. **Preferencias** — orden de 5 prioridades (la primera manda entre horarios con las mismas materias; las demás desempatan), tolerancia a huecos, hora mínima, días bloqueados y máximo de créditos (1–30). Si el máximo supera 21, se avisa que el sobrecupo depende del promedio y debe verificarse con CESA.
4. **Horarios** — 3 opciones con horario semanal, lista de profesores, métricas y "¿Por qué este?". **Ver otras opciones** pasa a las siguientes del ranking sin repetir horarios que se vean iguales (compara franjas, no NRC); si el estudiante marca un profesor que no le gustó, pasa a "evitar". Para cambiar prioridades, vuelve al paso 3. Descargar imagen y copiar NRC.

## Estructura (una carpeta por dueño para no pisarnos)

| Carpeta | Qué hay | Dueño |
|---|---|---|
| `src/types.ts` | **Contrato de datos.** Lo usan todos: cambiarlo solo en equipo. | Todos |
| `src/datos/` + `scripts/generar-datos.mjs` | `pensum.json` y `oferta.json` (simulada, con cruces a propósito) | Angie (Datos) |
| `src/motor/` | `generarHorarios.ts` (backtracking + puntaje + diversidad), `explicar.ts`, `pensum.ts`, pruebas | Juan Esteban (Backend/IA) |
| `src/pantallas/`, `src/componentes/`, `src/styles.css` | Las 4 pantallas y el modal | Johana (Frontend/UX) |
| `src/App.tsx`, `src/estado/` | Navegación, estado guardado en el navegador, conexión motor ↔ pantallas | Abie (Integración) |

## El motor en una línea

`generarHorarios({ solicitudes, oferta, preferencias, pensum, excluir? }) → { opciones, total, avisos }`

- **Reglas duras** (descartan): cruces, hora mínima, días bloqueados, grupos fijados, máximo de créditos elegido por el estudiante y selección declarada. El motor también acepta un mínimo de créditos flexible (`creditosMinimos`), pero su control está oculto hasta que respete "necesito" y "evitar".
- **Puntaje por niveles** (un nivel siempre gana a los de abajo): incluir las "necesito" → no usar profesores "evitar" → incluir las "me gustaría" que quepan → la prioridad principal del estudiante → las demás prioridades (profesores, huecos, madrugar, días libres, terminar temprano) solo desempatan.
- **Huecos**: penalización creciente (1 h casi no pesa, más de 3 h pesa mucho); el almuerzo de 12:00 a 2:00 no cuenta.
- **Nunca deja sin resultados**: si algo es imposible, lo deja fuera y lo explica en `avisos`.
- **Diversidad**: las 3 opciones procuran diferir en al menos 2 materias (si no alcanza, en 1) y verse distintas (entrada, días libres, huecos), sin alejarse de la prioridad principal.

## Datos reales (Oracle)

La app consume un único contrato `Oferta` definido en `src/types.ts`. Cuando TI entregue la oferta real, coloca su exportación con ese formato en `data/oferta-activa.json` y ejecuta `npm run build`. El generador usará ese archivo en lugar de la simulación; no se cambia el frontend ni el motor. Si se retira el archivo, vuelve la simulación. Los archivos de `src/datos/` son generados y no se editan. Al cambiar la oferta, las preferencias guardadas que apunten a NRC, actividades o profesores que ya no existen se limpian y los horarios anteriores se recalculan.

## Publicar en Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub.
2. **Add New → Project** → importar `Hackaton-CESA`.
3. Vercel detecta Vite solo (build `npm run build`, salida `dist`). **Deploy.**
4. Cada `git push` a `main` vuelve a publicar en https://horariocesa.vercel.app.

## Pendiente / opcional

- Explicación con IA (Gemini) en una función serverless `api/explicar` usando `GEMINI_API_KEY`; hoy la explicación usa plantillas y no necesita llave.
- Validar prerrequisitos y el límite de créditos con Registro Académico.
- Pulir la versión celular (hoy funciona; el pensum se desplaza de lado).
