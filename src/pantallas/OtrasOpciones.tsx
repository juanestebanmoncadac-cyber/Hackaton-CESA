import { useEffect, useState } from 'react';
import type { Asignacion, Criterio, Horario } from '../types';
import type { Estado } from '../estado/estado';
import { IconoCandado } from '../componentes/Encabezado';
import { listaNatural } from '../motor/explicar';
import { nombreMateria } from '../componentes/formato';

type Chip = 'huecos' | 'temprano' | 'dias' | 'profesor' | 'solo';
const CHIPS: [Chip, string][] = [
  ['huecos', 'Muchos huecos'],
  ['temprano', 'Entro muy temprano'],
  ['dias', 'Pocos días libres'],
  ['profesor', 'Un profesor'],
  ['solo', 'Solo quiero ver otras'],
];
const CRITERIO: Partial<Record<Chip, Criterio>> = { huecos: 'huecos', temprano: 'noMadrugar', dias: 'diasLibres' };

interface Props {
  e: Estado;
  horario: Horario;
  fijados: Asignacion[];
  cerrar: () => void;
  buscar: (cambios: (e: Estado) => Estado) => void;
}

/**
 * "Ver otras opciones": por defecto pasa a las siguientes del ranking con los
 * MISMOS pesos. Solo si el estudiante dice qué no le gustó, se ajustan.
 */
export function OtrasOpciones({ e, horario, fijados, cerrar, buscar }: Props) {
  const [chips, setChips] = useState<Set<Chip>>(new Set());
  const [evitar, setEvitar] = useState<Set<string>>(new Set());
  const profes = [...new Set(horario.asignaciones.filter((a) => a.grupo.profesor && e.profesores[a.grupo.profesor] !== 'evitar').map((a) => a.grupo.profesor!))];

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && cerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cerrar]);

  const toggle = (c: Chip) => setChips((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });

  const confirmar = () => {
    buscar((s) => {
      const ajustes = { ...s.ajustes };
      chips.forEach((c) => {
        const k = CRITERIO[c];
        if (k) ajustes[k] = (ajustes[k] ?? 1) * 1.8;
      });
      const profesores = { ...s.profesores };
      if (chips.has('profesor')) evitar.forEach((p) => (profesores[p] = 'evitar'));
      return { ...s, ajustes, profesores };
    });
  };

  return (
    <div className="overlay" onClick={cerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="t-otras" onClick={(ev) => ev.stopPropagation()}>
        <div>
          <h2 id="t-otras">¿Qué no te gustó?</h2>
          <p>Opcional. Si no marcas nada, te mostramos las siguientes del ranking con tus mismas prioridades.</p>
        </div>
        <div className="chips">
          {CHIPS.map(([c, l]) => (
            <button key={c} type="button" className={`chip ${chips.has(c) ? 'on' : ''}`} aria-pressed={chips.has(c)} onClick={() => toggle(c)} style={{ fontSize: 14, padding: '9px 14px' }}>
              {chips.has(c) ? `✓ ${l}` : l}
            </button>
          ))}
        </div>
        {chips.has('profesor') && (
          <div className="box">
            <span style={{ fontSize: 13, fontWeight: 700 }}>¿Con quién no quieres ver clase?</span>
            {profes.map((p) => {
              const a = horario.asignaciones.find((x) => x.grupo.profesor === p)!;
              return (
                <label key={p}>
                  <input type="checkbox" checked={evitar.has(p)} onChange={() => setEvitar((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; })} />
                  Prof. {p} · {nombreMateria(a)}
                </label>
              );
            })}
          </div>
        )}
        {fijados.length > 0 && (
          <div className="keep">
            <IconoCandado size={16} color="#16264F" />
            <span>Se mantienen fijos: {listaNatural(fijados.map((a) => `${nombreMateria(a)} (${a.grupo.grupo})`))}.</span>
          </div>
        )}
        <div className="modal-foot">
          <button type="button" className="btn-sec" onClick={cerrar}>Cancelar</button>
          <button type="button" className="btn" onClick={confirmar}>Buscar 3 opciones nuevas</button>
        </div>
      </div>
    </div>
  );
}
