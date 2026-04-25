'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { tarifarioService } from '@/services/tarifarioService'
import { empleadoService } from '@/services/empleadoService'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import axios from 'axios'

const EMPTY_LINEA = { perfilId: null, empleadoId: null, precioHora: 0 }

function margenPct(costo, precio) {
  if (!costo || !precio || precio === 0) return null
  return Math.round(((precio - costo) / precio) * 100)
}

function MargenBadge({ pct }) {
  if (pct === null) return <span className="text-color-secondary">—</span>
  const cls = pct >= 40 ? 'text-green-600' : pct >= 20 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-semibold ${cls}`}>{pct}%</span>
}

export default function TarifarioDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const toast = useRef(null)
  const { puede } = usePermisos()

  const [tarifario, setTarifario] = useState(null)
  const [empleados, setEmpleados] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingLinea, setEditingLinea] = useState(null)
  const [form, setForm] = useState(EMPTY_LINEA)
  const [errors, setErrors] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tarRes, empRes, perRes] = await Promise.all([
        tarifarioService.getById(id),
        empleadoService.getAll({ activo: true }),
        axios.get('/api/v1/perfiles-consultor?activo=true'),
      ])
      setTarifario(tarRes.data.data)
      setEmpleados(empRes.data.data || [])
      setPerfiles(perRes.data.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el tarifario' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const openNewLinea = () => {
    setForm(EMPTY_LINEA)
    setEditingLinea(null)
    setErrors({})
    setDialogOpen(true)
  }

  const openEditLinea = (linea) => {
    setForm({ perfilId: linea.perfilId, empleadoId: linea.empleadoId, precioHora: Number(linea.precioHora) })
    setEditingLinea(linea.id)
    setErrors({})
    setDialogOpen(true)
  }

  const handleSaveLinea = async () => {
    const e = {}
    if (!form.perfilId)      e.perfilId   = 'Requerido'
    if (!form.empleadoId)    e.empleadoId = 'Requerido'
    if (form.precioHora < 0) e.precioHora = 'Debe ser 0 o mayor'
    if (Object.keys(e).length) { setErrors(e); return }

    try {
      setSaving(true)
      await tarifarioService.saveLinea(id, {
        perfilId: form.perfilId,
        empleadoId: form.empleadoId,
        precioHora: form.precioHora,
      })
      toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Línea guardada' })
      setDialogOpen(false)
      load()
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLinea = (linea) => {
    confirmDialog({
      message: `¿Eliminar la línea ${linea.perfil?.nombre} ${linea.perfil?.nivel} — ${linea.empleado?.nombre} ${linea.empleado?.apellido}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await tarifarioService.removeLinea(id, linea.id)
          toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Línea eliminada' })
          load()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar' })
        }
      },
    })
  }

  // Para el dialog: empleados enriquecidos con costoHora visible
  const empleadosOpts = empleados.map((e) => ({
    label: `${e.nombre} ${e.apellido}`,
    sublabel: `Costo/h: $${Number(e.costoHora).toFixed(2)}`,
    value: e.id,
  }))

  const empleadoSeleccionado = form.empleadoId
    ? empleados.find((e) => e.id === form.empleadoId)
    : null

  const margenPreview = empleadoSeleccionado
    ? margenPct(Number(empleadoSeleccionado.costoHora), form.precioHora)
    : null

  const perfilesOpts = perfiles.map((p) => ({ label: `${p.nombre} ${p.nivel}`, value: p.id }))

  if (loading) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  if (!tarifario) return null

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Breadcrumb */}
      <div className="flex align-items-center gap-2 mb-3 text-sm text-color-secondary">
        <Button label="Tarifarios" link className="p-0 text-sm" onClick={() => router.push('/tarifarios')} />
        <i className="pi pi-angle-right text-xs" />
        <span>{tarifario.nombre}</span>
      </div>

      {/* Header */}
      <div className="flex justify-content-between align-items-start mb-4">
        <div>
          <div className="flex align-items-center gap-3">
            <h1 className="text-2xl font-bold m-0">{tarifario.nombre}</h1>
            <Tag value={tarifario.activo ? 'Activo' : 'Inactivo'} severity={tarifario.activo ? 'success' : 'secondary'} />
          </div>
          {tarifario.descripcion && <p className="text-color-secondary mt-1 mb-0">{tarifario.descripcion}</p>}
          {tarifario.empresas?.length > 0 && (
            <div className="flex align-items-center gap-2 mt-2">
              <span className="text-sm text-color-secondary">Asignado a:</span>
              {tarifario.empresas.map((emp) => (
                <Tag key={emp.id} value={emp.nombre} severity="info" />
              ))}
            </div>
          )}
        </div>
        {puede(PERMISOS.TARIFARIOS.EDITAR) && (
          <Button label="Agregar línea" icon="pi pi-plus" onClick={openNewLinea} />
        )}
      </div>

      {/* Tabla de líneas */}
      <DataTable
        value={tarifario.lineas || []}
        emptyMessage="Sin líneas — agrega la primera con el botón de arriba"
        stripedRows
        size="small"
      >
        <Column
          header="Perfil / Rol"
          body={(r) => (
            <div>
              <div className="font-semibold">{r.perfil ? r.perfil.nombre : '—'}</div>
              {r.perfil && (
                <Tag
                  value={r.perfil.nivel}
                  severity={r.perfil.nivel === 'Senior' ? 'success' : r.perfil.nivel === 'Semi Senior' ? 'info' : 'secondary'}
                  style={{ fontSize: '0.7rem' }}
                  className="mt-1"
                />
              )}
            </div>
          )}
        />
        <Column
          header="Consultor"
          body={(r) => r.empleado
            ? `${r.empleado.nombre} ${r.empleado.apellido}`
            : <span className="text-color-secondary">—</span>
          }
        />
        <Column
          header="Costo/h (interno)"
          style={{ textAlign: 'right', width: '140px' }}
          body={(r) => {
            const costo = r.empleado?.costoHora != null ? Number(r.empleado.costoHora) : null
            return costo != null
              ? <span className="text-color-secondary">${costo.toFixed(2)}</span>
              : <span className="text-color-secondary">—</span>
          }}
        />
        <Column
          header="Precio/h (cliente)"
          style={{ textAlign: 'right', width: '150px' }}
          body={(r) => <span className="font-semibold">${Number(r.precioHora).toFixed(2)}</span>}
        />
        <Column
          header="Margen"
          style={{ textAlign: 'right', width: '90px' }}
          body={(r) => {
            const costo = r.empleado?.costoHora != null ? Number(r.empleado.costoHora) : null
            const precio = Number(r.precioHora)
            const pct = margenPct(costo, precio)
            return <MargenBadge pct={pct} />
          }}
        />
        {puede(PERMISOS.TARIFARIOS.EDITAR) && (
          <Column header="Acciones" style={{ width: '100px' }} body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEditLinea(r)} />
              <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => handleDeleteLinea(r)} />
            </div>
          )} />
        )}
      </DataTable>

      {/* Dialog línea */}
      <Dialog
        header={editingLinea ? 'Editar línea' : 'Nueva línea'}
        visible={dialogOpen}
        onHide={() => setDialogOpen(false)}
        style={{ width: '460px' }}
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" outlined severity="secondary" onClick={() => setDialogOpen(false)} disabled={saving} />
            <Button label="Guardar" icon="pi pi-save" loading={saving} onClick={handleSaveLinea} />
          </div>
        }
      >
        <div className="grid">
          <div className="col-12">
            <label className="block font-medium mb-1">Perfil / Rol *</label>
            <Dropdown
              className={`w-full${errors.perfilId ? ' p-invalid' : ''}`}
              value={form.perfilId}
              options={perfilesOpts}
              onChange={(e) => { setForm((p) => ({ ...p, perfilId: e.value })); setErrors((p) => ({ ...p, perfilId: null })) }}
              placeholder="Seleccionar perfil"
              filter
            />
            {errors.perfilId && <small className="p-error">{errors.perfilId}</small>}
          </div>

          <div className="col-12">
            <label className="block font-medium mb-1">Consultor asignado *</label>
            <Dropdown
              className={`w-full${errors.empleadoId ? ' p-invalid' : ''}`}
              value={form.empleadoId}
              options={empleadosOpts}
              onChange={(e) => { setForm((p) => ({ ...p, empleadoId: e.value })); setErrors((p) => ({ ...p, empleadoId: null })) }}
              placeholder="Seleccionar consultor"
              filter
              itemTemplate={(opt) => (
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-color-secondary">{opt.sublabel}</div>
                </div>
              )}
            />
            {errors.empleadoId && <small className="p-error">{errors.empleadoId}</small>}
          </div>

          <div className="col-12">
            <label className="block font-medium mb-1">Precio/hora (cobrado al cliente) *</label>
            <InputNumber
              className={`w-full${errors.precioHora ? ' p-invalid' : ''}`}
              value={form.precioHora}
              onValueChange={(e) => { setForm((p) => ({ ...p, precioHora: e.value ?? 0 })); setErrors((p) => ({ ...p, precioHora: null })) }}
              mode="currency" currency="USD" locale="en-US" minFractionDigits={2}
            />
            {errors.precioHora && <small className="p-error">{errors.precioHora}</small>}
          </div>

          {/* Preview de margen */}
          {empleadoSeleccionado && form.precioHora > 0 && (
            <div className="col-12">
              <div className={`p-2 border-round text-sm text-center font-semibold ${
                margenPreview >= 40 ? 'bg-green-50 text-green-700'
                : margenPreview >= 20 ? 'bg-yellow-50 text-yellow-700'
                : 'bg-red-50 text-red-700'
              }`}>
                Costo interno: ${Number(empleadoSeleccionado.costoHora).toFixed(2)}/h
                {margenPreview !== null && ` · Margen: ${margenPreview}%`}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
