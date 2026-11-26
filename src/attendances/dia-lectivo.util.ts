/** Día de clase: lunes (1) a viernes (5). Sábado y domingo no admiten asistencia. */
export function esDiaLectivoLunesAViernes(fecha: string): boolean {
  const iso = fecha.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

export const MENSAJE_ASISTENCIA_SOLO_LUNES_A_VIERNES =
  'La asistencia solo se puede registrar de lunes a viernes';
