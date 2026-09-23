import type { Asignacion, Grupo } from '../types';
import { PENSUM } from '../estado/estado';
import { CORTO_DIA, fmtHora, listaNatural } from '../motor/explicar';

/** "Lun y Mié · 8:00 – 10:00"  o  "Mar · 7:00 – 9:00 y Mié · 14:00 – 16:00" */
export function cuando(g: Grupo): string {
  const porFranja = new Map<string, string[]>();
  for (const s of g.sesiones) {
    const k = `${fmtHora(s.inicio)} – ${fmtHora(s.fin)}`;
    if (!porFranja.has(k)) porFranja.set(k, []);
    porFranja.get(k)!.push(CORTO_DIA[s.dia]);
  }
  return [...porFranja.entries()].map(([franja, dias]) => `${listaNatural(dias)} · ${franja}`).join(' y ');
}

export const COLORES = [
  { bg: '#DCE8FF', bd: '#3D6FD6' },
  { bg: '#DDF1DF', bd: '#3E8E47' },
  { bg: '#ECE2FA', bd: '#7A4BC4' },
  { bg: '#FADDE9', bd: '#B23A6E' },
  { bg: '#FFF0C7', bd: '#A57A00' },
  { bg: '#FFE3D5', bd: '#C8612F' },
  { bg: '#D6F0EE', bd: '#1F8A86' },
  { bg: '#F1E4D8', bd: '#8A5A2B' },
  { bg: '#E3EEF9', bd: '#2F6FC4' },
];
export const GRIS = { bg: '#E6E9F0', bd: '#56627F' };

export function nombreMateria(a: Asignacion): string {
  if (a.materiaId === 'SELECCION') return a.grupo.actividad ?? 'Selección';
  const m = PENSUM.materias.find((x) => x.id === a.materiaId);
  if (!m) return a.materiaId;
  if (m.tipo === 'bienestar' || m.tipo === 'electivaSH') return `${m.nombre} · ${a.grupo.actividad}`;
  return m.nombre;
}
