'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Badge } from 'primereact/badge'
import EmpresaFormDialog from '@/components/shared/EmpresaFormDialog'
import { empresaService } from '@/services/empresaService'

export default function ClientesPage() {
  const toast = useRef(null)
  const router = useRouter()
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

  const contactosTemplate = (row) => {
    const count = row._count?.clientes ?? 0
    return (
      <Badge
        value={count}
        severity={count > 0 ? 'info' : 'secondary'}
      />
    )
  }

  const accionesTemplate = (rowData) => (
    <div className="flex gap-1">
      <Button
        icon="pi pi-users"
        rounded
        text
        severity="success"
        tooltip="Ver contactos"
        tooltipOptions={{ position: 'top' }}
        onClick={() => router.push(`/clientes/${rowData.id}`)}
      />
      <Button
        icon="pi pi-pencil"
        rounded
        text
        severity="info"
        tooltip="Editar"
        tooltipOptions={{ position: 'top' }}
        onClick={() => openEdit(rowData)}
      />
      <Button
        icon="pi pi-trash"
        rounded
        text
        severity="danger"
        tooltip="Eliminar"
        tooltipOptions={{ position: 'top' }}
        onClick={() => confirmDelete(rowData)}
      />
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
        <Button label="Nuevo Cliente" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="mb-3">
        <span className="p-input-icon-left w-full md:w-4">
          <i className="pi pi-search" />
          <InputText
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full"
          />
        </span>
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
        onRowClick={(e) => router.push(`/clientes/${e.data.id}`)}
        rowClassName={() => 'cursor-pointer'}
      >
        <Column field="id" header="ID" sortable style={{ width: '70px' }} />
        <Column field="nombre" header="Cliente" sortable filter filterPlaceholder="Filtrar..." />
        <Column field="ciudad" header="Ciudad" sortable body={(row) => row.ciudad || '—'} />
        <Column header="Contactos" body={contactosTemplate} style={{ width: '100px', textAlign: 'center' }} />
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
