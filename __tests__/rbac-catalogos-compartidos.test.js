/**
 * Tests para el patrón de permisos OR en catálogos compartidos (CLAUDE.md §2.2).
 * No requieren base de datos ni imports de src/ (mismo enfoque que reglas-negocio.test.js):
 * se reimplementa la lógica pura que debe vivir en las rutas de /api/v1/clientes.
 */

function tienePermiso(session, permiso) {
  if (session?.user?.role === 'admin') return true
  return (session?.user?.permisos || []).includes(permiso)
}

const PERMISOS = {
  CLIENTES:      { VER: 'clientes.ver', CREAR: 'clientes.crear' },
  EMPRESAS:      { VER: 'empresas.ver', CREAR: 'empresas.crear' },
  PROYECTOS:     { VER: 'proyectos.ver', CREAR: 'proyectos.crear' },
  PROPUESTAS:    { VER: 'propuestas.ver', CREAR: 'propuestas.crear' },
  OPORTUNIDADES: { VER: 'oportunidades.ver', CREAR: 'oportunidades.crear' },
  FACTURAS:      { VER: 'facturas.ver' },
}

function puedeVerClientes(session) {
  return (
    tienePermiso(session, PERMISOS.CLIENTES.VER) ||
    tienePermiso(session, PERMISOS.EMPRESAS.VER) ||
    tienePermiso(session, PERMISOS.PROYECTOS.VER) ||
    tienePermiso(session, PERMISOS.PROPUESTAS.VER) ||
    tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)
  )
}

function puedeCrearClientes(session) {
  return (
    tienePermiso(session, PERMISOS.CLIENTES.CREAR) ||
    tienePermiso(session, PERMISOS.EMPRESAS.CREAR) ||
    tienePermiso(session, PERMISOS.PROYECTOS.CREAR) ||
    tienePermiso(session, PERMISOS.PROPUESTAS.CREAR) ||
    tienePermiso(session, PERMISOS.OPORTUNIDADES.CREAR)
  )
}

describe('RBAC: Clientes es catálogo compartido entre módulos (CLAUDE.md §2.2)', () => {
  test('un perfil con permiso de Propuestas puede ver el dropdown de Clientes aunque no tenga clientes.ver', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.PROPUESTAS.VER] } }
    expect(puedeVerClientes(session)).toBe(true)
  })

  test('un perfil con permiso de Oportunidades puede crear un contacto inline aunque no tenga clientes.crear', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.OPORTUNIDADES.CREAR] } }
    expect(puedeCrearClientes(session)).toBe(true)
  })

  test('un perfil con permiso de Proyectos puede ver el dropdown de Clientes', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.PROYECTOS.VER] } }
    expect(puedeVerClientes(session)).toBe(true)
  })

  test('un perfil sin ninguno de los permisos relacionados no puede ver ni crear clientes', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.FACTURAS.VER] } }
    expect(puedeVerClientes(session)).toBe(false)
    expect(puedeCrearClientes(session)).toBe(false)
  })

  test('admin siempre puede, sin importar el array de permisos', () => {
    const session = { user: { role: 'admin', permisos: [] } }
    expect(puedeVerClientes(session)).toBe(true)
    expect(puedeCrearClientes(session)).toBe(true)
  })

  test('un perfil con permiso de Empresas puede ver el dropdown de Clientes (relación inversa de EmpresaFormDialog)', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.EMPRESAS.VER] } }
    expect(puedeVerClientes(session)).toBe(true)
  })

  test('un perfil con permiso de Empresas puede crear contactos inline (EmpresaFormDialog crea empresas + contactos)', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.EMPRESAS.CREAR] } }
    expect(puedeCrearClientes(session)).toBe(true)
  })
})
