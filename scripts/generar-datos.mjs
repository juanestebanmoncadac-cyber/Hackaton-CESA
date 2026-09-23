// Genera src/datos/pensum.json y src/datos/oferta.json (datos SIMULADOS).
// Uso: node scripts/generar-datos.mjs
// Cuando lleguen los datos reales de Oracle, oferta.json se reemplaza por la
// exportación real (mismo formato, ver src/types.ts) y este script ya no se usa.
import { existsSync, writeFileSync } from 'node:fs';

const PENSUM_OUT = new URL('../src/datos/pensum.json', import.meta.url);
const OFERTA_OUT = new URL('../src/datos/oferta.json', import.meta.url);
// --si-falta: no pisa archivos existentes (así la oferta real de Oracle nunca se sobrescribe)
if (process.argv.includes('--si-falta') && existsSync(PENSUM_OUT) && existsSync(OFERTA_OUT)) process.exit(0);

// [id, nombre, créditos, semestre, prerrequisitos]
// Tomado de la malla oficial de Administración de Empresas (prerrequisitos por validar con Registro Académico)
const PENSUM = [
  ['ma1','Matemáticas Aplicadas 1',4,1,[]],['ce','Comunicación Escrita',3,1,[]],['ie','Introducción a la Economía',3,1,[]],['he','Historia Empresarial',2,1,[]],['fa','Fundamentos de Administración',3,1,[]],['cb','Contabilidad Básica',3,1,[]],['idr','Introducción al Derecho',2,1,[]],['b1','Bienestar 1',0,1,[]],
  ['ma2','Matemáticas Aplicadas 2',3,2,['ma1']],['co','Comunicación Oral',3,2,['ce']],['mi','Microeconomía',3,2,['ie','ma1']],['pa','Pensamiento Administrativo',2,2,[]],['ac','Administración de Costos',2,2,['cb']],['tic','TIC Aplicadas a la Toma de Decisiones',2,2,[]],['dn','Derecho de Negocios',2,2,['idr']],['es1','Electiva Sociohumanística 1',2,2,[]],['i1','Idiomas 1',0,2,[]],['b2','Bienestar 2',0,2,['b1']],
  ['ep','Estadística y Probabilidad',3,3,['ma2']],['mac','Macroeconomía',3,3,['mi']],['pm','Principios de Mercadeo',3,3,[]],['pce','Planeación y Control Estratégico',3,3,['fa']],['anf','Análisis Financiero',2,3,['cb']],['ci','Creatividad e Innovación',2,3,[]],['dl','Derecho Laboral',2,3,['idr']],['es2','Electiva Sociohumanística 2',2,3,[]],['i2','Idiomas 2',0,3,['i1']],['gl','Grandes Líderes',0,3,[]],['b3','Bienestar 3',0,3,['b2']],
  ['ea','Estadística Aplicada',3,4,['ep']],['hec','Historia Económica',2,4,[]],['dor','Diseño Organizacional',3,4,['pce']],['mf','Matemáticas Financieras',3,4,['cb']],['gh','Gestión Humana',3,4,[]],['dt','Derecho Tributario',2,4,['idr']],['pie','Proyecto Integrador Espíritu Emprendedor',4,4,['ci']],['i3','Idiomas 3',0,4,['i2']],['b4','Bienestar 4',0,4,['b3']],
  ['io','Investigación de Operaciones',3,5,[]],['coy','Coyuntura Económica',3,5,['mac']],['im','Investigación de Mercados',2,5,['pm','ep']],['tp','Transformación Personal',2,5,[]],['adf','Administración Financiera',3,5,['mf']],['cor','Comportamiento Organizacional',3,5,['gh']],['gp','Gestión para lo Público',2,5,[]],['es3','Electiva Sociohumanística 3',2,5,[]],['i4','Idiomas 4',0,5,['i3']],['b5','Bienestar 5',0,5,['b4']],
  ['v1','Visitas 1',2,6,['adf']],['ao','Administración de Operaciones',3,6,['io']],['dc','Dirección Comercial',2,6,[]],['to','Transformación Organizacional',2,6,[]],['ni','Negocios Internacionales',2,6,['pce']],['mc','Mercado de Capitales',3,6,['mf']],['gi','Gestión de Innovación',2,6,[]],['mtd','Modelos para la Toma de Decisiones',3,6,['tic','adf']],['b6','Bienestar 6',0,6,['b5']],
  ['v2','Visitas 2',3,7,[]],['gcs','Gerencia de la Cadena de Suministro',3,7,[]],['spv','Seminario Preparación Vida Laboral',0,7,['v1']],['md','Marketing Digital',2,7,[]],['se','Sostenibilidad Empresarial',3,7,[]],['pf','Planeación Financiera',3,7,['adf']],['epr1','Electiva Profesional 1',3,7,['mtd']],['pire','Proyecto Integrador Reto Empresarial',4,7,['gi','mtd']],
  ['p1','Práctica 1',10,8,['spv']],['dem','Dirección Estratégica de Mercadeo',3,8,[]],['epr2','Electiva Profesional 2',3,8,['mtd']],['sinv','Seminario de Investigación',2,8,[]],
  ['p2','Práctica 2',10,9,['p1']],['ri','Requisito Inglés',0,9,[]],['li','Liderazgo',2,9,[]],['epr3','Electiva Profesional 3',3,9,['mtd']],['tg','Trabajo de Grado',3,9,['sinv']],
];

