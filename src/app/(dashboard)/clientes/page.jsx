'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from '@/components/shared/InputText'
import { IconField } from 'primereact/iconfield'
import { InputIcon } from 'primereact/inputicon'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Tag } from 'primereact/tag'
import EmpresaFormDialog from '@/components/shared/EmpresaFormDialog'
import { empresaService } from '@/services/empresaService'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

// Paleta de colores para chips de contacto (cicla por índice)
const CHIP_COLORS = [
  { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  { bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  { bg: '#fce7f3', color: '#9d174d', dot: '#ec4899' },
  { bg: '#ede9fe', color: '#5b21b6', dot: '#8b5cf6' },
  { bg: '#ccfbf1', color: '#134e4a', dot: '#14b8a6' },
  { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  { bg: '#e0f2fe', color: '#075985', dot: '#0ea5e9' },
]

export default function ClientesPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)

  useEffect(() => {
    loadClientes()
  }, [])

  const loadClientes = async () => {
    setLoading(true)
    try {
      const res = await empresaService.getAll()
      setClientes(res.data)
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los clientes', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setSelectedCliente(null)
    setDialogVisible(true)
  }

  const openEdit = (cliente) => {
    setSelectedCliente(cliente)
    setDialogVisible(true)
  }

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Cliente guardado exitosamente', life: 3000 })
    loadClientes()
  }

  const confirmDelete = (cliente) => {
    confirmDialog({
      message: `¿Eliminar el cliente "${cliente.nombre}"?${cliente._count?.clientes > 0 ? ` Tiene ${cliente._count.clientes} contacto(s) asociado(s).` : ''}`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => handleDelete(cliente.id),
    })
  }

  const handleDelete = async (id) => {
    try {
      await empresaService.remove(id)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Cliente eliminado exitosamente', life: 3000 })
      loadClientes()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar el cliente'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

  const codigoTemplate = (row) => {
    if (!row.codigoCliente) return <span className="text-color-secondary text-sm">—</span>
    return (
      <Tag
        value={row.codigoCliente}
        style={{ background: '#dbeafe', color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}
      />
    )
  }

  const contactosTemplate = (row) => {
    const lista = row.clientes || []
    if (lista.length === 0) {
      return <span className="text-color-secondary text-sm" style={{ fontStyle: 'italic' }}>Sin contactos</span>
    }
    return (
      <div className="flex flex-wrap gap-1">
        {lista.map((c, idx) => {
          const pal = CHIP_COLORS[idx % CHIP_COLORS.length]
          return (
            <span
              key={c.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 9px', borderRadius: '20px', fontSize: '11px',
                fontWeight: 600, background: pal.bg, color: pal.color,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: pal.dot, flexShrink: 0, display: 'inline-block' }} />
              {c.nombre} {c.apellido}
            </span>
          )
        })}
      </div>
    )
  }

  const accionesTemplate = (rowData) => (
    <div className="flex gap-1 justify-content-center">
      <Button
        icon="pi pi-users"
        rounded text severity="success"
        tooltip="Ver contactos"
        tooltipOptions={{ position: 'top' }}
        onClick={(e) => { e.stopPropagation(); router.push(`/clientes/${rowData.id}`) }}
      />
      {puede(PERMISOS.EMPRESAS.EDITAR) && (
        <Button
          icon="pi pi-pencil"
          rounded text severity="info"
          tooltip="Editar"
          tooltipOptions={{ position: 'top' }}
          onClick={(e) => { e.stopPropagation(); openEdit(rowData) }}
        />
      )}
      {puede(PERMISOS.EMPRESAS.ELIMINAR) && (
        <Button
          icon="pi pi-trash"
          rounded text severity="danger"
          tooltip="Eliminar"
          tooltipOptions={{ position: 'top' }}
          onClick={(e) => { e.stopPropagation(); confirmDelete(rowData) }}
        />
      )}
    </div>
  )

  if (loading && clientes.length === 0) {
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
          <h1 className="text-2xl font-bold m-0">Clientes</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">Empresas clientes y sus contactos/PMs</p>
        </div>
        {puede(PERMISOS.EMPRESAS.CREAR) && (
          <Button label="Nuevo Cliente" icon="pi pi-plus" onClick={openCreate} />
        )}
      </div>

      <div className="mb-3">
        <IconField iconPosition="left" className="w-full md:w-4">
          <InputIcon className="pi pi-search" />
          <InputText
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full"
          />
        </IconField>
      </div>

      <DataTable
        value={clientes}
        globalFilter={globalFilter}
        loading={loading}
        paginator
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay clientes registrados"
        stripedRows
        sortField="id"
        sortOrder={1}
        onRowClick={(e) => router.push(`/clientes/${e.data.id}`)}
        rowClassName={() => 'cursor-pointer'}
      >
        <Column header="#" body={(_, { rowIndex }) => <span className="text-color-secondary font-semibold">{rowIndex + 1}</span>} style={{ width: '55px' }} />
        <Column field="nombre" header="Cliente" sortable filter filterPlaceholder="Buscar cliente..." />
        <Column header="Código" body={codigoTemplate} style={{ width: '100px' }} />
        <Column field="ciudad" header="Ciudad" sortable filter filterPlaceholder="Buscar ciudad..." body={(row) => row.ciudad || '—'} style={{ width: '130px' }} />
        <Column header="Contactos" body={contactosTemplate} />
        <Column header="Acciones" body={accionesTemplate} style={{ width: '120px' }} />
      </DataTable>

      <EmpresaFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        empresa={selectedCliente}
        labelOverride="Cliente"
      />
    </div>
  )
}
