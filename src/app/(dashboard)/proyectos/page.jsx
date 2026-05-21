'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import ProyectoFormDialog from '@/components/shared/ProyectoFormDialog'
import { proyectoService } from '@/services/proyectoService'
import { empresaService } from '@/services/empresaService'
import { empleadoService } from '@/services/empleadoService'
import { configuracionService } from '@/services/configuracionService'
import axios from 'axios'
import { formatCurrency, formatDate, calcTiempoVida } from '@/utils/format'
import * as XLSX from 'xlsx'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

const ESTADOS_PROPUESTAS = ['Elaboracion_Propuesta', 'Rechazado']

const ESTADO_CONFIG = {
  Adjudicado:            { severity: 'success',   label: 'Adjudicado'        },
  'En Ejecución':        { severity: 'info',      label: 'En Ejecución'      },
  'Por Facturar':        { severity: 'warning',   label: 'Por Facturar'      },
  Facturado:             { severity: 'secondary', label: 'Facturado'         },
  Cerrado:               { severity: 'secondary', label: 'Cerrado'           },
  Elaboracion_Propuesta: { severity: 'info',      label: 'Elab. Propuesta'   },
  Ejecución:             { severity: 'info',      label: 'Ejecución'         },
  Pruebas:               { severity: 'warning',   label: 'Pruebas'           },
  Rechazado:             { severity: 'danger',    label: 'Rechazado'         },
  Entregado:             { severity: 'success',   label: 'Entregado'         },
}

