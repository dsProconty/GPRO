'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { configuracionService, SEVERITY_COLORS } from '@/services/configuracionService'

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
          <InputText value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: En Ejecución" />
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Descripción</label>
          <InputText value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional" />
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
          <InputText value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} placeholder="Ej: Generando Propuesta" />
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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useRef(null)

  const [loading, setLoading] = useState(true)
  const [estadosProyecto, setEstadosProyecto] = useState([])
  const [estadosPropuesta, setEstadosPropuesta] = useState([])

  // Dialogs
  const [epDialog, setEpDialog] = useState({ visible: false, estado: null })       // estado proyecto
  const [elDialog, setElDialog] = useState({ visible: false, estadoLabel: null })  // label propuesta

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
      const res = await configuracionService.getAll()
      setEstadosProyecto(res.data.data.estadosProyecto)
      setEstadosPropuesta(res.data.data.estadosPropuesta)
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
        <p className="text-color-secondary text-sm mt-1 mb-0">Configura los nombres de estados de proyectos y propuestas</p>
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

      {/* Recomendaciones futuras */}
      <Card className="mt-4">
        <h3 className="m-0 mb-3 font-semibold"><i className="pi pi-lightbulb mr-2 text-yellow-500" />Otras personalizaciones sugeridas</h3>
        <div className="grid text-sm">
          {[
            { icon: 'pi-building', label: 'Nombre de la empresa', desc: 'Reemplazar "Proconty" en el encabezado y PDFs por el nombre real de tu empresa.' },
            { icon: 'pi-dollar',   label: 'Moneda',               desc: 'Cambiar USD a otra moneda para reportes y facturas.' },
            { icon: 'pi-star',     label: 'Estado inicial al aprobar propuesta', desc: 'Elegir qué estado de proyecto se asigna cuando una propuesta es aprobada (actualmente: Adjudicado).' },
            { icon: 'pi-bell',     label: 'Umbral de alertas de cobranza', desc: 'Días de mora para activar las alertas del dashboard (actualmente: 30 días).' },
            { icon: 'pi-file-pdf', label: 'Encabezado del PDF',   desc: 'Logo y datos de contacto en los reportes PDF de proyectos.' },
          ].map((item) => (
            <div key={item.label} className="col-12 md:col-6 lg:col-4 mb-2">
              <div className="p-3 surface-50 border-round h-full">
                <div className="font-semibold mb-1"><i className={`pi ${item.icon} mr-2 text-primary`} />{item.label}</div>
                <div className="text-color-secondary text-xs">{item.desc}</div>
              </div>
            </div>
          ))}
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
    </div>
  )
}
