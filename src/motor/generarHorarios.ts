/**
 * MOTOR DE HORARIOS
 *
 * generarHorarios(entrada) → { opciones, total, avisos }
 *
 * 1. Reglas duras (descartan): cruces, hora mínima, días bloqueados,
 *    grupos fijados (candado), límite de créditos, selección declarada.
 * 2. Búsqueda: backtracking sobre las materias pedidas; las "me gustaría"
 *    pueden quedar fuera, las "necesito" solo si no hay otra salida.
 * 3. Puntaje: preferencias suaves ponderadas por el ranking del estudiante.
 * 4. Diversidad: las 3 opciones se diferencian en al menos 2 materias.
 *
 * No usa red ni IA: es gratis, instantáneo y garantiza cero cruces.
 */
import type {
  Asignacion,
  Criterio,
  Dia,
  EntradaMotor,
  Grupo,
  Horario,
  Materia,
  Metricas,
  Preferencias,
  ResultadoMotor,
  Sesion,
  SolicitudMateria,
} from '../types';

export const PESOS_POSICION = [1, 0.75, 0.5, 0.3, 0.15];
export const DIAS_HABILES: Dia[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ALMUERZO: [number, number] = [12, 14];
const MAX_NODOS = 400_000;
const MAX_GUARDADOS = 3_000;

const BONO_GUSTARIA = 0.8; // por cada "me gustaría" incluida
const CASTIGO_NECESITO = 6; // por cada "necesito" que queda fuera
const CASTIGO_EVITADO = 0.7; // por cada profesor "evitar" usado

// ───────────────────────── utilidades de tiempo ─────────────────────────

export function seCruzan(a: Sesion, b: Sesion): boolean {
  return a.dia === b.dia && a.inicio < b.fin && b.inicio < a.fin;
}

export function gruposSeCruzan(a: Grupo, b: Grupo): boolean {
  return a.sesiones.some((s) => b.sesiones.some((t) => seCruzan(s, t)));
}

/** horas de hueco en un día (sin contar la franja de almuerzo) */
export function huecosDelDia(sesiones: Sesion[]): number[] {
  const ord = [...sesiones].sort((a, b) => a.inicio - b.inicio);
  const huecos: number[] = [];
  for (let i = 1; i < ord.length; i++) {
    const ini = ord[i - 1].fin;
    const fin = ord[i].inicio;
    if (fin <= ini) continue;
    const solapeAlmuerzo = Math.max(0, Math.min(fin, ALMUERZO[1]) - Math.max(ini, ALMUERZO[0]));
    const h = fin - ini - solapeAlmuerzo;
    if (h > 0.01) huecos.push(h);
  }
  return huecos;
}

/** penalización creciente: 1 h casi no pesa, más de 3 h pesa mucho */
export function costoHueco(h: number): number {
  if (h <= 1) return 0.25 * h;
  if (h <= 3) return 0.25 + 0.6 * (h - 1);
  return 1.45 + 1.2 * (h - 3);
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// ───────────────────────── métricas y puntaje ─────────────────────────

export function calcularMetricas(asig: Asignacion[], solicitudes: SolicitudMateria[], pensumPorId: Map<string, Materia>): Metricas {
  const porDia = new Map<Dia, Sesion[]>();
  let creditos = 0;
  let entrada: number | null = null;
  let salida: number | null = null;
  for (const a of asig) {
    creditos += pensumPorId.get(a.materiaId)?.creditos ?? 0;
    for (const s of a.grupo.sesiones) {
      if (!porDia.has(s.dia)) porDia.set(s.dia, []);
      porDia.get(s.dia)!.push(s);
      entrada = entrada === null ? s.inicio : Math.min(entrada, s.inicio);
      salida = salida === null ? s.fin : Math.max(salida, s.fin);
    }
  }
  let horasHueco = 0;
  porDia.forEach((ss) => huecosDelDia(ss).forEach((h) => (horasHueco += h)));
  const diasLibres = DIAS_HABILES.filter((d) => !porDia.has(d));

  let total = 0;
  let cumplidos = 0;
  let evitados = 0;
  const solPorMateria = new Map(solicitudes.map((s) => [s.materiaId, s]));
  for (const s of solicitudes) {
    if (Object.values(s.profesores).includes('preferido')) total++;
  }
  for (const a of asig) {
    const s = solPorMateria.get(a.materiaId);
    if (!s || !a.grupo.profesor) continue;
    const op = s.profesores[a.grupo.profesor];
    if (op === 'preferido') cumplidos++;
    if (op === 'evitar') evitados++;
  }
  return {
    creditos,
    entradaMasTemprana: entrada,
    salidaMasTarde: salida,
    horasHueco: Math.round(horasHueco * 10) / 10,
    diasLibres,
    profesPreferidos: { cumplidos, total },
    profesEvitadosUsados: evitados,
  };
}

/** satisfacción de 0 a 1 de cada criterio */
export function satisfaccion(asig: Asignacion[], m: Metricas, pref: Preferencias): Record<Criterio, number> {
  const porDia = new Map<Dia, Sesion[]>();
  for (const a of asig) for (const s of a.grupo.sesiones) {
    if (!porDia.has(s.dia)) porDia.set(s.dia, []);
    porDia.get(s.dia)!.push(s);
  }
  const dias = [...porDia.values()];

  // huecos
  const factor = pref.toleranciaHuecos === 'max1' ? 1.6 : pref.toleranciaHuecos === 'hasta2' ? 1 : 0.3;
  let costo = 0;
  for (const ss of dias) for (const h of huecosDelDia(ss)) {
    costo += costoHueco(h);
    if (pref.toleranciaHuecos === 'max1' && h > 1) costo += 0.8;
    if (pref.toleranciaHuecos === 'hasta2' && h > 2) costo += 0.6;
  }
  const huecos = 1 / (1 + (costo * factor) / 1.2);

  // madrugar: cada día que empieza temprano resta
  const madrugon = (h: number) => (h < 8 ? 1 : h < 9 ? 0.55 : h < 10 ? 0.2 : 0);
  const noMadrugar = dias.length ? 1 - dias.reduce((acc, ss) => acc + madrugon(Math.min(...ss.map((s) => s.inicio))), 0) / dias.length : 1;

  // terminar temprano
  const finProm = dias.length ? dias.reduce((acc, ss) => acc + Math.max(...ss.map((s) => s.fin)), 0) / dias.length : 12;
  const terminarTemprano = clamp((18 - finProm) / 6);

  // días libres (de lunes a viernes, sin contar los bloqueados por el estudiante)
  const libres = m.diasLibres.filter((d) => !pref.diasBloqueados.includes(d)).length;
  const diasLibres = libres >= 2 ? 1 : libres === 1 ? 0.7 : 0;

  const profesores = m.profesPreferidos.total ? m.profesPreferidos.cumplidos / m.profesPreferidos.total : 1;

  return { profesores, huecos, noMadrugar, terminarTemprano, diasLibres };
}

export function pesos(pref: Preferencias): Record<Criterio, number> {
  const w = {} as Record<Criterio, number>;
  pref.ranking.forEach((c, i) => {
    w[c] = (PESOS_POSICION[i] ?? 0.1) * (pref.ajustes?.[c] ?? 1);
  });
  return w;
}

// ───────────────────────── candidatos por materia ─────────────────────────

interface Ranura {
  materia: Materia;
  solicitud: SolicitudMateria;
  candidatos: Grupo[];
  opcional: boolean; // puede quedar fuera
}

function candidatosDe(m: Materia, s: SolicitudMateria, entrada: EntradaMotor, avisos: string[]): Grupo[] {
  const { oferta, preferencias: p } = entrada;
  let base: Grupo[];
  if (m.tipo === 'bienestar') base = oferta.grupos.filter((g) => g.materiaId === 'BIENESTAR');
  else if (m.tipo === 'electivaSH') base = oferta.grupos.filter((g) => g.materiaId === 'ELECTIVA_SH');
  else base = oferta.grupos.filter((g) => g.materiaId === m.id);

  if (s.nrcFijado) {
    const fijo = base.find((g) => g.nrc === s.nrcFijado);
    if (fijo) {
      if (fijo.sesiones.every((x) => x.inicio >= p.horaMinima && !p.diasBloqueados.includes(x.dia))) return [fijo];
      avisos.push(`El grupo fijado de ${m.nombre} incumple tu hora mínima o un día bloqueado. Quita el candado o cambia esa restricción.`);
      return [];
    }
    avisos.push(`El grupo fijado de ${m.nombre} ya no está en la oferta; buscamos otros.`);
  }
  if ((m.tipo === 'bienestar' || m.tipo === 'electivaSH') && s.actividades?.length) {
    base = base.filter((g) => g.actividad && s.actividades!.includes(g.actividad));
  }
  const validos = base.filter(
    (g) => g.sesiones.every((x) => x.inicio >= p.horaMinima && !p.diasBloqueados.includes(x.dia)),
  );
  if (!validos.length && base.length) {
    avisos.push(`${m.nombre}: ningún grupo cumple tu hora de entrada o tus días disponibles.`);
  } else if (!base.length) {
    avisos.push(`${m.nombre} no tiene grupos abiertos en la oferta ${oferta.periodo}.`);
  }
  return validos;
}

// ───────────────────────── búsqueda ─────────────────────────

export function generarHorarios(entrada: EntradaMotor): ResultadoMotor {
  const { solicitudes, oferta, preferencias: pref, pensum } = entrada;
  const cuantas = entrada.cuantas ?? 3;
  const excluir = new Set(entrada.excluir ?? []);
  const avisos: string[] = [];
  const pensumPorId = new Map(pensum.materias.map((m) => [m.id, m]));
  const w = pesos(pref);

  // Selección deportiva: bloque fijo, solo si el estudiante la declaró
  const fijosBase: Asignacion[] = [];
  if (pref.seleccionNrc) {
    const sel = oferta.grupos.find((g) => g.nrc === pref.seleccionNrc && g.esSeleccion);
    if (sel) fijosBase.push({ materiaId: 'SELECCION', grupo: sel });
    else avisos.push('La selección deportiva que indicaste no está en la oferta.');
  }

  const ranuras: Ranura[] = [];
  for (const s of solicitudes) {
    const m = pensumPorId.get(s.materiaId);
    if (!m) continue;
    if (m.tipo === 'sinHorario') {
      avisos.push(`${m.nombre} no ocupa franja semanal: se inscribe aparte.`);
      continue;
    }
    const candidatos = candidatosDe(m, s, entrada, avisos);
    ranuras.push({ materia: m, solicitud: s, candidatos, opcional: s.prioridad === 'gustaria' });
  }

  // Aviso inmediato: grupos fijados que se cruzan entre sí
  const fijados = ranuras.filter((r) => r.solicitud.nrcFijado && r.candidatos.length === 1);
  for (let i = 0; i < fijados.length; i++) for (let j = i + 1; j < fijados.length; j++) {
    if (gruposSeCruzan(fijados[i].candidatos[0], fijados[j].candidatos[0])) {
      avisos.push(`Los grupos fijados de ${fijados[i].materia.nombre} y ${fijados[j].materia.nombre} se cruzan. Quita uno de los candados.`);
    }
  }

  // Orden: primero las más restringidas (menos candidatos), "necesito" antes que "me gustaría"
  ranuras.sort((a, b) => Number(a.opcional) - Number(b.opcional) || a.candidatos.length - b.candidatos.length);

  const guardados: { asig: Asignacion[]; fuera: string[]; puntaje: number }[] = [];
  let peorGuardado = -Infinity;
  let total = 0;
  let nodos = 0;
  const actual: Asignacion[] = [...fijosBase];
  const fuera: string[] = [];
  let creditos = 0;

  const puntuar = (): number => {
    const m = calcularMetricas(actual, solicitudes, pensumPorId);
    const sat = satisfaccion(actual, m, pref);
    let p = 0;
    (Object.keys(w) as Criterio[]).forEach((c) => (p += w[c] * sat[c]));
    for (const a of actual) {
      const r = ranuras.find((x) => x.materia.id === a.materiaId);
      if (r?.opcional) p += BONO_GUSTARIA;
    }
    for (const id of fuera) {
      const r = ranuras.find((x) => x.materia.id === id);
      if (r && !r.opcional) p -= CASTIGO_NECESITO;
    }
    p -= CASTIGO_EVITADO * m.profesEvitadosUsados;
    return p;
  };

  const guardar = () => {
    total++;
    const puntaje = puntuar();
    if (guardados.length >= MAX_GUARDADOS && puntaje <= peorGuardado) return;
    guardados.push({ asig: [...actual], fuera: [...fuera], puntaje });
    if (guardados.length > MAX_GUARDADOS * 1.5) {
      guardados.sort((a, b) => b.puntaje - a.puntaje);
      guardados.length = MAX_GUARDADOS;
      peorGuardado = guardados[guardados.length - 1].puntaje;
    }
  };

  const bt = (i: number) => {
    if (++nodos > MAX_NODOS) return;
    if (i === ranuras.length) return guardar();
    const r = ranuras[i];
    const cr = r.materia.creditos;
    for (const g of r.candidatos) {
      if (creditos + cr > pref.limiteCreditos) break;
      if (actual.some((a) => gruposSeCruzan(a.grupo, g))) continue;
      actual.push({ materiaId: r.materia.id, grupo: g });
      creditos += cr;
      bt(i + 1);
      creditos -= cr;
      actual.pop();
    }
    // dejar la materia fuera: siempre posible para "me gustaría"; para "necesito" es el último recurso
    fuera.push(r.materia.id);
    bt(i + 1);
    fuera.pop();
  };
  bt(0);

  if (nodos > MAX_NODOS) avisos.push('Hay demasiadas combinaciones; mostramos las mejores que encontramos.');

  guardados.sort((a, b) => b.puntaje - a.puntaje);

  const construir = (g: (typeof guardados)[number]): Horario => {
    const id = g.asig.map((a) => a.grupo.nrc).sort().join('-') || 'vacio';
    return { id, asignaciones: g.asig, puntaje: Math.round(g.puntaje * 1000) / 1000, metricas: calcularMetricas(g.asig, solicitudes, pensumPorId), materiasFuera: g.fuera };
  };

  // quitar duplicados y los ya mostrados
  const vistos = new Set<string>();
  const unicos: Horario[] = [];
  for (const g of guardados) {
    const h = construir(g);
    if (vistos.has(h.id) || excluir.has(h.id)) continue;
    vistos.add(h.id);
    unicos.push(h);
  }

  const opciones = elegirDiversas(unicos, cuantas);

  const necesitoFuera = opciones[0]?.materiasFuera.filter((id) => !ranuras.find((r) => r.materia.id === id)?.opcional) ?? [];
  for (const id of necesitoFuera) {
    avisos.push(`No fue posible incluir ${pensumPorId.get(id)?.nombre} sin romper tus reglas (cruces, horario o créditos).`);
  }

  return { opciones, total, avisos: [...new Set(avisos)] };
}

/** diferencia = número de materias con grupo distinto (o presencia distinta) */
export function diferencia(a: Horario, b: Horario): number {
  const ma = new Map(a.asignaciones.map((x) => [x.materiaId, x.grupo.nrc]));
  const mb = new Map(b.asignaciones.map((x) => [x.materiaId, x.grupo.nrc]));
  const ids = new Set([...ma.keys(), ...mb.keys()]);
  let d = 0;
  ids.forEach((id) => { if (ma.get(id) !== mb.get(id)) d++; });
  return d;
}

/** "perfil" del horario: lo que el estudiante nota a simple vista */
export function perfil(h: Horario): string {
  const m = h.metricas;
  return [m.entradaMasTemprana, m.diasLibres.join(','), Math.round(m.horasHueco), m.profesPreferidos.cumplidos].join('|');
}

/**
 * Toma las mejores del ranking cuidando que se vean distintas:
 * primero exige perfil distinto y ≥2 materias diferentes; si no alcanza, relaja.
 */
export function elegirDiversas(lista: Horario[], n: number): Horario[] {
  const reglas: ((e: Horario, h: Horario) => boolean)[] = [
    (e, h) => diferencia(e, h) >= 2 && perfil(e) !== perfil(h),
    (e, h) => diferencia(e, h) >= 2,
    (e, h) => diferencia(e, h) >= 1,
  ];
  const elegidas: Horario[] = [];
  for (const regla of reglas) {
    for (const h of lista) {
      if (elegidas.length === n) break;
      if (elegidas.includes(h)) continue;
      if (elegidas.every((e) => regla(e, h))) elegidas.push(h);
    }
  }
  return elegidas.sort((a, b) => b.puntaje - a.puntaje);
}
