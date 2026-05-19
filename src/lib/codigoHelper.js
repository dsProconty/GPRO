/**
 * Generador de códigos únicos por empresa/año.
 * Formato: PRO26-DEL-001 (proyectos) / PRP26-DEL-001 (propuestas)
 * - Año de 2 dígitos tomado de fechaCreacion
 * - codigoCliente de la empresa (parametrizable, 2-3 letras)
 * - Consecutivo por empresa+año+tipo (no global)
 */

export async function generarCodigoProyecto(empresaId, fechaCreacion, client) {
  return _generarCodigo('PRO', empresaId, fechaCreacion, client)
}

export async function generarCodigoPropuesta(empresaId, fechaCreacion, client) {
  return _generarCodigo('PRP', empresaId, fechaCreacion, client)
}

async function _generarCodigo(tipo, empresaId, fechaCreacion, client) {
  const empresa = await client.empresa.findUnique({
    where: { id: parseInt(empresaId) },
    select: { codigoCliente: true },
  })

  const codigoEmpresa = (empresa?.codigoCliente || 'XXX').toUpperCase()
  const anio = String(new Date(fechaCreacion).getFullYear()).slice(2)
  const prefijo = `${tipo}${anio}-${codigoEmpresa}-`

  const existentes =
    tipo === 'PRO'
      ? await client.proyecto.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } })
      : await client.propuesta.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } })

  const maxNum = existentes.reduce((max, r) => {
    const partes = r.codigo?.split('-') || []
    const num = parseInt(partes[partes.length - 1])
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)

  return `${prefijo}${String(maxNum + 1).padStart(3, '0')}`
}

export function sugerirCodigoCliente(nombre) {
  return (nombre || '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
}
