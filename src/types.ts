/**
 * CONTRATO DE DATOS — Plataforma de Horarios CESA
 *
 * Este archivo es el acuerdo entre Datos, Motor y Frontend.
 * Si cambias algo aquí, avisa al equipo: todos dependen de estos tipos.
 *
 * El formato de `Oferta` imita lo que vendrá de Oracle. Cuando TI entregue
 * la exportación real, solo se reemplaza `src/datos/oferta.json`
 * (o se traduce en la capa intermedia) y nada más cambia.
 */

// ───────────────────────── Pensum ─────────────────────────

export type TipoMateria =
  | 'regular' // se inscribe por profesor/grupo
  | 'bienestar' // se inscribe por actividad (tenis, golf…)
  | 'electivaSH' // electiva sociohumanística: se inscribe por tema
  | 'sinHorario'; // prácticas, requisitos: no ocupan franja semanal

export interface Materia {
  id: string; // código corto estable, p. ej. "mtd"
  nombre: string;
  creditos: number;
  semestre: number; // 1 a 9
  prerrequisitos: string[]; // ids de otras materias
  tipo: TipoMateria;
  /** fila de la malla oficial (línea de formación), solo para dibujar el pensum */
  fila?: number;
}

export interface Pensum {
  programa: string;
  totalCreditos: number;
  limiteCreditosSemestre: number;
  creditosPorSemestre: number[]; // índice 0 = semestre I
  materias: Materia[];
}

// ───────────────────────── Oferta ─────────────────────────

export type Dia = 'Lun' | 'Mar' | 'Mie' | 'Jue' | 'Vie' | 'Sab';
export const DIAS: Dia[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export interface Sesion {
  dia: Dia;
  inicio: number; // hora en decimal: 7 = 7:00, 13.5 = 13:30
  fin: number;
  salon?: string;
}

export interface Grupo {
  nrc: string; // identificador único del grupo (como en el sistema de inscripción)
  /** id de la materia; para bienestar = "BIENESTAR", electivas SH = "ELECTIVA_SH", selecciones = "SELECCION" */
  materiaId: string;
  grupo: string; // "Grupo 1"
  profesor?: string; // grupos regulares
  actividad?: string; // bienestar, electivas SH y selecciones
  tipo: 'regular' | 'actividad';
  esSeleccion: boolean;
  cupos: number;
  sesiones: Sesion[];
}

export interface Oferta {
  periodo: string; // "2027-1"
  generadoEn: string; // fecha ISO de la exportación
  fuente: 'simulada' | 'oracle';
  grupos: Grupo[];
}

// ─────────────────────── Lo que pide el estudiante ───────────────────────

export type Prioridad = 'necesito' | 'gustaria';
export type OpinionProfesor = 'preferido' | 'evitar';

export interface SolicitudMateria {
  materiaId: string;
  prioridad: Prioridad;
  /** solo los profesores con opinión; los demás son "me da igual" */
  profesores: Record<string, OpinionProfesor>;
  /** NRC fijado con candado: regla dura */
  nrcFijado?: string;
  /** bienestar / electivas SH: actividades o temas aceptables (vacío = cualquiera) */
  actividades?: string[];
}

export type Criterio = 'profesores' | 'huecos' | 'noMadrugar' | 'diasLibres' | 'terminarTemprano';

export type ToleranciaHuecos = 'max1' | 'hasta2' | 'igual';

export interface Preferencias {
  /** de más a menos importante; el peso sale de la posición */
  ranking: Criterio[];
  toleranciaHuecos: ToleranciaHuecos;
  /** regla dura: no hay clases antes de esta hora */
  horaMinima: number;
  /** regla dura: días en que no puede */
  diasBloqueados: Dia[];
  /** NRC de la selección deportiva si declaró que pertenece a una */
  seleccionNrc?: string;
  /** ajustes de pesos que vienen de "¿Qué no te gustó?" (multiplicadores) */
  ajustes?: Partial<Record<Criterio, number>>;
  limiteCreditos: number;
}

// ───────────────────────── Resultado ─────────────────────────

export interface Metricas {
  creditos: number;
  entradaMasTemprana: number | null;
  salidaMasTarde: number | null;
  horasHueco: number; // por semana, sin contar almuerzo
  diasLibres: Dia[]; // de lunes a viernes
  profesPreferidos: { cumplidos: number; total: number };
  profesEvitadosUsados: number;
}

export interface Asignacion {
  materiaId: string; // materia del pensum (o "SELECCION")
  grupo: Grupo;
}

export interface Horario {
  id: string; // firma estable: NRCs ordenados
  asignaciones: Asignacion[];
  puntaje: number;
  metricas: Metricas;
  materiasFuera: string[]; // ids que no se pudieron incluir
}

export interface ResultadoMotor {
  opciones: Horario[]; // ya ordenadas y diversas
  total: number; // combinaciones válidas encontradas
  avisos: string[]; // mensajes para el estudiante (conflictos, materias imposibles…)
}

export interface EntradaMotor {
  solicitudes: SolicitudMateria[];
  oferta: Oferta;
  preferencias: Preferencias;
  pensum: Pensum;
  /** firmas (Horario.id) ya mostradas, para "Ver otras opciones" */
  excluir?: string[];
  cuantas?: number; // por defecto 3
}
