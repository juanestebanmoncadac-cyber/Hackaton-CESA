/** Adapta el escenario de backtesting al contrato Oferta del frontend. */
export function convertirBacktest(pensum, datos) {
  const porNombre = new Map(pensum.materias.map((materia) => [materia.nombre, materia]));
  const nrcs = new Set();
  const grupos = datos.secciones.map((seccion) => {
    const materia = porNombre.get(seccion.nombre);
    if (!materia || materia.tipo !== 'regular') {
      throw new Error(`Materia sin correspondencia regular en el pénsum: ${seccion.nombre}`);
    }
    if (nrcs.has(seccion.nrc)) throw new Error(`NRC duplicado: ${seccion.nrc}`);
    nrcs.add(seccion.nrc);
    if (!seccion.sesiones.length || seccion.sesiones.some((s) =>
      !['Lun', 'Mar', 'Mie', 'Jue', 'Vie'].includes(s.dia) || s.inicio >= s.fin
    )) throw new Error(`Sesiones inválidas: ${seccion.nrc}`);
    return {
      nrc: seccion.nrc,
      materiaId: materia.id,
      grupo: seccion.grupo,
      profesor: seccion.profesor,
      tipo: 'regular',
      esSeleccion: false,
      cupos: seccion.cupos,
      sesiones: seccion.sesiones,
    };
  });

  // Los nombres vienen del folleto. NRC, cupos y franjas son exclusivamente de prueba.
  const franjas = [
    ['Lun', 14, 15.5], ['Mar', 14, 15.5], ['Mie', 14, 15.5],
    ['Jue', 14, 15.5], ['Vie', 12 + 10 / 60, 13 + 40 / 60],
    ['Lun', 15 + 40 / 60, 17 + 10 / 60], ['Mar', 15 + 40 / 60, 17 + 10 / 60],
    ['Mie', 15 + 40 / 60, 17 + 10 / 60], ['Jue', 15 + 40 / 60, 17 + 10 / 60],
  ];
  const opcionesBienestar = datos.bienestar.filter((opcion) => opcion.elegible);
  opcionesBienestar.forEach((opcion, i) => {
    const [dia, inicio, fin] = franjas[i % franjas.length];
    grupos.push({
      nrc: `SIMB${String(i + 1).padStart(3, '0')}`,
      materiaId: 'BIENESTAR',
      grupo: `Grupo ${i + 1}`,
      actividad: opcion.nombre,
      tipo: 'actividad',
      esSeleccion: false,
      cupos: 25,
      sesiones: [{ dia, inicio, fin }],
    });
  });

  // Estas actividades son extracurriculares; solo se usan si el estudiante
  // declara que pertenece a una selección. No se ofrecen como Bienestar.
  const selecciones = ['Fútbol femenino', 'Fútbol masculino', 'Voleibol', 'Baloncesto'];
  const pares = [['Lun', 'Mie'], ['Mar', 'Jue'], ['Lun', 'Jue'], ['Mar', 'Vie']];
  selecciones.forEach((actividad, i) => {
    if (!datos.bienestar.some((opcion) => opcion.nombre === actividad)) return;
    grupos.push({
      nrc: `SIMS${String(i + 1).padStart(3, '0')}`,
      materiaId: 'SELECCION',
      grupo: `Grupo ${i + 1}`,
      actividad: `Selección de ${actividad.toLowerCase()}`,
      tipo: 'actividad',
      esSeleccion: true,
      cupos: 25,
      sesiones: pares[i].map((dia) => ({ dia, inicio: 15 + 40 / 60, fin: 17 + 10 / 60 })),
    });
  });

  return { periodo: datos.periodo, generadoEn: '2026-09-24T00:00:00Z', fuente: 'simulada', grupos };
}
