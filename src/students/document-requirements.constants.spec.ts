import {
  MENSAJE_REQUISITOS_SIN_DATOS,
  requisitosConDatos,
} from './document-requirements.constants';

describe('requisitosConDatos', () => {
  it('no deja datos cuando no se envía la lista', () => {
    expect(requisitosConDatos(null)).toEqual([]);
    expect(requisitosConDatos(undefined)).toEqual([]);
    expect(requisitosConDatos([])).toEqual([]);
  });

  it('descarta tipos en blanco', () => {
    expect(
      requisitosConDatos([
        { tipo: '   ', obligatorio: true },
        { tipo: '', obligatorio: false },
      ]),
    ).toEqual([]);
  });

  it('descarta el catálogo si no trae número, archivo ni estado', () => {
    expect(
      requisitosConDatos([
        { tipo: 'DNI del alumno', obligatorio: true },
        { tipo: 'Ficha de Matrícula (FUT)', obligatorio: true, estado: 'pendiente', numero: '  ' },
        { tipo: 'Partida de Nacimiento', obligatorio: true, fechaEntrega: '09/10/2026' },
      ]),
    ).toEqual([]);
  });

  it('conserva el requisito que sí trae un dato', () => {
    expect(
      requisitosConDatos([{ tipo: '  DNI del alumno  ', obligatorio: true, numero: ' 12345678 ' }]),
    ).toEqual([
      {
        tipo: 'DNI del alumno',
        obligatorio: true,
        numero: '12345678',
        estado: 'pendiente',
        fechaEntrega: '',
        imagenUrl: '',
        tieneArchivo: false,
      },
    ]);
  });

  it('el aviso dice que no se procesa por falta de datos', () => {
    expect(MENSAJE_REQUISITOS_SIN_DATOS).toBe(
      'No se procesa por falta de datos de requisitos de matrícula.',
    );
  });
});
