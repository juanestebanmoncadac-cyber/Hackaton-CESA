/**
 * MOTOR DE HORARIOS
 *
 * generarHorarios(entrada) → { opciones, total, avisos }
 *
 * 1. Reglas duras (descartan): cruces, hora mínima, días bloqueados,
 *    grupos fijados (candado), máximo de créditos, selección declarada.
 *    El mínimo de créditos descarta solo si alguna combinación lo alcanza.
 * 2. Búsqueda: backtracking sobre las materias pedidas; cualquiera puede
 *    quedar fuera, pero el puntaje castiga mucho dejar una "necesito".
 * 3. Puntaje por niveles (un nivel alto siempre gana a los de abajo):
 *    "necesito" incluidas > profesores "evitar" no usados > "me gustaría"
 *    incluidas > prioridad principal > las demás prioridades (desempate).
 * 4. Diversidad: las 3 opciones procuran diferenciarse en al menos 2 materias
 *    (si no alcanza, en 1), comparando franjas y actividad, no el NRC.
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
import { NOMBRE_DIA, fmtHora, listaNatural } from './explicar';

export const PESOS_POSICION = [1, 0.75, 0.5, 0.3, 0.15];
export const DIAS_HABILES: Dia[] = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ALMUERZO: [number, number] = [12, 14];
const MAX_NODOS = 400_000;
const MAX_GUARDADOS = 3_000;

// Niveles del puntaje: un nivel alto siempre gana, sin importar los de abajo.
// Cada nivel supera la suma máxima de los de abajo (≤ 9 materias por nivel,
// ≤ 20 escalones × 1.000 en la prioridad principal, desempate < 1.000).
const NIVEL_NECESITO = 10_000_000; // por cada "necesito" que queda fuera
const NIVEL_EVITADO = 1_000_000; // por cada profesor "evitar" usado
const NIVEL_GUSTARIA = 100_000; // por cada "me gustaría" incluida
const NIVEL_PRINCIPAL = 1_000; // por cada escalón de la prioridad principal
// La prioridad principal se compara en escalones de 0,05 (de 0 a 1): dentro
// del mismo escalón, desempatan las demás prioridades.
const ESCALON_PRINCIPAL = 0.05;

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

  // terminar temprano: cuenta la salida promedio y también el día que sale más tarde
  const fines = dias.map((ss) => Math.max(...ss.map((s) => s.fin)));
  const finProm = fines.length ? fines.reduce((acc, f) => acc + f, 0) / fines.length : 12;
  const finMax = fines.length ? Math.max(...fines) : 12;
  const terminarTemprano = 0.6 * clamp((18 - finProm) / 6) + 0.4 * clamp((18 - finMax) / 6);

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

/**
 * La prioridad que manda: la primera del ranking, salvo que "¿Qué no te gustó?"
 * haya subido tanto otra que ahora pese más.
 */
export function criterioPrincipal(pref: Preferencias): Criterio {
  const w = pesos(pref);
  return pref.ranking.reduce((mejor, c) => (w[c] > w[mejor] ? c : mejor), pref.ranking[0]);
}

/**
 * Lo que el estudiante ve de un grupo, sin el NRC: materia, actividad, profesor y franjas.
 * Si cambias este formato (o el de firmaHorario), sube MOTOR_VERSION en
 * src/estado/estado.ts para que se descarten los "vistos" guardados.
 */
function firmaGrupo(materiaId: string, g: Grupo): string {
  const franjas = g.sesiones.map((s) => `${s.dia}${s.inicio.toFixed(2)}-${s.fin.toFixed(2)}`).sort().join(',');
  return `${materiaId}~${g.actividad ?? ''}~${g.profesor ?? ''}~${franjas}`;
}

/** firma estable del horario (Horario.id): grupos clonados con otro NRC dan la misma */
export function firmaHorario(asig: Asignacion[]): string {
  return asig.map((a) => firmaGrupo(a.materiaId, a.grupo)).sort().join('|') || 'vacio';
}

/**
 * Cómo se compara un horario con los ya vistos: un profesor sobre el que el
 * estudiante no opinó no lo hace "nuevo" (misma franja con otro profesor = lo
 * mismo para él). Se calcula desde la firma estable, así que si el estudiante
 * opina después (p. ej. "evitar"), los horarios vistos se siguen reconociendo.
 */
