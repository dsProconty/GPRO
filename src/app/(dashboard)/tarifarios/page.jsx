'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from '@/components/shared/InputText'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { InputSwitch } from 'primereact/inputswitch'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { tarifarioService } from '@/services/tarifarioService'
import { perfilConsultorService, NIVEL_OPTIONS } from '@/services/perfilConsultorService'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

const EMPTY = { nombre: '', descripcion: '', activo: true }

// ─── Dialog crear/editar perfil de consultor ─────────────────────────────────
// Nota: el precio al cliente ya no se gestiona aquí — se define en Tarifarios (por empresa).
// El costoHora aquí es un valor de respaldo si el empleado no tiene costo definido.
function PerfilConsultorDialog({ visible, onHide, onSave, perfil }) {
  const isEdit = !!perfil
  const [form, setForm] = useState({ nombre: '', nivel: 'Senior', costoHora: null, precioHora: null, activo: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (visible) {
      setForm(perfil
        ? { nombre: perfil.nombre, nivel: perfil.nivel, costoHora: Number(perfil.costoHora), precioHora: Number(perfil.precioHora), activo: perfil.activo }
        : { nombre: '', nivel: 'Senior', costoHora: null, precioHora: null, activo: true }
      )
      setError('')
    }
  }, [visible, perfil])

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre del rol es requerido'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await perfilConsultorService.update(perfil.id, form)
      } else {
        await perfilConsultorService.create(form)
      }
      onSave()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button label={isEdit ? 'Guardar cambios' : 'Crear perfil'} icon="pi pi-check" onClick={handleSave} loading={saving} />
    </div>
  )

  return (
    <Dialog visible={visible} onHide={onHide} header={isEdit ? 'Editar Perfil' : 'Nuevo Perfil de Consultor'} style={{ width: '420px' }} footer={footer} modal>
      <div className="flex flex-column gap-3 mt-2">
        {error && <div className="p-2 border-round text-red-600 text-sm surface-100">{error}</div>}
        <div className="grid">
          <div className="col-8">
            <div className="flex flex-column gap-1">
              <label className="text-sm font-medium">Rol <span className="text-red-500">*</span></label>
              <InputText value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Full Stack, QA, PM" />
            </div>
          </div>
          <div className="col-4">
            <div className="flex flex-column gap-1">
              <label className="text-sm font-medium">Nivel <span className="text-red-500">*</span></label>
              <Dropdown value={form.nivel} options={NIVEL_OPTIONS} optionLabel="label" optionValue="value" onChange={(e) => setForm((p) => ({ ...p, nivel: e.value }))} />
            </div>
          </div>
        </div>
        {isEdit && (
          <div className="flex align-items-center gap-2">
            <InputSwitch checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.value }))} />
            <label className="text-sm">Perfil activo</label>
          </div>
        )}
      </div>
    </Dialog>
  )
}

