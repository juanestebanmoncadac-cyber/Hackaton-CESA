/**
 * Explicación en lenguaje natural de cada horario ("¿Por qué este?").
 * Versión sin IA (plantillas). Si se configura GEMINI_API_KEY en Vercel,
 * el frontend puede pedir una versión más natural a /api/explicar.
 */
import type { Criterio, Dia, Horario, Pensum, Preferencias } from '../types';

export const NOMBRE_DIA: Record<Dia, string> = { Lun: 'lunes', Mar: 'martes', Mie: 'miércoles', Jue: 'jueves', Vie: 'viernes', Sab: 'sábado' };
export const CORTO_DIA: Record<Dia, string> = { Lun: 'Lun', Mar: 'Mar', Mie: 'Mié', Jue: 'Jue', Vie: 'Vie', Sab: 'Sáb' };

export const ETIQUETA_CRITERIO: Record<Criterio, string> = {
  profesores: 'Tener mis profesores preferidos',
  huecos: 'Días compactos, pocos huecos',
  noMadrugar: 'No madrugar',
  diasLibres: 'Tener días libres',
  terminarTemprano: 'Terminar temprano',
};

export function fmtHora(h: number): string {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return `${H}:${String(M).padStart(2, '0')}`;
}

export function fmtHoraLarga(h: number): string {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  const h12 = H > 12 ? H - 12 : H;
  return `${h12}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`;
}

export function listaNatural(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}

export function metricasVisibles(h: Horario): { label: string; value: string }[] {
  const m = h.metricas;
  const libres = m.diasLibres.map((d) => NOMBRE_DIA[d]);
  return [
    { label: 'Entrada', value: m.entradaMasTemprana === null ? '—' : fmtHoraLarga(m.entradaMasTemprana) },
    { label: 'Huecos', value: `${m.horasHueco.toString().replace('.', ',')} h / semana` },
    { label: 'Días libres', value: libres.length ? cap(listaNatural(libres)) : 'Ninguno' },
    { label: 'Profes preferidos', value: m.profesPreferidos.total ? `${m.profesPreferidos.cumplidos} de ${m.profesPreferidos.total}` : 'Sin preferencia' },
  ];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function explicar(h: Horario, pref: Preferencias, pensum: Pensum, mejor?: Horario): string {
  const m = h.metricas;
  const frases: string[] = [];
  const top = pref.ranking.slice(0, 3);

  for (const c of top) {
    if (c === 'profesores' && m.profesPreferidos.total) {
      frases.push(
        m.profesPreferidos.cumplidos === m.profesPreferidos.total
          ? `tienes a tus ${m.profesPreferidos.total === 1 ? 'profesor preferido' : m.profesPreferidos.total + ' profesores preferidos'}`
          : `tienes ${m.profesPreferidos.cumplidos} de tus ${m.profesPreferidos.total} profesores preferidos`,
      );
    }
    if (c === 'huecos') frases.push(m.horasHueco === 0 ? 'no tienes huecos' : `solo tienes ${m.horasHueco.toString().replace('.', ',')} h de hueco en la semana`);
    if (c === 'noMadrugar' && m.entradaMasTemprana !== null) frases.push(`nunca entras antes de las ${fmtHora(m.entradaMasTemprana)}`);
    if (c === 'diasLibres') {
      const libres = m.diasLibres.filter((d) => !pref.diasBloqueados.includes(d)).map((d) => NOMBRE_DIA[d]);
      frases.push(libres.length ? `te queda${libres.length > 1 ? 'n' : ''} libre${libres.length > 1 ? 's' : ''} ${listaNatural(libres)}` : 'vas todos los días hábiles');
    }
    if (c === 'terminarTemprano' && m.salidaMasTarde !== null) frases.push(`sales a más tardar a las ${fmtHora(m.salidaMasTarde)}`);
  }

  let texto = cap(listaNatural(frases.filter(Boolean))) + '.';

  if (m.profesEvitadosUsados) texto += ` Ojo: incluye ${m.profesEvitadosUsados === 1 ? 'un profesor' : m.profesEvitadosUsados + ' profesores'} que marcaste para evitar, porque no había otro grupo compatible.`;

  if (h.materiasFuera.length) {
    const nombres = h.materiasFuera.map((id) => pensum.materias.find((x) => x.id === id)?.nombre ?? id);
    texto += ` Deja fuera ${listaNatural(nombres)} para que todo encaje.`;
  }

  if (mejor && mejor.id !== h.id) {
    const cambios = h.asignaciones
      .filter((a) => {
        const b = mejor.asignaciones.find((x) => x.materiaId === a.materiaId);
        return b && b.grupo.profesor && a.grupo.profesor && b.grupo.profesor !== a.grupo.profesor;
      })
      .slice(0, 2)
      .map((a) => {
        const nombre = pensum.materias.find((x) => x.id === a.materiaId)?.nombre ?? a.materiaId;
        return `${nombre} con ${a.grupo.profesor}`;
      });
    if (cambios.length) texto += ` A diferencia de la opción 1, ves ${listaNatural(cambios)}.`;
  }
  return texto;
}
