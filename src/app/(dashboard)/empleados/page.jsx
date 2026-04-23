'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { InputSwitch } from 'primereact/inputswitch'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { empleadoService } from '@/services/empleadoService'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import axios from 'axios'

const EMPTY = { nombre: '', apellido: '', email: '', costoHora: 0, perfilBaseId: null, activo: true }

export default function EmpleadosPage() {
  const toast = useRef(null)
  const { puede } = usePermisos()

  const [empleados, setEmpleados] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, perRes] = await Promise.all([
        empleadoService.getAll(),
        axios.get('/api/v1/perfiles-consultor'),
      ])
      setEmpleados(empRes.data.data || [])
      setPerfiles(perRes.data.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los empleados' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY); setEditingId(null); setErrors({}); setDialogOpen(true) }
  const openEdit = (e) => {
    setForm({
      nombre:      e.nombre,
      apellido:    e.apellido,
      email:       e.email || '',
      costoHora:   Number(e.costoHora),
      perfilBaseId: e.perfilBaseId || null,
      activo:      e.activo,
    })
    setEditingId(e.id)
    setErrors({})
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const e = {}
    if (!form.nombre.trim())   e.nombre   = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (form.costoHora < 0)   e.costoHora = 'Debe ser 0 o mayor'
    if (Object.keys(e).length) { setErrors(e); return }

    try {
      setSaving(true)
      const payload = {
        nombre:      form.nombre.trim(),
        apellido:    form.apellido.trim(),
        email:       form.email.trim() || null,
        costoHora:   form.costoHora,
        perfilBaseId: form.perfilBaseId,
        activo:      form.activo,
      }
      if (editingId) {
        await empleadoService.update(editingId, payload)
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Empleado actualizado' })
      } else {
        await empleadoService.create(payload)
        toast.current?.show({ severity: 'success', summary: 'Creado', detail: 'Empleado creado' })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (emp) => {
    confirmDialog({
      message: `¿Eliminar a "${emp.nombre} ${emp.apellido}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await empleadoService.remove(emp.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Empleado eliminado' })
          load()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar' })
        }
      },
    })
  }

  const perfilesOptions = perfiles.map((p) => ({ label: `${p.nombre} ${p.nivel}`, value: p.id }))

  if (loading && empleados.length === 0) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">Empleados / Consultores</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">{empleados.length} empleado(s)</p>
        </div>
        {puede(PERMISOS.EMPLEADOS.CREAR) && (
          <Button label="Nuevo Empleado" icon="pi pi-plus" onClick={openNew} />
        )}
      </div>

      <DataTable value={empleados} loading={loading} paginator rows={15} emptyMessage="No hay empleados registrados" stripedRows>
        <Column header="Nombre" body={(r) => `${r.nombre} ${r.apellido}`} sortable sortField="nombre" />
        <Column field="email" header="Email" body={(r) => r.email || '—'} />
        <Column header="Perfil base" body={(r) => r.perfilBase ? `${r.perfilBase.nombre} ${r.perfilBase.nivel}` : '—'} />
        <Column header="Costo/h" body={(r) => `$${Number(r.costoHora).toFixed(2)}`} style={{ textAlign: 'right', width: '110px' }} />
        <Column header="Estado" body={(r) => <Tag value={r.activo ? 'Activo' : 'Inactivo'} severity={r.activo ? 'success' : 'secondary'} />} style={{ width: '100px' }} />
        <Column header="Acciones" style={{ width: '120px' }} body={(r) => (
          <div className="flex gap-1">
            {puede(PERMISOS.EMPLEADOS.EDITAR) && (
              <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEdit(r)} />
            )}
            {puede(PERMISOS.EMPLEADOS.ELIMINAR) && (
              <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => handleDelete(r)} />
            )}
          </div>
        )} />
      </DataTable>

      <Dialog
        header={editingId ? 'Editar Empleado' : 'Nuevo Empleado'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '480px' }}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" outlined severity="secondary" onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button label="Guardar" icon="pi pi-save" loading={saving} onClick={handleSave} />
          </div>
        }
      >
        <div className="grid">
          <div className="col-6">
            <label className="block font-medium mb-1">Nombre *</label>
            <InputText className={`w-full${errors.nombre ? ' p-invalid' : ''}`} value={form.nombre}
              onChange={(e) => { setForm((p) => ({ ...p, nombre: e.target.value })); setErrors((p) => ({ ...p, nombre: null })) }} />
            {errors.nombre && <small className="p-error">{errors.nombre}</small>}
          </div>
          <div className="col-6">
            <label className="block font-medium mb-1">Apellido *</label>
            <InputText className={`w-full${errors.apellido ? ' p-invalid' : ''}`} value={form.apellido}
              onChange={(e) => { setForm((p) => ({ ...p, apellido: e.target.value })); setErrors((p) => ({ ...p, apellido: null })) }} />
            {errors.apellido && <small className="p-error">{errors.apellido}</small>}
          </div>
          <div className="col-12">
            <label className="block font-medium mb-1">Email</label>
            <InputText className="w-full" value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="opcional" />
          </div>
          <div className="col-6">
            <label className="block font-medium mb-1">Costo/hora (interno) *</label>
            <InputNumber className={`w-full${errors.costoHora ? ' p-invalid' : ''}`} value={form.costoHora}
              onValueChange={(e) => { setForm((p) => ({ ...p, costoHora: e.value ?? 0 })); setErrors((p) => ({ ...p, costoHora: null })) }}
              mode="currency" currency="USD" locale="en-US" minFractionDigits={2} />
            {errors.costoHora && <small className="p-error">{errors.costoHora}</small>}
          </div>
          <div className="col-6">
            <label className="block font-medium mb-1">Perfil base</label>
            <Dropdown className="w-full" value={form.perfilBaseId} options={perfilesOptions}
              onChange={(e) => setForm((p) => ({ ...p, perfilBaseId: e.value }))}
              placeholder="Sin perfil" showClear />
          </div>
          <div className="col-12 flex align-items-center gap-3 mt-2">
            <InputSwitch checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.value })) } />
            <span className="font-medium">{form.activo ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
