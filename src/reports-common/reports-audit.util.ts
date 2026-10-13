import type { Request } from 'express';
import { AuditLoggerService } from '../audit-logs/audit-logger.service';

export type ReportsAuditModulo = 'matricula' | 'asistencia' | 'evaluacion' | 'territorial';

export interface ReportsAuditScopeRef {
  primaryInstitutionId: number;
  scopeKey: string;
  alcance?: unknown;
}

/** Exportación síncrona rechazada por volumen (HTTP 400). */
export function auditReportExportSyncRejected(
  auditLogger: AuditLoggerService,
  req: Request,
  modulo: ReportsAuditModulo,
  scope: ReportsAuditScopeRef,
  tipo: string,
  format: string,
  totalFilas: number,
  limite: number,
): void {
  auditLogger.logFromRequestContext(req, {
    accion: 'exportar',
    modulo,
    entidad: 'reporte',
    descripcion: `Exportación síncrona rechazada (${format}): ${tipo} supera ${limite} filas`,
    institutionId: scope.primaryInstitutionId,
    nivel: 'warning',
    resultado: 'error',
    detalle: { tipo, format, totalFilas, limite, scopeKey: scope.scopeKey },
  });
}

/** Descarga de job asíncrono cuando el archivo aún no está listo (HTTP 409). */
export function auditReportJobDownloadNotReady(
  auditLogger: AuditLoggerService,
  req: Request,
  modulo: ReportsAuditModulo,
  scope: ReportsAuditScopeRef,
  jobId: number,
  status: string,
  errorMensaje?: string | null,
): void {
  auditLogger.logFromRequestContext(req, {
    accion: 'exportar',
    modulo,
    entidad: 'reporte_job',
    descripcion: `Descarga de exportación asíncrona rechazada (job ${jobId})`,
    institutionId: scope.primaryInstitutionId,
    nivel: 'warning',
    resultado: 'error',
    detalle: { jobId, status, errorMensaje, scopeKey: scope.scopeKey },
  });
}

/** Job asíncrono falló en procesamiento en background. */
export function auditReportJobProcessingFailed(
  auditLogger: AuditLoggerService,
  req: Request,
  modulo: ReportsAuditModulo,
  scope: ReportsAuditScopeRef,
  jobId: number,
  reportType: string,
  format: string,
  errorMessage: string,
): void {
  auditLogger.logFromRequestContext(req, {
    accion: 'exportar',
    modulo,
    entidad: 'reporte_job',
    descripcion: `Exportación asíncrona fallida: ${reportType} (${format})`,
    institutionId: scope.primaryInstitutionId,
    nivel: 'warning',
    resultado: 'error',
    detalle: { jobId, reportType, format, error: errorMessage, scopeKey: scope.scopeKey },
  });
}
