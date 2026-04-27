'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Dropdown } from 'primereact/dropdown'
import { ProgressSpinner } from 'primereact/progressspinner'
import { ProgressBar } from 'primereact/progressbar'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { proyectoService } from '@/services/proyectoService'
import { facturaService } from '@/services/facturaService'
import { pagoService } from '@/services/pagoService'
import { observacionService } from '@/services/observacionService'
import { empleadoService } from '@/services/empleadoService'
import { formatCurrency, formatDate, calcTiempoVida } from '@/utils/format'
import * as XLSX from 'xlsx'
import FacturaFormDialog from '@/components/shared/FacturaFormDialog'
import PagoFormDialog from '@/components/shared/PagoFormDialog'
import ObservacionFormDialog from '@/components/shared/ObservacionFormDialog'
import ProyectoFormDialog from '@/components/shared/ProyectoFormDialog'
import RecordatorioFormDialog from '@/components/shared/RecordatorioFormDialog'
import { recordatorioService } from '@/services/recordatorioService'
import { configuracionService } from '@/services/configuracionService'
import axios from 'axios'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'

const ESTADO_CONFIG = {
  'Adjudicado':    { severity: 'success',   label: 'Adjudicado'   },
  'En Ejecución':  { severity: 'info',      label: 'En Ejecución' },
  'Por Facturar':  { severity: 'warning',   label: 'Por Facturar' },
  'Facturado':     { severity: 'secondary', label: 'Facturado'    },
  'Cerrado':       { severity: 'secondary', label: 'Cerrado'      },
}

const PIPELINE_STEPS = [
  { id: 3, nombre: 'Adjudicado' },
  { id: 1, nombre: 'En Ejecución' },
  { id: 2, nombre: 'Por Facturar' },
  { id: 4, nombre: 'Facturado' },
  { id: 5, nombre: 'Cerrado' },
]

