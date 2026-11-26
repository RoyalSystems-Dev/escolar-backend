import {
  curriculaSolapan,
  mensajeCurriculaDuplicada,
  normalizarSeccionCurricula,
} from './curricula-unicidad.util';

describe('curricula-unicidad', () => {
  it('normaliza la sección', () => {
    expect(normalizarSeccionCurricula(' a ')).toBe('A');
    expect(normalizarSeccionCurricula(null)).toBe('');
  });

  it('una currícula sin sección cubre cualquier otra del mismo año y nivel', () => {
    expect(curriculaSolapan('', 'A')).toBe(true);
    expect(curriculaSolapan('A', '')).toBe(true);
    expect(curriculaSolapan('A', 'B')).toBe(false);
    expect(curriculaSolapan('A', 'a')).toBe(true);
  });

  it('explica por qué no se puede repetir', () => {
    expect(mensajeCurriculaDuplicada('Inicial', 2026, 'B', '')).toContain('esta institución');
    expect(mensajeCurriculaDuplicada('Inicial', 2026, 'A', 'A')).toContain('sección A');
  });
});