// Filas de la malla oficial (una fila por línea de formación)
const GRID = [
  ['ma1','ma2','ep','ea',null,'v1','v2','p1','p2'],
  ['ce','co',null,null,'io','ao','gcs',null,'ri'],
  ['ie','mi','mac','hec','coy',null,'spv',null,null],
  [null,null,'pm',null,'im','dc','md','dem',null],
  ['he',null,null,null,'tp','to',null,null,'li'],
  ['fa','pa','pce','dor',null,'ni','se',null,null],
  ['cb','ac','anf','mf','adf','mc','pf',null,null],
  [null,null,'ci','gh','cor','gi',null,null,null],
  [null,'tic',null,null,null,'mtd','epr1','epr2','epr3'],
  ['idr','dn','dl','dt','gp',null,null,null,null],
  [null,'es1','es2','pie','es3',null,'pire','sinv','tg'],
  [null,'i1','i2','i3','i4',null,null,null,null],
  [null,null,'gl',null,null,null,null,null,null],
];
const fila = {};
GRID.forEach((row, r) => row.forEach((id) => { if (id) fila[id] = r; }));

function tipoDe(id) {
  if (/^b\d$/.test(id)) return 'bienestar';
  if (/^es\d$/.test(id)) return 'electivaSH';
  if (['p1', 'p2', 'ri'].includes(id)) return 'sinHorario';
  return 'regular';
}

const pensum = {
  programa: 'Administración de Empresas — CESA',
  totalCreditos: 175,
  limiteCreditosSemestre: 21,
  creditosPorSemestre: [20, 19, 20, 20, 20, 19, 21, 18, 18],
  materias: PENSUM.map(([id, nombre, creditos, semestre, prerrequisitos]) => {
    const m = { id, nombre, creditos, semestre, prerrequisitos, tipo: tipoDe(id) };
    if (fila[id] !== undefined) m.fila = fila[id];
    return m;
  }),
};

// Práctica 1 exige aprobar todo hasta VII semestre: materias, idiomas, bienestar y el seminario de preparación
pensum.materias.find((m) => m.id === 'p1').prerrequisitos = pensum.materias.filter((m) => m.semestre <= 7).map((m) => m.id);

// ───────────── Oferta simulada ─────────────
// RNG con semilla para que el archivo sea siempre el mismo
let seed = 20271;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const DIA = { Lun: 'Lun', Mar: 'Mar', 'Mié': 'Mie', Mie: 'Mie', Jue: 'Jue', Vie: 'Vie', 'Sáb': 'Sab' };
// "Lun y Mié · 8:00 – 10:00"  |  "Mar · 7:00 – 9:00 y Mié · 14:00 – 16:00"
function parse(txt) {
  const out = [];
  for (const parte of txt.split(/(?<=\d) y /)) {
    const [dias, horas] = parte.split(' · ');
    const [a, b] = horas.split(' – ').map((h) => { const [H, M] = h.split(':').map(Number); return H + M / 60; });
    for (const d of dias.split(' y ')) out.push({ dia: DIA[d.trim()], inicio: a, fin: b });
  }
  return out;
}

