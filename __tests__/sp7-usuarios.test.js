/**
 * SP7-06: Tests para gestión de usuarios y filtros avanzados
 */

// ── Helpers de validación de usuario (lógica de la API) ──────────────────────

function validarUsuario(data, isEdit = false) {
  const errors = {}
  if (!data.name?.trim()) errors.name = 'El nombre es requerido'
  if (!data.email?.trim()) errors.email = 'El email es requerido'
  if (!isEdit && (!data.password || data.password.length < 6)) errors.password = 'Mínimo 6 caracteres'
  if (isEdit && data.password && data.password.length < 6) errors.password = 'Mínimo 6 caracteres'
  if (data.role && !['admin', 'user'].includes(data.role)) errors.role = 'Rol inválido'
  return errors
}

function puedeEliminar(sessionUserId, targetUserId) {
  return parseInt(sessionUserId) !== parseInt(targetUserId)
}

function validarCambioPassword(form) {
  const errors = {}
  if (!form.passwordActual) errors.passwordActual = 'La contraseña actual es requerida'
  if (!form.passwordNueva || form.passwordNueva.length < 8) errors.passwordNueva = 'Mínimo 8 caracteres'
  if (form.passwordNueva !== form.passwordConfirmar) errors.passwordConfirmar = 'Las contraseñas no coinciden'
  return errors
}

// ── Tests de validación de usuario ──────────────────────────────────────────
describe('Validación de usuario — crear', () => {
  test('nombre vacío → error', () => {
    const errs = validarUsuario({ name: '', email: 'a@b.com', password: 'secret1', role: 'user' })
    expect(errs.name).toBeDefined()
  })

  test('email vacío → error', () => {
    const errs = validarUsuario({ name: 'Ana', email: '', password: 'secret1', role: 'user' })
    expect(errs.email).toBeDefined()
  })

  test('password corta → error', () => {
    const errs = validarUsuario({ name: 'Ana', email: 'a@b.com', password: '123', role: 'user' })
    expect(errs.password).toBeDefined()
  })

  test('rol inválido → error', () => {
    const errs = validarUsuario({ name: 'Ana', email: 'a@b.com', password: 'secret1', role: 'superadmin' })
    expect(errs.role).toBeDefined()
  })

  test('datos válidos → sin errores', () => {
    const errs = validarUsuario({ name: 'Ana López', email: 'ana@proconty.com', password: 'secret1', role: 'user' })
    expect(Object.keys(errs)).toHaveLength(0)
  })
})

describe('Validación de usuario — editar', () => {
  test('password vacía en edición NO genera error (no cambiar)', () => {
    const errs = validarUsuario({ name: 'Ana', email: 'a@b.com', password: '', role: 'user' }, true)
    expect(errs.password).toBeUndefined()
  })

  test('password corta en edición SÍ genera error', () => {
    const errs = validarUsuario({ name: 'Ana', email: 'a@b.com', password: '123', role: 'user' }, true)
    expect(errs.password).toBeDefined()
  })

  test('password de 6+ chars en edición es válida', () => {
    const errs = validarUsuario({ name: 'Ana', email: 'a@b.com', password: 'nueva123', role: 'user' }, true)
    expect(errs.password).toBeUndefined()
  })
})

describe('Eliminación de usuario', () => {
  test('no puede eliminarse a sí mismo', () => {
    expect(puedeEliminar(5, 5)).toBe(false)
  })

  test('puede eliminar a otro usuario', () => {
    expect(puedeEliminar(1, 5)).toBe(true)
  })

  test('compara correctamente con strings', () => {
    expect(puedeEliminar('3', 3)).toBe(false)
    expect(puedeEliminar('1', 3)).toBe(true)
  })
})

