/** Sección vacía: la currícula cubre todo el nivel. */
export function normalizarSeccionCurricula(value?: string | null): string {
  return (value ?? '').trim().toUpperCase();
}

/** Dos currículas del mismo año y nivel se solapan si alguna no tiene sección o si la sección coincide. */
export function curriculaSolapan(a?: string | null, b?: string | null): boolean {
  const sa = normalizarSeccionCurricula(a);
  const sb = normalizarSeccionCurricula(b);
  if (!sa || !sb) return true;
  return sa === sb;
}

export function mensajeCurriculaDuplicada(
  nivel: string,
  anio: number,
  seccionNueva?: string | null,
  seccionExistente?: string | null,
): string {
  const nueva = normalizarSeccionCurricula(seccionNueva);
  const existente = normalizarSeccionCurricula(seccionExistente);
  if (!existente && nueva) {
    return `En esta institución, la currícula de ${nivel} ${anio} cubre todas las secciones. Para registrar la sección ${nueva}, primero asigne la existente a una sección concreta.`;
  }
  if (!nueva && existente) {
    return `En esta institución ya hay una currícula de ${nivel} ${anio} para la sección ${existente}. Una de todas las secciones no puede convivir con ella.`;
  }
  if (nueva && existente && nueva === existente) {
    return `En esta institución ya existe una currícula de ${nivel} ${anio} para la sección ${nueva}.`;
  }
  return `En esta institución ya existe una currícula de ${nivel} ${anio}. Solo puede haber otra si cada una corresponde a una sección distinta.`;
}