export function firmaParaComparar(id: string, conOpinion: Set<string>): string {
  return id.split('|').map((parte) => {
    const [materia, actividad, profe, franjas] = parte.split('~');
    return `${materia}~${actividad}~${profe && conOpinion.has(profe) ? profe : ''}~${franjas}`;
  }).sort().join('|');
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
  const principal = criterioPrincipal(pref);
  // rango de créditos (valores inválidos caen al límite del pensum, nunca a "sin límite")
  const maxCreditos = Number.isFinite(pref.limiteCreditos) ? pref.limiteCreditos : pensum.limiteCreditosSemestre;
  const minCreditos = Math.min(Number.isFinite(pref.creditosMinimos) ? pref.creditosMinimos! : 0, maxCreditos);

  // Selección deportiva: bloque fijo, solo si el estudiante la declaró.
  // Se incluye siempre (quitarla dejaría poner clases encima del entrenamiento);
  // si choca con su hora mínima o un día bloqueado, se le avisa.
  const fijosBase: Asignacion[] = [];
  if (pref.seleccionNrc) {
    const sel = oferta.grupos.find((g) => g.nrc === pref.seleccionNrc && g.esSeleccion);
    if (sel) {
      fijosBase.push({ materiaId: 'SELECCION', grupo: sel });
      const choques = sel.sesiones.filter((x) => x.inicio < pref.horaMinima || pref.diasBloqueados.includes(x.dia));
      if (choques.length) {
        const cuando = listaNatural(choques.map((x) => `el ${NOMBRE_DIA[x.dia]} a las ${fmtHora(x.inicio)}`));
        avisos.push(`Tu ${sel.actividad?.toLowerCase() ?? 'selección'} entrena ${cuando}, que es antes de tu hora mínima o un día que bloqueaste. Dejamos el entrenamiento en tu horario porque es fijo; revisa esas restricciones.`);
      }
    } else avisos.push('La selección deportiva que indicaste no está en la oferta.');
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
  let necesitoFuera = 0; // "necesito" dejadas fuera en la rama actual
  let mejorNecesitoFuera = Infinity; // lo mínimo logrado en una combinación completa
  let conMinimo = 0; // combinaciones que alcanzan el mínimo de créditos

  const opcionalPorId = new Map(ranuras.map((r) => [r.materia.id, r.opcional]));

  // Puntaje por niveles (ver NIVEL_*): necesito > evitar > me gustaría > prioridad principal > desempate.
  const puntuar = (): number => {
    const m = calcularMetricas(actual, solicitudes, pensumPorId);
    const sat = satisfaccion(actual, m, pref);
    const gustariaIncluidas = actual.filter((a) => opcionalPorId.get(a.materiaId)).length;
    const escalon = Math.round(sat[principal] / ESCALON_PRINCIPAL);
    let desempate = sat[principal]; // dentro del mismo escalón, más cerca de lo ideal es mejor
    (Object.keys(w) as Criterio[]).forEach((c) => { if (c !== principal) desempate += w[c] * sat[c]; });
    return -NIVEL_NECESITO * necesitoFuera - NIVEL_EVITADO * m.profesEvitadosUsados
      + NIVEL_GUSTARIA * gustariaIncluidas + NIVEL_PRINCIPAL * escalon + desempate;
  };

  const guardar = () => {
    total++;
    mejorNecesitoFuera = Math.min(mejorNecesitoFuera, necesitoFuera);
    // Bajo el mínimo de créditos: solo sirve de respaldo mientras nada lo cumpla.
    // La primera combinación que lo cumple descarta los respaldos guardados.
    const cumpleMinimo = creditos >= minCreditos;
    if (!cumpleMinimo && conMinimo > 0) return;
    if (cumpleMinimo) {
      if (conMinimo === 0 && minCreditos > 0) {
        guardados.length = 0;
        peorGuardado = -Infinity;
      }
      conMinimo++;
    }
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
    // poda: esta rama ya deja fuera más "necesito" que la mejor combinación encontrada
    if (necesitoFuera > mejorNecesitoFuera) return;
    if (i === ranuras.length) return guardar();
    const r = ranuras[i];
    const cr = r.materia.creditos;
    for (const g of r.candidatos) {
      if (creditos + cr > maxCreditos) break;
      if (actual.some((a) => gruposSeCruzan(a.grupo, g))) continue;
      actual.push({ materiaId: r.materia.id, grupo: g });
      creditos += cr;
      bt(i + 1);
      creditos -= cr;
      actual.pop();
    }
    // dejar la materia fuera (a veces sacar una "necesito" deja entrar a otras dos)
    fuera.push(r.materia.id);
    if (!r.opcional) necesitoFuera++;
    bt(i + 1);
    if (!r.opcional) necesitoFuera--;
    fuera.pop();
  };
  bt(0);

  if (nodos > MAX_NODOS) avisos.push('Hay demasiadas combinaciones; mostramos las mejores que encontramos.');
  if (minCreditos > 0 && conMinimo === 0 && guardados.length) {
    avisos.push(`Ninguna combinación llega a ${minCreditos} créditos con tus materias y reglas. Te mostramos las más cercanas.`);
  }

  guardados.sort((a, b) => b.puntaje - a.puntaje);

  const construir = (g: (typeof guardados)[number]): Horario => {
    const id = firmaHorario(g.asig);
    return { id, asignaciones: g.asig, puntaje: Math.round(g.puntaje * 1000) / 1000, metricas: calcularMetricas(g.asig, solicitudes, pensumPorId), materiasFuera: g.fuera };
  };

  // quitar duplicados y los ya mostrados, comparando como los ve el estudiante hoy
  const conOpinion = new Set(solicitudes.flatMap((s) => Object.keys(s.profesores)));
  const vistos = new Set([...excluir].map((id) => firmaParaComparar(id, conOpinion)));
  const unicos: Horario[] = [];
  for (const g of guardados) {
    const h = construir(g);
    const f = firmaParaComparar(h.id, conOpinion);
    if (vistos.has(f)) continue;
    vistos.add(f);
    unicos.push(h);
  }

  const opciones = elegirDiversas(unicos, cuantas);

  // las que no tenían ningún grupo válido ya tienen su aviso (candidatosDe): no se repite
  const sinGrupos = new Set(ranuras.filter((r) => !r.candidatos.length).map((r) => r.materia.id));
  const necesitoFueraOpcion1 = opciones[0]?.materiasFuera.filter((id) => opcionalPorId.get(id) === false && !sinGrupos.has(id)) ?? [];
  for (const id of necesitoFueraOpcion1) {
    avisos.push(`No fue posible incluir ${pensumPorId.get(id)?.nombre} sin romper tus reglas (cruces, horario o créditos).`);
  }
  const gustariaFuera = opciones[0]?.materiasFuera.filter((id) => opcionalPorId.get(id) && !sinGrupos.has(id)) ?? [];
  if (gustariaFuera.length) {
    const nombres = gustariaFuera.map((id) => pensumPorId.get(id)?.nombre ?? id);
    avisos.push(`La opción 1 no incluye ${listaNatural(nombres)} ("Me gustaría"): se cruza con otra materia, pasa tu máximo de créditos o solo cabía con un profesor que quieres evitar.`);
  }

  return { opciones, total, avisos: [...new Set(avisos)] };
}

/** diferencia = número de materias en otra franja o actividad (o presencia distinta) */
export function diferencia(a: Horario, b: Horario): number {
  const vista = (g: Grupo) => `${g.actividad ?? ''}@${g.sesiones.map((s) => `${s.dia}${s.inicio}`).sort().join(',')}`;
  const ma = new Map(a.asignaciones.map((x) => [x.materiaId, vista(x.grupo)]));
  const mb = new Map(b.asignaciones.map((x) => [x.materiaId, vista(x.grupo)]));
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
 * Antes busca entre las cercanas a la mejor (puntaje a menos de 3 escalones de
 * la prioridad principal: mismos niveles de necesito, evitar y me gustaría),
 * para que la diversidad no traiga horarios que incumplen lo que puso primero.
 */
export function elegirDiversas(lista: Horario[], n: number): Horario[] {
  const reglas: ((e: Horario, h: Horario) => boolean)[] = [
    (e, h) => diferencia(e, h) >= 2 && perfil(e) !== perfil(h),
    (e, h) => diferencia(e, h) >= 2,
    (e, h) => diferencia(e, h) >= 1,
  ];
  const mejor = lista[0]?.puntaje ?? 0;
  const zonas: ((h: Horario) => boolean)[] = [(h) => mejor - h.puntaje < 3 * NIVEL_PRINCIPAL, () => true];
  const elegidas: Horario[] = [];
  for (const zona of zonas) for (const regla of reglas) {
    for (const h of lista) {
      if (elegidas.length === n) break;
      if (elegidas.includes(h) || !zona(h)) continue;
      if (elegidas.every((e) => regla(e, h))) elegidas.push(h);
    }
  }
  return elegidas.sort((a, b) => b.puntaje - a.puntaje);
}