export default function ProyectoDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const id = parseInt(params.id)
  const { puede, puedeEditarProyecto } = usePermisos()

  const [proyecto, setProyecto] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [observaciones, setObservaciones] = useState([])
  const [estados, setEstados] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])

  const [loadingProyecto, setLoadingProyecto] = useState(true)
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [loadingObs, setLoadingObs] = useState(false)
  const [savingEstado, setSavingEstado] = useState(false)
  const [expandedRows, setExpandedRows] = useState(null)

  // Dialogs
  const [facturaDialogVisible, setFacturaDialogVisible] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState(null)
  const [pagoDialogVisible, setPagoDialogVisible] = useState(false)
  const [selectedPago, setSelectedPago] = useState(null)
  const [facturaParaPago, setFacturaParaPago] = useState(null)
  const [obsDialogVisible, setObsDialogVisible] = useState(false)
  const [editDialogVisible, setEditDialogVisible] = useState(false)

  // Historial de estado
  const [estadoLogs, setEstadoLogs] = useState([])

  // Recordatorios
  const [recordatorios, setRecordatorios] = useState([])
  const [loadingRec, setLoadingRec] = useState(false)
  const [recDialogVisible, setRecDialogVisible] = useState(false)
  const [selectedRecordatorio, setSelectedRecordatorio] = useState(null)
  const [moneda, setMoneda] = useState('USD')
  const [casoNegocio, setCasoNegocio] = useState(null)  // { lineas, resumen } del proyecto
  const [perfilesConsultor, setPerfilesConsultor] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [addLineaVisible, setAddLineaVisible] = useState(false)
  const [editingLinea, setEditingLinea] = useState(null)  // linea al editar
  const [savingLinea, setSavingLinea] = useState(false)
  const [lineaForm, setLineaForm] = useState({ perfilId: null, horas: null, empleadoId: null, precioHora: null })

  useEffect(() => {
    loadAll()
  }, [id])

  const loadAll = async () => {
    setLoadingProyecto(true)
    try {
      const [proyRes, factRes, obsRes, estRes, empRes, usrRes, recRes, cfgRes, perfilesRes, emplRes] = await Promise.all([
        proyectoService.getById(id),
        facturaService.getAll({ proyecto_id: id }),
        observacionService.getAll({ proyecto_id: id }),
        axios.get('/api/v1/estados'),
        axios.get('/api/v1/empresas'),
        axios.get('/api/v1/usuarios'),
        recordatorioService.getAll({ proyecto_id: id }),
        configuracionService.getAll(),
        axios.get('/api/v1/perfiles-consultor?activo=true'),
        empleadoService.getAll({ activo: true }),
      ])
      setProyecto(proyRes.data)
      setFacturas(factRes.data)
      setObservaciones(obsRes.data)
      setEstados(estRes.data.data)
      setEmpresas(empRes.data.data)
      setUsuarios(usrRes.data.data)
      setRecordatorios(recRes.data)
      if (cfgRes.data.data?.empresa?.moneda) setMoneda(cfgRes.data.data.empresa.moneda)
      setPerfilesConsultor(perfilesRes.data.data || [])
      setEmpleados(emplRes.data.data || [])
      // Historial de estado (no bloquea si falla)
      axios.get(`/api/v1/proyectos/${id}/estado-logs`)
        .then((r) => setEstadoLogs(r.data.data || []))
        .catch(() => {})
      // Caso de negocio del proyecto (no bloquea si falla)
      axios.get(`/api/v1/proyectos/${id}/caso-negocio`)
        .then((r) => setCasoNegocio(r.data.data || { lineas: [], resumen: { totalHoras: 0, totalCosto: 0, totalPrecio: 0, gm: 0, gmPct: 0 } }))
        .catch(() => {})
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el proyecto', life: 4000 })
    } finally {
      setLoadingProyecto(false)
    }
  }

  const loadCasoNegocio = async () => {
    try {
      const r = await axios.get(`/api/v1/proyectos/${id}/caso-negocio`)
      setCasoNegocio(r.data.data || { lineas: [], resumen: { totalHoras: 0, totalCosto: 0, totalPrecio: 0, gm: 0, gmPct: 0 } })
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error cargando caso de negocio', life: 3000 })
    }
  }

  const loadFacturas = async () => {
    setLoadingFacturas(true)
    try {
      const res = await facturaService.getAll({ proyecto_id: id })
      setFacturas(res.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error cargando facturas', life: 3000 })
    } finally {
      setLoadingFacturas(false)
    }
  }

  const loadObservaciones = async () => {
    setLoadingObs(true)
    try {
      const res = await observacionService.getAll({ proyecto_id: id })
      setObservaciones(res.data)
    } finally {
      setLoadingObs(false)
    }
  }

  // Resumen financiero reactivo
  const resumen = useMemo(() => {
    const facturado = facturas.reduce((s, f) => s + f.valor, 0)
    const pagado = facturas.reduce((s, f) => s + f.totalPagos, 0)
    const saldo = facturado - pagado
    const valorContrato = proyecto ? Number(proyecto.valor) : 0
    const pctFacturado = valorContrato > 0 ? Math.min(100, Math.round((facturado / valorContrato) * 100)) : 0
    const pctPagado = facturado > 0 ? Math.min(100, Math.round((pagado / facturado) * 100)) : 0
    const valorRestante = valorContrato - facturado
    return { facturado, pagado, saldo, pctFacturado, pctPagado, valorRestante }
  }, [facturas, proyecto])

  // === Cambio de estado (SP4-04) ===
  const handleEstadoChange = async (nuevoEstadoId) => {
    if (!nuevoEstadoId || nuevoEstadoId === proyecto.estadoId) return
    setSavingEstado(true)
    try {
      const res = await axios.patch(`/api/v1/proyectos/${id}`, { estadoId: nuevoEstadoId })
      setProyecto(res.data.data)
      // Refresh estado logs
      axios.get(`/api/v1/proyectos/${id}/estado-logs`)
        .then((r) => setEstadoLogs(r.data.data || []))
        .catch(() => {})
      if (res.data.warning) {
        toast.current.show({ severity: 'warn', summary: 'Atención', detail: res.data.warning, life: 6000 })
      } else {
        toast.current.show({ severity: 'success', summary: 'Estado actualizado', detail: res.data.message, life: 3000 })
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al cambiar el estado'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
      setSavingEstado(false)
    }
  }

  // === Facturas ===
  const openNewFactura = () => { setSelectedFactura(null); setFacturaDialogVisible(true) }
  const openEditFactura = (f) => { setSelectedFactura(f); setFacturaDialogVisible(true) }

  const handleSaveFactura = () => {
    setFacturaDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Factura guardada', life: 3000 })
    loadFacturas()
  }

  const confirmDeleteFactura = (f) => {
    confirmDialog({
      message: `¿Eliminar la factura "${f.numFactura}"? Se eliminarán también sus pagos.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await facturaService.remove(f.id)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Factura eliminada', life: 3000 })
          loadFacturas()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  // === Pagos ===
  const openNewPago = (factura) => { setFacturaParaPago(factura); setSelectedPago(null); setPagoDialogVisible(true) }
  const openEditPago = (pago, factura) => { setFacturaParaPago(factura); setSelectedPago(pago); setPagoDialogVisible(true) }

  const handleSavePago = () => {
    setPagoDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Pago guardado', life: 3000 })
    loadFacturas()
  }

  const confirmDeletePago = (pago) => {
    confirmDialog({
      message: `¿Eliminar el pago de ${formatCurrency(pago.valor, moneda)}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await pagoService.remove(pago.id)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Pago eliminado', life: 3000 })
          loadFacturas()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  // === Observaciones ===
  const handleSaveObservacion = () => {
    setObsDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Observación registrada', life: 3000 })
    loadObservaciones()
  }

  // === Recordatorios ===
  const loadRecordatorios = async () => {
    setLoadingRec(true)
    try {
      const res = await recordatorioService.getAll({ proyecto_id: id })
      setRecordatorios(res.data)
    } finally {
      setLoadingRec(false)
    }
  }

  const handleSaveRecordatorio = () => {
    setRecDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Recordatorio guardado', life: 3000 })
    loadRecordatorios()
  }

  const confirmDeleteRecordatorio = (rec) => {
    confirmDialog({
      message: `¿Eliminar el recordatorio del día ${rec.diaMes} de cada mes?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await recordatorioService.remove(rec.id)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Recordatorio eliminado', life: 3000 })
          loadRecordatorios()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  // === Exportar Excel facturas ===
  const exportarFacturas = () => {
    const filas = facturas.map((f) => ({
      'Nº Factura': f.numFactura,
      'OC': f.ordenCompra || '',
      'Fecha': formatDate(f.fechaFactura),
      'Valor': Number(f.valor) || 0,
      'Pagado': Number(f.totalPagos) || 0,
      'Saldo': Number(f.saldo) || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `facturas_proyecto_${id}_${fecha}.xlsx`)
  }

  // === Editar proyecto ===
  const handleSaveProyecto = () => {
    setEditDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Proyecto actualizado', life: 3000 })
    loadAll()
  }

  // === Caso de negocio del proyecto ===
  const openAddLinea = (linea = null) => {
    setEditingLinea(linea)
    setLineaForm({
      perfilId:   linea?.perfilConsultorId ?? null,
      horas:      linea?.horas ?? null,
      empleadoId: linea?.empleadoId ?? null,
      precioHora: linea?.precioHora ?? null,
    })
    setAddLineaVisible(true)
  }

  const handleSaveLinea = async () => {
    if (!lineaForm.perfilId || !lineaForm.horas || lineaForm.horas <= 0) {
      toast.current.show({ severity: 'warn', summary: 'Validación', detail: 'Selecciona un perfil e ingresa horas mayores a 0', life: 3000 })
      return
    }
    setSavingLinea(true)
    try {
      await axios.post(`/api/v1/proyectos/${id}/caso-negocio`, {
        perfilId:   lineaForm.perfilId,
        horas:      lineaForm.horas,
        empleadoId: lineaForm.empleadoId || null,
        precioHora: lineaForm.precioHora ?? null,
      })
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Línea guardada', life: 3000 })
      setAddLineaVisible(false)
      loadCasoNegocio()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    } finally {
      setSavingLinea(false)
    }
  }

  const handleDeleteLinea = (perfilConsultorId) => {
    confirmDialog({
      message: '¿Eliminar esta línea del caso de negocio?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await axios.delete(`/api/v1/proyectos/${id}/caso-negocio?perfilId=${perfilConsultorId}`)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Línea eliminada', life: 3000 })
          loadCasoNegocio()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  // === Templates facturas ===
  const rowExpansionTemplate = (factura) => (
    <div className="p-3 surface-50 border-round">
      <div className="flex justify-content-between align-items-center mb-2">
        <span className="font-semibold text-sm"><i className="pi pi-credit-card mr-2" />Pagos registrados</span>
        <Button label="Registrar pago" icon="pi pi-plus" size="small" severity="success" outlined onClick={() => openNewPago(factura)} disabled={factura.saldo <= 0.001} />
      </div>
      {factura.pagos.length === 0 ? (
        <p className="text-color-secondary text-sm m-0">Sin pagos registrados.</p>
      ) : (
        <DataTable value={factura.pagos} size="small" stripedRows>
          <Column field="id" header="ID" style={{ width: '60px' }} />
          <Column header="Fecha" body={(p) => formatDate(p.fecha)} />
          <Column header="Valor" body={(p) => formatCurrency(Number(p.valor), moneda)} style={{ textAlign: 'right' }} />
          <Column field="observacion" header="Observación" body={(p) => p.observacion || '—'} />
          <Column header="Acciones" style={{ width: '100px' }} body={(p) => (
            <div className="flex gap-1">
              {puede(PERMISOS.PAGOS.EDITAR) && (
                <Button icon="pi pi-pencil" rounded text severity="info" size="small" onClick={() => openEditPago(p, factura)} />
              )}
              {puede(PERMISOS.PAGOS.ELIMINAR) && (
                <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => confirmDeletePago(p)} />
              )}
            </div>
          )} />
        </DataTable>
      )}
    </div>
  )

  if (loadingProyecto) return (
    <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <ProgressSpinner />
    </div>
  )

  if (!proyecto) return (
    <div className="p-4">
      <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/proyectos')} />
      <p className="mt-3 text-color-secondary">Proyecto no encontrado.</p>
    </div>
  )

  const estadoCfg = ESTADO_CONFIG[proyecto.estado?.nombre] || { severity: 'secondary', label: proyecto.estado?.nombre }
  const pipelineIdx = PIPELINE_STEPS.findIndex((s) => s.id === proyecto.estadoId)

  // Cronograma
  const hoy = new Date()
  const cronInicio = proyecto.fechaCreacion ? new Date(proyecto.fechaCreacion) : null
  const cronFin = proyecto.fechaCierre ? new Date(proyecto.fechaCierre) : null
  const cronTotal = cronInicio && cronFin ? Math.max(1, Math.floor((cronFin - cronInicio) / 86400000)) : null
  const cronElapsed = cronInicio ? Math.max(0, Math.floor((hoy - cronInicio) / 86400000)) : 0
  const cronPct = cronTotal ? Math.min(100, Math.round((cronElapsed / cronTotal) * 100)) : 0
  const cronRestantes = cronFin ? Math.floor((cronFin - hoy) / 86400000) : null

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* ── Header ── */}
      <div className="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="flex align-items-center gap-2 flex-wrap">
          <Button label="Proyectos" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/proyectos')} />
          <i className="pi pi-angle-right text-color-secondary" />
          <span className="text-900 font-bold text-xl">{proyecto.detalle}</span>
          {proyecto.codigo && (
            <span className="text-sm text-color-secondary" style={{ fontFamily: 'monospace', background: 'var(--surface-100)', padding: '2px 8px', borderRadius: '4px' }}>{proyecto.codigo}</span>
          )}
          <Tag value={estadoCfg.label} severity={estadoCfg.severity} />
        </div>
        <div className="flex gap-2">
          {puede(PERMISOS.PROYECTOS.PDF) && (
            <Button label="PDF" icon="pi pi-file-pdf" severity="secondary" outlined onClick={() => window.open(`/api/v1/proyectos/${id}/pdf`, '_blank')} />
          )}
          <Button label="Excel" icon="pi pi-file-excel" severity="secondary" outlined onClick={exportarFacturas} disabled={facturas.length === 0} />
          {proyecto.propuesta && (
            <Button label="Propuesta original" icon="pi pi-file-edit" severity="secondary" outlined
              onClick={() => router.push('/propuestas/' + proyecto.propuesta.id)} />
          )}
          {(puede(PERMISOS.PROYECTOS.EDITAR) && puedeEditarProyecto(proyecto?.estadoId)) && (
            <Button label="Editar" icon="pi pi-pencil" severity="secondary" outlined onClick={() => setEditDialogVisible(true)} />
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '14px' }}>
        {[
          { icon: '🏢', bg: '#EFF6FF', label: 'Empresa', value: proyecto.empresa?.nombre || '—', valueColor: '#1e293b' },
          { icon: '📅', bg: '#F1F5F9', label: 'Fecha inicio', value: formatDate(proyecto.fechaCreacion), valueColor: '#1e293b' },
          { icon: '🏁', bg: '#FFF7ED', label: 'Fecha de cierre', value: formatDate(proyecto.fechaCierre) || 'Sin definir', valueColor: proyecto.fechaCierre ? '#1e293b' : '#94a3b8' },
          { icon: '🖥️', bg: '#F5F3FF', label: 'Aplicativo', value: proyecto.aplicativo || '—', valueColor: '#1e293b' },
          { icon: '💰', bg: '#F0FDF4', label: 'Valor contrato', value: formatCurrency(proyecto.valor, moneda), valueColor: '#15803D' },
        ].map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '3px' }}>{k.label}</div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: k.valueColor }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pipeline de estado ── */}
      <Card className="mb-3">
        <div className="flex align-items-start" style={{ gap: 0 }}>
          {PIPELINE_STEPS.map((step, idx) => {
            const done = pipelineIdx > idx
            const curr = pipelineIdx === idx
            return (
              <div key={step.id} className="flex align-items-center flex-1">
                <div className="flex flex-column align-items-center" style={{ minWidth: '64px' }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--green-500)' : curr ? 'var(--primary-color)' : 'var(--surface-200)',
                    color: (done || curr) ? '#fff' : 'var(--text-color-secondary)',
                    fontWeight: 700, fontSize: '13px', flexShrink: 0,
                    boxShadow: curr ? '0 0 0 4px var(--primary-100)' : 'none',
                  }}>
                    {done ? <i className="pi pi-check" style={{ fontSize: '12px' }} /> : idx + 1}
                  </div>
                  <span className="text-xs mt-1 text-center" style={{
                    color: curr ? 'var(--primary-color)' : done ? 'var(--green-600)' : 'var(--text-color-secondary)',
                    fontWeight: curr ? 700 : 400,
                    maxWidth: '72px', lineHeight: '1.2',
                  }}>{step.nombre}</span>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', margin: '-20px 4px 0', background: done ? 'var(--green-400)' : 'var(--surface-200)' }} />
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-content-center align-items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
          {pipelineIdx < PIPELINE_STEPS.length - 1 ? (
            <Button
              label={`→ Mover a: ${PIPELINE_STEPS[pipelineIdx + 1]?.nombre}`}
              outlined
              loading={savingEstado}
              onClick={() => handleEstadoChange(PIPELINE_STEPS[pipelineIdx + 1]?.id)}
            />
          ) : (
            <span className="text-sm text-color-secondary font-semibold">✓ Proyecto finalizado</span>
          )}
          {proyecto.projectOnline && (
            <Button label="Project Online" icon="pi pi-external-link" severity="secondary" text size="small"
              onClick={() => window.open(proyecto.projectOnline, '_blank')} />
          )}
        </div>
      </Card>

      {/* ── 3 columnas: Responsables | Propuesta | Resumen Financiero ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.1fr', gap: '14px', marginBottom: '14px' }}>

        {/* Responsables */}
        <Card>
          <h3 className="m-0 mb-3 font-semibold text-base"><i className="pi pi-users mr-2 text-primary" />Responsables</h3>
          <p className="text-xs text-color-secondary font-semibold mt-0 mb-2">CONTACTOS / PMs</p>
          {proyecto.clientes.length === 0
            ? <p className="text-color-secondary text-sm">Sin contactos asignados</p>
            : proyecto.clientes.map((c) => (
                <div key={c.clienteId} className="flex align-items-center gap-2 mb-2">
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                    {c.cliente.nombre?.[0]}{c.cliente.apellido?.[0]}
                  </div>
                  <span className="text-sm">{c.cliente.nombre} {c.cliente.apellido}</span>
                </div>
              ))
          }
          <p className="text-xs text-color-secondary font-semibold mt-3 mb-2">RESPONSABLES PROCONTY</p>
          {proyecto.responsables.length === 0
            ? <p className="text-color-secondary text-sm">Sin responsables asignados</p>
            : proyecto.responsables.map((r) => (
                <div key={r.userId} className="flex align-items-center gap-2 mb-2">
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--primary-color)', flexShrink: 0 }}>
                    {r.user.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <span className="text-sm">{r.user.name}</span>
                </div>
              ))
          }
        </Card>

        {/* Cronograma compacto */}
        <Card>
          <h3 className="m-0 mb-3 font-semibold text-base"><i className="pi pi-calendar-clock mr-2 text-primary" />Cronograma</h3>
          {cronInicio ? (
            <>
              {/* Barra de progreso con marcador de hoy */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '20px', overflow: 'visible', position: 'relative' }}>
                  <div style={{ width: `${cronPct}%`, height: '100%', background: 'linear-gradient(90deg,var(--primary-300),var(--primary-color))', borderRadius: '20px' }} />
                  {cronTotal && (
                    <div style={{ position: 'absolute', top: '-6px', left: `calc(${Math.min(97, cronPct)}%)`, transform: 'translateX(-50%)', zIndex: 2 }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-color)', border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,.25)' }} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                  <span>{formatDate(proyecto.fechaCreacion)}</span>
                  {cronFin
                    ? <span style={{ background: '#eff6ff', color: 'var(--primary-color)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, fontSize: '10px' }}>HOY {cronPct}%</span>
                    : <span style={{ background: '#eff6ff', color: 'var(--primary-color)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600, fontSize: '10px' }}>HOY</span>
                  }
                  <span>{cronFin ? formatDate(proyecto.fechaCierre) : 'Sin cierre'}</span>
                </div>
              </div>
              {/* Stats compactos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#1D4ED8', marginBottom: '2px' }}>Transcurridos</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1D4ED8', lineHeight: 1.1 }}>{cronElapsed}<span style={{ fontSize: '11px', fontWeight: 500 }}> días</span></div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: cronRestantes !== null && cronRestantes < 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${cronRestantes !== null && cronRestantes < 0 ? '#FECACA' : '#BBF7D0'}` }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: cronRestantes !== null && cronRestantes < 0 ? '#B91C1C' : '#15803D', marginBottom: '2px' }}>
                    {cronRestantes !== null && cronRestantes < 0 ? 'Vencido' : 'Restantes'}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: cronRestantes !== null && cronRestantes < 0 ? '#B91C1C' : '#15803D', lineHeight: 1.1 }}>
                    {cronRestantes !== null ? Math.abs(cronRestantes) : '—'}<span style={{ fontSize: '11px', fontWeight: 500 }}> días</span>
                  </div>
                </div>
                {cronTotal && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#64748b', marginBottom: '2px' }}>Duración total del proyecto</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{cronTotal} días <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>· {cronPct}% completado</span></div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-column align-items-center justify-content-center text-center py-3">
              <i className="pi pi-calendar text-3xl text-color-secondary mb-2" />
              <p className="text-sm text-color-secondary m-0">Sin fecha de inicio definida</p>
            </div>
          )}
        </Card>

        {/* Resumen Financiero compacto */}
        <Card>
          <h3 className="m-0 mb-3 font-semibold text-base">💹 Resumen Financiero</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
            <div style={{ background: '#fff', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '5px' }}>Valor contrato</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(proyecto.valor, moneda)}</div>
            </div>
            <div style={{ background: '#fff', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '5px' }}>Facturado</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1D4ED8' }}>{formatCurrency(resumen.facturado, moneda)}</div>
            </div>
            <div style={{ background: '#fff', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '5px' }}>Cobrado</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803D' }}>{formatCurrency(resumen.pagado, moneda)}</div>
            </div>
            <div style={{ background: '#fff', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '5px' }}>Saldo pendiente</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#B45309' }}>{formatCurrency(resumen.saldo, moneda)}</div>
            </div>
            <div style={{ background: '#fff', padding: '10px 12px', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '5px' }}>Valor restante (sin facturar)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: resumen.valorRestante > 0.001 ? '#7C3AED' : '#15803D' }}>{formatCurrency(resumen.valorRestante, moneda)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '5px' }}>
            <span>Facturado</span><span style={{ fontWeight: 700 }}>{resumen.pctFacturado}%</span>
          </div>
          <div style={{ height: '8px', background: '#f1f3f4', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ width: `${resumen.pctFacturado}%`, height: '100%', borderRadius: '20px', background: 'linear-gradient(90deg,#1D4ED8,#4F8EF7)' }} />
          </div>
        </Card>
      </div>


      {/* ── Caso de Negocio ── */}
      {(casoNegocio !== null && (casoNegocio.lineas.length > 0 || puede(PERMISOS.CASOS_NEGOCIO.EDITAR))) && (
        <Card className="mb-3">
          <div className="flex align-items-center justify-content-between mb-3">
            <div>
              <h3 className="m-0 font-semibold"><i className="pi pi-chart-line mr-2 text-green-600" />Caso de Negocio</h3>
              <p className="text-color-secondary text-xs mt-1 mb-0">Recursos y rentabilidad del proyecto</p>
            </div>
            <div className="flex align-items-center gap-3">
              {casoNegocio.lineas.length > 0 && (
                <span className={`text-2xl font-bold ${(casoNegocio.resumen.gmPct || 0) >= 40 ? 'text-green-600' : (casoNegocio.resumen.gmPct || 0) >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {casoNegocio.resumen.gmPct}%
                </span>
              )}
              {puede(PERMISOS.CASOS_NEGOCIO.EDITAR) && (
                <Button label="Agregar perfil" icon="pi pi-plus" size="small" severity="success" outlined onClick={() => openAddLinea()} />
              )}
            </div>
          </div>

          {casoNegocio.lineas.length === 0 ? (
            <p className="text-color-secondary text-sm m-0">No hay líneas de caso de negocio. Agrega perfiles para estimar la rentabilidad.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '6px' }}>Total Horas</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.2 }}>{casoNegocio.resumen.totalHoras}<span style={{ fontSize: '14px', fontWeight: 500, color: '#94a3b8' }}>h</span></div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{casoNegocio.lineas.length} perfil(es)</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '6px' }}>Costo Interno</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#B45309', lineHeight: 1.2 }}>{formatCurrency(casoNegocio.resumen.totalCosto, moneda)}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Suma de costos del equipo</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '6px' }}>Precio al Cliente</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1D4ED8', lineHeight: 1.2 }}>{formatCurrency(casoNegocio.resumen.totalPrecio, moneda)}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Según tarifario vigente</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#94a3b8', marginBottom: '6px' }}>Margen Bruto</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803D', lineHeight: 1.2 }}>{casoNegocio.resumen.gmPct}%</div>
                  <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px' }}>{formatCurrency(casoNegocio.resumen.gm, moneda)} de ganancia</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-content-between text-xs text-color-secondary mb-1">
                  <span>Margen bruto</span><span>{casoNegocio.resumen.gmPct}%</span>
                </div>
                <ProgressBar value={casoNegocio.resumen.gmPct || 0} showValue={false} style={{ height: '8px' }}
                  color={(casoNegocio.resumen.gmPct || 0) >= 40 ? 'var(--green-500)' : (casoNegocio.resumen.gmPct || 0) >= 20 ? 'var(--yellow-500)' : 'var(--red-500)'}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div className="flex px-2 py-1 surface-100 text-xs font-semibold text-color-secondary border-round-top" style={{ minWidth: '820px', gap: '8px' }}>
                  <div style={{ flex: '0 0 170px' }}>Perfil / Consultor</div>
                  <div style={{ flex: '0 0 55px', textAlign: 'right' }}>Horas</div>
                  <div style={{ flex: '0 0 80px', textAlign: 'right' }}>Costo/h</div>
                  <div style={{ flex: '0 0 80px', textAlign: 'right' }}>Precio/h</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Total Costo</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Total Precio</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Margen</div>
                  <div style={{ flex: '0 0 70px' }} />
                </div>
                {casoNegocio.lineas.map((l, idx) => {
                  const lineaMargenPct = l.precio > 0 ? Math.round(((l.precio - l.costo) / l.precio) * 100) : 0
                  const mc = lineaMargenPct >= 40 ? { bg: '#DCFCE7', color: '#15803D' } : lineaMargenPct >= 20 ? { bg: '#FEFCE8', color: '#854D0E' } : { bg: '#FEF2F2', color: '#B91C1C' }
                  return (
                  <div key={l.perfilConsultorId}
                    className={`flex px-2 py-2 text-sm align-items-center ${idx % 2 === 1 ? 'surface-50' : ''}`}
                    style={{ borderTop: '1px solid var(--surface-border)', minWidth: '820px', gap: '8px' }}
                  >
                    <div style={{ flex: '0 0 170px' }}>
                      <div className="font-medium">{l.perfil.nombre}</div>
                      <div className="text-xs mt-1 flex align-items-center gap-1">
                        <Tag value={l.perfil.nivel} severity={l.perfil.nivel === 'Senior' ? 'success' : l.perfil.nivel === 'Semi Senior' ? 'info' : 'secondary'} style={{ fontSize: '0.65rem' }} />
                        {l.empleado
                          ? <span className="text-color-secondary"><i className="pi pi-user ml-1 mr-1" />{l.empleado.nombre} {l.empleado.apellido}</span>
                          : <span className="text-color-secondary" style={{ fontStyle: 'italic' }}>Sin consultor</span>}
                      </div>
                    </div>
                    <div style={{ flex: '0 0 55px', textAlign: 'right', color: 'var(--text-color-secondary)' }}>{l.horas}h</div>
                    <div style={{ flex: '0 0 80px', textAlign: 'right', color: 'var(--text-color-secondary)' }}>{formatCurrency(l.costoHora, moneda)}</div>
                    <div style={{ flex: '0 0 80px', textAlign: 'right', fontWeight: 700, color: '#1D4ED8' }}>{formatCurrency(l.precioHora, moneda)}</div>
                    <div style={{ flex: '0 0 90px', textAlign: 'right', color: 'var(--text-color-secondary)' }}>{formatCurrency(l.costo, moneda)}</div>
                    <div style={{ flex: '0 0 90px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(l.precio, moneda)}</div>
                    <div style={{ flex: '0 0 90px', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: mc.bg, color: mc.color }}>{lineaMargenPct}%</span>
                    </div>
                    <div style={{ flex: '0 0 70px', textAlign: 'right' }}>
                      {puede(PERMISOS.CASOS_NEGOCIO.EDITAR) && (
                        <div className="flex gap-1 justify-content-end">
                          <Button icon="pi pi-pencil" rounded text severity="info" size="small" onClick={() => openAddLinea(l)} tooltip="Editar" tooltipOptions={{ position: 'top' }} />
                          <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => handleDeleteLinea(l.perfilConsultorId)} tooltip="Eliminar" tooltipOptions={{ position: 'top' }} />
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })}
                <div className="flex px-2 py-2 text-sm font-bold surface-100 border-round-bottom" style={{ borderTop: '2px solid var(--surface-border)', minWidth: '820px', gap: '8px' }}>
                  <div style={{ flex: '0 0 170px' }}>TOTAL</div>
                  <div style={{ flex: '0 0 55px', textAlign: 'right' }}>{casoNegocio.resumen.totalHoras}h</div>
                  <div style={{ flex: '0 0 80px' }} />
                  <div style={{ flex: '0 0 80px' }} />
                  <div style={{ flex: '0 0 90px', textAlign: 'right', color: 'var(--text-color-secondary)' }}>{formatCurrency(casoNegocio.resumen.totalCosto, moneda)}</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right', color: '#15803D' }}>{formatCurrency(casoNegocio.resumen.totalPrecio, moneda)}</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: '#DCFCE7', color: '#15803D' }}>~{casoNegocio.resumen.gmPct}%</span>
                  </div>
                  <div style={{ flex: '0 0 70px' }} />
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Recordatorios ── */}
      <Card className="mb-3">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-bell mr-2" />Recordatorios de Facturación</h3>
            <p className="text-color-secondary text-xs mt-1 mb-0">Alertas automáticas por email en un día fijo cada mes</p>
          </div>
          {puede(PERMISOS.RECORDATORIOS.CREAR) && (
            <Button label="Nuevo Recordatorio" icon="pi pi-plus" size="small" severity="warning" outlined
              onClick={() => { setSelectedRecordatorio(null); setRecDialogVisible(true) }} />
          )}
        </div>
        {loadingRec ? (
          <div className="flex justify-content-center p-3"><ProgressSpinner style={{ width: '30px', height: '30px' }} /></div>
        ) : recordatorios.length === 0 ? (
          <p className="text-color-secondary text-sm m-0">No hay recordatorios configurados para este proyecto.</p>
        ) : (
          <DataTable value={recordatorios} size="small" stripedRows emptyMessage="Sin recordatorios">
            <Column header="Día" body={(r) => <span className="font-bold text-primary">Día {r.diaMes}</span>} style={{ width: '80px' }} />
            <Column field="descripcion" header="Descripción" />
            <Column header="Destinatarios" body={(r) => (
              <span className="text-sm text-color-secondary" title={r.destinatarios}>
                {r.destinatarios.length > 40 ? r.destinatarios.slice(0, 40) + '…' : r.destinatarios}
              </span>
            )} />
            <Column header="Estado" style={{ width: '100px' }} body={(r) => (
              <span className={`font-semibold text-sm ${r.activo ? 'text-green-600' : 'text-color-secondary'}`}>
                <i className={`pi ${r.activo ? 'pi-check-circle' : 'pi-minus-circle'} mr-1`} />
                {r.activo ? 'Activo' : 'Inactivo'}
              </span>
            )} />
            <Column header="Último envío" style={{ width: '130px' }} body={(r) => {
              const ultimo = r.logs?.[0]
              if (!ultimo) return <span className="text-color-secondary text-xs">Nunca</span>
              return (
                <span className={`text-xs ${ultimo.exitoso ? 'text-green-600' : 'text-red-500'}`}>
                  <i className={`pi ${ultimo.exitoso ? 'pi-check' : 'pi-times'} mr-1`} />
                  {new Date(ultimo.enviadoEn).toLocaleDateString('es-EC')}
                </span>
              )
            }} />
            <Column header="Acciones" style={{ width: '90px' }} body={(r) => (
              <div className="flex gap-1">
                {puede(PERMISOS.RECORDATORIOS.EDITAR) && (
                  <Button icon="pi pi-pencil" rounded text severity="info" size="small"
                    onClick={() => { setSelectedRecordatorio(r); setRecDialogVisible(true) }} />
                )}
                {puede(PERMISOS.RECORDATORIOS.ELIMINAR) && (
                  <Button icon="pi pi-trash" rounded text severity="danger" size="small"
                    onClick={() => confirmDeleteRecordatorio(r)} />
                )}
              </div>
            )} />
          </DataTable>
        )}
      </Card>

      {/* ── Facturas ── */}
      <Card className="mb-3">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-file mr-2" />Facturas</h3>
            <p className="text-color-secondary text-sm mt-1 mb-0">{facturas.length} factura(s)</p>
          </div>
          <div className="flex gap-2">
            <Button label="Exportar Excel" icon="pi pi-file-excel" severity="success" outlined size="small" onClick={exportarFacturas} disabled={facturas.length === 0} />
            {puede(PERMISOS.FACTURAS.CREAR) && (
              <Button label="Nueva Factura" icon="pi pi-plus" onClick={openNewFactura} />
            )}
          </div>
        </div>
        <DataTable value={facturas} loading={loadingFacturas} expandedRows={expandedRows} onRowToggle={(e) => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate} dataKey="id" emptyMessage="No hay facturas registradas" stripedRows>
          <Column expander style={{ width: '3rem' }} />
          <Column field="id" header="ID" style={{ width: '60px' }} />
          <Column field="numFactura" header="Nº Factura" sortable />
          <Column field="ordenCompra" header="OC" body={(row) => row.ordenCompra || '—'} />
          <Column header="Fecha" body={(row) => formatDate(row.fechaFactura)} sortable sortField="fechaFactura" />
          <Column header="Valor" body={(row) => formatCurrency(row.valor, moneda)} sortable sortField="valor" style={{ textAlign: 'right' }} />
          <Column header="Pagado" body={(row) => formatCurrency(row.totalPagos, moneda)} style={{ textAlign: 'right' }} />
          <Column header="Saldo" style={{ textAlign: 'right' }} body={(row) => (
            <span style={{ color: row.saldo > 0.001 ? 'var(--red-500)' : 'var(--green-500)', fontWeight: 600 }}>
              {formatCurrency(row.saldo, moneda)}
            </span>
          )} />
          <Column header="Acciones" style={{ width: '130px' }} body={(row) => (
            <div className="flex gap-1">
              {puede(PERMISOS.PAGOS.CREAR) && (
                <Button icon="pi pi-plus" rounded text severity="success" tooltip="Registrar pago" tooltipOptions={{ position: 'top' }} onClick={() => openNewPago(row)} disabled={row.saldo <= 0.001} />
              )}
              {puede(PERMISOS.FACTURAS.EDITAR) && (
                <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEditFactura(row)} />
              )}
              {puede(PERMISOS.FACTURAS.ELIMINAR) && (
                <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => confirmDeleteFactura(row)} />
              )}
            </div>
          )} />
        </DataTable>
      </Card>

      {/* ── Observaciones ── */}
      <Card className="mb-3">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-comment mr-2" />Observaciones</h3>
            <p className="text-color-secondary text-xs mt-1 mb-0">Bitácora inmutable del proyecto</p>
          </div>
          {puede(PERMISOS.OBSERVACIONES.CREAR) && (
            <Button label="Nueva observación" icon="pi pi-plus" size="small" onClick={() => setObsDialogVisible(true)} />
          )}
        </div>
        {loadingObs ? (
          <div className="flex justify-content-center p-3"><ProgressSpinner style={{ width: '30px', height: '30px' }} /></div>
        ) : observaciones.length === 0 ? (
          <p className="text-color-secondary text-sm m-0">No hay observaciones registradas.</p>
        ) : (
          <div className="flex flex-column gap-2">
            {observaciones.map((obs) => (
              <div key={obs.id} className="surface-50 border-round p-3 border-left-3" style={{ borderColor: 'var(--primary-color)' }}>
                <div className="flex justify-content-between align-items-center mb-1">
                  <span className="font-semibold text-sm"><i className="pi pi-user mr-1" />{obs.user?.name}</span>
                  <span className="text-color-secondary text-xs">{new Date(obs.createdAt).toLocaleString('es-EC')}</span>
                </div>
                <p className="m-0 text-sm" style={{ whiteSpace: 'pre-wrap' }}>{obs.descripcion}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Trazabilidad de Estado ── */}
      {estadoLogs.length > 0 && (
        <Card>
          <h3 className="m-0 mb-1 font-semibold"><i className="pi pi-history mr-2" />Trazabilidad de Estado</h3>
          <p className="text-color-secondary text-xs mt-0 mb-3">Registro inmutable de todos los cambios de estado</p>
          <div className="flex flex-column gap-0">
            {estadoLogs.map((log, idx) => {
              const anteriorNombre = log.estadoAnterior?.nombre || 'Inicio'
              const nuevoNombre = log.estadoNuevo?.nombre || '—'
              const nuevoSeverity = (ESTADO_CONFIG[nuevoNombre] || { severity: 'secondary' }).severity
              const DOT_COLORS = {
                'Adjudicado':   { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' },
                'En Ejecución': { bg: '#EFF6FF', color: '#4F8EF7', border: '#BFDBFE' },
                'Por Facturar': { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
                'Facturado':    { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
                'Cerrado':      { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
              }
              const dc = DOT_COLORS[nuevoNombre] || { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' }
              return (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-column align-items-center">
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: dc.bg, color: dc.color, border: `2px solid ${dc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                      {nuevoNombre[0] || '?'}
                    </div>
                    {idx < estadoLogs.length - 1 && (
                      <div style={{ width: '2px', flex: 1, background: '#e2e8f0', minHeight: '24px', margin: '4px 0' }} />
                    )}
                  </div>
                  <div className="pb-3" style={{ paddingTop: '5px' }}>
                    <div className="flex align-items-center gap-2 flex-wrap">
                      <Tag value={nuevoNombre} severity={nuevoSeverity} style={{ fontSize: '0.75rem' }} />
                      <span className="text-xs text-color-secondary">{new Date(log.createdAt).toLocaleString('es-EC')}</span>
                    </div>
                    <div className="text-xs text-color-secondary mt-1">
                      👤 {log.user?.name}
                      {anteriorNombre !== 'Inicio' && <span> · desde <strong>{anteriorNombre}</strong></span>}
                      {log.nota && <span> · <em>{log.nota}</em></span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── Dialogs ── */}
      <FacturaFormDialog visible={facturaDialogVisible} onHide={() => setFacturaDialogVisible(false)} onSave={handleSaveFactura} factura={selectedFactura} proyectoId={id} />
      <PagoFormDialog visible={pagoDialogVisible} onHide={() => setPagoDialogVisible(false)} onSave={handleSavePago} pago={selectedPago} factura={facturaParaPago} />
      <ObservacionFormDialog visible={obsDialogVisible} onHide={() => setObsDialogVisible(false)} onSave={handleSaveObservacion} proyectoId={id} />
      <ProyectoFormDialog visible={editDialogVisible} onHide={() => setEditDialogVisible(false)} onSave={handleSaveProyecto} proyecto={proyecto} empresas={empresas} estados={estados} usuarios={usuarios} />
      <RecordatorioFormDialog visible={recDialogVisible} onHide={() => setRecDialogVisible(false)} onSave={handleSaveRecordatorio} recordatorio={selectedRecordatorio} proyectoId={id} />

      {/* Dialog: agregar/editar línea de caso de negocio */}
      {(() => {
        const perfilSel = perfilesConsultor.find((p) => p.id === lineaForm.perfilId)
        const empleadoSel = empleados.find((e) => e.id === lineaForm.empleadoId)
        const costoHoraEf = empleadoSel ? Number(empleadoSel.costoHora) : (perfilSel ? Number(perfilSel.costoHora) : null)
        const precioHoraEf = lineaForm.precioHora ?? (perfilSel ? Number(perfilSel.precioHora) : null)
        const previewCosto  = costoHoraEf  !== null && lineaForm.horas ? lineaForm.horas * costoHoraEf  : null
        const previewPrecio = precioHoraEf !== null && lineaForm.horas ? lineaForm.horas * precioHoraEf : null
        return (
          <Dialog
            header={editingLinea ? 'Editar línea del caso de negocio' : 'Agregar perfil al caso de negocio'}
            visible={addLineaVisible}
            onHide={() => setAddLineaVisible(false)}
            style={{ width: '460px' }}
            footer={
              <div className="flex justify-content-end gap-2">
                <Button label="Cancelar" severity="secondary" outlined onClick={() => setAddLineaVisible(false)} disabled={savingLinea} />
                <Button label="Guardar" icon="pi pi-check" onClick={handleSaveLinea} disabled={savingLinea} loading={savingLinea} />
              </div>
            }
          >
            <div className="flex flex-column gap-3 pt-2">
              <div className="flex flex-column gap-1">
                <label className="text-sm font-semibold">Perfil <span className="text-red-500">*</span></label>
                <Dropdown
                  value={lineaForm.perfilId}
                  options={perfilesConsultor}
                  optionLabel={(p) => `${p.nombre} · ${p.nivel}`}
                  optionValue="id"
                  onChange={(e) => setLineaForm((f) => ({ ...f, perfilId: e.value, empleadoId: null, precioHora: null }))}
                  placeholder="Seleccionar perfil"
                  disabled={!!editingLinea}
                  filter
                  className="w-full"
                />
                {editingLinea && (
                  <small className="text-color-secondary">El perfil no se puede cambiar — elimina y agrega una nueva línea si necesitas cambiarlo.</small>
                )}
              </div>
              <div className="flex flex-column gap-1">
                <label className="text-sm font-semibold">Consultor asignado <span className="text-color-secondary text-xs ml-1">(opcional)</span></label>
                <Dropdown
                  value={lineaForm.empleadoId}
                  options={[{ label: '— Sin asignar —', value: null }, ...empleados.map((e) => ({ label: `${e.nombre} ${e.apellido}${e.perfilBase ? ' · ' + e.perfilBase.nombre : ''}`, value: e.id }))]}
                  onChange={(e) => setLineaForm((f) => ({ ...f, empleadoId: e.value }))}
                  placeholder="Sin consultor"
                  filter
                  className="w-full"
                />
                {empleadoSel && <small className="text-color-secondary">Costo: {formatCurrency(empleadoSel.costoHora, moneda)}/h</small>}
              </div>
              <div className="flex flex-column gap-1">
                <label className="text-sm font-semibold">Horas <span className="text-red-500">*</span></label>
                <InputNumber value={lineaForm.horas} onValueChange={(e) => setLineaForm((f) => ({ ...f, horas: e.value }))} min={1} max={99999} placeholder="Ej: 160" suffix="h" className="w-full" />
              </div>
              <div className="flex flex-column gap-1">
                <label className="text-sm font-semibold">
                  Precio/hora
                  {perfilSel && <span className="text-color-secondary text-xs ml-2">(tarifa base: {formatCurrency(perfilSel.precioHora, moneda)}/h)</span>}
                </label>
                <InputNumber
                  value={lineaForm.precioHora}
                  onValueChange={(e) => setLineaForm((f) => ({ ...f, precioHora: e.value }))}
                  mode="currency" currency="USD" locale="es-EC" minFractionDigits={2}
                  placeholder={perfilSel ? `${formatCurrency(perfilSel.precioHora, moneda)} (del perfil)` : 'Precio/hora'}
                  className="w-full"
                />
                {lineaForm.precioHora !== null && lineaForm.precioHora !== undefined && (
                  <small className="text-primary"><i className="pi pi-info-circle mr-1" />Precio personalizado</small>
                )}
              </div>
              {previewCosto !== null && (
                <div className="grid text-sm surface-50 border-round p-2 m-0">
                  <div className="col-6">
                    <div className="text-color-secondary text-xs mb-1">Costo estimado</div>
                    <strong className="text-color-secondary">{formatCurrency(previewCosto, moneda)}</strong>
                  </div>
                  <div className="col-6">
                    <div className="text-color-secondary text-xs mb-1">Ingreso estimado</div>
                    <strong>{formatCurrency(previewPrecio, moneda)}</strong>
                  </div>
                </div>
              )}
            </div>
          </Dialog>
        )
      })()}
    </div>
  )
}
