'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import PropuestaFormDialog from '@/components/shared/PropuestaFormDialog'
import { propuestaService } from '@/services/propuestaService'
import { empresaService } from '@/services/empresaService'
import { usuarioService } from '@/services/usuarioService'
import { configuracionService, buildPropuestaConfig } from '@/services/configuracionService'
import { formatCurrency, formatDate } from '@/utils/format'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

export default function PropuestasPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()

  const [propuestas, setPropuestas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [propuestaConfig, setPropuestaConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [propRes, empRes, usrRes, cfgRes] = await Promise.all([
        propuestaService.getAll(),
        empresaService.getAll(),
        usuarioService.getAll(),
        configuracionService.getAll(),
      ])
      setPropuestas(propRes.data)
      setEmpresas(empRes.data)
      setUsuarios(usrRes.data)
      setPropuestaConfig(buildPropuestaConfig(cfgRes.data.data.estadosPropuesta))
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las propuestas', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const estadosFiltro = useMemo(() => [
    { label: 'Todos', value: null },
    ...Object.values(propuestaConfig).map((cfg) => ({ label: cfg.label, value: cfg.key })),
  ], [propuestaConfig])

  const ESTADOS_TERMINALES = ['Aprobada', 'Rechazada']

  const propuestasFiltradas = useMemo(() => {
    let lista = propuestas
    if (estadoFiltro) {
      lista = lista.filter((p) => p.estado === estadoFiltro)
    } else {
      // Por defecto ocultar propuestas en estado terminal (Aprobada/Rechazada)
      lista = lista.filter((p) => !ESTADOS_TERMINALES.includes(p.estado))
    }
    return lista
  }, [propuestas, estadoFiltro])

  const openCreate = () => { setSelected(null); setDialogVisible(true) }
  const openEdit   = (p) => { setSelected(p);    setDialogVisible(true) }

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: selected ? 'Propuesta actualizada' : 'Propuesta creada', life: 3000 })
    loadAll()
  }

  const confirmDelete = (p) => {
    const bloqueado = !['Factibilidad', 'Haciendo'].includes(p.estado)
    if (bloqueado) {
      const cfg = propuestaConfig[p.estado]
      toast.current.show({ severity: 'warn', summary: 'No permitido', detail: 'No se puede eliminar una propuesta en estado "' + (cfg?.label || p.estado) + '"', life: 4000 })
      return
    }
    confirmDialog({
      message: '¿Eliminar la propuesta "' + p.titulo + '"?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await propuestaService.remove(p.id)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Propuesta eliminada', life: 3000 })
          loadAll()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  if (loading && propuestas.length === 0) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">Propuestas</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">{propuestasFiltradas.length} propuesta(s)</p>
        </div>
        {puede(PERMISOS.PROPUESTAS.CREAR) && (
          <Button label="Nueva Propuesta" icon="pi pi-plus" onClick={openCreate} />
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="p-input-icon-left flex-1" style={{ minWidth: '200px' }}>
          <i className="pi pi-search" />
          <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Buscar propuesta..." className="w-full" />
        </span>
        <Dropdown
          value={estadoFiltro}
          options={estadosFiltro}
          optionLabel="label"
          optionValue="value"
          onChange={(e) => setEstadoFiltro(e.value)}
          placeholder="Filtrar por estado"
          showClear
          style={{ minWidth: '200px' }}
        />
      </div>

      <DataTable
        value={propuestasFiltradas}
        globalFilter={globalFilter}
        loading={loading}
        paginator rows={10} rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay propuestas registradas"
        stripedRows
      >
        <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable style={{ width: '130px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        <Column header="Título" sortable sortField="titulo" style={{ minWidth: '200px' }} body={(r) => (
          <Button label={r.titulo} link className="p-0 text-left" style={{ fontWeight: 500 }}
            onClick={() => router.push('/propuestas/' + r.id)} />
        )} />
        <Column header="Empresa" body={(r) => r.empresa?.nombre} sortable sortField="empresa.nombre" />
        <Column field="aplicativo" header="Aplicativo" body={(r) => r.aplicativo || '—'} style={{ width: '120px' }} />
        <Column header="Valor est." style={{ textAlign: 'right', width: '130px' }}
          body={(r) => r.valorEstimado ? formatCurrency(r.valorEstimado) : '—'} />
        <Column header="Estado" style={{ width: '180px' }} body={(r) => {
          const cfg = propuestaConfig[r.estado] || { severity: 'secondary', label: r.estado }
          return <Tag value={cfg.label} severity={cfg.severity} />
        }} />
        <Column header="Responsables" body={(r) => (
          <span className="text-sm text-color-secondary">
            {r.responsables?.map((res) => res.user?.name).join(', ') || '—'}
          </span>
        )} />
        <Column header="Creada" style={{ width: '110px' }} body={(r) => formatDate(r.fechaCreacion)} />
        <Column header="Acciones" style={{ width: '120px' }} body={(r) => (
          <div className="flex gap-1">
            <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver detalle" tooltipOptions={{ position: 'top' }}
              onClick={() => router.push('/propuestas/' + r.id)} />
            {puede(PERMISOS.PROPUESTAS.EDITAR) && (
              <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }}
                onClick={() => openEdit(r)} disabled={['Aprobada', 'Rechazada'].includes(r.estado)} />
            )}
            {puede(PERMISOS.PROPUESTAS.ELIMINAR) && (
              <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                onClick={() => confirmDelete(r)} disabled={!['Factibilidad', 'Haciendo'].includes(r.estado)} />
            )}
          </div>
        )} />
      </DataTable>

      <PropuestaFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        propuesta={selected}
        empresas={empresas}
        usuarios={usuarios}
      />
    </div>
  )
}
