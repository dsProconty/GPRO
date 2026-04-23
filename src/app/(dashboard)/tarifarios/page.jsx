'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { InputSwitch } from 'primereact/inputswitch'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { tarifarioService } from '@/services/tarifarioService'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

const EMPTY = { nombre: '', descripcion: '', activo: true }

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tarifarioService.getAll()
      setTarifarios(res.data.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los tarifarios' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
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
    </div>
  )
}
