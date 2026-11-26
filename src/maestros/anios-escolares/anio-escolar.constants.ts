/** Años lectivos que se listan y se pueden registrar (oculta registros fuera de rango, p. ej. 2064). */
export const ANIO_ESCOLAR_REGISTRO_MIN = 2024;
export const ANIO_ESCOLAR_REGISTRO_MAX = 2027;

export const PERMISO_CALENDARIZACION_VER = 'calendarizacion.ver';
export const PERMISO_CALENDARIZACION_GESTIONAR = 'calendarizacion.gestionar';

export const ESTADOS_ANIO_ESCOLAR = ['planificado', 'activo', 'cerrado'] as const;
export type EstadoAnioEscolar = (typeof ESTADOS_ANIO_ESCOLAR)[number];

export const TIPOS_PERIODO_ANIO_ESCOLAR = ['bimestre', 'trimestre', 'semestre'] as const;
export type TipoPeriodoAnioEscolar = (typeof TIPOS_PERIODO_ANIO_ESCOLAR)[number];

export const ESTADO_ANIO_ESCOLAR_LABEL: Record<EstadoAnioEscolar, string> = {
  planificado: 'Planificado',
  activo: 'Activo',
  cerrado: 'Cerrado',
};
