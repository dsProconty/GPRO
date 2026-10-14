/**
 * Estados de proyecto creados desde el CRUD de Configuración (ej. "Stand By").
 * Lee los archivos reales (Jest corre sin transformar ESM) para que el test falle
 * si el selector de colores, el CSS y el mapa hex se desalinean.
 */
const fs = require('fs')
const path = require('path')

const leer = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf-8')

const cargarUtil = () => {
  const src = leer('src/utils/estadoColors.js').replace(/export const /g, 'const ')
  return new Function(`${src}; return { SEVERITY_HEX, severityHex, severityDot, PIPELINE_IDS }`)()
}

const severidadesDelCrud = () => {
  const src = leer('src/app/(dashboard)/configuracion/page.jsx')
  const bloque = src.slice(src.indexOf('const SEVERITY_OPTIONS = ['), src.indexOf('const severityItem'))
  return [...bloque.matchAll(/value:\s*'([a-z]+)'/g)].map((m) => m[1])
}

describe('colores de estado', () => {
  const { SEVERITY_HEX, severityHex, severityDot } = cargarUtil()
  const opciones = severidadesDelCrud()

  test('el CRUD ofrece las 13 opciones sin repetir', () => {
    expect(opciones).toHaveLength(13)
    expect(new Set(opciones).size).toBe(13)
  })

  test.each(opciones)('"%s" tiene color hex para gráficas/PDF', (sev) => {
    expect(SEVERITY_HEX[sev]).toMatch(/^#[0-9a-f]{6}$/i)
  })

  test('las severidades que el tema de PrimeReact no define tienen clase CSS propia', () => {
    const css = leer('src/app/tag-colors.css')
    const delTema = ['info', 'success', 'warning', 'danger']
    opciones.filter((s) => !delTema.includes(s)).forEach((sev) => {
      expect(css).toContain(`.p-tag.p-tag-${sev} `)
    })
  })

  test('un color desconocido o vacío cae al respaldo, sin romper', () => {
    expect(severityHex('no-existe')).toBe('#6b7280')
    expect(severityHex(undefined, '#123456')).toBe('#123456')
  })

  test('el punto de la línea de tiempo deriva del hex', () => {
    expect(severityDot('help')).toEqual({ bg: '#a855f722', color: '#a855f7', border: '#a855f755' })
  })
})

describe('estado fuera del flujo (Stand By)', () => {
  const { PIPELINE_IDS } = cargarUtil()

  test('un id nuevo (Stand By = 6) no pertenece al flujo lineal', () => {
    expect(PIPELINE_IDS.indexOf(6)).toBe(-1)
  })

  test('el flujo coincide con PIPELINE_STEPS del detalle del proyecto', () => {
    const src = leer('src/app/(dashboard)/proyectos/[id]/page.jsx')
    const bloque = src.slice(src.indexOf('const PIPELINE_STEPS'), src.indexOf(']', src.indexOf('const PIPELINE_STEPS')))
    const ids = [...bloque.matchAll(/id:\s*(\d+)/g)].map((m) => Number(m[1]))
    expect(ids).toEqual(PIPELINE_IDS)
  })
})

describe('permiso de edición por estado (usePermisos)', () => {
  // Misma regla que src/hooks/usePermisos.js: null = todos; lista = solo esos ids
  const puedeEditar = (editables, estadoId) => (editables === null ? true : editables.includes(Number(estadoId)))

  test('perfil sin restricción puede editar Stand By', () => expect(puedeEditar(null, 6)).toBe(true))
  test('perfil limitado a [2,3,4] no puede editar Stand By hasta que se marque', () => {
    expect(puedeEditar([2, 3, 4], 6)).toBe(false)
    expect(puedeEditar([2, 3, 4, 6], 6)).toBe(true)
  })
})
