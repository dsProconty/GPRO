'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from '@/components/shared/InputText'
import { InputText as PrInputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { InputNumber } from 'primereact/inputnumber'
import { InputSwitch } from 'primereact/inputswitch'
import { configuracionService, SEVERITY_COLORS } from '@/services/configuracionService'
import { perfilConsultorService, NIVEL_OPTIONS } from '@/services/perfilConsultorService'
import { formatDate, formatCurrency } from '@/utils/format'
import axios from 'axios'

const FUENTE_CONFIG = {
  estado_log:      { label: 'Historial de estado', severity: 'success' },
  fecha_cierre:     { label: 'Fecha cierre operativo', severity: 'info' },
  manual:           { label: 'Fecha manual', severity: 'success' },
  saldo_pendiente:  { label: 'Saldo pendiente — omitido', severity: 'warning' },
  sin_facturas:     { label: 'Sin facturas — omitido', severity: 'secondary' },
  sin_dato:         { label: 'Sin dato confiable — omitido', severity: 'danger' },
}

const MONEDA_OPTIONS = [
  { label: 'USD — Dólar estadounidense',  value: 'USD' },
  { label: 'EUR — Euro',                  value: 'EUR' },
  { label: 'COP — Peso colombiano',       value: 'COP' },
  { label: 'MXN — Peso mexicano',         value: 'MXN' },
  { label: 'PEN — Sol peruano',           value: 'PEN' },
  { label: 'CLP — Peso chileno',          value: 'CLP' },
  { label: 'ARS — Peso argentino',        value: 'ARS' },
  { label: 'BRL — Real brasileño',        value: 'BRL' },
  { label: 'GBP — Libra esterlina',       value: 'GBP' },
]

const SEVERITY_OPTIONS = [
  { label: 'Azul (info)',      value: 'info'      },
  { label: 'Verde (success)',  value: 'success'   },
  { label: 'Amarillo (warn)',  value: 'warning'   },
  { label: 'Rojo (danger)',    value: 'danger'    },
  { label: 'Gris (neutral)',   value: 'secondary' },
]

const ICON_OPTIONS = [
  { label: 'Bombilla',      value: 'pi-lightbulb'    },
  { label: 'Engranaje',     value: 'pi-cog'          },
  { label: 'Enviar',        value: 'pi-send'         },
  { label: 'Check',         value: 'pi-check-circle' },
  { label: 'X / Rechazo',   value: 'pi-times-circle' },
  { label: 'Maletín',       value: 'pi-briefcase'    },
  { label: 'Reloj',         value: 'pi-clock'        },
  { label: 'Estrella',      value: 'pi-star'         },
  { label: 'Círculo',       value: 'pi-circle'       },
]

// ─── Dialog para crear/editar estado de proyecto ──────────────────────────────
function EstadoProyectoDialog({ visible, onHide, onSave, estado }) {
  const isEdit = !!estado
  const [form, setForm] = useState({ nombre: '', descripcion: '', color: 'secondary' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (visible) {
      setForm(estado
        ? { nombre: estado.nombre, descripcion: estado.descripcion || '', color: estado.color }
        : { nombre: '', descripcion: '', color: 'secondary' }
      )
      setError('')
    }
  }, [visible, estado])

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await configuracionService.updateEstadoProyecto(estado.id, form)
      } else {
        await configuracionService.createEstadoProyecto(form)
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
      <Button label={isEdit ? 'Guardar cambios' : 'Crear estado'} icon="pi pi-check" onClick={handleSave} loading={saving} />
    </div>
  )

  return (
    <Dialog visible={visible} onHide={onHide} header={isEdit ? 'Editar Estado' : 'Nuevo Estado de Proyecto'} style={{ width: '420px' }} footer={footer} modal>
      <div className="flex flex-column gap-3 mt-2">
        {error && <div className="p-2 border-round text-red-600 text-sm surface-100">{error}</div>}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
          <PrInputText value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: En Ejecución" className="w-full" />
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Descripción</label>
          <PrInputText value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional" className="w-full" />
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Color / Severidad</label>
          <Dropdown value={form.color} options={SEVERITY_OPTIONS} optionLabel="label" optionValue="value" onChange={(e) => setForm((p) => ({ ...p, color: e.value }))} />
          <div className="mt-1">
            <Tag value={form.nombre || 'Vista previa'} severity={form.color} />
          </div>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Dialog para editar label de estado de propuesta ─────────────────────────
function EstadoPropuestaDialog({ visible, onHide, onSave, estadoLabel }) {
  const [form, setForm] = useState({ label: '', severity: 'secondary', icon: 'pi-circle' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (visible && estadoLabel) {
      setForm({ label: estadoLabel.label, severity: estadoLabel.severity, icon: estadoLabel.icon })
      setError('')
    }
  }, [visible, estadoLabel])

  const handleSave = async () => {
    if (!form.label.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    try {
      await configuracionService.updateEstadoPropuesta(estadoLabel.key, form)
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
      <Button label="Guardar cambios" icon="pi pi-check" onClick={handleSave} loading={saving} />
    </div>
  )

  return (
    <Dialog visible={visible} onHide={onHide} header="Editar nombre de estado" style={{ width: '420px' }} footer={footer} modal>
      <div className="flex flex-column gap-3 mt-2">
        {error && <div className="p-2 border-round text-red-600 text-sm surface-100">{error}</div>}
        <div className="p-2 surface-50 border-round text-sm text-color-secondary">
          <i className="pi pi-info-circle mr-1" />
          Clave interna: <strong className="text-900">{estadoLabel?.key}</strong> — este identificador no cambia, solo el nombre visible.
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Nombre visible <span className="text-red-500">*</span></label>
          <PrInputText value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Ej: Generando Propuesta" className="w-full" />
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Color / Severidad</label>
          <Dropdown value={form.severity} options={SEVERITY_OPTIONS} optionLabel="label" optionValue="value" onChange={(e) => setForm((p) => ({ ...p, severity: e.value }))} />
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Ícono</label>
          <Dropdown
            value={form.icon}
            options={ICON_OPTIONS}
            optionLabel="label"
            optionValue="value"
            onChange={(e) => setForm((p) => ({ ...p, icon: e.value }))}
            itemTemplate={(opt) => <span><i className={`pi ${opt.value} mr-2`} />{opt.label}</span>}
            valueTemplate={(opt) => opt ? <span><i className={`pi ${opt.value} mr-2`} />{opt.label}</span> : 'Seleccionar'}
          />
          <div className="mt-1">
            <Tag value={form.label || 'Vista previa'} severity={form.severity} icon={`pi ${form.icon}`} />
          </div>
        </div>
      </div>
    </Dialog>
  )
}

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
              <PrInputText value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Full Stack, QA, PM" className="w-full" />
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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useRef(null)

  const [loading, setLoading] = useState(true)
  const [estadosProyecto, setEstadosProyecto] = useState([])
  const [estadosPropuesta, setEstadosPropuesta] = useState([])
  const [empresaForm, setEmpresaForm] = useState({ nombre: '', moneda: 'USD', logoUrl: '', direccion: '', telefono: '', email: '' })
  const [empresaSaving, setEmpresaSaving] = useState(false)
  const [perfiles, setPerfiles] = useState([])

  // Dialogs
  const [epDialog, setEpDialog] = useState({ visible: false, estado: null })       // estado proyecto
  const [elDialog, setElDialog] = useState({ visible: false, estadoLabel: null })  // label propuesta
  const [pfDialog, setPfDialog] = useState({ visible: false, perfil: null })       // perfil consultor

  const [backfillDialog, setBackfillDialog] = useState({ visible: false, resultados: [], mensaje: '' })
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillAplicando, setBackfillAplicando] = useState(false)
  const [manualDates, setManualDates] = useState({}) // { [proyectoId]: Date }

  const [eliminarObsId, setEliminarObsId] = useState(null)
  const [eliminarObsPreview, setEliminarObsPreview] = useState(null)
  const [eliminarObsLoading, setEliminarObsLoading] = useState(false)
  const [eliminarObsAplicando, setEliminarObsAplicando] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      loadAll()
    }
  }, [status])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cfgRes, pfRes] = await Promise.allSettled([
        configuracionService.getAll(),
        perfilConsultorService.getAll(),
      ])
      if (cfgRes.status === 'rejected') throw cfgRes.reason
      setEstadosProyecto(cfgRes.value.data.data.estadosProyecto)
      setEstadosPropuesta(cfgRes.value.data.data.estadosPropuesta)
      const emp = cfgRes.value.data.data.empresa || {}
      setEmpresaForm({
        nombre:    emp.nombre    || '',
        moneda:    emp.moneda    || 'USD',
        logoUrl:   emp.logoUrl   || '',
        direccion: emp.direccion || '',
        telefono:  emp.telefono  || '',
        email:     emp.email     || '',
      })
      if (pfRes.status === 'fulfilled') setPerfiles(pfRes.value.data.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la configuración', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEstadoProyecto = () => {
    setEpDialog({ visible: false, estado: null })
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Estado de proyecto guardado', life: 3000 })
    loadAll()
  }

  const handleSaveEstadoPropuesta = () => {
    setElDialog({ visible: false, estadoLabel: null })
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Nombre de estado actualizado', life: 3000 })
    loadAll()
  }

  const handleSavePerfil = () => {
    setPfDialog({ visible: false, perfil: null })
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Perfil guardado', life: 3000 })
    loadAll()
  }

  const handlePreviewCierreFinanciero = async () => {
    setBackfillLoading(true)
    try {
      const res = await axios.post('/api/v1/admin/backfill-cierre-financiero', { aplicar: false })
      setManualDates({})
      setBackfillDialog({ visible: true, resultados: res.data.data, mensaje: res.data.message })
    } catch (e) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
    } finally {
      setBackfillLoading(false)
    }
  }

  const handleAplicarCierreFinanciero = () => {
    const overrideEntries = Object.entries(manualDates).filter(([, d]) => d)
    const aplicables = backfillDialog.resultados.filter(
      (r) => r.fechaTentativa || manualDates[r.id]
    ).length
    confirmDialog({
      message: `Se asignará fecha de cierre financiero a ${aplicables} proyecto(s)${overrideEntries.length > 0 ? ` (${overrideEntries.length} con fecha ingresada manualmente)` : ''}. Esta acción escribe directamente en la base de datos. ¿Confirmas?`,
      header: 'Aplicar cierre financiero retroactivo',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, aplicar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        setBackfillAplicando(true)
        try {
          const overrides = Object.fromEntries(
            overrideEntries.map(([id, d]) => [id, d.toISOString().slice(0, 10)])
          )
          const res = await axios.post('/api/v1/admin/backfill-cierre-financiero', { aplicar: true, overrides })
          setBackfillDialog({ visible: true, resultados: res.data.data, mensaje: res.data.message })
          setManualDates({})
          toast.current.show({ severity: 'success', summary: 'Aplicado', detail: res.data.message, life: 6000 })
        } catch (e) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
        } finally {
          setBackfillAplicando(false)
        }
      },
    })
  }

  const handleBuscarObservacion = async () => {
    if (!eliminarObsId) return
    setEliminarObsLoading(true)
    setEliminarObsPreview(null)
    try {
      const res = await axios.post('/api/v1/admin/eliminar-observacion', { id: eliminarObsId, aplicar: false })
      setEliminarObsPreview(res.data.data)
    } catch (e) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
    } finally {
      setEliminarObsLoading(false)
    }
  }

  const handleEliminarObservacion = () => {
    confirmDialog({
      message: `¿Eliminar definitivamente la observación #${eliminarObsPreview.id} de "${eliminarObsPreview.autor}"? Esta acción no se puede deshacer.`,
      header: 'Eliminar observación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        setEliminarObsAplicando(true)
        try {
          const res = await axios.post('/api/v1/admin/eliminar-observacion', { id: eliminarObsId, aplicar: true })
          toast.current.show({ severity: 'success', summary: 'Eliminada', detail: res.data.message, life: 4000 })
          setEliminarObsPreview(null)
          setEliminarObsId(null)
        } catch (e) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
        } finally {
          setEliminarObsAplicando(false)
        }
      },
    })
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
          toast.current.show({ severity: 'success', summary: 'Eliminado', detail: 'Perfil eliminado', life: 3000 })
          loadAll()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'No se pudo eliminar', life: 5000 })
        }
      },
    })
  }

  const toggleActivoPerfil = async (perfil) => {
    try {
      await perfilConsultorService.update(perfil.id, { ...perfil, activo: !perfil.activo })
      loadAll()
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar', life: 3000 })
    }
  }

  const handleSaveEmpresa = async () => {
    if (!empresaForm.nombre.trim()) {
      toast.current.show({ severity: 'warn', summary: 'Requerido', detail: 'El nombre de la empresa es obligatorio', life: 3000 })
      return
    }
    setEmpresaSaving(true)
    try {
      await configuracionService.updateEmpresa(empresaForm)
      toast.current.show({ severity: 'success', summary: 'Guardado', detail: 'Datos de empresa actualizados', life: 3000 })
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    } finally {
      setEmpresaSaving(false)
    }
  }

  const confirmDeleteEstado = (estado) => {
    confirmDialog({
      message: `¿Eliminar el estado "${estado.nombre}"? Solo es posible si ningún proyecto lo usa.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await configuracionService.deleteEstadoProyecto(estado.id)
          toast.current.show({ severity: 'success', summary: 'Eliminado', detail: `Estado "${estado.nombre}" eliminado`, life: 3000 })
          loadAll()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'No se pudo eliminar', life: 5000 })
        }
      },
    })
  }

  if (status === 'loading' || loading) return (
    <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <ProgressSpinner />
    </div>
  )

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="mb-4">
        <h1 className="text-2xl font-bold m-0">Personalización</h1>
        <p className="text-color-secondary text-sm mt-1 mb-0">Configura los estados, datos de empresa y moneda del sistema</p>
      </div>

      <div className="grid">

        {/* ── Estados de Proyecto ── */}
        <div className="col-12 lg:col-6">
          <Card>
            <div className="flex align-items-center justify-content-between mb-3">
              <div>
                <h3 className="m-0 font-semibold"><i className="pi pi-briefcase mr-2" />Estados de Proyectos</h3>
                <p className="text-color-secondary text-xs mt-1 mb-0">Puedes renombrar, agregar o eliminar estados</p>
              </div>
              <Button label="Nuevo estado" icon="pi pi-plus" size="small" onClick={() => setEpDialog({ visible: true, estado: null })} />
            </div>

            <DataTable value={estadosProyecto} emptyMessage="Sin estados" size="small" stripedRows>
              <Column header="Nombre" body={(r) => (
                <div className="flex align-items-center gap-2">
                  <Tag value={r.nombre} severity={r.color} style={{ fontSize: '0.8rem' }} />
                </div>
              )} />
              <Column header="Descripción" body={(r) => (
                <span className="text-sm text-color-secondary">{r.descripcion || '—'}</span>
              )} />
              <Column header="Acciones" style={{ width: '90px' }} body={(r) => (
                <div className="flex gap-1">
                  <Button icon="pi pi-pencil" rounded text severity="info" size="small" tooltip="Editar" tooltipOptions={{ position: 'top' }}
                    onClick={() => setEpDialog({ visible: true, estado: r })} />
                  <Button icon="pi pi-trash" rounded text severity="danger" size="small" tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                    onClick={() => confirmDeleteEstado(r)} />
                </div>
              )} />
            </DataTable>
          </Card>
        </div>

        {/* ── Estados de Propuesta ── */}
        <div className="col-12 lg:col-6">
          <Card>
            <div className="mb-3">
              <h3 className="m-0 font-semibold"><i className="pi pi-send mr-2" />Estados de Propuestas</h3>
              <p className="text-color-secondary text-xs mt-1 mb-0">Renombra cómo se llama cada etapa del pipeline comercial</p>
            </div>

            {/* Flujo visual */}
            <div className="flex flex-column gap-2 mb-3 p-3 surface-50 border-round">
              {estadosPropuesta.map((ep, idx) => {
                const color = SEVERITY_COLORS[ep.severity] || '#6b7280'
                const esTerminal = ['Aprobada', 'Rechazada'].includes(ep.key)
                const esBifurcacion = ep.key === 'Enviada'
                return (
                  <div key={ep.key} className="flex align-items-center gap-2">
                    <div className="flex flex-column align-items-center" style={{ width: '20px' }}>
                      <div className="border-circle flex-shrink-0"
                        style={{ width: '12px', height: '12px', background: color, flexShrink: 0 }} />
                      {!esTerminal && (
                        <div style={{ width: '2px', height: '16px', background: 'var(--surface-border)' }} />
                      )}
                    </div>
                    <Tag value={ep.label} severity={ep.severity} icon={`pi ${ep.icon}`} style={{ fontSize: '0.8rem' }} />
                    {esBifurcacion && <span className="text-xs text-color-secondary">→ bifurca en:</span>}
                  </div>
                )
              })}
            </div>

            <DataTable value={estadosPropuesta} emptyMessage="Sin estados" size="small" stripedRows>
              <Column header="Clave interna" body={(r) => (
                <code className="text-xs text-color-secondary surface-100 p-1 border-round">{r.key}</code>
              )} style={{ width: '140px' }} />
              <Column header="Nombre visible" body={(r) => (
                <Tag value={r.label} severity={r.severity} icon={`pi ${r.icon}`} style={{ fontSize: '0.8rem' }} />
              )} />
              <Column header="" style={{ width: '50px' }} body={(r) => (
                <Button icon="pi pi-pencil" rounded text severity="info" size="small" tooltip="Renombrar" tooltipOptions={{ position: 'top' }}
                  onClick={() => setElDialog({ visible: true, estadoLabel: r })} />
              )} />
            </DataTable>
          </Card>

          {/* Nota informativa */}
          <div className="mt-3 p-3 surface-50 border-round flex gap-2 text-sm text-color-secondary">
            <i className="pi pi-info-circle mt-1 flex-shrink-0" />
            <span>
              Las <strong>claves internas</strong> de propuesta no cambian (mantienen la lógica del sistema).
              Solo el <strong>nombre visible</strong> es personalizable.
            </span>
          </div>
        </div>
      </div>

      {/* ── Perfiles de Consultor ── */}
      <Card className="mt-4">
        <div className="flex align-items-center justify-content-between mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-id-card mr-2" />Perfiles de Consultor</h3>
            <p className="text-color-secondary text-xs mt-1 mb-0">
              Roles (Full Stack Senior, QA, PM…). El precio al cliente se gestiona en
              <strong> Tarifarios</strong> y el costo por consultor en <strong>Empleados</strong>.
            </p>
          </div>
          <Button label="Nuevo perfil" icon="pi pi-plus" size="small" onClick={() => setPfDialog({ visible: true, perfil: null })} />
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
            <InputSwitch checked={r.activo} onChange={() => toggleActivoPerfil(r)} />
          )} style={{ width: '80px' }} />
          <Column header="Acciones" style={{ width: '90px' }} body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-pencil" rounded text severity="info" size="small" tooltip="Editar" tooltipOptions={{ position: 'top' }}
                onClick={() => setPfDialog({ visible: true, perfil: r })} />
              <Button icon="pi pi-trash" rounded text severity="danger" size="small" tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                onClick={() => confirmDeletePerfil(r)} />
            </div>
          )} />
        </DataTable>
      </Card>

      {/* ── Datos de la Empresa ── */}
      <Card className="mt-4">
        <div className="flex align-items-center justify-content-between mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-building mr-2" />Datos de la Empresa</h3>
            <p className="text-color-secondary text-xs mt-1 mb-0">Nombre, moneda y datos para el encabezado de los PDFs</p>
          </div>
        </div>
        <div className="grid">
          <div className="col-12 md:col-6">
            <div className="flex flex-column gap-1 mb-3">
              <label className="text-sm font-medium">Nombre de la empresa <span className="text-red-500">*</span></label>
              <InputText
                value={empresaForm.nombre}
                onChange={(e) => setEmpresaForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Proconty S.A."
              />
            </div>
          </div>
          <div className="col-12 md:col-6">
            <div className="flex flex-column gap-1 mb-3">
              <label className="text-sm font-medium">Moneda</label>
              <Dropdown
                value={empresaForm.moneda}
                options={MONEDA_OPTIONS}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => setEmpresaForm((p) => ({ ...p, moneda: e.value }))}
              />
            </div>
          </div>
          <div className="col-12">
            <div className="flex flex-column gap-1 mb-3">
              <label className="text-sm font-medium">URL del logo <span className="text-color-secondary text-xs">(aparece en PDFs)</span></label>
              <InputText
                value={empresaForm.logoUrl}
                onChange={(e) => setEmpresaForm((p) => ({ ...p, logoUrl: e.target.value }))}
                placeholder="https://tuempresa.com/logo.png"
              />
            </div>
          </div>
          <div className="col-12 md:col-4">
            <div className="flex flex-column gap-1 mb-3">
              <label className="text-sm font-medium">Dirección</label>
              <InputText
                value={empresaForm.direccion}
                onChange={(e) => setEmpresaForm((p) => ({ ...p, direccion: e.target.value }))}
                placeholder="Av. Principal 123, Ciudad"
              />
            </div>
          </div>
          <div className="col-12 md:col-4">
            <div className="flex flex-column gap-1 mb-3">
              <label className="text-sm font-medium">Teléfono</label>
              <InputText
                value={empresaForm.telefono}
                onChange={(e) => setEmpresaForm((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="+593 99 999 9999"
              />
            </div>
          </div>
          <div className="col-12 md:col-4">
            <div className="flex flex-column gap-1 mb-3">
              <label className="text-sm font-medium">Email</label>
              <InputText
                value={empresaForm.email}
                onChange={(e) => setEmpresaForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="contacto@tuempresa.com"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-content-end">
          <Button
            label="Guardar datos de empresa"
            icon="pi pi-save"
            onClick={handleSaveEmpresa}
            loading={empresaSaving}
          />
        </div>
      </Card>

      {/* ── Acciones de administración ───────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex align-items-center gap-2 mb-3">
          <i className="pi pi-wrench text-orange-500" style={{ fontSize: '1.2rem' }} />
          <div>
            <h3 className="m-0 font-semibold">Acciones de administración</h3>
            <p className="text-color-secondary text-xs mt-1 mb-0">Migraciones y generación retroactiva de datos</p>
          </div>
        </div>
        <div className="flex flex-column gap-3">
          <div className="flex align-items-center justify-content-between p-3 surface-100 border-round">
            <div>
              <p className="m-0 font-semibold text-sm">1. Migrar responsables de usuarios a empleados</p>
              <p className="m-0 text-color-secondary text-xs mt-1">Crea empleados por cada usuario, vincula los responsables de proyectos/propuestas a la tabla empleados y elimina referencias a users</p>
            </div>
            <Button
              label="Ejecutar migración"
              icon="pi pi-users"
              severity="danger"
              size="small"
              onClick={async () => {
                try {
                  const res = await axios.post('/api/v1/admin/migrar-responsables-a-empleados')
                  const pasos = res.data.data?.log?.join('\n') || res.data.message
                  toast.current.show({ severity: res.data.success ? 'success' : 'warn', summary: 'Migración usuarios→empleados', detail: pasos, life: 15000 })
                } catch (e) {
                  toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 8000 })
                }
              }}
            />
          </div>
          <div className="flex align-items-center justify-content-between p-3 surface-100 border-round">
            <div>
              <p className="m-0 font-semibold text-sm">2. Agregar columna código cliente</p>
              <p className="m-0 text-color-secondary text-xs mt-1">Ejecutar una sola vez para habilitar el campo "Código cliente" en empresas</p>
            </div>
            <Button
              label="Ejecutar migración"
              icon="pi pi-database"
              severity="warning"
              size="small"
              onClick={async () => {
                try {
                  const res = await axios.post('/api/v1/admin/migrate-codigo-cliente')
                  toast.current.show({ severity: 'success', summary: 'Migración', detail: res.data.message, life: 5000 })
                } catch (e) {
                  toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
                }
              }}
            />
          </div>
          <div className="flex align-items-center justify-content-between p-3 surface-100 border-round">
            <div>
              <p className="m-0 font-semibold text-sm">3. Fusionar empresas duplicadas</p>
              <p className="m-0 text-color-secondary text-xs mt-1">Detecta empresas con el mismo nombre y las consolida en un solo registro, reasignando proyectos y propuestas</p>
            </div>
            <Button
              label="Fusionar duplicados"
              icon="pi pi-sitemap"
              severity="danger"
              size="small"
              onClick={async () => {
                try {
                  const res = await axios.post('/api/v1/admin/fusionar-empresas-duplicadas')
                  toast.current.show({ severity: 'success', summary: 'Fusión completada', detail: res.data.message, life: 8000 })
                } catch (e) {
                  toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
                }
              }}
            />
          </div>
          <div className="flex align-items-center justify-content-between p-3 surface-100 border-round">
            <div>
              <p className="m-0 font-semibold text-sm">4. Generar códigos retroactivos</p>
              <p className="m-0 text-color-secondary text-xs mt-1">Asigna códigos PRO/PRP a todos los registros sin código, ordenados por fecha de creación</p>
            </div>
            <Button
              label="Generar códigos"
              icon="pi pi-hashtag"
              severity="info"
              size="small"
              onClick={async () => {
                try {
                  const res = await axios.post('/api/v1/admin/generar-codigos', { force: false })
                  const { proyectosActualizados, propuestasActualizadas, errores } = res.data.data
                  toast.current.show({ severity: 'success', summary: 'Códigos generados', detail: `${proyectosActualizados} proyectos · ${propuestasActualizadas} propuestas${errores.length > 0 ? ` · ${errores.length} errores` : ''}`, life: 8000 })
                } catch (e) {
                  toast.current.show({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || e.message, life: 6000 })
                }
              }}
            />
          </div>
          <div className="flex align-items-center justify-content-between p-3 surface-100 border-round">
            <div>
              <p className="m-0 font-semibold text-sm">5. Backfill de cierre financiero (proyectos cerrados)</p>
              <p className="m-0 text-color-secondary text-xs mt-1">Calcula una fecha tentativa de cierre financiero para proyectos ya Cerrados, usando el historial de cambios de estado o la fecha de cierre operativo. Solo vista previa hasta que confirmes aplicar</p>
            </div>
            <Button
              label="Vista previa"
              icon="pi pi-search"
              severity="secondary"
              size="small"
              loading={backfillLoading}
              onClick={handlePreviewCierreFinanciero}
            />
          </div>
          <div className="p-3 surface-100 border-round">
            <p className="m-0 font-semibold text-sm mb-1">6. Eliminar observación por error</p>
            <p className="m-0 text-color-secondary text-xs mb-2">
              Corrige un comentario duplicado o mal registrado. El ID aparece atenuado junto a la fecha de cada observación en el detalle del proyecto (ej. #123)
            </p>
            <div className="flex align-items-end gap-2 flex-wrap">
              <div className="flex flex-column gap-1">
                <label className="text-xs font-medium">ID de la observación</label>
                <InputNumber value={eliminarObsId} onValueChange={(e) => { setEliminarObsId(e.value); setEliminarObsPreview(null) }}
                  placeholder="Ej: 123" style={{ width: '140px' }} />
              </div>
              <Button label="Buscar" icon="pi pi-search" severity="secondary" size="small" outlined
                loading={eliminarObsLoading} disabled={!eliminarObsId} onClick={handleBuscarObservacion} />
            </div>

            {eliminarObsPreview && (
              <div className="mt-3 p-3 surface-0 border-round" style={{ border: '1px solid var(--surface-border)' }}>
                <div className="flex justify-content-between align-items-center mb-2">
                  <span className="text-sm font-semibold">{eliminarObsPreview.autor} · {eliminarObsPreview.proyecto}</span>
                  <span className="text-xs text-color-secondary">{formatDate(eliminarObsPreview.createdAt)}</span>
                </div>
                <p className="text-sm m-0 mb-2" style={{ whiteSpace: 'pre-wrap' }}>{eliminarObsPreview.descripcion}</p>
                {eliminarObsPreview.respondeA && (
                  <p className="text-xs text-color-secondary m-0 mb-2">
                    <i className="pi pi-reply mr-1" />En respuesta a {eliminarObsPreview.respondeA.autor}
                  </p>
                )}
                {eliminarObsPreview.tieneRespuestas ? (
                  <p className="text-orange-600 text-xs m-0">
                    <i className="pi pi-exclamation-triangle mr-1" />
                    Tiene {eliminarObsPreview.cantidadRespuestas} respuesta(s) encadenada(s) — no se puede eliminar.
                  </p>
                ) : (
                  <Button label="Eliminar definitivamente" icon="pi pi-trash" severity="danger" size="small"
                    loading={eliminarObsAplicando} onClick={handleEliminarObservacion} />
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      <EstadoProyectoDialog
        visible={epDialog.visible}
        onHide={() => setEpDialog({ visible: false, estado: null })}
        onSave={handleSaveEstadoProyecto}
        estado={epDialog.estado}
      />
      <EstadoPropuestaDialog
        visible={elDialog.visible}
        onHide={() => setElDialog({ visible: false, estadoLabel: null })}
        onSave={handleSaveEstadoPropuesta}
        estadoLabel={elDialog.estadoLabel}
      />
      <PerfilConsultorDialog
        visible={pfDialog.visible}
        onHide={() => setPfDialog({ visible: false, perfil: null })}
        onSave={handleSavePerfil}
        perfil={pfDialog.perfil}
      />

      <Dialog
        header="Vista previa — Cierre financiero retroactivo"
        visible={backfillDialog.visible}
        onHide={() => setBackfillDialog({ visible: false, resultados: [], mensaje: '' })}
        style={{ width: '900px', maxWidth: '95vw' }}
        modal
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cerrar" severity="secondary" outlined onClick={() => setBackfillDialog({ visible: false, resultados: [], mensaje: '' })} />
            <Button
              label="Aplicar cambios"
              icon="pi pi-check"
              severity="danger"
              loading={backfillAplicando}
              disabled={!backfillDialog.resultados.some((r) => (r.fechaTentativa || manualDates[r.id]) && !r.aplicado)}
              onClick={handleAplicarCierreFinanciero}
            />
          </div>
        }
      >
        <p className="text-color-secondary text-sm mb-3">{backfillDialog.mensaje}</p>
        <DataTable value={backfillDialog.resultados} dataKey="id" size="small" stripedRows scrollable style={{ maxHeight: '55vh' }} filterDisplay="menu">
          <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable filter filterPlaceholder="Buscar código..." style={{ width: '110px', fontFamily: 'monospace', fontSize: '0.8rem' }} />
          <Column field="detalle" header="Proyecto" sortable filter filterPlaceholder="Buscar proyecto..." />
          <Column field="facturado" header="Facturado" body={(r) => formatCurrency(r.facturado)} sortable dataType="numeric" style={{ textAlign: 'right' }} />
          <Column field="saldo" header="Saldo" body={(r) => formatCurrency(r.saldo)} sortable dataType="numeric" style={{ textAlign: 'right' }} />
          <Column
            field="fuente"
            header="Fuente"
            body={(r) => (
              <Tag value={FUENTE_CONFIG[r.fuente]?.label || r.fuente} severity={FUENTE_CONFIG[r.fuente]?.severity || 'secondary'} />
            )}
            sortable
            filter
            filterElement={(options) => (
              <Dropdown
                value={options.value}
                options={Object.entries(FUENTE_CONFIG).map(([key, cfg]) => ({ label: cfg.label, value: key }))}
                onChange={(e) => options.filterApplyCallback(e.value)}
                placeholder="Todas"
                showClear
                style={{ minWidth: '200px' }}
              />
            )}
          />
          <Column
            field="fechaTentativa"
            header="Fecha tentativa"
            sortable
            style={{ width: '160px' }}
            body={(r) => {
              if (r.aplicado) return formatDate(r.fechaTentativa)
              if (r.fuente === 'sin_facturas' || r.fuente === 'saldo_pendiente') return '—'
              const valorActual = manualDates[r.id] !== undefined
                ? manualDates[r.id]
                : (r.fechaTentativa ? new Date(r.fechaTentativa) : null)
              return (
                <Calendar
                  value={valorActual}
                  onChange={(e) => setManualDates((prev) => ({ ...prev, [r.id]: e.value || null }))}
                  dateFormat="dd/mm/yy"
                  placeholder="Elegir fecha"
                  showIcon
                  readOnlyInput
                  style={{ width: '140px' }}
                  inputStyle={{ fontSize: '0.8rem', padding: '4px 6px' }}
                />
              )
            }}
          />
          <Column field="aplicado" header="Estado" body={(r) => r.aplicado ? <Tag value="✅ Aplicado" severity="success" /> : ''} sortable style={{ width: '110px' }} />
        </DataTable>
      </Dialog>
    </div>
  )
}
