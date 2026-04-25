'use client'
// src/app/(dashboard)/perfiles/page.jsx
// Sprint 11 — Gestión de Perfiles de Acceso (RBAC)
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Checkbox } from 'primereact/checkbox'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { perfilUsuarioService } from '@/services/perfilUsuarioService'
import { TODOS_LOS_PERMISOS } from '@/lib/permisos'

// ── Módulos para la matrix de permisos ──────────────────────────────────────
const MODULOS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    acciones: [{ key: 'ver', label: 'Ver' }],
    especiales: [],
  },
  {
    key: 'proyectos',
    label: 'Proyectos',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [
      { key: 'cambiarEstado', label: 'Cambiar Estado' },
      { key: 'pdf', label: 'Descargar PDF' },
    ],
  },
  {
    key: 'propuestas',
    label: 'Propuestas',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [{ key: 'cambiarEstado', label: 'Cambiar Estado' }],
  },
  {
    key: 'clientes',
    label: 'Clientes',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [],
  },
  {
    key: 'empresas',
    label: 'Empresas',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [],
  },
  {
    key: 'facturas',
    label: 'Facturas',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [],
  },
  {
    key: 'pagos',
    label: 'Pagos',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [],
  },
  {
    key: 'observaciones',
    label: 'Observaciones',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
    ],
    especiales: [],
  },
  {
    key: 'recordatorios',
    label: 'Recordatorios',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [],
  },
]

const ESTADOS_PROYECTO = [
  { id: 1, label: 'En Ejecución' },
  { id: 2, label: 'Por Facturar' },
  { id: 3, label: 'Adjudicado' },
  { id: 4, label: 'Facturado' },
  { id: 5, label: 'Cerrado' },
]

const EMPTY_FORM = {
  nombre: '',
  descripcion: '',
  permisos: [],
  estadosProyectoEditables: null, // null = todos
}

