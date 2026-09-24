import { describe, expect, it } from 'vitest';
import pensumJson from '../datos/pensum.json';
import ofertaJson from '../datos/oferta.json';
import type { EntradaMotor, Horario, Oferta, Pensum, Preferencias, SolicitudMateria } from '../types';
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
      if (!['v1', 'v2'].includes(g.materiaId)) {
        expect(bloques.has(`${fmt(s.inicio)}-${fmt(s.fin)}`)).toBe(true);
      }
    }
  });
  it.skipIf(oferta.fuente !== 'simulada')('aplica la frecuencia semanal y los horarios fijos acordados', () => {
    const tresEncuentros = new Set(['ma1', 'ep', 'ea', 'mf']);
    const unEncuentro = new Set(['v1', 'v2', 'i1', 'i2', 'i3', 'i4']); // Idiomas se ve una vez por semana
    for (const grupo of oferta.grupos.filter((g) => g.tipo === 'regular')) {
      const esperados = unEncuentro.has(grupo.materiaId) ? 1 : tresEncuentros.has(grupo.materiaId) ? 3 : 2;
      expect(grupo.sesiones).toHaveLength(esperados);
      if (grupo.materiaId === 'v1') {
        expect(grupo.sesiones[0]).toMatchObject({ dia: 'Mar', inicio: 8, fin: 12 + 10 / 60 });
      }
      if (grupo.materiaId === 'v2') {
        expect(grupo.sesiones[0]).toMatchObject({ dia: 'Mie', inicio: 8, fin: 13 + 40 / 60 });
      }
      if (grupo.materiaId === 'pie') {
        expect(grupo.sesiones.map(({ dia, inicio, fin }) => ({ dia, inicio, fin }))).toEqual([
          { dia: 'Mar', inicio: 14, fin: 15.5 },
          { dia: 'Jue', inicio: 14, fin: 15.5 },
        ]);
      }
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

describe('motor con oferta mínima', () => {
  it('deja fuera la "necesito" que bloquea a otras dos, no a las dos', () => {
    // A (lun y mar 8:00) choca con B (lun 8:00) y con C (mar 8:00); lo mejor es sacar solo A
    const grupo = (nrc: string, materiaId: string, dias: ('Lun' | 'Mar')[]) => ({
      nrc, materiaId, grupo: 'Grupo 1', profesor: nrc, tipo: 'regular' as const, esSeleccion: false, cupos: 30,
      sesiones: dias.map((dia) => ({ dia, inicio: 8, fin: 9.5 })),
    });
    const mini: Oferta = { periodo: 'prueba', generadoEn: '', fuente: 'simulada', grupos: [grupo('A1', 'mtd', ['Lun', 'Mar']), grupo('B1', 'mc', ['Lun']), grupo('C1', 'io', ['Mar'])] };
    const sol: SolicitudMateria[] = ['mtd', 'mc', 'io'].map((materiaId) => ({ materiaId, prioridad: 'necesito', profesores: {} }));
    const [h] = generarHorarios({ solicitudes: sol, oferta: mini, pensum, preferencias: PREF }).opciones;
    expect(h.materiasFuera).toEqual(['mtd']);
  });
});

describe.skipIf(oferta.fuente !== 'simulada')('motor con escenario de prueba', () => {
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
    // se compara lo que el estudiante ve (materia y franjas), no el NRC
    const ve = (p: (typeof a)['asignaciones'][number]) => `${p.materiaId}:${p.grupo.sesiones.map((s) => `${s.dia}${s.inicio}`).join()}`;
    const dif = (x: typeof a, y: typeof a) => x.asignaciones.filter((p) => !y.asignaciones.some((q) => ve(q) === ve(p))).length;
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
    const fijo = generarHorarios(entrada()).opciones[0].asignaciones.find((a) => a.materiaId === 'mtd')!.grupo;
    const sol = SOLIC.map((s) => (s.materiaId === 'mtd' ? { ...s, nrcFijado: fijo.nrc } : s));
    for (const h of generarHorarios(entrada({ solicitudes: sol })).opciones) {
      expect(h.asignaciones.find((a) => a.materiaId === 'mtd')?.grupo.nrc).toBe(fijo.nrc);
    }
  });

  it('un grupo fijado no ignora la hora mínima', () => {
    const fijo = oferta.grupos.find((g) => g.materiaId === 'mtd' && g.sesiones.some((s) => s.inicio < 9))!;
    const sol: SolicitudMateria = { materiaId: 'mtd', prioridad: 'necesito', profesores: {}, nrcFijado: fijo.nrc };
    const resultado = generarHorarios(entrada({ solicitudes: [sol] }, { horaMinima: 9 }));
    expect(resultado.avisos.some((a) => a.includes('incumple tu hora mínima'))).toBe(true);
    expect(resultado.opciones.every((h) => !h.asignaciones.some((a) => a.grupo.nrc === fijo.nrc))).toBe(true);
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

  it('"Ver otras opciones" no muestra grupos clonados como opciones nuevas', () => {
    // v1 tiene varios grupos a la misma hora; cambiar solo el NRC no cuenta como horario nuevo
    const franjas = (h: Horario) => h.asignaciones.map((a) => `${a.materiaId}:${a.grupo.sesiones.map((s) => `${s.dia}${s.inicio}`).join()}`).sort().join('|');
    let vistos: string[] = [];
    const mostradas: string[] = [];
    for (let ronda = 0; ronda < 4; ronda++) {
      const r = generarHorarios(entrada({ excluir: vistos }));
      vistos = [...vistos, ...r.opciones.map((h) => h.id)];
      mostradas.push(...r.opciones.map(franjas));
    }
    expect(new Set(mostradas).size).toBe(mostradas.length);
  });

  it('la prioridad principal manda: con "terminar temprano" primero se sale antes, sin perder materias', () => {
    const fines = (h: Horario) => {
      const fin = new Map<string, number>();
      for (const a of h.asignaciones) for (const s of a.grupo.sesiones) fin.set(s.dia, Math.max(fin.get(s.dia) ?? 0, s.fin));
      return [...fin.values()];
    };
    const promedio = (h: Horario) => fines(h).reduce((x, y) => x + y, 0) / fines(h).length;
    const [porDefecto] = generarHorarios(entrada()).opciones;
    const temprano = generarHorarios(entrada({}, { ranking: ['terminarTemprano', 'profesores', 'huecos', 'noMadrugar', 'diasLibres'] })).opciones;
    expect(temprano).toHaveLength(3);
    expect(promedio(temprano[0])).toBeLessThan(promedio(porDefecto));
    for (const h of temprano) {
      expect(Math.max(...fines(h))).toBeLessThanOrEqual(Math.max(...fines(porDefecto)));
      expect(h.materiasFuera).toEqual([]); // las "me gustaría" que caben no se sacrifican
    }
  });

  it('marcar un profesor para "evitar" entre rondas no repite horarios ni lo deja', () => {
    const r1 = generarHorarios(entrada());
    const profe = r1.opciones[0].asignaciones.find((a) => a.materiaId === 'io')!.grupo.profesor!;
    const sol = SOLIC.map((s) => (s.materiaId === 'io' ? { ...s, profesores: { ...s.profesores, [profe]: 'evitar' as const } } : s));
    const r2 = generarHorarios(entrada({ solicitudes: sol, excluir: r1.opciones.map((h) => h.id) }));
    expect(r2.opciones.length).toBeGreaterThan(0);
    for (const h of r2.opciones) {
      expect(r1.opciones.map((x) => x.id)).not.toContain(h.id);
      expect(h.asignaciones.some((a) => a.grupo.profesor === profe)).toBe(false);
    }
  });

  it('una "necesito" no queda fuera si le cabe algún grupo', () => {
    for (const ranking of [PREF.ranking, ['terminarTemprano', 'diasLibres', 'huecos', 'noMadrugar', 'profesores'] as Preferencias['ranking']]) {
      for (const h of generarHorarios(entrada({}, { ranking })).opciones) {
        const necesito = SOLIC.filter((s) => s.prioridad === 'necesito').map((s) => s.materiaId);
        expect(h.materiasFuera.filter((id) => necesito.includes(id))).toEqual([]);
      }
    }
  });

  it('respeta el rango de créditos elegido', () => {
    for (const h of generarHorarios(entrada({}, { creditosMinimos: 15, ranking: ['terminarTemprano', 'profesores', 'huecos', 'noMadrugar', 'diasLibres'] })).opciones) {
      expect(h.metricas.creditos).toBeGreaterThanOrEqual(15);
    }
    for (const h of generarHorarios(entrada({}, { limiteCreditos: 12 })).opciones) {
      expect(h.metricas.creditos).toBeLessThanOrEqual(12);
    }
  });

  it('si ninguna combinación llega al mínimo de créditos, avisa y muestra las más cercanas', () => {
    const r = generarHorarios(entrada({}, { creditosMinimos: 30, limiteCreditos: 30 }));
    expect(r.opciones.length).toBeGreaterThan(0);
    expect(r.avisos.some((a) => a.includes('Ninguna combinación llega a 30 créditos'))).toBe(true);
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
