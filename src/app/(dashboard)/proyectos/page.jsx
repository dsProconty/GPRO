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
import { usuarioService } from '@/services/usuarioService'
import { configuracionService } from '@/services/configuracionService'
import axios from 'axios'
import { formatCurrency, formatDate, calcTiempoVida } from '@/utils/format'
import * as XLSX from 'xlsx'

const ESTADO_CONFIG = {
  Prefactibilidad:       { severity: 'warning',   label: 'Prefactibilidad' },
  Elaboracion_Propuesta: { severity: 'info',       label: 'Elab. Propuesta' },
  Adjudicado:            { severity: 'success',    label: 'Adjudicado' },
  Rechazado:             { severity: 'danger',     label: 'Rechazado' },
  Cerrado:               { severity: 'secondary',  label: 'Cerrado' },
}

export default function ProyectosPage() {
  const toast = useRef(null)
  const router = useRouter()

  const [proyectos, setProyectos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [estados, setEstados] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [moneda, setMoneda] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [responsableFiltro, setResponsableFiltro] = useState(null)
  const [fechaRango, setFechaRango] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedProyecto, setSelectedProyecto] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [proyRes, empRes, usrRes, estRes, cfgRes] = await Promise.all([
        proyectoService.getAll(),
        empresaService.getAll(),
        usuarioService.getAll(),
        axios.get('/api/v1/estados'),
        configuracionService.getAll(),
      ])
      setProyectos(proyRes.data)
      setEmpresas(empRes.data)
      setUsuarios(usrRes.data)
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

  const estadoTemplate = (row) => {
    const cfg = ESTADO_CONFIG[row.estado?.nombre] || { severity: 'secondary', label: row.estado?.nombre }
    return <Tag value={cfg.label} severity={cfg.severity} />
  }

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
      <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEdit(row)} />
      <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => confirmDelete(row)} />
    </div>
  )

  // Filtrado avanzado en frontend (SP7-05)
  const proyectosFiltrados = useMemo(() => {
    let lista = proyectos
    if (responsableFiltro) {
      lista = lista.filter((p) => p.responsables?.some((r) => r.userId === responsableFiltro))
    }
    if (fechaRango && fechaRango[0]) {
      const desde = new Date(fechaRango[0]); desde.setHours(0, 0, 0, 0)
      lista = lista.filter((p) => new Date(p.fechaCreacion) >= desde)
    }
    if (fechaRango && fechaRango[1]) {
      const hasta = new Date(fechaRango[1]); hasta.setHours(23, 59, 59, 999)
      lista = lista.filter((p) => new Date(p.fechaCreacion) <= hasta)
    }
    return lista
  }, [proyectos, responsableFiltro, fechaRango])

  const exportarExcel = () => {
    const filas = proyectosFiltrados.map((p) => ({
      'ID': p.id,
      'Proyecto': p.detalle,
      'Cliente': p.empresa?.nombre || '',
      'Responsable(s)': p.responsables?.map((r) => r.user?.name).join(', ') || '',
      'Estado': p.estado?.nombre?.replace('_', ' ') || '',
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
    { id: 1, nombre: 'Prefactibilidad' },
    { id: 2, nombre: 'Elaboracion_Propuesta' },
    { id: 3, nombre: 'Adjudicado' },
    { id: 4, nombre: 'Rechazado' },
    { id: 5, nombre: 'Cerrado' },
  ]

  if (loading && proyectos.length === 0) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <ProgressSpinner />
      </div>
    )
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">Proyectos</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">{proyectosFiltrados.length} proyecto(s) encontrado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button label="Exportar Excel" icon="pi pi-file-excel" severity="success" outlined onClick={exportarExcel} disabled={proyectosFiltrados.length === 0} />
          <Button label="Nuevo Proyecto" icon="pi pi-plus" onClick={openCreate} />
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
          options={[{ id: null, name: 'Todos los responsables' }, ...usuarios]}
          optionLabel="name"
          optionValue="id"
          onChange={(e) => setResponsableFiltro(e.value)}
          placeholder="Filtrar por responsable"
          showClear
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
        loading={loading}
        paginator
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay proyectos registrados"
        stripedRows
        scrollable
      >
        <Column field="id" header="ID" sortable style={{ width: '70px' }} />
        <Column header="Proyecto" body={detalleTemplate} sortable sortField="detalle" style={{ minWidth: '200px' }} />
        <Column header="Cliente" body={(row) => row.empresa?.nombre} sortable sortField="empresa.nombre" />
        <Column header="Valor" body={valorTemplate} sortable sortField="valor" style={{ textAlign: 'right' }} />
        <Column header="Facturado" body={facturadoTemplate} style={{ textAlign: 'right' }} />
        <Column header="Pagado" body={pagadoTemplate} style={{ textAlign: 'right' }} />
        <Column header="Saldo" body={saldoTemplate} style={{ textAlign: 'right' }} />
        <Column header="Tiempo de vida" body={tiempoVidaTemplate} style={{ width: '130px' }} />
        <Column header="Estado" body={estadoTemplate} style={{ width: '140px' }} />
        <Column header="Acciones" body={accionesTemplate} style={{ width: '120px' }} />
      </DataTable>

      <ProyectoFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        proyecto={selectedProyecto}
        empresas={empresas}
        estados={estados}
        usuarios={usuarios}
      />
    </div>
  )
}
