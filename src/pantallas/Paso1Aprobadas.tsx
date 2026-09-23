import { useMemo, useState } from 'react';
import type { Materia } from '../types';
import { PENSUM, type Estado } from '../estado/estado';
import { aprobarConPrerrequisitos, desaprobarConDependientes, estadoMateria, hastaSemestre, semestreActual } from '../motor/pensum';

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const CLASE = { aprobada: 'ok', disponible: 'disp', bloqueada: 'bloq' } as const;

interface Props {
  e: Estado;
  set: (fn: (e: Estado) => Estado) => void;
  seguir: () => void;
}

export function Paso1Aprobadas({ e, set, seguir }: Props) {
  const [hov, setHov] = useState<Materia | null>(null);
  const [hasta, setHasta] = useState<number | null>(null);
  const aprob = useMemo(() => new Set(e.aprobadas), [e.aprobadas]);
  const sem = semestreActual(PENSUM, aprob);
  const porId = useMemo(() => new Map(PENSUM.materias.map((m) => [m.id, m])), []);

  // matriz filas × semestres igual que la malla oficial
  const filas = useMemo(() => {
    const nFilas = Math.max(...PENSUM.materias.map((m) => m.fila ?? -1)) + 1;
    const grid: (Materia | null)[][] = Array.from({ length: nFilas }, () => Array(9).fill(null));
    for (const m of PENSUM.materias) if (m.fila !== undefined) grid[m.fila][m.semestre - 1] = m;
    return grid;
  }, []);
  const bienestar = PENSUM.materias.filter((m) => m.tipo === 'bienestar');

  const toggle = (m: Materia) => {
    setHasta(null);
    set((s) => {
      const a = new Set(s.aprobadas);
      const next = a.has(m.id) ? desaprobarConDependientes(PENSUM, a, m.id) : aprobarConPrerrequisitos(PENSUM, a, m.id);
      return { ...s, aprobadas: [...next] };
    });
  };

  let nOk = 0, crOk = 0, nDisp = 0;
  const semDone = Array(9).fill(0);
  for (const m of PENSUM.materias) {
    const st = estadoMateria(m, aprob, sem);
    if (st === 'aprobada') { nOk++; crOk += m.creditos; semDone[m.semestre - 1] += m.creditos; }
    if (st === 'disponible') nDisp++;
  }

  const hint = hov
    ? hov.prerrequisitos.length
      ? `${hov.nombre} requiere: ${hov.prerrequisitos.map((p) => porId.get(p)?.nombre).join(', ')}.`
      : `${hov.nombre} no tiene prerrequisitos.`
    : 'Pasa el mouse por una materia para ver sus prerrequisitos.';

  const celda = (m: Materia, pill = false) => {
    const st = estadoMateria(m, aprob, sem);
    const ring = hov?.prerrequisitos.includes(m.id);
    const label = `${m.nombre}, ${m.creditos} créditos, ${st}`;
    return (
      <button
        key={m.id}
        type="button"
        className={`${pill ? 'pill' : 'mat'} ${CLASE[st]} ${ring ? 'ring' : ''}`}
        onClick={() => toggle(m)}
        onMouseEnter={() => setHov(m)}
        onMouseLeave={() => setHov(null)}
        onFocus={() => setHov(m)}
        onBlur={() => setHov(null)}
        aria-pressed={st === 'aprobada'}
        aria-label={label}
      >
        {pill ? (st === 'aprobada' ? `✓ ${m.nombre}` : m.nombre) : <><span>{m.nombre}</span><span className="cr">{m.creditos}</span></>}
      </button>
    );
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>¿Qué materias ya aprobaste?</h1>
          <p>Es tu malla curricular. Toca una materia para marcarla; sus prerrequisitos se marcan solos.</p>
        </div>
        <div className="sem-picker">
          <span>Marcar hasta el semestre</span>
          {ROMANOS.map((r, i) => (
            <button
              key={r}
              type="button"
              className={`sem-btn ${hasta === i + 1 ? 'on' : ''}`}
              onClick={() => { setHasta(i + 1); set((s) => ({ ...s, aprobadas: [...hastaSemestre(PENSUM, i + 1)] })); }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="leyenda">
        <span><i className="sw" style={{ background: 'var(--navy)' }} />Aprobada</span>
        <span><i className="sw" style={{ background: '#fff', border: '2px solid var(--blue)' }} />Disponible para inscribir</span>
        <span><i className="sw" style={{ background: '#fff', border: '1px dashed #AEB6C8' }} />Bloqueada</span>
        <span><i className="sw" style={{ background: '#fff', boxShadow: '0 0 0 3px var(--amber)' }} />Prerrequisito de la materia señalada</span>
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>Datos de ejemplo · prerrequisitos por validar con Registro Académico</span>
      </div>

      <div className="card malla-wrap">
        <div className="malla">
          <div className="g9">
            <div className="ciclo" style={{ gridColumn: 'span 4', background: 'var(--tint)', color: 'var(--navy)' }}>Primer ciclo · I a IV</div>
            <div className="ciclo" style={{ gridColumn: 'span 3', background: 'var(--blue)', color: '#fff' }}>Segundo ciclo · V a VII</div>
            <div className="ciclo" style={{ gridColumn: 'span 2', background: 'var(--navy)', color: '#fff' }}>Tercer ciclo · VIII y IX</div>
          </div>
          <div className="g9">{ROMANOS.map((r) => <div key={r} className="sem-label">{r} Semestre</div>)}</div>
          <div className="g9 celdas">
            {filas.flatMap((fila, r) => fila.map((m, c) => (m ? celda(m) : <div key={`${r}-${c}`} style={{ minHeight: 48 }} />)))}
          </div>
          <div className="g9" style={{ paddingTop: 6 }}>{bienestar.map((m) => celda(m, true))}</div>
          <div className="g9">
            {PENSUM.creditosPorSemestre.map((t, i) => (
              <div key={i} className="cred"><span>Créditos</span><span>{semDone[i]} / {t}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="card barra">
        <div className="barra-stats">
          <span><b>{nOk}</b> aprobadas</span>
          <span><b>{crOk}</b> de {PENSUM.totalCreditos} créditos</span>
          <span><b style={{ color: 'var(--link)' }}>{nDisp}</b> disponibles</span>
          <span className="barra-hint" aria-live="polite">{hint}</span>
        </div>
        <button type="button" className="btn" onClick={seguir} disabled={nDisp === 0}>Continuar a elegir materias →</button>
      </div>
    </>
  );
}
