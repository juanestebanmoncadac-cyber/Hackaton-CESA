import { useMemo, useState } from 'react';
import type { Grupo, Materia } from '../types';
import { OFERTA, PENSUM, sincronizarMaterias, type Estado, type EstadoMateria } from '../estado/estado';
import { disponibles, semestreActual } from '../motor/pensum';
import { gruposSeCruzan } from '../motor/generarHorarios';
import { IconoCandado } from '../componentes/Encabezado';
import { cuando } from '../componentes/formato';

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

interface Props {
  e: Estado;
  set: (fn: (e: Estado) => Estado) => void;
  seguir: () => void;
  volver: () => void;
}

export function Paso2Materias({ e, set, seguir, volver }: Props) {
  const [hovProf, setHovProf] = useState<string | null>(null);
  const aprob = useMemo(() => new Set(e.aprobadas), [e.aprobadas]);
  const semAct = semestreActual(PENSUM, aprob);
  const disp = useMemo(() => disponibles(PENSUM, aprob), [aprob]);
  const mats = sincronizarMaterias(e);
  const limite = e.creditos.max; // lo elige el estudiante en Preferencias (por defecto el límite del pensum)

  const regulares = disp.filter((m) => m.tipo === 'regular');
  const bienestar = disp.find((m) => m.tipo === 'bienestar');
  const electivas = disp.filter((m) => m.tipo === 'electivaSH');
  const sinHorario = disp.filter((m) => m.tipo === 'sinHorario');

  const upd = (id: string, fn: (m: EstadoMateria) => EstadoMateria) =>
    set((s) => {
      const all = sincronizarMaterias(s);
      return { ...s, materias: { ...all, [id]: fn(all[id]) } };
    });

  const cycleProf = (p: string) =>
    set((s) => {
      const cur = s.profesores[p];
      const n = { ...s.profesores };
      if (!cur) n[p] = 'preferido';
      else if (cur === 'preferido') n[p] = 'evitar';
      else delete n[p];
      return { ...s, profesores: n };
    });

  const cr = disp.reduce((acc, m) => acc + (mats[m.id]?.sel ? m.creditos : 0), 0);
  const over = cr > limite;
  const nSel = disp.filter((m) => mats[m.id]?.sel).length;

  // aviso inmediato de grupos fijados que se cruzan
  const fijados = disp
    .filter((m) => mats[m.id]?.sel && mats[m.id]?.nrcFijado)
    .map((m) => ({ m, g: OFERTA.grupos.find((g) => g.nrc === mats[m.id].nrcFijado) }))
    .filter((x): x is { m: Materia; g: Grupo } => !!x.g);
  const choques: string[] = [];
  for (let i = 0; i < fijados.length; i++) for (let j = i + 1; j < fijados.length; j++) {
    if (gruposSeCruzan(fijados[i].g, fijados[j].g)) choques.push(`${fijados[i].m.nombre} y ${fijados[j].m.nombre}`);
  }

  const actividades = (materiaId: 'BIENESTAR' | 'ELECTIVA_SH') => [...new Set(OFERTA.grupos.filter((g) => g.materiaId === materiaId).map((g) => g.actividad!))];
  const selecciones = OFERTA.grupos.filter((g) => g.esSeleccion);

  const tarjeta = (m: Materia) => {
    const st = mats[m.id];
    const grupos = OFERTA.grupos.filter((g) => g.materiaId === m.id);
    const profes = [...new Set(grupos.map((g) => g.profesor!))];
    const fijo = st.nrcFijado ? grupos.find((g) => g.nrc === st.nrcFijado) : undefined;
    const pendiente = m.semestre <= semAct ? `Pendiente de ${ROMANOS[m.semestre - 1]} semestre` : '';
    return (
      <div key={m.id} className={`card mcard ${st.sel ? '' : 'off'}`}>
        <div className="mcard-top">
          <input type="checkbox" id={`chk-${m.id}`} checked={st.sel} disabled={!grupos.length} onChange={() => upd(m.id, (x) => ({ ...x, sel: !x.sel }))} />
          <label htmlFor={`chk-${m.id}`}>{m.nombre}</label>
          <span className="crs">{m.creditos} cr</span>
        </div>
        {pendiente && <div className="tag">{pendiente}</div>}
        {!grupos.length && <div className="note">Sin grupos abiertos en {OFERTA.periodo}.</div>}
        {st.sel && grupos.length > 0 && (
          <>
            <div className="seg" role="group" aria-label={`Prioridad de ${m.nombre}`}>
              <button type="button" className={st.prioridad === 'necesito' ? 'on' : ''} aria-pressed={st.prioridad === 'necesito'} onClick={() => upd(m.id, (x) => ({ ...x, prioridad: 'necesito' }))}>La necesito</button>
              <button type="button" className={st.prioridad === 'gustaria' ? 'on' : ''} aria-pressed={st.prioridad === 'gustaria'} onClick={() => upd(m.id, (x) => ({ ...x, prioridad: 'gustaria' }))}>Me gustaría</button>
            </div>
            <div className="mini">Profesores</div>
            <div className="profs">
              {profes.map((p) => {
                const key = `${m.id}|${p}`;
                const op = e.profesores[p];
                return (
                  <div key={p} className="prof-wrap" onMouseEnter={() => setHovProf(key)} onMouseLeave={() => setHovProf(null)} onFocus={() => setHovProf(key)} onBlur={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setHovProf(null); }}>
                    <button
                      type="button"
                      className={`prof ${op === 'preferido' ? 'pref' : op === 'evitar' ? 'avoid' : ''}`}
                      onClick={() => cycleProf(p)}
                      aria-label={`${p}: ${op ?? 'me da igual'}. Toca para cambiar.`}
                    >
                      {op === 'preferido' ? '★ ' : op === 'evitar' ? '✕ ' : ''}{p}
                    </button>
                    {hovProf === key && (
                      <div className="pop" role="tooltip">
                        <div className="pop-in">
                          <span className="pop-title">Horarios de {p}</span>
                          {grupos.filter((g) => g.profesor === p).map((g) => {
                            const on = st.nrcFijado === g.nrc;
                            return (
                              <div key={g.nrc} className="pop-row">
                                <div><span style={{ fontWeight: 700 }}>{g.grupo} · NRC {g.nrc}</span><span>{cuando(g)}</span></div>
                                <button type="button" className={`lockbtn ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => upd(m.id, (x) => ({ ...x, nrcFijado: on ? undefined : g.nrc }))}>
                                  <IconoCandado abierto={!on} size={12} color={on ? '#16264F' : '#FFFFFF'} />{on ? 'Fijado' : 'Fijar'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {fijo && (
              <div className="fijado">
                <IconoCandado size={14} color="#16264F" />
                <span><b>Fijado:</b> {fijo.grupo} con {fijo.profesor} · {cuando(fijo)}</span>
                <button type="button" onClick={() => upd(m.id, (x) => ({ ...x, nrcFijado: undefined }))}>Quitar</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const bloqueActividad = (m: Materia, tipo: 'BIENESTAR' | 'ELECTIVA_SH', texto: string) => {
    const st = mats[m.id];
    const opciones = actividades(tipo);
    return (
      <div key={m.id} className="extra-main">
        <div className="row-check">
          <input type="checkbox" id={`chk-${m.id}`} checked={st.sel} disabled={!opciones.length} onChange={() => upd(m.id, (x) => ({ ...x, sel: !x.sel, prioridad: 'necesito' }))} />
          <label htmlFor={`chk-${m.id}`}>{m.nombre}</label>
          <span className="note">{m.creditos} cr · {texto}</span>
        </div>
        {!opciones.length && <div className="note">Sin actividades abiertas en {OFERTA.periodo}.</div>}
        {st.sel && (
          <>
            <div className="note">Marca todas las que te sirvan. Usaremos la que mejor encaje en tu horario.</div>
            <div className="chips">
              {opciones.map((a) => {
                const on = st.actividades.includes(a);
                return (
                  <button key={a} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                    onClick={() => upd(m.id, (x) => ({ ...x, actividades: on ? x.actividades.filter((y) => y !== a) : [...x.actividades, a] }))}>
                    {on ? `✓ ${a}` : a}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>¿Qué quieres inscribir?</h1>
          <p>Solo ves las materias que ya puedes tomar. Dinos cuáles necesitas y con quién prefieres verlas. Pasa el mouse sobre un profesor para ver sus horarios y fijar un grupo; tócalo para marcarlo como preferido (★), evitar (✕) o me da igual.</p>
        </div>
      </div>

      <div className="p2">
        <div className="p2-grid">
          {regulares.map(tarjeta)}
          {electivas.map((m) => (
            <div key={m.id} className="card extra">{bloqueActividad(m, 'ELECTIVA_SH', 'se elige por tema, no por profesor')}</div>
          ))}
          <div className="card extra">
            {bienestar ? bloqueActividad(bienestar, 'BIENESTAR', 'se elige por actividad, no por profesor') : (
              <div className="extra-main"><div className="note">No tienes Bienestar pendiente para este semestre.</div></div>
            )}
            <div className="extra-side">
              <div className="row-check">
                <input type="checkbox" id="seleccion" checked={e.seleccion.pertenece} disabled={!selecciones.length}
                  onChange={() => set((s) => ({ ...s, seleccion: { pertenece: !s.seleccion.pertenece, nrc: s.seleccion.nrc ?? selecciones[0]?.nrc } }))} />
                <label htmlFor="seleccion" style={{ fontSize: 14 }}>Pertenezco a una selección deportiva</label>
              </div>
              {!selecciones.length && <div className="note">Sin selecciones deportivas abiertas en {OFERTA.periodo}.</div>}
              {!e.seleccion.pertenece ? (
                <div className="note">Las selecciones no se asignan automáticamente. Solo aparecen si nos dices que eres parte de una.</div>
              ) : (
                <>
                  <label htmlFor="equipo" className="note">¿Cuál?</label>
                  <select id="equipo" className="sel" value={e.seleccion.nrc} onChange={(ev) => set((s) => ({ ...s, seleccion: { pertenece: true, nrc: ev.target.value } }))}>
                    {selecciones.map((g) => <option key={g.nrc} value={g.nrc}>{g.actividad} · {cuando(g)}</option>)}
                  </select>
                  <div className="note" style={{ color: 'var(--green-ink)' }}>Sus entrenamientos quedan como bloque fijo; lo demás se acomoda alrededor.</div>
                </>
              )}
            </div>
          </div>
          {sinHorario.length > 0 && (
            <div className="aviso" style={{ gridColumn: '1 / -1' }}>
              {sinHorario.map((m) => m.nombre).join(', ')} no ocupa{sinHorario.length > 1 ? 'n' : ''} franja semanal y se inscribe aparte.
            </div>
          )}
        </div>

        <aside className="side">
          <div className="card">
            <div className="mini">Créditos del semestre</div>
            <div className="big">{cr}<small> / {limite}</small></div>
            <div className="track"><div style={{ width: `${Math.min(100, (cr / limite) * 100)}%`, background: over ? 'var(--red)' : 'var(--blue)' }} /></div>
            <div className="note" style={{ color: over ? 'var(--red-ink)' : undefined }}>
              {over ? 'Te pasaste de tu máximo. Quita alguna materia, márcala como "Me gustaría" o sube tu máximo de créditos en el siguiente paso.' : `Te quedan ${limite - cr} créditos disponibles.`}
            </div>
            {cr > PENSUM.limiteCreditosSemestre && (
              <div className="note" style={{ color: 'var(--amber-ink)' }}>Más de {PENSUM.limiteCreditosSemestre} créditos es sobrecupo: revisa tu promedio.</div>
            )}
            <div className="note">{nSel} materias seleccionadas</div>
          </div>
          {choques.map((c) => (
            <div key={c} className="aviso rojo" role="alert">Los grupos fijados de {c} se cruzan. Quita uno de los candados.</div>
          ))}
          <button type="button" className="btn" onClick={seguir} disabled={nSel === 0}>Continuar a preferencias →</button>
          <button type="button" className="linkbtn" onClick={volver}>← Volver a materias aprobadas</button>
        </aside>
      </div>
    </>
  );
}
