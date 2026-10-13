-- =============================================================================
-- Escolar — carga de DATOS demo (SQL puro)
-- =============================================================================
-- IMPORTANTE: Este archivo NO crea el esquema completo de TypeORM.
-- Para esquema + datos en un solo SQL, use:
--   scripts/escolar-full-dump.sql  (generar con: npm run db:dump)
--
-- Requisito previo para este archivo:
--   - PostgreSQL accesible (Docker: npm run db:up)
--   - Esquema creado al menos una vez (npm run db:migrate:full:local paso 1-2,
--     o restaurar escolar-full-dump.sql)
--
-- Ejecutar con psql (desde carpeta scripts/):
--   psql -h 127.0.0.1 -p 5433 -U postgres -d escolar -f migrate-full.sql
--
-- Con Docker:
--   Get-Content migrate-full.sql | docker exec -i escolar-postgres psql -U postgres -d escolar
-- =============================================================================

\set ON_ERROR_STOP on

\echo '==> sedes e institución'
\i sedes-data.sql

\echo '==> docentes'
\i docentes-data.sql

\echo '==> horarios (periodos en horarios-data.sql; bloques vía npm run db:horarios-data)'
\i horarios-data.sql

\echo '==> datos académicos (historial, notas, asistencia)'
\i academic-data.sql

\echo '==> control de asistencia ampliado'
\i asistencia-control-data.sql

\echo '==> registro de notas'
\i registro-notas-data.sql

\echo '==> bitácora docente'
\i bitacora-data.sql

\echo '==> temario'
\i temario-data.sql

\echo '==> conceptos tesorería'
\i treasury-concepts-data.sql

\echo '==> deduplicación estudiantes'
\i dedupe-students-data.sql

\echo 'Datos SQL cargados. Falta seed TypeScript (usuarios, roles, waitlist): npm run db:seed'
\echo 'Para horarios completos (bloques/asignaciones): npm run db:horarios-data'
\echo 'Para tesorería, eventos, documentos: npm run db:migrate:full:local'
