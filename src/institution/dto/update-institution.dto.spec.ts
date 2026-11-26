import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateInstitutionDto } from './update-institution.dto';

async function erroresDe(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdateInstitutionDto, body);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('UpdateInstitutionDto datos generales', () => {
  it('acepta los datos reales de la institución y deja vacíos los opcionales', async () => {
    await expect(
      erroresDe({
        nombre: 'I.E.P. San Martin de Porres',
        siglas: 'IEP SMP',
        ruc: '20512345789',
        codigoModular: '0654321',
        tipoGestion: 'privada',
        ugel: 'UGEL 01',
        dre: 'DRELM',
        resolucion: 'RD N 1234-2005',
        direccion: 'Av. Los Heroes 123',
        distrito: 'San Juan de Miraflores',
        provincia: 'Lima',
        region: 'Lima',
        codigoPostal: '15800',
        telefono: '01-5551234',
        telefono2: '',
        email: 'info@sanmartin.edu.pe',
        web: 'https://www.sanmartin.edu.pe',
        facebook: '',
        director: 'Juan Carlos Perez Torres',
        subdirector: '',
        administrador: '',
        anio: '2026',
        sistemaEval: 'mixto',
        tipoPeriodo: 'bimestre',
        notaMinima: 11,
        escalaLogro: { AD: 17.5, A: 14, B: 11 },
      }),
    ).resolves.toEqual([]);
  });

  it('rechaza valores que no coinciden con el tipo del campo', async () => {
    const props = await erroresDe({
      ruc: '20A',
      codigoModular: 'MOD-1',
      codigoPostal: 'Lima',
      telefono: 'abc',
      email: 'correo-sin-arroba',
      web: 'www.colegio.edu.pe',
      director: 'Juan 2',
      anio: '26',
      notaMinima: 25,
    });
    expect(props).toEqual(
      expect.arrayContaining([
        'ruc',
        'codigoModular',
        'codigoPostal',
        'telefono',
        'email',
        'web',
        'director',
        'anio',
        'notaMinima',
      ]),
    );
  });
});
