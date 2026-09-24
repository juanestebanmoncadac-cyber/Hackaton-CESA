import { describe, expect, it } from 'vitest';
import pensumJson from '../datos/pensum.json';
import ofertaJson from '../datos/oferta.json';
import type { EntradaMotor, Oferta, Pensum, Preferencias, SolicitudMateria } from '../types';
import { costoHueco, generarHorarios, gruposSeCruzan, huecosDelDia } from './generarHorarios';
import { aprobarConPrerrequisitos, desaprobarConDependientes, disponibles, hastaSemestre } from './pensum';

const pensum = pensumJson as Pensum;
const oferta = ofertaJson as Oferta;
const primerProfesor = (id: string) => oferta.grupos.find((g) => g.materiaId === id)?.profesor ?? '';

const PREF: Preferencias = {
  ranking: ['profesores', 'huecos', 'noMadrugar', 'diasLibres', 'terminarTemprano'],
  toleranciaHuecos: 'hasta2',
  horaMinima: 7,
  diasBloqueados: ['Sab'],
  limiteCreditos: 21,
};

const SOLIC: SolicitudMateria[] = [
  { materiaId: 'mtd', prioridad: 'necesito', profesores: { [primerProfesor('mtd')]: 'preferido' } },
  { materiaId: 'mc', prioridad: 'necesito', profesores: { [primerProfesor('mc')]: 'preferido' } },
  { materiaId: 'io', prioridad: 'necesito', profesores: {} },
  { materiaId: 'v1', prioridad: 'necesito', profesores: {} },
  { materiaId: 'ni', prioridad: 'gustaria', profesores: { [primerProfesor('ni')]: 'preferido' } },
  { materiaId: 'dc', prioridad: 'gustaria', profesores: {} },
  { materiaId: 'to', prioridad: 'gustaria', profesores: {} },
  { materiaId: 'b6', prioridad: 'necesito', profesores: {}, actividades: ['Tenis', 'Golf'] },
];

const entrada = (over: Partial<EntradaMotor> = {}, pref: Partial<Preferencias> = {}): EntradaMotor => ({
  solicitudes: SOLIC,
  oferta,
  pensum,
  preferencias: { ...PREF, ...pref },
  ...over,
});

const sinCruces = (gs: { grupo: import('../types').Grupo }[]) => {
  for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) if (gruposSeCruzan(gs[i].grupo, gs[j].grupo)) return false;
  return true;
};

describe('datos', () => {
  it('la oferta tiene NRC únicos y sesiones válidas', () => {
    const nrcs = new Set(oferta.grupos.map((g) => g.nrc));
    expect(nrcs.size).toBe(oferta.grupos.length);
    for (const g of oferta.grupos) for (const s of g.sesiones) expect(s.fin).toBeGreaterThan(s.inicio);
  });
  it.skipIf(oferta.fuente !== 'simulada')('la oferta simulada conserva secciones y franjas del escenario CESA', () => {
    expect(oferta.fuente).toBe('simulada');
    expect(oferta.grupos.filter((g) => g.tipo === 'regular')).toHaveLength(232);
    expect(oferta.grupos.filter((g) => g.materiaId === 'BIENESTAR')).toHaveLength(28);
    const bloques = new Set(['7:00-8:30', '8:40-10:10', '10:30-12:00', '12:10-13:40', '14:00-15:30', '15:40-17:10']);
    const fmt = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    for (const g of oferta.grupos) for (const s of g.sesiones) {
      expect(s.dia).not.toBe('Sab');
      expect(bloques.has(`${fmt(s.inicio)}-${fmt(s.fin)}`)).toBe(true);
    }
  });
  it('los prerrequisitos existen en el pensum', () => {
    const ids = new Set(pensum.materias.map((m) => m.id));
    for (const m of pensum.materias) for (const p of m.prerrequisitos) expect(ids.has(p)).toBe(true);
  });
});

describe('pensum', () => {
  it('aprobar en cascada marca los prerrequisitos', () => {
    const a = aprobarConPrerrequisitos(pensum, new Set(), 'mc');
    expect([...a]).toEqual(expect.arrayContaining(['mc', 'mf', 'cb']));
  });
  it('desaprobar quita lo que dependía', () => {
    const a = desaprobarConDependientes(pensum, hastaSemestre(pensum, 5), 'mf');
    expect(a.has('adf')).toBe(false);
  });
  it('con I a V aprobados (menos IO) aparecen las de VI', () => {
    const a = hastaSemestre(pensum, 5);
    a.delete('io');
    const ids = disponibles(pensum, a).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['io', 'mtd', 'mc', 'v1', 'b6']));
    expect(ids).not.toContain('ao'); // requiere IO
  });
});

describe('huecos', () => {
  it('el almuerzo no cuenta como hueco', () => {
    expect(huecosDelDia([{ dia: 'Lun', inicio: 10, fin: 12 }, { dia: 'Lun', inicio: 14, fin: 16 }])).toEqual([]);
  });
  it('penalización creciente', () => {
    expect(costoHueco(1)).toBeLessThan(costoHueco(2) / 2);
    expect(costoHueco(4)).toBeGreaterThan(costoHueco(2) * 2);
  });
});

