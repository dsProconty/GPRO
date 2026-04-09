'use client'

import { useEffect, useRef, useState } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import ClienteFormDialog from '@/components/shared/ClienteFormDialog'
import { clienteService } from '@/services/clienteService'
import { empresaService } from '@/services/empresaService'

export default function ClientesPage() {
  const toast = useRef(null)
  const [clientes, setClientes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [clientesRes, empresasRes] = await Promise.all([
        clienteService.getAll(),
        empresaService.getAll(),
      ])
      setClientes(clientesRes.data)
      setEmpresas(empresasRes.data)
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los datos', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const loadClientes = async (empresaId) => {
    setLoading(true)
    try {
      const params = empresaId ? { empresa_id: empresaId } : {}
      const res = await clienteService.getAll(params)
      setClientes(res.data)
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los clientes', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const handleEmpresaFiltroChange = (value) => {
    setEmpresaFiltro(value)
    loadClientes(value)
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
    loadClientes(empresaFiltro)
  }

  const confirmDelete = (cliente) => {
    confirmDialog({
      message: `¿Eliminar a "${cliente.nombre} ${cliente.apellido}"?`,
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
      await clienteService.remove(id)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Cliente eliminado exitosamente', life: 3000 })
      loadClientes(empresaFiltro)
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar el cliente'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

  const nombreCompletoTemplate = (row) => `${row.nombre} ${row.apellido}`
  const empresaTemplate = (row) => row.empresa?.nombre || '—'
  const telefonoTemplate = (row) => row.telefono || '—'
  const mailTemplate = (row) => row.mail || '—'

  const accionesTemplate = (rowData) => (
    <div className="flex gap-1">
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

  const empresaFilterOptions = [{ id: null, nombre: 'Todas las empresas' }, ...empresas]

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
        <h1 className="text-2xl font-bold m-0">Clientes</h1>
        <Button label="Nuevo Cliente" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="p-input-icon-left flex-1" style={{ minWidth: '200px' }}>
          <i className="pi pi-search" />
          <InputText
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full"
          />
        </span>
        <Dropdown
          value={empresaFiltro}
          options={empresaFilterOptions}
          optionLabel="nombre"
          optionValue="id"
          onChange={(e) => handleEmpresaFiltroChange(e.value)}
          placeholder="Filtrar por empresa"
          showClear
          style={{ minWidth: '220px' }}
        />
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
      >
        <Column header="Nombre Completo" body={nombreCompletoTemplate} sortable sortField="apellido" filter filterField="nombre" filterPlaceholder="Filtrar..." />
        <Column header="Empresa" body={empresaTemplate} sortable sortField="empresa.nombre" />
        <Column header="Teléfono" body={telefonoTemplate} />
        <Column header="Email" body={mailTemplate} />
        <Column header="Acciones" body={accionesTemplate} style={{ width: '100px' }} />
      </DataTable>

      <ClienteFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        cliente={selectedCliente}
        empresas={empresas}
      />
    </div>
  )
}
