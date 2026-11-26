import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import {
  Evento,
  EventoEstado,
} from './entities/evento.entity';
import {
  inferEventVisibility,
  normalizeEventVisibility,
} from './event-visibility.util';
import {
  canceladoFromEstado,
  computeEstadoFromDates,
  normalizeEventEstado,
  toEventDateYmd,
} from './event-estado.util';

export interface EventResponse {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string | null;
  horaInicio: string;
  horaFin: string | null;
  lugar: string;
  destinatarios: string;
  visibilidad: string;
  nivel: string;
  grado: string;
  seccion: string;
  responsable: string;
  publicado: boolean;
  cancelado: boolean;
  estado: EventoEstado;
  fechaInicioDisplay: string;
  fechaFinDisplay: string | null;
  horario: string;
  institutionId: number | null;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Evento)
    private readonly eventsRepo: Repository<Evento>,
  ) {}

  create(dto: CreateEventDto, institutionId?: number): Promise<EventResponse> {
    const ie = this.requireInstitutionId(institutionId);
    const vis = normalizeEventVisibility(dto);
    const fechaFin = dto.fechaFin ?? dto.fechaInicio;
    const estado = normalizeEventEstado({
      estado: dto.estado,
      fechaInicio: dto.fechaInicio,
      fechaFin,
    });
    const entity = this.eventsRepo.create({
      titulo: dto.titulo.trim(),
      descripcion: dto.descripcion?.trim() ?? '',
      tipo: dto.tipo as Evento['tipo'],
      fechaInicio: dto.fechaInicio,
      fechaFin,
      horaInicio: dto.horaInicio?.trim() || '08:00',
      horaFin: dto.horaFin?.trim() || null,
      lugar: dto.lugar?.trim() ?? '',
      destinatarios: vis.destinatarios,
      visibilidad: vis.visibilidad,
      nivel: vis.nivel,
      grado: vis.grado,
      seccion: vis.seccion,
      responsable: dto.responsable?.trim() ?? '',
      publicado: dto.publicado ?? true,
      estado,
      cancelado: canceladoFromEstado(estado),
      institutionId: ie,
    });
    return this.eventsRepo.save(entity).then((saved) => this.toResponse(saved));
  }

  async findAll(query?: {
    mes?: string;
    tipo?: string;
    destinatarios?: string;
    estado?: string;
    busqueda?: string;
    institutionId?: number;
  }): Promise<EventResponse[]> {
    await this.syncEstadosLegacy();

    const qb = this.eventsRepo
      .createQueryBuilder('e')
      .orderBy('e.fechaInicio', 'ASC')
      .addOrderBy('e.horaInicio', 'ASC');

    const ie = this.requireInstitutionId(query?.institutionId);
    qb.andWhere('e.institutionId = :institutionId', { institutionId: ie });
    if (query?.mes) {
      qb.andWhere("TO_CHAR(e.fechaInicio, 'YYYY-MM') = :mes", { mes: query.mes });
    }
    if (query?.tipo) {
      qb.andWhere('e.tipo = :tipo', { tipo: query.tipo });
    }
    if (query?.destinatarios) {
      qb.andWhere('e.destinatarios = :destinatarios', {
        destinatarios: query.destinatarios,
      });
    }
    if (query?.estado) {
      qb.andWhere('e.estado = :estado', { estado: query.estado });
    }

    let rows = await qb.getMany();
    let result = rows.map((row) => this.toResponse(row));

    if (query?.busqueda?.trim()) {
      const q = query.busqueda.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.titulo.toLowerCase().includes(q) ||
          e.lugar.toLowerCase().includes(q) ||
          e.responsable.toLowerCase().includes(q),
      );
    }

    return result;
  }

  async findOne(id: number, institutionId?: number): Promise<EventResponse> {
    const ie = this.requireInstitutionId(institutionId);
    const event = await this.getOrFail(id, ie);
    return this.toResponse(event);
  }

  async update(id: number, dto: UpdateEventDto, institutionId?: number): Promise<EventResponse> {
    const ie = this.requireInstitutionId(institutionId);
    const current = await this.getOrFail(id, ie);
    if (current.institutionId == null) {
      current.institutionId = ie;
    }

    if (dto.titulo !== undefined) current.titulo = dto.titulo.trim();
    if (dto.descripcion !== undefined) current.descripcion = dto.descripcion.trim();
    if (dto.tipo !== undefined) current.tipo = dto.tipo as Evento['tipo'];
    if (dto.fechaInicio !== undefined) {
      current.fechaInicio = toEventDateYmd(dto.fechaInicio);
    }
    if (dto.fechaFin !== undefined) {
      current.fechaFin = dto.fechaFin ? toEventDateYmd(dto.fechaFin) : null;
    }
    if (dto.lugar !== undefined) current.lugar = dto.lugar.trim();
    if (dto.responsable !== undefined) current.responsable = dto.responsable.trim();
    if (dto.nivel !== undefined) current.nivel = dto.nivel.trim();
    if (dto.grado !== undefined) current.grado = dto.grado.trim();
    if (dto.seccion !== undefined) current.seccion = dto.seccion.trim();
    if (dto.horaInicio !== undefined) current.horaInicio = dto.horaInicio.trim();
    if (dto.horaFin !== undefined) {
      current.horaFin = dto.horaFin?.trim() || null;
    }
    if (dto.destinatarios !== undefined) {
      current.destinatarios = dto.destinatarios as Evento['destinatarios'];
    }
    if (dto.publicado !== undefined) current.publicado = dto.publicado;
    if (dto.visibilidad !== undefined) {
      current.visibilidad = dto.visibilidad as Evento['visibilidad'];
    }

    current.fechaInicio = toEventDateYmd(current.fechaInicio);
    current.fechaFin = current.fechaFin ? toEventDateYmd(current.fechaFin) : null;

    if (dto.estado !== undefined || dto.cancelado !== undefined) {
      const canceladoFlag =
        dto.estado !== undefined
          ? dto.estado === 'cancelado'
          : (dto.cancelado ?? current.cancelado);
      const estado = normalizeEventEstado({
        estado: dto.estado ?? current.estado,
        cancelado: canceladoFlag,
        fechaInicio: current.fechaInicio,
        fechaFin: current.fechaFin,
      });
      current.estado = estado;
      current.cancelado = canceladoFromEstado(estado);
      if (estado === 'cancelado') {
        current.publicado = false;
      } else if (dto.estado !== undefined && dto.publicado === undefined) {
        current.publicado = true;
      }
    }

    const saved = await this.eventsRepo.save(current);
    return this.toResponse(saved);
  }

  async remove(id: number, institutionId?: number) {
    const ie = this.requireInstitutionId(institutionId);
    const current = await this.getOrFail(id, ie);
    await this.eventsRepo.remove(current);
    return { deleted: true, id };
  }

  private requireInstitutionId(institutionId?: number): number {
    if (institutionId == null || institutionId < 1) {
      throw new BadRequestException(
        'Seleccione una institución educativa para gestionar eventos.',
      );
    }
    return institutionId;
  }

  private async getOrFail(id: number, institutionId: number): Promise<Evento> {
    const event = await this.eventsRepo.findOneBy({ id });
    if (!event) {
      throw new NotFoundException(`Evento ${id} no encontrado`);
    }
    if (event.institutionId != null && event.institutionId !== institutionId) {
      throw new NotFoundException(
        `Evento ${id} no pertenece a la institución seleccionada`,
      );
    }
    return event;
  }

  private toResponse(event: Evento): EventResponse {
    const fin = event.fechaFin ?? event.fechaInicio;
    return {
      id: event.id,
      titulo: event.titulo,
      descripcion: event.descripcion,
      tipo: event.tipo,
      fechaInicio: event.fechaInicio,
      fechaFin: event.fechaFin,
      horaInicio: event.horaInicio,
      horaFin: event.horaFin,
      lugar: event.lugar,
      destinatarios: event.destinatarios,
      visibilidad: inferEventVisibility(event),
      nivel: event.nivel,
      grado: event.grado ?? '',
      seccion: event.seccion ?? '',
      responsable: event.responsable,
      publicado: event.publicado,
      cancelado: event.cancelado,
      estado: event.estado ?? computeEstadoFromDates(
        event.fechaInicio,
        event.fechaFin,
        event.cancelado,
      ),
      fechaInicioDisplay: formatDate(event.fechaInicio),
      fechaFinDisplay: event.fechaFin ? formatDate(event.fechaFin) : null,
      horario: formatHorario(event.horaInicio, event.horaFin),
      institutionId: event.institutionId ?? null,
    };
  }

  private async syncEstadosLegacy(): Promise<void> {
    const rows = await this.eventsRepo.find();
    const pending = rows.filter((row) => !row.estado);
    if (!pending.length) return;

    await this.eventsRepo.save(
      pending.map((row) => ({
        ...row,
        estado: row.cancelado
          ? 'cancelado'
          : computeEstadoFromDates(row.fechaInicio, row.fechaFin),
        cancelado: row.cancelado ?? canceladoFromEstado(
          computeEstadoFromDates(row.fechaInicio, row.fechaFin),
        ),
      })),
    );
  }
}

function formatDate(value: string | Date): string {
  const ymd = toEventDateYmd(value);
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function formatHorario(inicio: string, fin: string | null): string {
  return fin ? `${inicio} – ${fin}` : inicio;
}
