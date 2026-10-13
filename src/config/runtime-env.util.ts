/** Entorno de ejecución del API (NODE_ENV). QA y producción se tratan como no-desarrollo. */
export function isDevelopmentRuntime(nodeEnv = process.env.NODE_ENV ?? 'development'): boolean {
  return nodeEnv === 'development';
}
