import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';
import { AuditLoggerService } from '../../audit-logs/audit-logger.service';
import { Institution } from '../../institution/entities/institution.entity';
import { CatalogCacheService } from '../../common/catalog-cache.service';
import {
  ANIO_ESCOLAR_REGISTRO_MAX,
  ANIO_ESCOLAR_REGISTRO_MIN,
  type TipoPeriodoAnioEscolar,
} from '../anios-escolares/anio-escolar.constants';
import {
  fechasDefectoAnioEscolar,
  plantillaPeriodosAnioEscolar,
} from '../anios-escolares/anio-escolar-periodos.util';
import { MaestroAnioEscolar } from '../anios-escolares/entities/maestro-anio-escolar.entity';
import {
  CreateMaestroPeriodoAcademicoDto,
  DividirPeriodosAnioEscolarDto,
  UpdateMaestroPeriodoAcademicoDto,
} from './dto/maestro-periodo-academico.dto';
import {
  MaestroPeriodoAcademico,
  MaestroPeriodoEstado,
  MaestroPeriodoTipo,
} from './entities/maestro-periodo-academico.entity';
import {
  assertPeriodoDentroDeAnioEscolar,
  assertPlantillaDentroDeAnio,
  assertSinSolapamientoPeriodo,
  plantillaCoincideConExistentes,
} from './periodo-academico-validation.util';
import { MAESTRO_PERIODOS_ACADEMICOS_SEED } from './periodos-academicos-seed.data';
import {
  applyAniosInstitucionWhere,
  applyInstitutionIdWhere,
  assertMaestroBelongsToInstitution,
  filterAniosEscolaresPorInstitucion,
  requireMaestrosInstitutionId,
  resolveMaestrosAniosEscolares,
  resolveMaestrosInstitutionId,
  resolveSeedInstitutionId,
} from '../common/maestros-tenant.util';
import { alinearAnioEscolarVigentePorFecha } from '../common/alinear-anio-escolar-vigente.util';
import { formatIsoDate } from '../feriados/feriados.service';

export interface PeriodoAcademicoActorContext {
  req: Request;
}

export interface AnioEscolarCatalogoItem {
  anio: number;
  tipoPeriodo: TipoPeriodoAnioEscolar;
  estado?: string;
  fechaInicio?: string;
  fechaFin?: string;
  vigente?: boolean;
}

export interface DividirPeriodosResultado {
  anioEscolar: number;
  tipo: TipoPeriodoAnioEscolar;
  creados: number;
  actualizados: number;
  omitidos: number;
  version?: number;
  recuperado?: boolean;
  mensaje: string;
  periodos: MaestroPeriodoAcademicoResponse[];
}

export interface MaestroPeriodoAcademicoResponse {
  id: number;
  anioEscolar: number;
  numero: number;
  nombre: string;
  tipo: MaestroPeriodoTipo;
  inicio: string;
  fin: string;
  actual: boolean;
  descripcion: string;
  activo: boolean;
  estado: MaestroPeriodoEstado;
  inicioDisplay: string;
  finDisplay: string;
  duracionDias: number;
  duracionSemanas: number;
}

