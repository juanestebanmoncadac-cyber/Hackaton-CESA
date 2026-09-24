import type { Dia, ToleranciaHuecos } from '../types';
import { DIAS } from '../types';
import { CREDITOS_TOPE, PENSUM, type Estado } from '../estado/estado';
import { CORTO_DIA, ETIQUETA_CRITERIO, fmtHoraLarga } from '../motor/explicar';
import { PESOS_POSICION } from '../motor/generarHorarios';
import { Flecha } from '../componentes/Encabezado';

const HUECOS: [ToleranciaHuecos, string][] = [['max1', 'Máx. 1 h'], ['hasta2', 'Hasta 2 h'], ['igual', 'Me da igual']];
const HORAS = [6, 7, 8, 9, 10];

interface Props {
  e: Estado;
  set: (fn: (e: Estado) => Estado) => void;
  generar: () => void;
  volver: () => void;
}

export function Paso3Preferencias({ e, set, generar, volver }: Props) {
  const mover = (i: number, d: number) =>
    set((s) => {
      const j = i + d;
      if (j < 0 || j >= s.ranking.length) return s;
      const r = [...s.ranking];
      [r[i], r[j]] = [r[j], r[i]];
      return { ...s, ranking: r };
    });
  const toggleDia = (d: Dia) =>
    set((s) => ({ ...s, diasBloqueados: s.diasBloqueados.includes(d) ? s.diasBloqueados.filter((x) => x !== d) : [...s.diasBloqueados, d] }));
  // el mínimo de créditos está oculto por ahora: podía pasar por encima de "necesito" y "evitar"
  const cambiarMaximo = (v: number) => set((s) => ({ ...s, creditos: { min: Math.min(s.creditos.min, v), max: v } }));
  const limite = PENSUM.limiteCreditosSemestre;
  const sobrecupo = e.creditos.max > limite;

  return (
    <>
      <div className="head">
        <div>
          <h1>¿Cómo te gusta tu horario?</h1>
          <p>Ordena lo que más te importa y dinos lo que no puedes. Lo primero lo intentamos; lo segundo lo respetamos siempre.</p>
        </div>
      </div>

      <div className="p3">
        <section className="card">
          <div className="sec-head">
            <h2>Lo que prefiero</h2>
            <span className="note">La primera manda entre horarios con las mismas materias</span>
          </div>
          <ol className="rank">
            {e.ranking.map((c, i) => {
              const w = Math.round(PESOS_POSICION[i] * 100) + '%';
              return (
                <li key={c}>
                  <span className="pos">{i + 1}</span>
                  <div className="lbl">
                    {ETIQUETA_CRITERIO[c]}
                    <div className="w"><div><div style={{ width: i === 0 ? '100%' : w }} /></div>{i === 0 ? 'prioridad principal' : `desempate ${w}`}</div>
                  </div>
                  <button type="button" className="arrow" aria-label={`Subir ${ETIQUETA_CRITERIO[c]}`} disabled={i === 0} onClick={() => mover(i, -1)}><Flecha dir="up" /></button>
                  <button type="button" className="arrow" aria-label={`Bajar ${ETIQUETA_CRITERIO[c]}`} disabled={i === e.ranking.length - 1} onClick={() => mover(i, 1)}><Flecha dir="down" /></button>
                </li>
              );
            })}
          </ol>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>¿Cuánto hueco toleras en un día?</span>
            <div className="seg tres" role="group" aria-label="Tolerancia a huecos">
              {HUECOS.map(([v, l]) => (
                <button key={v} type="button" className={e.toleranciaHuecos === v ? 'on' : ''} aria-pressed={e.toleranciaHuecos === v} style={{ padding: 10, fontSize: 14 }}
                  onClick={() => set((s) => ({ ...s, toleranciaHuecos: v }))}>{l}</button>
              ))}
            </div>
            <span className="note">La hora de almuerzo (12:00 a 2:00) no cuenta como hueco.</span>
          </div>
        </section>

        <section className="card">
          <div className="sec-head">
            <h2>Lo que no puedo</h2>
            <span className="note" style={{ color: 'var(--red-ink)', fontWeight: 700 }}>Nunca se incumple</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="hmin" style={{ fontWeight: 700, fontSize: 14 }}>No puedo antes de</label>
            <select id="hmin" className="sel" style={{ width: 180 }} value={e.horaMinima} onChange={(ev) => set((s) => ({ ...s, horaMinima: Number(ev.target.value) }))}>
              {HORAS.map((h) => <option key={h} value={h}>{fmtHoraLarga(h)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Días en los que no puedo</span>
            <div className="dias">
              {DIAS.map((d) => {
                const b = e.diasBloqueados.includes(d);
                return <button key={d} type="button" className={`dia ${b ? 'bloq' : ''}`} aria-pressed={b} onClick={() => toggleDia(d)}>{CORTO_DIA[d]}</button>;
              })}
            </div>
            <span className="note">Úsalo para trabajo, prácticas u otros compromisos fijos.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Máximo de créditos que quiero ver: {e.creditos.max}</span>
            <div className="rango">
              <label htmlFor="cr-max">Máximo</label>
              <input id="cr-max" type="range" min={1} max={CREDITOS_TOPE} step={1} value={e.creditos.max}
                aria-valuetext={`${e.creditos.max} créditos`} onChange={(ev) => cambiarMaximo(Number(ev.target.value))} />
              <output htmlFor="cr-max">{e.creditos.max}</output>
            </div>
            {sobrecupo ? (
              <div className="aviso" role="alert">
                Más de {limite} créditos es sobrecupo: en el CESA depende de tu promedio. Revisa tu promedio con Registro Académico antes de inscribirte.
              </div>
            ) : (
              <span className="note">El límite normal es {limite} créditos. Pasarlo depende de tu promedio.</span>
            )}
          </div>
          <div className="info">Si lo que prefieres no es posible con los grupos que hay, igual te mostramos las opciones más cercanas y te decimos por qué.</div>
        </section>
      </div>

      <div className="foot">
        <button type="button" className="linkbtn" onClick={volver}>← Volver a materias</button>
        <button type="button" className="btn" style={{ padding: '14px 26px', fontSize: 16 }} onClick={generar}>Generar mis horarios →</button>
      </div>
    </>
  );
}