describe('motor', () => {
  it('da 3 opciones sin cruces y dentro del límite de créditos', () => {
    const r = generarHorarios(entrada());
    expect(r.opciones).toHaveLength(3);
    for (const h of r.opciones) {
      expect(sinCruces(h.asignaciones)).toBe(true);
      expect(h.metricas.creditos).toBeLessThanOrEqual(21);
    }
  });

  it('las 3 opciones son distintas en al menos 2 materias', () => {
    const [a, b, c] = generarHorarios(entrada()).opciones;
    const dif = (x: typeof a, y: typeof a) => x.asignaciones.filter((p) => !y.asignaciones.some((q) => q.grupo.nrc === p.grupo.nrc)).length;
    expect(dif(a, b)).toBeGreaterThanOrEqual(2);
    expect(dif(a, c)).toBeGreaterThanOrEqual(2);
    expect(dif(b, c)).toBeGreaterThanOrEqual(2);
  });

  it('respeta la hora mínima y los días bloqueados', () => {
    const r = generarHorarios(entrada({}, { horaMinima: 9, diasBloqueados: ['Vie', 'Sab'] }));
    for (const h of r.opciones) for (const a of h.asignaciones) for (const s of a.grupo.sesiones) {
      expect(s.inicio).toBeGreaterThanOrEqual(9);
      expect(['Vie', 'Sab']).not.toContain(s.dia);
    }
  });

  it('el grupo fijado siempre aparece', () => {
    const fijo = oferta.grupos.find((g) => g.materiaId === 'mtd')!;
    const sol = SOLIC.map((s) => (s.materiaId === 'mtd' ? { ...s, nrcFijado: fijo.nrc } : s));
    for (const h of generarHorarios(entrada({ solicitudes: sol })).opciones) {
      expect(h.asignaciones.find((a) => a.materiaId === 'mtd')?.grupo.nrc).toBe(fijo.nrc);
    }
  });

  it('avisa si dos grupos fijados se cruzan', () => {
    const par = oferta.grupos.filter((g) => g.materiaId === 'mtd').flatMap((g1) =>
      oferta.grupos.filter((g2) => g2.materiaId === 'mc' && gruposSeCruzan(g1, g2)).map((g2) => [g1, g2] as const),
    )[0];
    expect(par).toBeDefined();
    const [g1, g2] = par;
    const sol = SOLIC.map((s) => (s.materiaId === 'mtd' ? { ...s, nrcFijado: g1.nrc } : s.materiaId === 'mc' ? { ...s, nrcFijado: g2.nrc } : s));
    const r = generarHorarios(entrada({ solicitudes: sol }));
    expect(r.avisos.some((a) => a.includes('se cruzan'))).toBe(true);
    expect(r.opciones.length).toBeGreaterThan(0); // nunca deja sin resultados
  });

  it('las selecciones nunca se asignan solas', () => {
    for (const h of generarHorarios(entrada()).opciones) expect(h.asignaciones.some((a) => a.grupo.esSeleccion)).toBe(false);
  });

  it('si declaró selección, queda como bloque fijo', () => {
    const sel = oferta.grupos.find((g) => g.esSeleccion)!;
    for (const h of generarHorarios(entrada({}, { seleccionNrc: sel.nrc })).opciones) {
      expect(h.asignaciones.some((a) => a.grupo.nrc === sel.nrc)).toBe(true);
      expect(sinCruces(h.asignaciones)).toBe(true);
    }
  });

  it('bienestar solo usa las actividades aceptadas', () => {
    for (const h of generarHorarios(entrada()).opciones) {
      const b = h.asignaciones.find((a) => a.materiaId === 'b6');
      if (b) expect(['Tenis', 'Golf']).toContain(b.grupo.actividad);
    }
  });

  it('con profesores como prioridad #1, la opción 1 tiene a los preferidos', () => {
    const prof = primerProfesor('mtd');
    const solicitud: SolicitudMateria = { materiaId: 'mtd', prioridad: 'necesito', profesores: { [prof]: 'preferido' } };
    const [h] = generarHorarios(entrada({ solicitudes: [solicitud] })).opciones;
    expect(h.asignaciones.find((a) => a.materiaId === 'mtd')?.grupo.profesor).toBe(prof);
  });

  it('"Ver otras opciones" no repite horarios', () => {
    const r1 = generarHorarios(entrada());
    const r2 = generarHorarios(entrada({ excluir: r1.opciones.map((h) => h.id) }));
    expect(r2.opciones.length).toBeGreaterThan(0);
    for (const h of r2.opciones) expect(r1.opciones.map((x) => x.id)).not.toContain(h.id);
  });

  it('reglas imposibles no dejan al estudiante sin resultados', () => {
    const r = generarHorarios(entrada({}, { horaMinima: 16 }));
    expect(r.opciones.length).toBeGreaterThan(0);
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  it('es rápido (menos de 1,5 s)', () => {
    const t = performance.now();
    generarHorarios(entrada({}, { diasBloqueados: [] }));
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
