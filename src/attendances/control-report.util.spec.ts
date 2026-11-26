import {
  etiquetaEstadoControl,
  evaluarAsistenciaControl,
} from './control-report.util';

describe('evaluarAsistenciaControl', () => {
  const umbrales = { diasAlertaAusentismo: 3, diasAlertaCritica: 6 };

  it('no asigna 0% ni Normal cuando el alumno no tiene registros', () => {
    expect(
      evaluarAsistenciaControl({
        totalRegistrado: 0,
        presentes: 0,
        tardanzas: 0,
        faltasInjustificadas: 0,
        ...umbrales,
      }),
    ).toEqual({ asistenciaPct: null, nivelAlerta: 'sin_registro' });
    expect(etiquetaEstadoControl('sin_registro')).toBe('Sin registro');
  });

  it('calcula el porcentaje solo con días ya registrados', () => {
    expect(
      evaluarAsistenciaControl({
        totalRegistrado: 4,
        presentes: 3,
        tardanzas: 1,
        faltasInjustificadas: 0,
        ...umbrales,
      }),
    ).toEqual({ asistenciaPct: 100, nivelAlerta: 'normal' });
  });

  it('marca alerta o crítico según las faltas injustificadas ya ocurridas', () => {
    expect(
      evaluarAsistenciaControl({
        totalRegistrado: 5,
        presentes: 1,
        tardanzas: 0,
        faltasInjustificadas: 4,
        ...umbrales,
      }).nivelAlerta,
    ).toBe('alerta');
    expect(
      evaluarAsistenciaControl({
        totalRegistrado: 8,
        presentes: 1,
        tardanzas: 0,
        faltasInjustificadas: 7,
        ...umbrales,
      }).nivelAlerta,
    ).toBe('critico');
  });
});