// Grupos hechos a mano (los mismos del diseño de pantallas), con cruces a propósito
const MANUAL = {
  'mtd|C. Herrera': [['Grupo 1', 'Lun y Mié · 8:00 – 10:00'], ['Grupo 2', 'Mar y Jue · 10:00 – 12:00'], ['Grupo 3', 'Lun y Mié · 7:00 – 9:00']],
  'mtd|M. Duarte': [['Grupo 4', 'Mar y Jue · 14:00 – 16:00']],
  'mc|A. Salazar': [['Grupo 1', 'Lun y Mié · 9:00 – 11:00'], ['Grupo 2', 'Lun y Mié · 10:00 – 12:00']],
  'mc|P. Vargas': [['Grupo 3', 'Lun y Mié · 10:00 – 12:00']],
  'mc|L. Rincón': [['Grupo 4', 'Mar y Jue · 16:00 – 18:00']],
  'io|D. Quintero': [['Grupo 1', 'Mar y Jue · 9:00 – 11:00'], ['Grupo 3', 'Lun y Mié · 11:00 – 13:00']],
  'io|S. Castaño': [['Grupo 2', 'Mar y Jue · 14:00 – 16:00']],
  'v1|R. Méndez': [['Grupo 1', 'Jue · 14:00 – 16:00'], ['Grupo 2', 'Mar · 9:00 – 11:00'], ['Grupo 3', 'Vie · 10:00 – 12:00']],
  'ni|N. Acosta': [['Grupo 1', 'Mié · 14:00 – 16:00'], ['Grupo 2', 'Mar y Jue · 11:00 – 13:00']],
  'ni|F. Galindo': [['Grupo 3', 'Mar · 7:00 – 9:00 y Mié · 14:00 – 16:00']],
  'dc|V. Ortiz': [['Grupo 1', 'Lun · 14:00 – 16:00']],
  'dc|J. Pardo': [['Grupo 2', 'Vie · 10:00 – 12:00']],
  'to|E. Lozano': [['Grupo 2', 'Mar · 11:00 – 13:00'], ['Grupo 3', 'Mié · 14:00 – 16:00']],
  'to|G. Beltrán': [['Grupo 1', 'Vie · 12:00 – 14:00']],
  'gi|K. Montoya': [['Grupo 1', 'Mar y Jue · 16:00 – 18:00']],
  'gi|H. Suárez': [['Grupo 2', 'Vie · 8:00 – 10:00']],
};

const NOMBRES = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'I.', 'J.', 'L.', 'M.', 'N.', 'O.', 'P.', 'R.', 'S.', 'T.', 'V.'];
const APELLIDOS = ['Arango', 'Bernal', 'Cárdenas', 'Díaz', 'Escobar', 'Forero', 'Gaitán', 'Hoyos', 'Jaramillo', 'López', 'Mejía', 'Naranjo', 'Ospina', 'Peña', 'Restrepo', 'Sierra', 'Torres', 'Uribe', 'Valencia', 'Zapata', 'Rojas', 'Camacho', 'Molina', 'Guerrero'];
const PARES = [['Lun', 'Mie'], ['Mar', 'Jue']];
const INICIOS = [7, 8, 9, 10, 11, 14, 16];

const grupos = [];
let nrc = 30100;
const nuevoNrc = () => String(nrc++);

