/**
 * Regresión del PDF de proyecto (500 por pedir `responsables.user`, relación que ya no existe
 * porque los responsables migraron a Empleados). Lee los archivos reales: Jest corre sin
 * transformar ESM.
 */
const fs = require('fs')
const path = require('path')

const leer = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf-8')
const listar = (dir) =>
  fs.readdirSync(path.join(__dirname, '..', dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    return e.isDirectory() ? listar(rel) : [rel]
  })

const cargarUtil = () => {
  const src = leer('src/utils/responsables.js').replace(/export const /g, 'const ')
  return new Function(`${src}; return { nombreResponsable, listaResponsables }`)()
}

// Relaciones que existen en los pivotes de responsables según el esquema real
const relacionesDePivote = (modelo) => {
  const bloque = leer('prisma/schema.prisma').split(`model ${modelo} {`)[1].split('\n}')[0]
  return [...bloque.matchAll(/^\s+(\w+)\s+\w+\s+@relation/gm)].map((m) => m[1])
}

describe('listaResponsables', () => {
  const { nombreResponsable, listaResponsables } = cargarUtil()
  const ana = { empleado: { nombre: 'Ana', apellido: 'Pérez' } }
  const luis = { empleado: { nombre: 'Luis', apellido: 'Mora' } }

  test('une nombre y apellido de cada empleado', () => {
    expect(listaResponsables([ana, luis])).toBe('Ana Pérez, Luis Mora')
  })
  test('sin responsables devuelve el guion', () => {
    expect(listaResponsables([])).toBe('—')
    expect(listaResponsables(undefined)).toBe('—')
  })
  test('ignora pivotes sin empleado (datos viejos con user) en vez de imprimir "undefined"', () => {
    expect(nombreResponsable({ user: { name: 'Viejo' } })).toBe('')
    expect(listaResponsables([{ user: { name: 'Viejo' } }, ana])).toBe('Ana Pérez')
  })
  test('apellido ausente no deja "undefined"', () => {
    expect(nombreResponsable({ empleado: { nombre: 'Ana' } })).toBe('Ana')
  })
})

describe('consultas de responsables vs esquema', () => {
  const validas = new Set([...relacionesDePivote('ProyectoResponsable'), ...relacionesDePivote('PropuestaResponsable')])

  test('el esquema expone empleado en ambos pivotes', () => {
    expect(relacionesDePivote('ProyectoResponsable')).toContain('empleado')
    expect(relacionesDePivote('PropuestaResponsable')).toContain('empleado')
    expect(relacionesDePivote('ProyectoResponsable')).not.toContain('user')
  })

  test('ninguna ruta incluye en `responsables` una relación inexistente', () => {
    const rutas = listar('src/app/api').filter((f) => f.endsWith('.js'))
    const malas = []
    for (const f of rutas) {
      const src = leer(f)
      for (const m of src.matchAll(/responsables:\s*\{\s*include:\s*\{\s*(\w+)\s*:/g)) {
        if (!validas.has(m[1])) malas.push(`${f}: include.${m[1]}`)
      }
    }
    expect(malas).toEqual([])
  })

  test('el PDF pide empleado y no user', () => {
    const src = leer('src/app/api/v1/proyectos/[id]/pdf/route.js')
    expect(src).toMatch(/responsables:\s*\{\s*include:\s*\{\s*empleado:/)
  })
})
