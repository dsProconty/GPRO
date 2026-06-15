/**
 * Logger de trazabilidad GPRO.
 * Escribe líneas JSON en logs/app.log (Azure App Service tiene FS persistente).
 * En Vercel/serverless el write falla silenciosamente y solo queda console.
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const IS_SERVER = typeof window === 'undefined'
const LOG_DIR   = process.env.LOG_DIR || (IS_SERVER ? join(process.cwd(), 'logs') : '')
const LOG_FILE  = LOG_DIR ? join(LOG_DIR, 'app.log') : ''

function write(level, msg, data) {
  const entry = JSON.stringify({
    ts:    new Date().toISOString(),
    level,
    msg,
    ...(data !== undefined && { data }),
  })

  // Console siempre (capturado por Azure App Insights / Vercel logs)
  if (level === 'ERROR') console.error(entry)
  else if (level === 'WARN') console.warn(entry)
  else console.log(entry)

  // Archivo solo en servidor con FS disponible
  if (!IS_SERVER || !LOG_FILE) return
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(LOG_FILE, entry + '\n', 'utf8')
  } catch {
    // Silencioso: entorno sin FS persistente (Vercel serverless)
  }
}

export const logger = {
  info:  (msg, data) => write('INFO',  msg, data),
  warn:  (msg, data) => write('WARN',  msg, data),
  error: (msg, data) => write('ERROR', msg, data),
}

/**
 * Log de permiso denegado. Llamar desde API routes (server-side) cuando
 * tienePermiso() retorna false.
 */
export function logPermisoDenegado(session, permiso, ruta = '') {
  logger.warn('PERMISO_DENEGADO', {
    userId:   session?.user?.id,
    userName: session?.user?.name,
    email:    session?.user?.email,
    permiso,
    ruta,
  })
}
