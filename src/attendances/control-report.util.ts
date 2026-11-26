export type NivelAlertaControl =
  | 'normal'
  | 'alerta'
  | 'critico'
  | 'sin_registro';

export function evaluarAsistenciaControl(input: {
  totalRegistrado: number;
  presentes: number;
  tardanzas: number;
  faltasInjustificadas: number;
  diasAlertaAusentismo: number;
  diasAlertaCritica: number;
}): { asistenciaPct: number | null; nivelAlerta: NivelAlertaControl } {
  if (input.totalRegistrado <= 0) {
    return { asistenciaPct: null, nivelAlerta: 'sin_registro' };
  }

  const asistenciaPct = Math.round(
    ((input.presentes + input.tardanzas) / input.totalRegistrado) * 100,
  );

  if (input.faltasInjustificadas > input.diasAlertaCritica) {
    return { asistenciaPct, nivelAlerta: 'critico' };
  }
  if (input.faltasInjustificadas > input.diasAlertaAusentismo) {
    return { asistenciaPct, nivelAlerta: 'alerta' };
  }
  return { asistenciaPct, nivelAlerta: 'normal' };
}

export function etiquetaEstadoControl(nivel: NivelAlertaControl): string {
  if (nivel === 'sin_registro') return 'Sin registro';
  if (nivel === 'critico') return 'Crítico';
  if (nivel === 'alerta') return 'Alerta';
  return 'Normal';
}
