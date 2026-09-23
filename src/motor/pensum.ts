import type { Materia, Pensum } from '../types';

export type EstadoMateria = 'aprobada' | 'disponible' | 'bloqueada';

/** semestre más alto con alguna materia aprobada */
export function semestreActual(pensum: Pensum, aprobadas: Set<string>): number {
  let max = 0;
  for (const m of pensum.materias) if (aprobadas.has(m.id) && m.semestre > max) max = m.semestre;
  return max;
}

/** disponible = no aprobada, prerrequisitos aprobados y a lo sumo un semestre por encima del actual */
export function estadoMateria(m: Materia, aprobadas: Set<string>, semActual: number): EstadoMateria {
  if (aprobadas.has(m.id)) return 'aprobada';
  const prereqOk = m.prerrequisitos.every((p) => aprobadas.has(p));
  return prereqOk && m.semestre <= semActual + 1 ? 'disponible' : 'bloqueada';
}

export function disponibles(pensum: Pensum, aprobadas: Set<string>): Materia[] {
  const sem = semestreActual(pensum, aprobadas);
  return pensum.materias.filter((m) => estadoMateria(m, aprobadas, sem) === 'disponible');
}

/** aprobar una materia aprueba en cascada sus prerrequisitos */
export function aprobarConPrerrequisitos(pensum: Pensum, aprobadas: Set<string>, id: string): Set<string> {
  const porId = new Map(pensum.materias.map((m) => [m.id, m]));
  const out = new Set(aprobadas);
  const visitar = (x: string) => {
    if (out.has(x)) return;
    out.add(x);
    porId.get(x)?.prerrequisitos.forEach(visitar);
  };
  visitar(id);
  return out;
}

/** desaprobar una materia desaprueba en cascada lo que dependía de ella */
export function desaprobarConDependientes(pensum: Pensum, aprobadas: Set<string>, id: string): Set<string> {
  const out = new Set(aprobadas);
  const quitar = (x: string) => {
    if (!out.has(x)) return;
    out.delete(x);
    pensum.materias.filter((m) => m.prerrequisitos.includes(x)).forEach((m) => quitar(m.id));
  };
  quitar(id);
  return out;
}

export function hastaSemestre(pensum: Pensum, n: number): Set<string> {
  return new Set(pensum.materias.filter((m) => m.semestre <= n).map((m) => m.id));
}