export default function ProyectosPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede, puedeEditarProyecto } = usePermisos()

  const [proyectos, setProyectos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [estados, setEstados] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [moneda, setMoneda] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [responsableFiltro, setResponsableFiltro] = useState(null)
  const [fechaRango, setFechaRango] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedProyecto, setSelectedProyecto] = useState(null)
  const [visibleRows, setVisibleRows] = useState([])
  const [cerradosExpanded, setCerradosExpanded] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [proyRes, empRes, emplRes, estRes, cfgRes] = await Promise.all([
        proyectoService.getAll(),
        empresaService.getAll(),
        empleadoService.getAll(),
        axios.get('/api/v1/estados'),
        configuracionService.getAll(),
      ])
      setProyectos(proyRes.data)
      setEmpresas(empRes.data)
      setEmpleados(emplRes.data)
      setEstados(estRes.data.data)
      if (cfgRes.data.data?.empresa?.moneda) setMoneda(cfgRes.data.data.empresa.moneda)
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los proyectos', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const loadProyectos = async (estadoId) => {
    setLoading(true)
    try {
      const params = estadoId ? { estado_id: estadoId } : {}
      const res = await proyectoService.getAll(params)
      setProyectos(res.data)
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Error al filtrar proyectos', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const handleEstadoFiltro = (value) => {
    setEstadoFiltro(value)
    loadProyectos(value)
  }

  const openCreate = () => { setSelectedProyecto(null); setDialogVisible(true) }
  const openEdit = (p) => { setSelectedProyecto(p); setDialogVisible(true) }

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Proyecto guardado exitosamente', life: 3000 })
    loadAll()
  }

  const confirmDelete = (p) => {
    confirmDialog({
      message: `¿Eliminar el proyecto "${p.detalle}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => handleDelete(p.id),
    })
  }

  const handleDelete = async (id) => {
    try {
      await proyectoService.remove(id)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Proyecto eliminado', life: 3000 })
      loadAll()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar el proyecto'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

  // Templates de columnas
  const detalleTemplate = (row) => (
    <Button
      label={row.detalle}
      link
      className="p-0 text-left"
      style={{ fontWeight: 500 }}
      onClick={() => router.push(`/proyectos/${row.id}`)}
    />
  )

  const estadoTemplate = (row) => (
    <Tag value={row.estado?.nombre} severity={row.estado?.color || 'secondary'} />
  )

  const valorTemplate = (row) => formatCurrency(row.valor, moneda)
  const facturadoTemplate = (row) => formatCurrency(row.facturado, moneda)
  const pagadoTemplate = (row) => formatCurrency(row.pagado, moneda)

  const saldoTemplate = (row) => (
    <span style={{ color: row.saldo > 0 ? 'var(--red-500)' : 'var(--green-500)', fontWeight: 600 }}>
      {formatCurrency(row.saldo, moneda)}
    </span>
  )

  const tiempoVidaTemplate = (row) =>
    calcTiempoVida(row.fechaCreacion, row.fechaCierre)

  const accionesTemplate = (row) => (
    <div className="flex gap-1">
      <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver detalle" tooltipOptions={{ position: 'top' }} onClick={() => router.push(`/proyectos/${row.id}`)} />
      {(puede(PERMISOS.PROYECTOS.EDITAR) && puedeEditarProyecto(row.estadoId)) && (
        <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEdit(row)} />
      )}
      {puede(PERMISOS.PROYECTOS.ELIMINAR) && (
        <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => confirmDelete(row)} />
      )}
    </div>
  )

  // Proyectos cerrados — siempre separados, aplica solo el buscador global
  const proyectosCerrados = useMemo(() => {
    let lista = proyectos.filter((p) => p.estado?.nombre === 'Cerrado')
    if (globalFilter) {
      const term = globalFilter.toLowerCase()
      lista = lista.filter((p) =>
        p.detalle?.toLowerCase().includes(term) ||
        p.empresa?.nombre?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term)
      )
    }
    return lista
  }, [proyectos, globalFilter])

  // Filtrado avanzado en frontend (SP7-05)
  const proyectosFiltrados = useMemo(() => {
    let lista = proyectos
    // Siempre excluir estados de Propuestas y proyectos Cerrados (van en tabla propia)
    lista = lista.filter((p) => !ESTADOS_PROPUESTAS.includes(p.estado?.nombre) && p.estado?.nombre !== 'Cerrado')
    if (responsableFiltro) {
      lista = lista.filter((p) => p.responsables?.some((r) => r.empleadoId === responsableFiltro))
    }
    if (fechaRango && fechaRango[0]) {
      const desde = new Date(fechaRango[0]); desde.setHours(0, 0, 0, 0)
      lista = lista.filter((p) => new Date(p.fechaCreacion) >= desde)
    }
    if (fechaRango && fechaRango[1]) {
      const hasta = new Date(fechaRango[1]); hasta.setHours(23, 59, 59, 999)
      lista = lista.filter((p) => new Date(p.fechaCreacion) <= hasta)
    }
    if (globalFilter) {
      const term = globalFilter.toLowerCase()
      lista = lista.filter((p) =>
        p.detalle?.toLowerCase().includes(term) ||
        p.empresa?.nombre?.toLowerCase().includes(term) ||
        p.aplicativo?.toLowerCase().includes(term) ||
        p.ot?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term) ||
        p.estado?.nombre?.toLowerCase().includes(term) ||
        p.responsables?.some((r) => `${r.empleado?.nombre} ${r.empleado?.apellido}`.toLowerCase().includes(term))
      )
    }
    return lista
  }, [proyectos, estadoFiltro, responsableFiltro, fechaRango, globalFilter])

  const kpiEstados = useMemo(() => {
    const fuente = visibleRows.length > 0 ? visibleRows : proyectosFiltrados
    const conteo = {}
    fuente.forEach((p) => {
      const nombre = p.estado?.nombre
      if (!nombre) return
      conteo[nombre] = (conteo[nombre] || 0) + 1
    })
    return Object.entries(conteo)
      .map(([nombre, count]) => {
        const estadoDB = estados.find((e) => e.nombre === nombre)
        const severity = estadoDB?.color || 'secondary'
        return { nombre, count, cfg: { severity, label: nombre } }
      })
      .sort((a, b) => b.count - a.count)
  }, [visibleRows, proyectosFiltrados])

  const kpiTotal = visibleRows.length > 0 ? visibleRows.length : proyectosFiltrados.length

  const SEVERITY_STYLE = {
    success:   { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
    info:      { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
    warning:   { bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },
    danger:    { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    secondary: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  }

  const exportarExcel = () => {
    const filas = proyectosFiltrados.map((p) => ({
      'ID': p.id,
      'Proyecto': p.detalle,
      'Cliente': p.empresa?.nombre || '',
      'Responsable(s)': p.responsables?.map((r) => r.empleado ? `${r.empleado.nombre} ${r.empleado.apellido}` : '').join(', ') || '',
      'Estado': p.estado?.nombre?.replace('_', ' ') || '',
      'Aplicativo': p.aplicativo || '',
      'OT': p.ot || '',
      'Valor': Number(p.valor) || 0,
      'Facturado': Number(p.facturado) || 0,
      'Pagado': Number(p.pagado) || 0,
      'Saldo': Number(p.saldo) || 0,
      'Tiempo de vida': calcTiempoVida(p.fechaCreacion, p.fechaCierre),
      'Fecha inicio': formatDate(p.fechaCreacion),
      'Fecha cierre': formatDate(p.fechaCierre),
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `proyectos_${fecha}.xlsx`)
  }

  const estadosFiltroOptions = [
    { id: null, nombre: 'Todos los estados' },
    ...estados.filter((e) => !ESTADOS_PROPUESTAS.includes(e.nombre) && e.nombre !== 'Cerrado').map((e) => ({ id: e.id, nombre: e.nombre })),
  ]

  if (loading && proyectos.length === 0) {
    return (
      <>
        <Toast ref={toast} />
        <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
          <ProgressSpinner />
        </div>
      </>
    )
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex align-items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold m-0 mr-2">Proyectos</h1>

        {/* KPI chips — misma altura que los botones */}
        <div className="flex align-items-center gap-2 flex-1 flex-wrap">
          {/* Total */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '0 12px', height: '36px', borderRadius: '18px',
            background: '#f3f4f6', border: '1px solid #d1d5db',
            fontSize: '0.8rem', fontWeight: 600, color: '#374151',
            whiteSpace: 'nowrap',
          }}>
            <i className="pi pi-briefcase" style={{ fontSize: '0.75rem' }} />
            {kpiTotal} total
          </span>

          {/* Por estado */}
          {kpiEstados.map(({ nombre, count, cfg }) => {
            const s = SEVERITY_STYLE[cfg.severity] || SEVERITY_STYLE.secondary
            return (
              <span key={nombre} style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '0 12px', height: '36px', borderRadius: '18px',
                background: s.bg, border: `1px solid ${s.border}`,
                fontSize: '0.8rem', fontWeight: 600, color: s.color,
                whiteSpace: 'nowrap',
              }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: s.color, display: 'inline-block', flexShrink: 0,
                }} />
                {count} {cfg.label}
              </span>
            )
          })}
        </div>

        <div className="flex gap-2" style={{ flexShrink: 0 }}>
          <Button label="Exportar Excel" icon="pi pi-file-excel" severity="success" outlined onClick={exportarExcel} disabled={proyectosFiltrados.length === 0} />
          {puede(PERMISOS.PROYECTOS.CREAR) && (
            <Button label="Nuevo Proyecto" icon="pi pi-plus" onClick={openCreate} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="p-input-icon-left flex-1" style={{ minWidth: '200px' }}>
          <i className="pi pi-search" />
          <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Buscar proyecto..." className="w-full" />
        </span>
        <Dropdown
          value={estadoFiltro}
          options={estadosFiltroOptions}
          optionLabel="nombre"
          optionValue="id"
          onChange={(e) => handleEstadoFiltro(e.value)}
          placeholder="Filtrar por estado"
          showClear
          style={{ minWidth: '180px' }}
        />
        <Dropdown
          value={responsableFiltro}
          options={[{ id: null, nombre: 'Todos los responsables', apellido: '' }, ...empleados]}
          optionLabel="nombre"
          optionValue="id"
          onChange={(e) => setResponsableFiltro(e.value)}
          placeholder="Filtrar por responsable"
          showClear
          filter filterPlaceholder="Buscar responsable..."
          style={{ minWidth: '200px' }}
        />
        <Calendar
          value={fechaRango}
          onChange={(e) => setFechaRango(e.value)}
          selectionMode="range"
          readOnlyInput
          placeholder="Rango de fechas"
          dateFormat="dd/mm/yy"
          showButtonBar
          style={{ minWidth: '200px' }}
        />
      </div>

      <DataTable
        value={proyectosFiltrados}
        globalFilter={globalFilter}
        onValueChange={(rows) => setVisibleRows(rows)}
        loading={loading}
        paginator
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay proyectos registrados"
        stripedRows
        scrollable
        filterDisplay="menu"
      >
        <Column field="codigo" header="Código" body={(row) => row.codigo || '—'} sortable filter filterPlaceholder="Buscar código..." style={{ width: '120px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        <Column field="detalle" header="Proyecto" body={detalleTemplate} sortable filter filterPlaceholder="Buscar proyecto..." style={{ minWidth: '180px' }} />
        <Column field="empresa.nombre" header="Cliente" body={(row) => row.empresa?.nombre} sortable filter filterPlaceholder="Buscar cliente..." />
        <Column field="aplicativo" header="Aplicativo" body={(row) => row.aplicativo || '—'} sortable filter filterPlaceholder="Buscar aplicativo..." style={{ width: '120px' }} />
        <Column field="ot" header="OT" body={(row) => row.ot || '—'} sortable filter filterPlaceholder="Buscar OT..." style={{ width: '110px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        <Column field="valor" header="Valor" body={valorTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
        <Column field="facturado" header="Facturado" body={facturadoTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
        <Column field="pagado" header="Pagado" body={pagadoTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
        <Column field="saldo" header="Saldo" body={saldoTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
        <Column field="fechaCreacion" header="Fecha Inicio" body={(row) => formatDate(row.fechaCreacion)} sortable style={{ width: '115px' }} />
        <Column field="fechaCierre" header="Fecha Cierre" body={(row) => formatDate(row.fechaCierre)} sortable style={{ width: '115px' }} />
        <Column field="estado.nombre" header="Estado" body={estadoTemplate} sortable filter filterPlaceholder="Buscar estado..." style={{ width: '140px' }} />
        <Column header="Acciones" body={accionesTemplate} style={{ width: '120px' }} />
      </DataTable>

      {/* ── Proyectos Cerrados ─────────────────────────────────────────── */}
      <div className="mt-4">
        <div
          className="flex align-items-center justify-content-between px-3 py-2 border-round cursor-pointer select-none"
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: cerradosExpanded ? '6px 6px 0 0' : '6px' }}
          onClick={() => setCerradosExpanded((v) => !v)}
        >
          <div className="flex align-items-center gap-2">
            <i className="pi pi-folder" style={{ color: '#6b7280' }} />
            <span className="font-semibold" style={{ color: '#374151' }}>Proyectos cerrados</span>
            <span className="ml-1 px-2 py-0 border-round-xl text-sm font-bold" style={{ background: '#e5e7eb', color: '#6b7280' }}>
              {proyectosCerrados.length}
            </span>
          </div>
          <i className={`pi ${cerradosExpanded ? 'pi-chevron-up' : 'pi-chevron-down'}`} style={{ color: '#9ca3af', fontSize: '0.85rem' }} />
        </div>

        {cerradosExpanded && (
          <div style={{ border: '1px solid #d1d5db', borderTop: 'none', borderRadius: '0 0 6px 6px', opacity: 0.85 }}>
            <DataTable
              value={proyectosCerrados}
              paginator
              rows={10}
              rowsPerPageOptions={[10, 25, 50]}
              emptyMessage="No hay proyectos cerrados"
              stripedRows
              scrollable
              size="small"
              filterDisplay="menu"
            >
              <Column field="codigo" header="Código" body={(row) => row.codigo || '—'} sortable filter filterPlaceholder="Buscar código..." style={{ width: '120px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
              <Column field="detalle" header="Proyecto" body={detalleTemplate} sortable filter filterPlaceholder="Buscar proyecto..." style={{ minWidth: '180px' }} />
              <Column field="empresa.nombre" header="Cliente" body={(row) => row.empresa?.nombre} sortable filter filterPlaceholder="Buscar cliente..." />
              <Column field="estado.nombre" header="Estado" body={estadoTemplate} sortable filter filterPlaceholder="Buscar estado..." style={{ width: '130px' }} />
              <Column field="valor" header="Valor" body={valorTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
              <Column field="facturado" header="Facturado" body={facturadoTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
              <Column field="pagado" header="Pagado" body={pagadoTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
              <Column field="saldo" header="Saldo" body={saldoTemplate} sortable dataType="numeric" style={{ textAlign: 'right' }} />
              <Column field="fechaCreacion" header="Fecha Inicio" body={(row) => formatDate(row.fechaCreacion)} sortable style={{ width: '115px' }} />
              <Column field="fechaCierre" header="Fecha Cierre" body={(row) => formatDate(row.fechaCierre)} sortable style={{ width: '115px' }} />
              <Column header="Acciones" body={(row) => (
                <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver detalle" tooltipOptions={{ position: 'top' }} onClick={() => router.push(`/proyectos/${row.id}`)} />
              )} style={{ width: '80px' }} />
            </DataTable>
          </div>
        )}
      </div>

      <ProyectoFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        proyecto={selectedProyecto}
        empresas={empresas}
        estados={estados}
        empleados={empleados}
      />
    </div>
  )
}