for (const m of pensum.materias) {
  if (m.tipo !== 'regular') continue;
  const manuales = Object.entries(MANUAL).filter(([k]) => k.startsWith(m.id + '|'));
  if (manuales.length) {
    for (const [k, gs] of manuales) {
      const profesor = k.split('|')[1];
      for (const [g, txt] of gs) {
        grupos.push({ nrc: nuevoNrc(), materiaId: m.id, grupo: g, profesor, tipo: 'regular', esSeleccion: false, cupos: 25 + Math.floor(rnd() * 15), sesiones: parse(txt) });
      }
    }
    continue;
  }
  const nProfes = 1 + Math.floor(rnd() * 3); // 1 a 3 profesores
  let g = 1;
  for (let p = 0; p < nProfes; p++) {
    const profesor = `${pick(NOMBRES)} ${pick(APELLIDOS)}`;
    const nGrupos = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < nGrupos; k++) {
      const ini = pick(INICIOS);
      let sesiones;
      if (m.creditos >= 3 || m.creditos === 0) {
        const par = pick(PARES);
        sesiones = par.map((dia) => ({ dia, inicio: ini, fin: ini + 2 }));
      } else {
        sesiones = [{ dia: pick(['Lun', 'Mar', 'Mie', 'Jue', 'Vie']), inicio: ini, fin: ini + 2 }];
      }
      grupos.push({ nrc: nuevoNrc(), materiaId: m.id, grupo: `Grupo ${g++}`, profesor, tipo: 'regular', esSeleccion: false, cupos: 20 + Math.floor(rnd() * 20), sesiones });
    }
  }
}

// Bienestar: se elige por actividad
const BIENESTAR = [
  ['Tenis', 'Mar · 15:00 – 17:00'], ['Tenis', 'Jue · 16:00 – 18:00'],
  ['Golf', 'Mar · 16:00 – 18:00'], ['Golf', 'Vie · 8:00 – 10:00'],
  ['Fútbol', 'Jue · 16:00 – 18:00'],
  ['Cata de vino', 'Mar · 14:00 – 16:00'], ['Cata de vino', 'Mié · 16:00 – 18:00'],
  ['Yoga', 'Vie · 7:00 – 9:00'], ['Yoga', 'Lun · 16:00 – 18:00'],
  ['Teatro', 'Lun · 16:00 – 18:00'],
  ['Fotografía', 'Mié · 16:00 – 18:00'],
];
BIENESTAR.forEach(([actividad, txt], i) => grupos.push({ nrc: nuevoNrc(), materiaId: 'BIENESTAR', grupo: `Grupo ${i + 1}`, actividad, tipo: 'actividad', esSeleccion: false, cupos: 20, sesiones: parse(txt) }));

// Electivas sociohumanísticas: se eligen por tema
const ELECTIVAS = [
  ['Cine y sociedad', 'Lun · 14:00 – 16:00'], ['Filosofía del arte', 'Mar · 16:00 – 18:00'],
  ['Historia de Colombia', 'Mié · 7:00 – 9:00'], ['Ética y ciudadanía', 'Jue · 14:00 – 16:00'],
  ['Literatura latinoamericana', 'Vie · 10:00 – 12:00'],
];
ELECTIVAS.forEach(([actividad, txt], i) => grupos.push({ nrc: nuevoNrc(), materiaId: 'ELECTIVA_SH', grupo: `Grupo ${i + 1}`, actividad, tipo: 'actividad', esSeleccion: false, cupos: 30, sesiones: parse(txt) }));

// Selecciones deportivas: nunca se asignan solas, solo si el estudiante declara que pertenece
const SELECCIONES = [
  ['Selección de fútbol', 'Mar y Jue · 16:00 – 18:00'],
  ['Selección de voleibol', 'Lun y Mié · 16:00 – 18:00'],
  ['Selección de baloncesto', 'Mar y Vie · 16:00 – 18:00'],
];
SELECCIONES.forEach(([actividad, txt], i) => grupos.push({ nrc: nuevoNrc(), materiaId: 'SELECCION', grupo: `Grupo ${i + 1}`, actividad, tipo: 'actividad', esSeleccion: true, cupos: 25, sesiones: parse(txt) }));

const oferta = { periodo: '2027-1', generadoEn: '2026-09-23T00:00:00Z', fuente: 'simulada', grupos };

writeFileSync(PENSUM_OUT, JSON.stringify(pensum, null, 2));
writeFileSync(OFERTA_OUT, JSON.stringify(oferta, null, 2));
console.log(`pensum.json: ${pensum.materias.length} materias · oferta.json: ${grupos.length} grupos`);
