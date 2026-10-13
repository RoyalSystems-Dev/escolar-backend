import request from 'supertest';
import type { App } from 'supertest/types';

export async function waitForAuditFlush(ms = 1500): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Verifica registros recientes de consultar y exportar en audit-logs. */
export async function expectReportAuditTrail(
  server: App,
  token: string,
  options: {
    modulo: string;
    entidad: string;
    descripcionExportIncludes: string;
    descripcionConsultIncludes?: string;
  },
): Promise<void> {
  await waitForAuditFlush();
  const {
    modulo,
    entidad,
    descripcionExportIncludes,
    descripcionConsultIncludes = descripcionExportIncludes,
  } = options;

  const exportRes = await request(server)
    .get(`/api/v1/audit-logs?modulo=${modulo}&accion=exportar&page=1&pageSize=40`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const exportItems = exportRes.body.items as Array<{
    modulo: string;
    entidad: string;
    descripcion: string;
  }>;
  expect(
    exportItems.some(
      (i) =>
        i.modulo === modulo &&
        i.entidad === entidad &&
        i.descripcion.includes(descripcionExportIncludes),
    ),
  ).toBe(true);

  const consultRes = await request(server)
    .get(`/api/v1/audit-logs?modulo=${modulo}&accion=consultar&page=1&pageSize=40`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const consultItems = consultRes.body.items as Array<{
    modulo: string;
    entidad: string;
    descripcion: string;
  }>;
  expect(
    consultItems.some(
      (i) =>
        i.modulo === modulo &&
        i.entidad === entidad &&
        i.descripcion.includes(descripcionConsultIncludes),
    ),
  ).toBe(true);
}
