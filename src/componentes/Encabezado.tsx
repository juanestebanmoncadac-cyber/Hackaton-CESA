import { Fragment } from 'react';

const PASOS = ['Aprobadas', 'Materias', 'Preferencias', 'Horarios'];

export function Encabezado({ paso, irA, alInicio }: { paso: number; irA: (p: 1 | 2 | 3 | 4) => void; alInicio: () => void }) {
  return (
    <header className="top">
      <button type="button" className="logo" onClick={alInicio} aria-label="HorarioCESA, volver al inicio">
        Horario<span>CESA</span>
      </button>
      <nav className="stepper" aria-label="Pasos">
        {PASOS.map((nombre, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const estado = n < paso ? 'done' : n === paso ? 'now' : '';
          return (
            <Fragment key={nombre}>
              {i > 0 && <span className={`step-line ${n <= paso ? 'done' : ''}`} />}
              <button
                type="button"
                className={`step ${estado}`}
                onClick={() => n < paso && irA(n)}
                disabled={n > paso}
                aria-current={n === paso ? 'step' : undefined}
                style={{ cursor: n < paso ? 'pointer' : 'default' }}
              >
                {n < paso ? `✓ ${nombre}` : `${n} · ${nombre}`}
              </button>
            </Fragment>
          );
        })}
      </nav>
    </header>
  );
}

export function IconoCandado({ abierto = false, color = 'currentColor', size = 14 }: { abierto?: boolean; color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={abierto ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  );
}

export function Flecha({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14213F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}
