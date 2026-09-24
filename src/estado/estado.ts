/**
 * Estado global de la app (un solo reducer, guardado en el navegador).
 * Las pantallas leen y escriben aquí; el motor solo recibe una "foto".
 */
import pensumJson from '../datos/pensum.json';
import ofertaJson from '../datos/oferta.json';
import type { Criterio, Dia, Horario, OpinionProfesor, Oferta, Pensum, Preferencias, Prioridad, SolicitudMateria, ToleranciaHuecos } from '../types';
import { disponibles, hastaSemestre } from '../motor/pensum';

export const PENSUM = pensumJson as Pensum;
export const OFERTA = ofertaJson as Oferta;
/** tope del selector de créditos; por encima de limiteCreditosSemestre es sobrecupo */
export const CREDITOS_TOPE = 30;
const MOTOR_VERSION = 'm2';

/** rango de créditos guardado: si viene dañado vuelve al valor por defecto */
function creditosValidos(c: unknown, base: Estado['creditos']): Estado['creditos'] {
  const r = c as Partial<Estado['creditos']> | null;
  const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (!r || !ok(r.min) || !ok(r.max)) return base;
  const max = Math.min(CREDITOS_TOPE, Math.max(1, Math.round(r.max)));
  return { min: Math.min(max, Math.max(0, Math.round(r.min))), max };
}
// Incluye horarios, profesores y cupos: un NRC puede conservarse aunque cambie su grupo.
const DATOS_VERSION = (() => {
  let hash = 2166136261;
  for (const char of JSON.stringify(OFERTA)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  // MOTOR_VERSION: súbela cuando cambie el formato de Horario.id, para descartar "vistos" viejos
  return `${OFERTA.periodo}:${(hash >>> 0).toString(16)}:${MOTOR_VERSION}`;
})();

function idEnOferta(id: string): string {
  const tipo = PENSUM.materias.find((materia) => materia.id === id)?.tipo;
  if (tipo === 'bienestar') return 'BIENESTAR';
  if (tipo === 'electivaSH') return 'ELECTIVA_SH';
  return id;
}

export interface EstadoMateria {
  sel: boolean;
  prioridad: Prioridad;
  nrcFijado?: string;
  actividades: string[];
}

export interface Estado {
  datosVersion: string;
  paso: 1 | 2 | 3 | 4;
  aprobadas: string[];
  materias: Record<string, EstadoMateria>;
  /** opinión por profesor (global: si lo prefieres, lo prefieres en todas) */
  profesores: Record<string, OpinionProfesor>;
  ranking: Criterio[];
  toleranciaHuecos: ToleranciaHuecos;
  horaMinima: number;
  diasBloqueados: Dia[];
  /** créditos que el estudiante acepta ver (más de 21 = sobrecupo, depende del promedio); min está oculto y no se usa por ahora */
  creditos: { min: number; max: number };
  seleccion: { pertenece: boolean; nrc?: string };
  ajustes: Partial<Record<Criterio, number>>;
  /** resultado actual */
  opciones: Horario[];
  avisos: string[];
  opcion: number;
  vistos: string[]; // ids ya mostrados (para "Ver otras opciones")
  ronda: number;
}

function inicial(): Estado {
  const aprob = hastaSemestre(PENSUM, 5);
  aprob.delete('io'); // ejemplo: le quedó pendiente Investigación de Operaciones
  const disp = disponibles(PENSUM, aprob).map((m) => m.id);
  const materias: Record<string, EstadoMateria> = {};
  const defecto: Record<string, [boolean, Prioridad]> = {
    mtd: [true, 'necesito'], mc: [true, 'necesito'], io: [true, 'necesito'], v1: [true, 'necesito'],
    ni: [true, 'gustaria'], dc: [true, 'gustaria'], to: [true, 'gustaria'], b6: [true, 'necesito'],
  };
  for (const id of disp) {
    const [sel, prioridad] = defecto[id] ?? [false, 'gustaria'];
    const tipo = PENSUM.materias.find((m) => m.id === id)?.tipo;
    const disponible = tipo === 'sinHorario' || OFERTA.grupos.some((g) => g.materiaId === idEnOferta(id));
    materias[id] = {
      sel: sel && disponible,
      prioridad,
      actividades: id === 'b6' ? ['Tenis', 'Golf'].filter((a) => OFERTA.grupos.some((g) => g.materiaId === 'BIENESTAR' && g.actividad === a)) : [],
    };
  }
  return {
    datosVersion: DATOS_VERSION,
    paso: 1,
    aprobadas: [...aprob],
    materias,
    profesores: {},
    ranking: ['profesores', 'huecos', 'noMadrugar', 'diasLibres', 'terminarTemprano'],
    toleranciaHuecos: 'hasta2',
    horaMinima: 7,
    diasBloqueados: ['Sab'],
    creditos: { min: 0, max: PENSUM.limiteCreditosSemestre },
    seleccion: { pertenece: false },
    ajustes: {},
    opciones: [],
    avisos: [],
    opcion: 0,
    vistos: [],
    ronda: 1,
  };
}

const CLAVE = 'horarios-cesa:v2-backtest';

export function cargar(): Estado {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (raw) {
      const previo = JSON.parse(raw) as Partial<Estado>;
      const base = inicial();
      if (previo.datosVersion === DATOS_VERSION) return { ...base, ...previo, creditos: creditosValidos(previo.creditos, base.creditos) };
      const nrcs = new Map(OFERTA.grupos.map((g) => [g.nrc, g]));
      const actividades = new Set(OFERTA.grupos.map((g) => g.actividad).filter(Boolean));
      const profesores = new Set(OFERTA.grupos.map((g) => g.profesor).filter(Boolean));
      const materias: Estado['materias'] = {};
      for (const [id, materia] of Object.entries(previo.materias ?? {})) {
        const pensumMateria = PENSUM.materias.find((m) => m.id === id);
        if (!pensumMateria) continue;
        materias[id] = {
          ...materia,
          sel: materia.sel && (pensumMateria.tipo === 'sinHorario' ||
            OFERTA.grupos.some((g) => g.materiaId === idEnOferta(id))),
          nrcFijado: nrcs.get(materia.nrcFijado ?? '')?.materiaId === id ? materia.nrcFijado : undefined,
          actividades: (materia.actividades ?? []).filter((a) => actividades.has(a)),
        };
      }
      return {
        ...base,
        ...previo,
        datosVersion: DATOS_VERSION,
        paso: previo.paso === 4 ? 2 : (previo.paso ?? 1),
        creditos: creditosValidos(previo.creditos, base.creditos),
        materias,
        profesores: Object.fromEntries(Object.entries(previo.profesores ?? {}).filter(([p]) => profesores.has(p))),
        seleccion: {
          pertenece: !!(previo.seleccion?.pertenece && nrcs.get(previo.seleccion.nrc ?? '')?.esSeleccion),
          nrc: nrcs.get(previo.seleccion?.nrc ?? '')?.esSeleccion ? previo.seleccion?.nrc : undefined,
        },
        opciones: [], avisos: [], opcion: 0, vistos: [], ronda: 1,
      };
    }
  } catch {
    /* sin almacenamiento: seguimos con el estado inicial */
  }
  return inicial();
}