export default function TarifariosPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()

  const [tarifarios, setTarifarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const [perfiles, setPerfiles] = useState([])
  const [pfDialog, setPfDialog] = useState({ visible: false, perfil: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tarRes, pfRes] = await Promise.all([
        tarifarioService.getAll(),
        perfilConsultorService.getAll(),
      ])
      setTarifarios(tarRes.data.data || [])
      setPerfiles(pfRes.data.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los tarifarios' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSavePerfil = () => {
    setPfDialog({ visible: false, perfil: null })
    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Perfil guardado', life: 3000 })
    load()
  }

  const confirmDeletePerfil = (perfil) => {
    confirmDialog({
      message: `¿Eliminar el perfil "${perfil.nombre} ${perfil.nivel}"? Solo es posible si no está en uso en ningún caso de negocio.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await perfilConsultorService.remove(perfil.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Perfil eliminado', life: 3000 })
          load()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'No se pudo eliminar', life: 5000 })
        }
      },
    })
  }

  const toggleActivoPerfil = async (perfil) => {
    try {
      await perfilConsultorService.update(perfil.id, { ...perfil, activo: !perfil.activo })
      load()
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar', life: 3000 })
    }
  }

  const openNew = () => { setForm(EMPTY); setEditingId(null); setErrors({}); setDialogOpen(true) }
  const openEdit = (t) => {
    setForm({ nombre: t.nombre, descripcion: t.descripcion || '', activo: t.activo })
    setEditingId(t.id)
    setErrors({})
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) { setErrors({ nombre: 'Requerido' }); return }

    try {
      setSaving(true)
      const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, activo: form.activo }
      if (editingId) {
        await tarifarioService.update(editingId, payload)
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Tarifario actualizado' })
      } else {
        await tarifarioService.create(payload)
        toast.current?.show({ severity: 'success', summary: 'Creado', detail: 'Tarifario creado' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (t) => {
    confirmDialog({
      message: `¿Eliminar el tarifario "${t.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await tarifarioService.remove(t.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Tarifario eliminado' })
          load()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar' })
        }
      },
    })
  }

  if (loading && tarifarios.length === 0) {
    return (
      <>
        <Toast ref={toast} />
        <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
      </>
    )
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">Tarifarios</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">{tarifarios.length} tarifario(s)</p>
        </div>
        {puede(PERMISOS.TARIFARIOS.CREAR) && (
          <Button label="Nuevo Tarifario" icon="pi pi-plus" onClick={openNew} />
        )}
      </div>

      <DataTable value={tarifarios} loading={loading} paginator rows={15} emptyMessage="No hay tarifarios registrados" stripedRows>
        <Column header="Nombre" body={(r) => (
          <Button label={r.nombre} link className="p-0 text-left font-medium"
            onClick={() => router.push(`/tarifarios/${r.id}`)} />
        )} sortable sortField="nombre" />
        <Column field="descripcion" header="Descripción" body={(r) => r.descripcion || '—'} />
        <Column header="Líneas" body={(r) => r._count?.lineas ?? 0} style={{ width: '90px', textAlign: 'center' }} />
        <Column header="Estado" body={(r) => <Tag value={r.activo ? 'Activo' : 'Inactivo'} severity={r.activo ? 'success' : 'secondary'} />} style={{ width: '100px' }} />
        <Column header="Acciones" style={{ width: '120px' }} body={(r) => (
          <div className="flex gap-1">
            <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver líneas" tooltipOptions={{ position: 'top' }}
              onClick={() => router.push(`/tarifarios/${r.id}`)} />
            {puede(PERMISOS.TARIFARIOS.EDITAR) && (
              <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEdit(r)} />
            )}
            {puede(PERMISOS.TARIFARIOS.ELIMINAR) && (
              <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => handleDelete(r)} />
            )}
          </div>
        )} />
      </DataTable>

      {/* ── Perfiles de Consultor ── */}
      <Card className="mt-4">
        <div className="flex align-items-center justify-content-between mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-id-card mr-2" />Perfiles de Consultor</h3>
            <p className="text-color-secondary text-xs mt-1 mb-0">
              Roles (Full Stack Senior, QA, PM…). El precio al cliente se define por línea en cada
              tarifario y el costo por consultor en <strong>Empleados</strong>.
            </p>
          </div>
          {puede(PERMISOS.TARIFARIOS.CREAR) && (
            <Button label="Nuevo perfil" icon="pi pi-plus" size="small" onClick={() => setPfDialog({ visible: true, perfil: null })} />
          )}
        </div>
        <DataTable value={perfiles} emptyMessage="Sin perfiles registrados" size="small" stripedRows>
          <Column header="Rol" body={(r) => <span className="font-semibold">{r.nombre}</span>} />
          <Column header="Nivel" body={(r) => (
            <Tag
              value={r.nivel}
              severity={r.nivel === 'Senior' ? 'success' : r.nivel === 'Semi Senior' ? 'info' : 'secondary'}
              style={{ fontSize: '0.75rem' }}
            />
          )} style={{ width: '130px' }} />
          <Column header="Activo" body={(r) => (
            <InputSwitch checked={r.activo} onChange={() => toggleActivoPerfil(r)} disabled={!puede(PERMISOS.TARIFARIOS.EDITAR)} />
          )} style={{ width: '80px' }} />
          <Column header="Acciones" style={{ width: '90px' }} body={(r) => (
            <div className="flex gap-1">
              {puede(PERMISOS.TARIFARIOS.EDITAR) && (
                <Button icon="pi pi-pencil" rounded text severity="info" size="small" tooltip="Editar" tooltipOptions={{ position: 'top' }}
                  onClick={() => setPfDialog({ visible: true, perfil: r })} />
              )}
              {puede(PERMISOS.TARIFARIOS.ELIMINAR) && (
                <Button icon="pi pi-trash" rounded text severity="danger" size="small" tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                  onClick={() => confirmDeletePerfil(r)} />
              )}
            </div>
          )} />
        </DataTable>
      </Card>

      <Dialog
        header={editingId ? 'Editar Tarifario' : 'Nuevo Tarifario'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '440px' }}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" outlined severity="secondary" onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button label="Guardar" icon="pi pi-save" loading={saving} onClick={handleSave} />
          </div>
        }
      >
        <div className="grid">
          <div className="col-12">
            <label className="block font-medium mb-1">Nombre *</label>
            <InputText className={`w-full${errors.nombre ? ' p-invalid' : ''}`} value={form.nombre}
              onChange={(e) => { setForm((p) => ({ ...p, nombre: e.target.value })); setErrors({}) }} />
            {errors.nombre && <small className="p-error">{errors.nombre}</small>}
          </div>
          <div className="col-12">
            <label className="block font-medium mb-1">Descripción</label>
            <InputTextarea className="w-full" rows={3} value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="opcional" />
          </div>
          <div className="col-12 flex align-items-center gap-3 mt-2">
            <InputSwitch checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.value }))} />
            <span className="font-medium">{form.activo ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </Dialog>

      <PerfilConsultorDialog
        visible={pfDialog.visible}
        onHide={() => setPfDialog({ visible: false, perfil: null })}
        onSave={handleSavePerfil}
        perfil={pfDialog.perfil}
      />
    </div>
  )
}
