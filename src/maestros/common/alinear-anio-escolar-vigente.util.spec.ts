import { fechaEnRangoAnioEscolar } from '../anios-escolares/anio-escolar-calendario-copy.util';

describe('alinear-anio-escolar-vigente (reglas)', () => {
  it('2026-06-15 cae dentro del A.E. 2026 por defecto', () => {
    expect(fechaEnRangoAnioEscolar('2026-06-15', '2026-03-01', '2026-12-20')).toBe(true);
  });

  it('2025-11-10 no cae en el A.E. 2026', () => {
    expect(fechaEnRangoAnioEscolar('2025-11-10', '2026-03-01', '2026-12-20')).toBe(false);
  });

  it('2064-06-15 no es el calendario del A.E. 2026', () => {
    expect(fechaEnRangoAnioEscolar('2026-06-15', '2064-03-01', '2064-12-20')).toBe(false);
  });
});
