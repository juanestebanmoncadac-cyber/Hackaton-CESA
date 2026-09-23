import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import type { Asignacion, Horario } from '../types';
import { DIAS } from '../types';
import { PENSUM, preferenciasDe, type Estado } from '../estado/estado';
import { CORTO_DIA, explicar, fmtHora, metricasVisibles } from '../motor/explicar';
import { IconoCandado } from '../componentes/Encabezado';
import { COLORES, GRIS, cuando, nombreMateria } from '../componentes/formato';
import { OtrasOpciones } from './OtrasOpciones';

const PX = 40; // alto de una hora

interface Props {
  e: Estado;
  set: (fn: (e: Estado) => Estado) => void;
  otras: (cambios: (e: Estado) => Estado) => void;
  volver: () => void;
}

export function Paso4Resultado({ e, set, otras, volver }: Props) {
  const [hl, setHl] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const pref = preferenciasDe(e);

  if (!e.opciones.length) {
    return (
      <div className="card vacio">
        <h2 style={{ margin: 0 }}>No encontramos horarios con estas condiciones</h2>
        {e.avisos.map((a) => <p key={a}>{a}</p>)}
        <button type="button" className="btn" onClick={volver}>← Ajustar preferencias</button>
      </div>
    );
  }

  const h: Horario = e.opciones[Math.min(e.opcion, e.opciones.length - 1)];
  const colorDe = new Map<string, { bg: string; bd: string }>();
  let ci = 0;
  for (const a of h.asignaciones) colorDe.set(a.materiaId, a.grupo.tipo === 'actividad' ? GRIS : COLORES[ci++ % COLORES.length]);

  const todas = h.asignaciones.flatMap((a) => a.grupo.sesiones);
  const hIni = Math.min(7, ...todas.map((s) => Math.floor(s.inicio)));
  const hFin = Math.max(18, ...todas.map((s) => Math.ceil(s.fin)));
  const alto = (hFin - hIni) * PX;
  const usados = new Set(todas.map((s) => s.dia));
  const credTot = h.metricas.creditos;

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2200); };

  const copiarNrc = async () => {
    const txt = h.asignaciones.map((a) => `${a.grupo.nrc} — ${nombreMateria(a)} (${a.grupo.grupo})`).join('\n');
    try { await navigator.clipboard.writeText(txt); flash('NRC copiados al portapapeles'); }
    catch { flash('No se pudo copiar: ' + h.asignaciones.map((a) => a.grupo.nrc).join(', ')); }
  };

  const descargar = async () => {
    if (!ref.current) return;
    try {
      const url = await toPng(ref.current, { backgroundColor: '#F3F5FA', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = url;
      a.download = `horario-opcion-${e.opcion + 1}.png`;
      a.click();
    } catch {
      flash('No se pudo generar la imagen');
    }
  };

  const toggleLock = (a: Asignacion) => {
    if (a.materiaId === 'SELECCION') return;
    set((s) => {
      const m = s.materias[a.materiaId];
      if (!m) return s;
      const on = m.nrcFijado === a.grupo.nrc;
      return { ...s, materias: { ...s.materias, [a.materiaId]: { ...m, nrcFijado: on ? undefined : a.grupo.nrc } } };
    });
  };

  const fijadosEnVista = h.asignaciones.filter((a) => e.materias[a.materiaId]?.nrcFijado === a.grupo.nrc);

  return (
    <>
      <div className="head">
        <div>
          <h1>Tus {e.opciones.length === 1 ? 'opción' : `${e.opciones.length} opciones`} de horario</h1>
          <p>
            Todas sin cruces{credTot ? ` y con ${credTot} créditos` : ''}. Compara y quédate con la que más te sirva.
            {e.ronda > 1 && ` (Ronda ${e.ronda}: opciones nuevas.)`}
          </p>
        </div>
        <div className="tabs" role="tablist">
          {e.opciones.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={e.opcion === i} className={e.opcion === i ? 'on' : ''} onClick={() => { setHl(null); set((s) => ({ ...s, opcion: i })); }}>
              Opción {i + 1}
            </button>
          ))}
        </div>
      </div>

      {e.avisos.map((a) => <div key={a} className="aviso">{a}</div>)}

      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="r-row top-row">
          <div className="r-main card semana">
            <div className="semana-dias">{DIAS.map((d) => <div key={d}>{CORTO_DIA[d]}</div>)}</div>
            <div className="semana-body">
              <div className="horas" style={{ height: alto }}>
                {Array.from({ length: hFin - hIni + 1 }, (_, i) => (
                  <div key={i} style={{ top: i * PX }}>{fmtHora(hIni + i)}</div>
                ))}
              </div>
              {DIAS.map((d) => {
                const bloq = e.diasBloqueados.includes(d);
                const libre = !bloq && !usados.has(d);
                return (
                  <div key={d} className={`col ${bloq ? 'bloq' : ''}`} style={{ height: alto }}>
                    {bloq && <div className="col-msg no">No puedes</div>}
                    {libre && <div className="col-msg libre">Día libre</div>}
                    {h.asignaciones.flatMap((a) =>
                      a.grupo.sesiones.filter((s) => s.dia === d).map((s, k) => {
                        const c = colorDe.get(a.materiaId)!;
                        return (
                          <div key={a.grupo.nrc + k} className="bloque"
                            onMouseEnter={() => setHl(a.materiaId)} onMouseLeave={() => setHl(null)}
                            style={{ top: (s.inicio - hIni) * PX + 2, height: (s.fin - s.inicio) * PX - 4, background: c.bg, borderLeftColor: c.bd, opacity: hl && hl !== a.materiaId ? 0.3 : 1 }}>
                            <b>{nombreMateria(a)}</b>
                            <span>{fmtHora(s.inicio)} – {fmtHora(s.fin)}</span>
                          </div>
                        );
                      }),
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="r-side card lista">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Tus materias</h2>
              <span className="note" style={{ fontSize: 11.5 }}>Fija lo que te gusta</span>
            </div>
            {h.asignaciones.map((a) => {
              const c = colorDe.get(a.materiaId)!;
              const op = a.grupo.profesor ? e.profesores[a.grupo.profesor] : undefined;
              const cr = PENSUM.materias.find((m) => m.id === a.materiaId)?.creditos ?? 0;
              const locked = e.materias[a.materiaId]?.nrcFijado === a.grupo.nrc;
              return (
                <div key={a.grupo.nrc} className={`lista-item ${hl === a.materiaId ? 'hl' : ''}`} onMouseEnter={() => setHl(a.materiaId)} onMouseLeave={() => setHl(null)}>
                  <span className="color" style={{ background: c.bd }} />
                  <div className="txt">
                    <b>{nombreMateria(a)}</b>
                    <span>
                      {a.grupo.profesor ? `Prof. ${a.grupo.profesor}` : `Actividad: ${a.grupo.actividad}`}{' '}
                      {op === 'preferido' && <span className="star">★ preferido</span>}
                      {op === 'evitar' && <span className="warn">✕ lo querías evitar</span>}
                    </span>
                    <small>{a.grupo.grupo} · NRC {a.grupo.nrc} · {cr} cr · {cuando(a.grupo)}</small>
                  </div>
                  {a.materiaId !== 'SELECCION' && (
                    <button type="button" className={`lk ${locked ? 'on' : ''}`} aria-pressed={locked} aria-label={locked ? 'Desfijar grupo' : 'Fijar grupo'} onClick={() => toggleLock(a)}>
                      <IconoCandado abierto={!locked} color={locked ? '#FFFFFF' : '#8A93AD'} />
                    </button>
                  )}
                </div>
              );
            })}
            {h.materiasFuera.length > 0 && (
              <div className="note" style={{ paddingTop: 8 }}>
                Quedó fuera: {h.materiasFuera.map((id) => PENSUM.materias.find((m) => m.id === id)?.nombre).join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="r-row">
          <div className="r-main" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="kpis">
              {metricasVisibles(h).map((k) => (
                <div key={k.label} className="card kpi"><span>{k.label}</span><b>{k.value}</b></div>
              ))}
            </div>
            <div className="porque">
              <b style={{ whiteSpace: 'nowrap' }}>¿Por qué este?</b>
              <span>{explicar(h, pref, PENSUM, e.opcion > 0 ? e.opciones[0] : undefined)}</span>
            </div>
          </div>
          <div className="r-side acciones">
            <button type="button" className="btn" onClick={() => setModal(true)}>Ver otras opciones</button>
            <div className="dos">
              <button type="button" className="btn-sec" onClick={descargar}>Descargar imagen</button>
              <button type="button" className="btn-sec" onClick={copiarNrc}>Copiar NRC</button>
            </div>
            <button type="button" className="linkbtn" style={{ alignSelf: 'center' }} onClick={volver}>← Cambiar preferencias</button>
          </div>
        </div>
      </div>

      {toast && <div role="status" className="aviso" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--navy)', color: '#fff', zIndex: 60 }}>{toast}</div>}

      {modal && (
        <OtrasOpciones
          e={e}
          horario={h}
          fijados={fijadosEnVista}
          cerrar={() => setModal(false)}
          buscar={(cambios) => { setModal(false); otras(cambios); }}
        />
      )}
    </>
  );
}