export function guardar(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* ignorar */
  }
}

export function reiniciar(): Estado {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* ignorar */
  }
  return inicial();
}

/** asegura que toda materia disponible tenga su entrada en `materias` */
export function sincronizarMaterias(e: Estado): Record<string, EstadoMateria> {
  const disp = disponibles(PENSUM, new Set(e.aprobadas)).map((m) => m.id);
  const out: Record<string, EstadoMateria> = {};
  for (const id of disp) out[id] = e.materias[id] ?? { sel: false, prioridad: 'gustaria', actividades: [] };
  return out;
}

export function solicitudesDe(e: Estado): SolicitudMateria[] {
  return Object.entries(sincronizarMaterias(e))
    .filter(([, m]) => m.sel)
    .map(([materiaId, m]) => ({
      materiaId,
      prioridad: m.prioridad,
      nrcFijado: m.nrcFijado,
      actividades: m.actividades,
      profesores: Object.fromEntries(
        OFERTA.grupos
          .filter((g) => g.materiaId === materiaId && g.profesor && e.profesores[g.profesor])
          .map((g) => [g.profesor!, e.profesores[g.profesor!]]),
      ),
    }));
}

export function preferenciasDe(e: Estado): Preferencias {
  return {
    ranking: e.ranking,
    toleranciaHuecos: e.toleranciaHuecos,
    horaMinima: e.horaMinima,
    diasBloqueados: e.diasBloqueados,
    seleccionNrc: e.seleccion.pertenece ? e.seleccion.nrc : undefined,
    // ajustes no se envían: los chips que los creaban se quitaron, y así la prioridad
    // principal es siempre la primera del ranking que el estudiante ve
    limiteCreditos: e.creditos.max,
    // creditosMinimos no se envía: el control del mínimo está oculto hasta que respete "necesito" y "evitar"
  };
}
