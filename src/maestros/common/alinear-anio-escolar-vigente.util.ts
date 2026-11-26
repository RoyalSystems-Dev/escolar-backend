import { Repository } from 'typeorm';
import { Institution } from '../../institution/entities/institution.entity';
import { fechaEnRangoAnioEscolar } from '../anios-escolares/anio-escolar-calendario-copy.util';
import {
  ANIO_ESCOLAR_REGISTRO_MAX,
  ANIO_ESCOLAR_REGISTRO_MIN,
} from '../anios-escolares/anio-escolar.constants';
import { MaestroAnioEscolar } from '../anios-escolares/entities/maestro-anio-escolar.entity';

function anioInstitucionalValido(anio: number): boolean {
  return (
    Number.isFinite(anio) &&
    anio >= ANIO_ESCOLAR_REGISTRO_MIN &&
    anio <= ANIO_ESCOLAR_REGISTRO_MAX
  );
}

/**
 * Alinea el flag «vigente» en maestros con Administración → Institución (campo anio).
 * Fallback: año activo cuyo rango contiene hoy; luego el vigente manual.
 * No modifica institution.anio (la config. institucional es la fuente de verdad).
 */
export async function alinearAnioEscolarVigentePorFecha(
  anioRepo: Repository<MaestroAnioEscolar>,
  institutionRepo: Repository<Institution>,
  institutionId: number,
  hoy: string,
): Promise<{ anio: number; changed: boolean } | null> {
  const inst = await institutionRepo.findOneBy({ id: institutionId });
  const anioInst = Number(inst?.anio);

  const rows = (
    await anioRepo.find({
      where: { institutionId, activo: true, estado: 'activo' },
      order: { anio: 'DESC' },
    })
  ).filter((row) => anioInstitucionalValido(row.anio));
  if (!rows.length) return null;

  const porInstitucion =
    anioInstitucionalValido(anioInst) ?
      rows.find((r) => r.anio === anioInst)
    : undefined;
  const enCurso = rows.find((r) => fechaEnRangoAnioEscolar(hoy, r.fechaInicio, r.fechaFin));
  const vigentes = rows.filter((r) => r.vigente);
  const objetivo = porInstitucion ?? enCurso ?? vigentes[0] ?? rows[0];

  const yaCorrecto =
    objetivo.vigente && vigentes.length === 1 && vigentes[0].id === objetivo.id;

  let changed = false;
  if (!yaCorrecto) {
    await anioRepo
      .createQueryBuilder()
      .update(MaestroAnioEscolar)
      .set({ vigente: false })
      .where('institutionId = :institutionId', { institutionId })
      .andWhere('activo = true')
      .execute();
    objetivo.vigente = true;
    await anioRepo.save(objetivo);
    changed = true;
  }

  return { anio: objetivo.anio, changed };
}