@Injectable()
export class PeriodosAcademicosMaestrosService {
  constructor(
    @InjectRepository(MaestroPeriodoAcademico)
    private readonly periodoRepo: Repository<MaestroPeriodoAcademico>,
    @InjectRepository(MaestroAnioEscolar)
    private readonly anioEscolarRepo: Repository<MaestroAnioEscolar>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly catalogCache: CatalogCacheService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async seedCatalogIfEmpty(): Promise<void> {
    if ((await this.periodoRepo.count()) === 0) {
      await this.migrarDesdeInstitucion();
    }
    if ((await this.periodoRepo.count()) === 0) {
      const institutionId = await resolveSeedInstitutionId(
        this.dataSource.getRepository(Institution),
      );
      await this.periodoRepo.save(
        MAESTRO_PERIODOS_ACADEMICOS_SEED.map((p) =>
          this.periodoRepo.create({
            ...p,
            institutionId,
            descripcion: p.descripcion ?? '',
            activo: true,
          }),
        ),
      );
      return;
    }

    await this.ensureSeedPeriodos();
  }

  private async ensureSeedPeriodos(): Promise<void> {
    const institutionId = await resolveSeedInstitutionId(
      this.dataSource.getRepository(Institution),
    );
    const existing = await this.periodoRepo.find({
      where: { institutionId },
      select: { anioEscolar: true, numero: true },
    });
    const keys = new Set(existing.map((p) => `${p.anioEscolar}-${p.numero}`));
    const missing = MAESTRO_PERIODOS_ACADEMICOS_SEED.filter(
      (p) => !keys.has(`${p.anioEscolar}-${p.numero}`),
    );
    if (!missing.length) return;

    await this.periodoRepo.save(
      missing.map((p) =>
        this.periodoRepo.create({
          ...p,
          institutionId,
          descripcion: p.descripcion ?? '',
          activo: true,
        }),
      ),
    );
  }

  /** Años escolares disponibles para calendarización (maestros + periodos existentes). */
  async listCatalogoAniosEscolares(
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<AnioEscolarCatalogoItem[]> {
    const institutionId = ctx?.req
      ? resolveMaestrosInstitutionId(ctx.req)
      : undefined;
    if (institutionId != null) {
      await this.ensureAnioEscolarVigente(institutionId);
    }
    const aniosInstitucion = await this.resolveAniosInstitucion(ctx?.req);
    const cacheKey = `periodos:catalogo-anios:${JSON.stringify(aniosInstitucion ?? 'all')}`;
    return this.catalogCache.wrap(
      cacheKey,
      () => this.listCatalogoAniosEscolaresUncached(aniosInstitucion),
      60_000,
    );
  }

  private async listCatalogoAniosEscolaresUncached(
    aniosInstitucion?: number[] | null,
  ): Promise<AnioEscolarCatalogoItem[]> {
    if (aniosInstitucion !== undefined && aniosInstitucion !== null && !aniosInstitucion.length) {
      return [];
    }

    const map = new Map<number, AnioEscolarCatalogoItem>();

    const anios = aniosInstitucion?.length
      ? await this.anioEscolarRepo
          .createQueryBuilder('a')
          .where('a.activo = true')
          .andWhere('a.anio IN (:...anios)', { anios: aniosInstitucion })
          .andWhere('a.anio >= :anioMin', { anioMin: ANIO_ESCOLAR_REGISTRO_MIN })
          .andWhere('a.anio <= :anioMax', { anioMax: ANIO_ESCOLAR_REGISTRO_MAX })
          .orderBy('a.anio', 'DESC')
          .getMany()
      : await this.anioEscolarRepo
          .createQueryBuilder('a')
          .where('a.activo = true')
          .andWhere('a.anio >= :anioMin', { anioMin: ANIO_ESCOLAR_REGISTRO_MIN })
          .andWhere('a.anio <= :anioMax', { anioMax: ANIO_ESCOLAR_REGISTRO_MAX })
          .orderBy('a.anio', 'DESC')
          .getMany();
    for (const row of anios) {
      if (row.anio < ANIO_ESCOLAR_REGISTRO_MIN || row.anio > ANIO_ESCOLAR_REGISTRO_MAX) continue;
      map.set(row.anio, {
        anio: row.anio,
        tipoPeriodo: row.tipoPeriodo,
        estado: row.estado,
        fechaInicio: row.fechaInicio,
        fechaFin: row.fechaFin,
        vigente: row.vigente,
      });
    }

    const periodosQb = this.periodoRepo
      .createQueryBuilder('p')
      .select('p.anioEscolar', 'anioEscolar')
      .addSelect('MAX(p.tipo)', 'tipo')
      .where('p.activo = true');
    if (
      aniosInstitucion !== undefined &&
      aniosInstitucion !== null &&
      !applyAniosInstitucionWhere(periodosQb, 'p', 'anioEscolar', aniosInstitucion)
    ) {
      return Array.from(map.values()).sort((a, b) => b.anio - a.anio);
    }
    const desdePeriodos = await periodosQb
      .groupBy('p.anioEscolar')
      .orderBy('p.anioEscolar', 'DESC')
      .getRawMany<{ anioEscolar: string; tipo: string }>();

    for (const row of desdePeriodos) {
      const anio = Number(row.anioEscolar);
      if (
        !Number.isFinite(anio) ||
        anio > ANIO_ESCOLAR_REGISTRO_MAX ||
        anio < ANIO_ESCOLAR_REGISTRO_MIN ||
        map.has(anio)
      ) {
        continue;
      }
      map.set(anio, {
        anio,
        tipoPeriodo: (row.tipo as TipoPeriodoAnioEscolar) ?? 'bimestre',
      });
    }

    return Array.from(map.values())
      .filter(
        (a) =>
          a.anio >= ANIO_ESCOLAR_REGISTRO_MIN && a.anio <= ANIO_ESCOLAR_REGISTRO_MAX,
      )
      .sort((a, b) => b.anio - a.anio);
  }

  async findAll(
    query?: {
      anioEscolar?: number;
      tipo?: string;
      activo?: boolean;
    },
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<MaestroPeriodoAcademicoResponse[]> {
    const institutionId = ctx?.req
      ? resolveMaestrosInstitutionId(ctx.req)
      : undefined;
    if (ctx?.req && institutionId == null) return [];

    const aniosInstitucion = await this.resolveAniosInstitucion(ctx?.req);
    if (institutionId != null) {
      await this.ensureAnioEscolarVigente(institutionId);
      const anio =
        query?.anioEscolar ??
        (await this.resolveAnioEscolarVigente(institutionId)) ??
        aniosInstitucion?.[0] ??
        new Date().getFullYear();
      await this.alinearPeriodoActualPorFecha(institutionId, anio);
    }
    const cacheKey = `periodos:list:${JSON.stringify({ ...query, institutionId, aniosInstitucion })}`;
    return this.catalogCache.wrap(cacheKey, () =>
      this.findAllUncached(query, institutionId, aniosInstitucion),
    );
  }

  private async findAllUncached(
    query?: {
      anioEscolar?: number;
      tipo?: string;
      activo?: boolean;
    },
    institutionId?: number,
    aniosInstitucion?: number[] | null,
  ): Promise<MaestroPeriodoAcademicoResponse[]> {
    const aniosFiltrados =
      aniosInstitucion !== undefined && aniosInstitucion !== null
        ? filterAniosEscolaresPorInstitucion(aniosInstitucion, query?.anioEscolar)
        : undefined;
    if (aniosFiltrados !== undefined && !aniosFiltrados.length) return [];

    const qb = this.periodoRepo
      .createQueryBuilder('p')
      .orderBy('p.anioEscolar', 'DESC')
      .addOrderBy('p.numero', 'ASC');

    applyInstitutionIdWhere(qb, 'p', institutionId);

    if (aniosFiltrados?.length) {
      qb.andWhere('p.anioEscolar IN (:...aniosInstitucion)', {
        aniosInstitucion: aniosFiltrados,
      });
    } else if (query?.anioEscolar) {
      qb.andWhere('p.anioEscolar = :anio', { anio: query.anioEscolar });
    }
    if (query?.tipo) {
      qb.andWhere('p.tipo = :tipo', { tipo: query.tipo });
    }
    if (query?.activo !== undefined) {
      qb.andWhere('p.activo = :activo', { activo: query.activo });
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: number): Promise<MaestroPeriodoAcademicoResponse> {
    const row = await this.getOrFail(id);
    return this.toResponse(row);
  }

  async create(
    dto: CreateMaestroPeriodoAcademicoDto,
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<MaestroPeriodoAcademicoResponse> {
    const institutionId = requireMaestrosInstitutionId(ctx?.req ?? {});
    this.validarFechas(dto.inicio, dto.fin);
    await this.assertUniqueNumero(institutionId, dto.anioEscolar, dto.numero);
    await this.assertReglasPeriodo(dto.anioEscolar, dto.inicio, dto.fin, dto.numero);
    await this.assertAnioNoCerrado(dto.anioEscolar);

    if (dto.actual) {
      await this.clearActual(institutionId, dto.anioEscolar);
    }

    const saved = await this.periodoRepo.save(
      this.periodoRepo.create({
        institutionId,
        anioEscolar: dto.anioEscolar,
        numero: dto.numero,
        nombre: dto.nombre.trim(),
        tipo: dto.tipo ?? 'bimestre',
        inicio: dto.inicio,
        fin: dto.fin,
        actual: dto.actual ?? false,
        descripcion: dto.descripcion?.trim() ?? '',
        activo: dto.activo ?? true,
      }),
    );
    this.catalogCache.invalidate('periodos:');
    this.auditPeriodo(ctx, 'crear', saved, 'Periodo académico registrado', {
      anioEscolar: saved.anioEscolar,
      numero: saved.numero,
    });
    return this.toResponse(saved);
  }

  async update(
    id: number,
    dto: UpdateMaestroPeriodoAcademicoDto,
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<MaestroPeriodoAcademicoResponse> {
    const institutionId = requireMaestrosInstitutionId(ctx?.req ?? {});
    const current = await this.getOrFail(id);
    assertMaestroBelongsToInstitution(current, institutionId);
    const inicio = dto.inicio ?? current.inicio;
    const fin = dto.fin ?? current.fin;
    this.validarFechas(inicio, fin);

    const anio = dto.anioEscolar ?? current.anioEscolar;
    const numero = dto.numero ?? current.numero;
    if (anio !== current.anioEscolar || numero !== current.numero) {
      await this.assertUniqueNumero(institutionId, anio, numero, id);
    }
    await this.assertReglasPeriodo(anio, inicio, fin, numero, id);
    await this.assertAnioNoCerrado(anio);

    if (dto.actual === true) {
      await this.clearActual(institutionId, anio, id);
    }

    const anterior = {
      inicio: current.inicio,
      fin: current.fin,
      nombre: current.nombre,
      numero: current.numero,
    };

    Object.assign(current, {
      ...dto,
      nombre: dto.nombre !== undefined ? dto.nombre.trim() : current.nombre,
      descripcion:
        dto.descripcion !== undefined
          ? dto.descripcion.trim()
          : current.descripcion,
    });

    const saved = await this.periodoRepo.save(current);
    this.catalogCache.invalidate('periodos:');
    this.auditPeriodo(ctx, 'actualizar', saved, 'Periodo académico actualizado', {
      anterior,
      nuevo: { inicio: saved.inicio, fin: saved.fin, nombre: saved.nombre, numero: saved.numero },
    });
    return this.toResponse(saved);
  }

  async marcarActual(
    id: number,
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<MaestroPeriodoAcademicoResponse> {
    const institutionId = requireMaestrosInstitutionId(ctx?.req ?? {});
    const current = await this.getOrFail(id);
    assertMaestroBelongsToInstitution(current, institutionId);
    await this.assertAnioNoCerrado(current.anioEscolar);
    await this.clearActual(institutionId, current.anioEscolar, id);
    current.actual = true;
    const saved = await this.periodoRepo.save(current);
    await this.mirrorActualEnInstitucion(saved);
    this.catalogCache.invalidate('periodos:');
    this.auditPeriodo(ctx, 'actualizar', saved, 'Periodo marcado como vigente', {
      numero: saved.numero,
      anioEscolar: saved.anioEscolar,
    });
    return this.toResponse(saved);
  }

  async remove(
    id: number,
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<{ deleted: boolean; id: number }> {
    const institutionId = requireMaestrosInstitutionId(ctx?.req ?? {});
    const current = await this.getOrFail(id);
    assertMaestroBelongsToInstitution(current, institutionId);
    await this.assertAnioNoCerrado(current.anioEscolar);
    current.activo = false;
    current.actual = false;
    await this.periodoRepo.save(current);
    this.catalogCache.invalidate('periodos:');
    this.auditPeriodo(ctx, 'eliminar', current, 'Periodo académico desactivado', {
      anioEscolar: current.anioEscolar,
      numero: current.numero,
    });
    return { deleted: true, id };
  }

  /** Divide un año escolar en periodos según plantilla MINEDU (bimestre/trimestre/semestre). */
  async dividirPeriodos(
    dto: DividirPeriodosAnioEscolarDto,
    ctx?: PeriodoAcademicoActorContext,
  ): Promise<DividirPeriodosResultado> {
    const anioRow = await this.resolveAnioEscolarRow(dto.anioEscolar);
    if (anioRow?.estado === 'cerrado') {
      throw new BadRequestException('No puede dividir periodos de un año escolar cerrado.');
    }

    const tipo = dto.tipo ?? anioRow?.tipoPeriodo ?? 'bimestre';
    const fechas = anioRow
      ? { fechaInicio: anioRow.fechaInicio, fechaFin: anioRow.fechaFin }
      : fechasDefectoAnioEscolar(dto.anioEscolar);

    const plantilla = plantillaPeriodosAnioEscolar(dto.anioEscolar, tipo);
    try {
      assertPlantillaDentroDeAnio(plantilla, fechas.fechaInicio, fechas.fechaFin);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }

    const existentes = await this.periodoRepo.find({
      where: { anioEscolar: dto.anioEscolar, activo: true },
      order: { numero: 'ASC' },
    });

    if (plantillaCoincideConExistentes(plantilla, existentes)) {
      const resultado: DividirPeriodosResultado = {
        anioEscolar: dto.anioEscolar,
        tipo,
        creados: 0,
        actualizados: 0,
        omitidos: plantilla.length,
        version: anioRow?.version,
        recuperado: true,
        mensaje: `El año ${dto.anioEscolar} ya tiene la plantilla de ${tipo} aplicada.`,
        periodos: existentes.map((p) => this.toResponse(p)),
      };
      return resultado;
    }

    if (existentes.length > 0 && !dto.sobreescribir) {
      throw new ConflictException(
        `El año ${dto.anioEscolar} ya tiene ${existentes.length} periodo(s). Use sobreescribir=true o elimínelos manualmente.`,
      );
    }

    const antes = existentes.map((p) => ({
      numero: p.numero,
      inicio: p.inicio,
      fin: p.fin,
      nombre: p.nombre,
    }));

    const institutionId = requireMaestrosInstitutionId(ctx?.req ?? {});

    let creados = 0;
    let actualizados = 0;

    await this.syncFromInstitution({
      id: institutionId,
      anio: String(dto.anioEscolar),
      periodos: plantilla,
    });

    for (const p of plantilla) {
      const prev = existentes.find((e) => e.numero === p.numero);
      if (prev) actualizados += 1;
      else creados += 1;
    }

    let version = anioRow?.version;
    if (anioRow) {
      anioRow.version += 1;
      if (dto.tipo && dto.tipo !== anioRow.tipoPeriodo) {
        anioRow.tipoPeriodo = dto.tipo;
      }
      const savedAnio = await this.anioEscolarRepo.save(anioRow);
      version = savedAnio.version;
    }

    const periodos = await this.periodoRepo.find({
      where: { anioEscolar: dto.anioEscolar, activo: true },
      order: { numero: 'ASC' },
    });

    this.catalogCache.invalidate('periodos:');

    const resultado: DividirPeriodosResultado = {
      anioEscolar: dto.anioEscolar,
      tipo,
      creados,
      actualizados,
      omitidos: 0,
      version,
      mensaje: `Año ${dto.anioEscolar} dividido en ${plantilla.length} periodo(s) (${tipo}).`,
      periodos: periodos.map((p) => this.toResponse(p)),
    };

    this.auditPeriodo(ctx, 'crear', periodos[0] ?? null, 'Año escolar dividido en periodos', {
      anioEscolar: dto.anioEscolar,
      tipo,
      creados,
      actualizados,
      version,
      motivo: dto.motivo ?? '',
      idempotencyKey: dto.idempotencyKey ?? null,
      anterior: antes,
      plantilla,
    });

    return resultado;
  }

  private async migrarDesdeInstitucion(): Promise<void> {
    const inst = await this.dataSource.getRepository(Institution).findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!inst?.periodos?.length) return;

    const anio = Number(inst.anio) || new Date().getFullYear();
    await this.periodoRepo.save(
      inst.periodos.map((p) =>
        this.periodoRepo.create({
          institutionId: inst.id,
          anioEscolar: anio,
          numero: p.numero,
          nombre: p.nombre,
          tipo: (p.tipo as MaestroPeriodoTipo) ?? 'bimestre',
          inicio: p.inicio,
          fin: p.fin,
          actual: p.actual ?? false,
          descripcion: '',
          activo: true,
        }),
      ),
    );
  }

  private async clearActual(
    institutionId: number,
    anioEscolar: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.periodoRepo
      .createQueryBuilder()
      .update(MaestroPeriodoAcademico)
      .set({ actual: false })
      .where('institutionId = :institutionId', { institutionId })
      .andWhere('anioEscolar = :anio', { anio: anioEscolar })
      .andWhere('actual = true');
    if (excludeId) {
      qb.andWhere('id != :excludeId', { excludeId });
    }
    await qb.execute();
  }

  private async assertUniqueNumero(
    institutionId: number,
    anioEscolar: number,
    numero: number,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.periodoRepo.findOne({
      where: { institutionId, anioEscolar, numero },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(
        `Ya existe el periodo ${numero} para el año ${anioEscolar}`,
      );
    }
  }

  private validarFechas(inicio: string, fin: string): void {
    if (fin < inicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior al inicio',
      );
    }
  }

  private async resolveAnioEscolarRow(anio: number): Promise<MaestroAnioEscolar | null> {
    return this.anioEscolarRepo.findOne({
      where: { anio, activo: true },
      order: { id: 'DESC' },
    });
  }

  private async resolveRangoAnioEscolar(anioEscolar: number): Promise<{
    fechaInicio: string;
    fechaFin: string;
  }> {
    const row = await this.resolveAnioEscolarRow(anioEscolar);
    if (row) {
      return { fechaInicio: row.fechaInicio, fechaFin: row.fechaFin };
    }
    return fechasDefectoAnioEscolar(anioEscolar);
  }

  private async assertAnioNoCerrado(anioEscolar: number): Promise<void> {
    const row = await this.resolveAnioEscolarRow(anioEscolar);
    if (row?.estado === 'cerrado') {
      throw new BadRequestException(
        'No puede modificar periodos de un año escolar cerrado.',
      );
    }
  }

  private async assertReglasPeriodo(
    anioEscolar: number,
    inicio: string,
    fin: string,
    numero: number,
    excludeId?: number,
  ): Promise<void> {
    const anioInicio = Number(inicio.slice(0, 4));
    const anioFin = Number(fin.slice(0, 4));
    if (
      anioInicio < anioEscolar ||
      anioInicio > anioEscolar + 1 ||
      anioFin < anioEscolar ||
      anioFin > anioEscolar + 1
    ) {
      throw new BadRequestException(
        `Las fechas del periodo deben caer en ${anioEscolar} o ${anioEscolar + 1}.`,
      );
    }

    const rango = await this.resolveRangoAnioEscolar(anioEscolar);
    try {
      assertPeriodoDentroDeAnioEscolar(inicio, fin, rango.fechaInicio, rango.fechaFin);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }

    const existentes = await this.periodoRepo.find({
      where: { anioEscolar, activo: true },
    });
    const rangos = existentes
      .filter((p) => p.id !== excludeId)
      .map((p) => ({ numero: p.numero, inicio: p.inicio, fin: p.fin }));
    try {
      assertSinSolapamientoPeriodo({ numero, inicio, fin }, rangos);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
  }

  private auditPeriodo(
    ctx: PeriodoAcademicoActorContext | undefined,
    accion: 'crear' | 'actualizar' | 'eliminar',
    row: MaestroPeriodoAcademico | null,
    descripcion: string,
    detalle?: Record<string, unknown>,
  ): void {
    if (!ctx?.req) return;
    this.auditLogger.logFromRequestContext(ctx.req, {
      accion,
      modulo: 'calendarizacion',
      entidad: 'periodo_academico',
      entidadId: row ? String(row.id) : null,
      descripcion,
      institutionId: row?.institutionId ?? undefined,
      resultado: 'success',
      detalle,
    });
  }

  private async getOrFail(id: number): Promise<MaestroPeriodoAcademico> {
    const row = await this.periodoRepo.findOneBy({ id });
    if (!row) throw new NotFoundException(`Periodo académico ${id} no encontrado`);
    return row;
  }

  private toResponse(row: MaestroPeriodoAcademico): MaestroPeriodoAcademicoResponse {
    const duracionDias = this.diffDays(row.inicio, row.fin) + 1;
    return {
      id: row.id,
      anioEscolar: row.anioEscolar,
      numero: row.numero,
      nombre: row.nombre,
      tipo: row.tipo,
      inicio: row.inicio,
      fin: row.fin,
      actual: row.actual,
      descripcion: row.descripcion,
      activo: row.activo,
      estado: this.resolveEstado(row),
      inicioDisplay: this.formatDate(row.inicio),
      finDisplay: this.formatDate(row.fin),
      duracionDias,
      duracionSemanas: Math.round(duracionDias / 7),
    };
  }

  private resolveEstado(row: MaestroPeriodoAcademico): MaestroPeriodoEstado {
    const today = new Date().toISOString().slice(0, 10);
    if (today < row.inicio) return 'pendiente';
    if (today > row.fin) return 'cerrado';
    return 'en_curso';
  }

  private formatDate(value: string): string {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }

  private diffDays(inicio: string, fin: string): number {
    const a = new Date(`${inicio}T00:00:00Z`).getTime();
    const b = new Date(`${fin}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
  }

  /**
   * Sincroniza periodos de configuración institucional hacia maestros.
   * La fuente de verdad del periodo actual es Administración → Institucional.
   */
  async syncFromInstitution(
    source?: Pick<Institution, 'anio' | 'periodos'> & Partial<Pick<Institution, 'id'>>,
  ): Promise<void> {
    const inst =
      source?.id != null
        ? (source as Pick<Institution, 'id' | 'anio' | 'periodos'>)
        : await this.dataSource.getRepository(Institution).findOne({
            where: {},
            order: { id: 'ASC' },
          });
    if (!inst?.id || !inst?.periodos?.length) return;

    const institutionId = inst.id;
    const anioEscolar = Number(inst.anio) || new Date().getFullYear();
    const tieneActual = inst.periodos.some((p) => p.actual);
    if (tieneActual) {
      await this.clearActual(institutionId, anioEscolar);
    }

    for (const p of inst.periodos) {
      const existing = await this.periodoRepo.findOne({
        where: { institutionId, anioEscolar, numero: p.numero },
      });
      if (existing) {
        existing.nombre = p.nombre.trim();
        existing.tipo = (p.tipo as MaestroPeriodoTipo) ?? 'bimestre';
        existing.inicio = p.inicio;
        existing.fin = p.fin;
        existing.actual = p.actual ?? false;
        existing.activo = true;
        await this.periodoRepo.save(existing);
        continue;
      }

      await this.periodoRepo.save(
        this.periodoRepo.create({
          institutionId,
          anioEscolar,
          numero: p.numero,
          nombre: p.nombre.trim(),
          tipo: (p.tipo as MaestroPeriodoTipo) ?? 'bimestre',
          inicio: p.inicio,
          fin: p.fin,
          actual: p.actual ?? false,
          descripcion: '',
          activo: true,
        }),
      );
    }
  }

  /** Número del bimestre en curso según configuración institucional. */
  async resolveBimestreActual(): Promise<number> {
    const actual = await this.findPeriodoActualRow();
    if (actual?.tipo === 'bimestre') return actual.numero;
    return actual?.numero ?? 1;
  }

  /** Año escolar del periodo académico marcado como actual. */
  async resolveAnioEscolarActual(): Promise<number> {
    const actual = await this.findPeriodoActualRow();
    return actual?.anioEscolar ?? new Date().getFullYear();
  }

  /** Periodo académico marcado como actual en maestros. */
  async findPeriodoActual(): Promise<MaestroPeriodoAcademicoResponse | null> {
    return this.catalogCache.wrap('periodos:actual', async () => {
      await this.alinearPeriodosActualesPorFechaHoy();
      const row = await this.findPeriodoActualRow();
      return row ? this.toResponse(row) : null;
    }, 60_000);
  }

  private async resolveAniosInstitucion(
    req?: PeriodoAcademicoActorContext['req'],
  ): Promise<number[] | null | undefined> {
    if (!req) return undefined;
    const scope = await resolveMaestrosAniosEscolares(req, this.anioEscolarRepo);
    if (!scope) return [];
    return scope.anios;
  }

  private async ensureAnioEscolarVigente(institutionId: number): Promise<void> {
    const instRepo = this.dataSource.getRepository(Institution);
    const inst = await instRepo.findOneBy({ id: institutionId });
    if (!inst) return;

    const anioInst = Number(inst.anio);
    if (
      Number.isFinite(anioInst) &&
      anioInst >= ANIO_ESCOLAR_REGISTRO_MIN &&
      anioInst <= ANIO_ESCOLAR_REGISTRO_MAX
    ) {
      const existe = await this.anioEscolarRepo.findOne({
        where: { institutionId, anio: anioInst, activo: true },
      });
      if (!existe) {
        const fechas = fechasDefectoAnioEscolar(anioInst);
        await this.anioEscolarRepo.save(
          this.anioEscolarRepo.create({
            institutionId,
            anio: anioInst,
            ...fechas,
            tipoPeriodo:
              (inst.tipoPeriodo as MaestroAnioEscolar['tipoPeriodo']) ?? 'bimestre',
            estado: 'activo',
            vigente: false,
            version: 1,
            publicado: true,
            motivo: 'Sincronizado desde configuración institucional',
            activo: true,
          }),
        );
        if (inst.periodos?.length) {
          await this.syncFromInstitution(inst);
        }
      }
    }

    const r = await alinearAnioEscolarVigentePorFecha(
      this.anioEscolarRepo,
      instRepo,
      institutionId,
      formatIsoDate(new Date()),
    );
    if (r?.changed) this.catalogCache.invalidate('periodos:');
  }

  private async resolveAnioEscolarVigente(
    institutionId: number,
  ): Promise<number | undefined> {
    const row = await this.anioEscolarRepo.findOne({
      where: { institutionId, vigente: true, activo: true },
    });
    return row?.anio;
  }

  private async findPeriodoActualRow(): Promise<MaestroPeriodoAcademico | null> {
    const hoy = new Date().toISOString().slice(0, 10);
    const enCurso = await this.periodoRepo
      .createQueryBuilder('p')
      .where('p.activo = true')
      .andWhere('p.inicio <= :hoy', { hoy })
      .andWhere('p.fin >= :hoy', { hoy })
      .orderBy('p.anioEscolar', 'DESC')
      .addOrderBy('p.numero', 'DESC')
      .getOne();
    if (enCurso) return enCurso;

    return this.periodoRepo.findOne({
      where: { actual: true, activo: true },
      order: { anioEscolar: 'DESC', numero: 'DESC' },
    });
  }

  /** Alinea el flag «actual» al periodo que contiene la fecha de hoy (por institución y año). */
  private async alinearPeriodoActualPorFecha(
    institutionId: number,
    anioEscolar: number,
  ): Promise<void> {
    const hoy = new Date().toISOString().slice(0, 10);
    const periodos = await this.periodoRepo.find({
      where: { institutionId, anioEscolar, activo: true },
    });
    const porFecha = periodos.find((p) => hoy >= p.inicio && hoy <= p.fin);
    if (!porFecha) return;

    const yaCorrecto =
      porFecha.actual && periodos.filter((p) => p.actual).length === 1;
    if (yaCorrecto) return;

    await this.clearActual(institutionId, anioEscolar, porFecha.id);
    porFecha.actual = true;
    await this.periodoRepo.save(porFecha);
    this.catalogCache.invalidate('periodos:');
    await this.mirrorActualEnInstitucion(porFecha);
  }

  private async alinearPeriodosActualesPorFechaHoy(): Promise<void> {
    const hoy = new Date().toISOString().slice(0, 10);
    const enCurso = await this.periodoRepo.find({
      where: { activo: true },
    });
    const vistos = new Set<string>();
    for (const p of enCurso) {
      if (hoy < p.inicio || hoy > p.fin) continue;
      if (p.institutionId == null) continue;
      const key = `${p.institutionId}:${p.anioEscolar}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      await this.alinearPeriodoActualPorFecha(p.institutionId, p.anioEscolar);
    }
  }

  /** Refleja el periodo vigente en institution.periodos (config. institucional). */
  private async mirrorActualEnInstitucion(
    periodo: MaestroPeriodoAcademico,
  ): Promise<void> {
    if (!periodo.institutionId) return;
    const repo = this.dataSource.getRepository(Institution);
    const inst = await repo.findOneBy({ id: periodo.institutionId });
    if (!inst?.periodos?.length) return;

    let changed = false;
    const next = inst.periodos.map((p) => {
      const esActual = p.numero === periodo.numero;
      if (p.actual !== esActual) changed = true;
      return { ...p, actual: esActual };
    });
    if (!changed) return;
    inst.periodos = next;
    await repo.save(inst);
  }

  private fechaCoherenteConAnio(anio: number, iso: string): boolean {
    const y = Number(iso.slice(0, 4));
    return y === anio || y === anio + 1;
  }

  /** Bimestres ya concluidos (fecha fin superada) — elegibles para acta de salon. */
  async resolveBimestresTerminados(anioEscolar?: number): Promise<number[]> {
    const anio = anioEscolar ?? (await this.resolveAnioEscolarActual());
    const rows = await this.periodoRepo.find({
      where: { anioEscolar: anio, tipo: 'bimestre', activo: true },
      order: { numero: 'ASC' },
    });
    const today = new Date().toISOString().slice(0, 10);
    return rows
      .filter((r) => r.numero >= 1 && r.numero <= 4)
      .filter((r) => this.fechaCoherenteConAnio(anio, r.fin))
      .filter((r) => today > r.fin)
      .map((r) => r.numero);
  }
}