export default function PerfilesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useRef(null)

  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  // Solo admin
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  const loadPerfiles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await perfilUsuarioService.getAll()
      setPerfiles(res.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los perfiles' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPerfiles() }, [loadPerfiles])

  // ── Helpers para la matrix ────────────────────────────────────────────────
  const hasPermiso = (permiso) => form.permisos.includes(permiso)

  const togglePermiso = (permiso) => {
    setForm((prev) => {
      const set = new Set(prev.permisos)
      if (set.has(permiso)) {
        set.delete(permiso)
      } else {
        set.add(permiso)
      }
      return { ...prev, permisos: Array.from(set) }
    })
  }

  const hasEstadoEditable = (estadoId) => {
    if (form.estadosProyectoEditables === null) return true
    return form.estadosProyectoEditables.includes(estadoId)
  }

  const toggleEstadoEditable = (estadoId) => {
    setForm((prev) => {
      const actual = prev.estadosProyectoEditables ?? ESTADOS_PROYECTO.map((e) => e.id)
      const set = new Set(actual)
      if (set.has(estadoId)) {
        set.delete(estadoId)
      } else {
        set.add(estadoId)
      }
      const arr = Array.from(set)
      // Si todos están marcados → null (sin restricción)
      const isAll = ESTADOS_PROYECTO.every((e) => arr.includes(e.id))
      return { ...prev, estadosProyectoEditables: isAll ? null : arr }
    })
  }

  const seleccionarTodo = () => setForm((prev) => ({ ...prev, permisos: [...TODOS_LOS_PERMISOS] }))
  const deseleccionarTodo = () => setForm((prev) => ({ ...prev, permisos: [] }))

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = (perfil) => {
    setForm({
      nombre: perfil.nombre,
      descripcion: perfil.descripcion || '',
      permisos: Array.isArray(perfil.permisos) ? perfil.permisos : [],
      estadosProyectoEditables: perfil.estadosProyectoEditables ?? null,
    })
    setEditingId(perfil.id)
    setErrors({})
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'
    if (Object.keys(e).length > 0) { setErrors(e); return }

    try {
      setSaving(true)
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        permisos: form.permisos,
        estadosProyectoEditables: form.estadosProyectoEditables,
      }
      if (editingId) {
        await perfilUsuarioService.update(editingId, payload)
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Perfil actualizado exitosamente' })
      } else {
        await perfilUsuarioService.create(payload)
        toast.current?.show({ severity: 'success', summary: 'Creado', detail: 'Perfil creado exitosamente' })
      }
      setDialogOpen(false)
      loadPerfiles()
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al guardar'
      toast.current?.show({ severity: 'error', summary: 'Error', detail: msg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (perfil) => {
    confirmDialog({
      message: `¿Eliminar el perfil "${perfil.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await perfilUsuarioService.remove(perfil.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Perfil eliminado' })
          loadPerfiles()
        } catch (err) {
          const msg = err.response?.data?.message || 'Error al eliminar'
          toast.current?.show({ severity: 'error', summary: 'Error', detail: msg })
        }
      },
    })
  }

  // ── Columnas de la tabla ──────────────────────────────────────────────────
  const accionesTemplate = (row) => (
    <div className="flex gap-2">
      <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" onClick={() => openEdit(row)} />
      <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar"
        disabled={row._count?.usuarios > 0}
        tooltipOptions={{ position: 'top' }}
        onClick={() => handleDelete(row)} />
    </div>
  )

  const usuariosTemplate = (row) => (
    <Tag value={`${row._count?.usuarios ?? 0} usuario(s)`} severity={row._count?.usuarios > 0 ? 'info' : 'secondary'} />
  )

  const permisosTemplate = (row) => {
    const count = Array.isArray(row.permisos) ? row.permisos.length : 0
    return <Tag value={`${count} permiso(s)`} severity={count === TODOS_LOS_PERMISOS.length ? 'success' : 'warning'} />
  }

  const showEditarEstados = hasPermiso('proyectos.editar')

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <ProgressSpinner />
      </div>
    )
  }

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Header */}
      <div className="flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="text-900 font-bold text-2xl m-0">Perfiles de Acceso</h2>
          <p className="text-500 mt-1 mb-0">Define los permisos por módulo para cada rol de usuario</p>
        </div>
        <Button label="Nuevo Perfil" icon="pi pi-plus" onClick={openNew} />
      </div>

      {/* Tabla */}
      <div className="card">
        <DataTable value={perfiles} paginator rows={10} emptyMessage="No hay perfiles registrados">
          <Column field="id" header="ID" style={{ width: '60px' }} />
          <Column field="nombre" header="Nombre" />
          <Column field="descripcion" header="Descripción" body={(row) => row.descripcion || <span className="text-400">—</span>} />
          <Column header="Permisos" body={permisosTemplate} />
          <Column header="Usuarios" body={usuariosTemplate} />
          <Column header="Acciones" body={accionesTemplate} style={{ width: '120px' }} />
        </DataTable>
      </div>

      {/* Dialog crear/editar */}
      <Dialog
        header={editingId ? 'Editar Perfil' : 'Nuevo Perfil'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '900px' }}
        maximizable
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" outlined severity="secondary" onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button label="Guardar perfil" icon="pi pi-save" loading={saving} onClick={handleSave} />
          </div>
        }
      >
        {/* Nombre y descripción */}
        <div className="grid mb-3">
          <div className="col-12 md:col-6">
            <label className="block text-900 font-medium mb-1">Nombre *</label>
            <InputText
              className={`w-full${errors.nombre ? ' p-invalid' : ''}`}
              value={form.nombre}
              onChange={(e) => { setForm((p) => ({ ...p, nombre: e.target.value })); setErrors((p) => ({ ...p, nombre: null })) }}
            />
            {errors.nombre && <small className="p-error">{errors.nombre}</small>}
          </div>
          <div className="col-12 md:col-6">
            <label className="block text-900 font-medium mb-1">Descripción</label>
            <InputTextarea
              className="w-full"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            />
          </div>
        </div>

        {/* Botones rápidos */}
        <div className="flex gap-2 mb-3">
          <Button label="Seleccionar todo" size="small" outlined severity="secondary" onClick={seleccionarTodo} />
          <Button label="Deseleccionar todo" size="small" outlined severity="secondary" onClick={deseleccionarTodo} />
        </div>

        {/* Matrix de permisos */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-100)' }}>
                <th className="text-left p-2" style={{ width: '150px', borderBottom: '2px solid var(--surface-300)' }}>Módulo</th>
                <th className="text-center p-2" style={{ borderBottom: '2px solid var(--surface-300)' }}>Ver</th>
                <th className="text-center p-2" style={{ borderBottom: '2px solid var(--surface-300)' }}>Crear</th>
                <th className="text-center p-2" style={{ borderBottom: '2px solid var(--surface-300)' }}>Editar</th>
                <th className="text-center p-2" style={{ borderBottom: '2px solid var(--surface-300)' }}>Eliminar</th>
                <th className="text-left p-2" style={{ borderBottom: '2px solid var(--surface-300)' }}>Especiales</th>
              </tr>
            </thead>
            <tbody>
              {MODULOS.map((modulo, idx) => {
                const rowStyle = { background: idx % 2 === 0 ? 'transparent' : 'var(--surface-50)', borderBottom: '1px solid var(--surface-200)' }
                const getAccion = (key) => modulo.acciones.find((a) => a.key === key)
                return (
                  <tr key={modulo.key} style={rowStyle}>
                    <td className="p-2 font-medium text-900">{modulo.label}</td>
                    {['ver', 'crear', 'editar', 'eliminar'].map((accion) => {
                      const def = getAccion(accion)
                      if (!def) return <td key={accion} className="text-center p-2 text-400">—</td>
                      const permKey = `${modulo.key}.${accion}`
                      return (
                        <td key={accion} className="text-center p-2">
                          <Checkbox checked={hasPermiso(permKey)} onChange={() => togglePermiso(permKey)} />
                        </td>
                      )
                    })}
                    <td className="p-2">
                      <div className="flex flex-column gap-1">
                        {modulo.especiales.map((esp) => {
                          const permKey = `${modulo.key}.${esp.key}`
                          return (
                            <div key={esp.key} className="flex align-items-center gap-2">
                              <Checkbox checked={hasPermiso(permKey)} onChange={() => togglePermiso(permKey)} />
                              <span className="text-sm">{esp.label}</span>
                            </div>
                          )
                        })}
                        {/* Restricción de estados de edición (solo proyectos) */}
                        {modulo.key === 'proyectos' && showEditarEstados && (
                          <div className="mt-2">
                            <div className="text-xs text-500 font-medium mb-1">Editar en estados:</div>
                            <div className="flex flex-column gap-1">
                              {ESTADOS_PROYECTO.map((est) => (
                                <div key={est.id} className="flex align-items-center gap-2">
                                  <Checkbox
                                    checked={hasEstadoEditable(est.id)}
                                    onChange={() => toggleEstadoEditable(est.id)}
                                    disabled={!hasPermiso('proyectos.editar')}
                                  />
                                  <span className="text-xs">{est.label}</span>
                                </div>
                              ))}
                              {form.estadosProyectoEditables === null && (
                                <span className="text-xs text-green-600 font-medium">Todos los estados</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="text-400 text-xs mt-2">* Los cambios aplican al siguiente inicio de sesión del usuario.</div>
      </Dialog>
    </div>
  )
}
