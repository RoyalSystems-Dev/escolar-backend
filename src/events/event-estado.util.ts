import { EventoEstado } from './entities/evento.entity';

/** Normaliza fecha de BD (string o Date) a YYYY-MM-DD. */
export function toEventDateYmd(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return raw;
}

export function parseEventDate(value: string | Date): Date {
  const ymd = toEventDateYmd(value);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function computeEstadoFromDates(
  fechaInicio: string | Date,
  fechaFin?: string | Date | null,
  cancelado?: boolean,
): EventoEstado {
  if (cancelado) return 'cancelado';

  const inicioYmd = toEventDateYmd(fechaInicio);
  const finYmd = toEventDateYmd(fechaFin ?? fechaInicio) || inicioYmd;
  if (!inicioYmd) return 'programado';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = parseEventDate(inicioYmd);
  const fin = parseEventDate(finYmd);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return 'programado';
  }

  if (fin < today) return 'finalizado';
  if (inicio <= today && fin >= today) return 'en_curso';
  return 'programado';
}

export function normalizeEventEstado(input: {
  estado?: string;
  cancelado?: boolean;
  fechaInicio: string | Date;
  fechaFin?: string | Date | null;
}): EventoEstado {
  if (input.estado === 'cancelado') return 'cancelado';
  if (input.cancelado && input.estado == null) return 'cancelado';

  const manual = input.estado as EventoEstado | undefined;
  if (
    manual === 'programado' ||
    manual === 'en_curso' ||
    manual === 'finalizado'
  ) {
    return manual;
  }

  return computeEstadoFromDates(
    input.fechaInicio,
    input.fechaFin,
    input.cancelado,
  );
}

export function canceladoFromEstado(estado: EventoEstado): boolean {
  return estado === 'cancelado';
}
