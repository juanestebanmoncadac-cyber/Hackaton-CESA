// Genera los JSON que consume la app desde la oferta activa o el escenario simulado.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { convertirBacktest } from './convertir-backtest.mjs';

const PENSUM_OUT = new URL('../src/datos/pensum.json', import.meta.url);
const OFERTA_OUT = new URL('../src/datos/oferta.json', import.meta.url);
const OFERTA_ACTIVA = new URL('../data/oferta-activa.json', import.meta.url);

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
  if (['p1', 'p2', 'ri', 'tg'].includes(id)) return 'sinHorario';
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

// Oferta sintética de backtesting, convertida al contrato del frontend.
// El archivo fuente contiene secciones, profesores y horarios de prueba;
// las opciones de Bienestar provienen del folleto, con grupos también simulados.
const oferta = existsSync(OFERTA_ACTIVA)
  ? JSON.parse(readFileSync(OFERTA_ACTIVA, 'utf8'))
  : convertirBacktest(pensum, JSON.parse(readFileSync(new URL('./cesa-backtest.json', import.meta.url), 'utf8')));

writeFileSync(PENSUM_OUT, JSON.stringify(pensum, null, 2));
writeFileSync(OFERTA_OUT, JSON.stringify(oferta, null, 2));
console.log(`pensum.json: ${pensum.materias.length} materias · oferta.json: ${oferta.grupos.length} grupos (${existsSync(OFERTA_ACTIVA) ? 'oferta activa' : 'simulación'})`);