describe('Cambio de contraseña — validación', () => {
  test('contraseña actual vacía → error', () => {
    const errs = validarCambioPassword({ passwordActual: '', passwordNueva: 'nueva1234', passwordConfirmar: 'nueva1234' })
    expect(errs.passwordActual).toBeDefined()
  })

  test('nueva contraseña < 8 chars → error', () => {
    const errs = validarCambioPassword({ passwordActual: 'actual', passwordNueva: '1234', passwordConfirmar: '1234' })
    expect(errs.passwordNueva).toBeDefined()
  })

  test('confirmación no coincide → error', () => {
    const errs = validarCambioPassword({ passwordActual: 'actual', passwordNueva: 'nueva1234', passwordConfirmar: 'nueva9999' })
    expect(errs.passwordConfirmar).toBeDefined()
  })

  test('todo válido → sin errores', () => {
    const errs = validarCambioPassword({ passwordActual: 'actual123', passwordNueva: 'nueva1234', passwordConfirmar: 'nueva1234' })
    expect(Object.keys(errs)).toHaveLength(0)
  })
})

// ── Tests de filtros avanzados ────────────────────────────────────────────────

function filtrarProyectos(proyectos, { responsableId, fechaDesde, fechaHasta }) {
  let lista = proyectos
  if (responsableId) {
    lista = lista.filter((p) => p.responsables?.some((r) => r.userId === responsableId))
  }
  if (fechaDesde) {
    const desde = new Date(fechaDesde); desde.setHours(0, 0, 0, 0)
    lista = lista.filter((p) => new Date(p.fechaCreacion) >= desde)
  }
  if (fechaHasta) {
    const hasta = new Date(fechaHasta); hasta.setHours(23, 59, 59, 999)
    lista = lista.filter((p) => new Date(p.fechaCreacion) <= hasta)
  }
  return lista
}

const PROYECTOS = [
  { id: 1, detalle: 'Alpha', fechaCreacion: '2024-01-15', responsables: [{ userId: 1 }, { userId: 2 }] },
  { id: 2, detalle: 'Beta',  fechaCreacion: '2024-03-20', responsables: [{ userId: 2 }] },
  { id: 3, detalle: 'Gamma', fechaCreacion: '2024-06-01', responsables: [{ userId: 3 }] },
  { id: 4, detalle: 'Delta', fechaCreacion: '2024-09-10', responsables: [] },
]

describe('Filtro por responsable', () => {
  test('filtra proyectos de un responsable específico', () => {
    const result = filtrarProyectos(PROYECTOS, { responsableId: 2 })
    expect(result.map((p) => p.id)).toEqual([1, 2])
  })

  test('responsable sin proyectos → lista vacía', () => {
    const result = filtrarProyectos(PROYECTOS, { responsableId: 99 })
    expect(result).toHaveLength(0)
  })

  test('sin filtro de responsable → devuelve todos', () => {
    const result = filtrarProyectos(PROYECTOS, {})
    expect(result).toHaveLength(4)
  })
})

describe('Filtro por rango de fechas', () => {
  test('filtra por fechaDesde correctamente', () => {
    const result = filtrarProyectos(PROYECTOS, { fechaDesde: '2024-06-01' })
    expect(result.map((p) => p.id)).toEqual([3, 4])
  })

  test('filtra por fechaHasta correctamente', () => {
    const result = filtrarProyectos(PROYECTOS, { fechaHasta: '2024-03-20' })
    expect(result.map((p) => p.id)).toEqual([1, 2])
  })

  test('filtra por rango completo', () => {
    const result = filtrarProyectos(PROYECTOS, { fechaDesde: '2024-03-01', fechaHasta: '2024-06-30' })
    expect(result.map((p) => p.id)).toEqual([2, 3])
  })
})

describe('Filtros combinados', () => {
  test('responsable + rango de fechas', () => {
    const result = filtrarProyectos(PROYECTOS, { responsableId: 2, fechaDesde: '2024-03-01' })
    expect(result.map((p) => p.id)).toEqual([2])
  })

  test('filtros que no coinciden → lista vacía', () => {
    const result = filtrarProyectos(PROYECTOS, { responsableId: 3, fechaHasta: '2024-03-20' })
    expect(result).toHaveLength(0)
  })
})
