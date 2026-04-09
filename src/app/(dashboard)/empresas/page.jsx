'use client'

import { useEffect, useRef, useState } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import EmpresaFormDialog from '@/components/shared/EmpresaFormDialog'
import { empresaService } from '@/services/empresaService'

export default function EmpresasPage() {
  const toast = useRef(null)
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)

  useEffect(() => {
    loadEmpresas()
  }, [])

  const loadEmpresas = async () => {
    setLoading(true)
    try {
      const res = await empresaService.getAll()
      setEmpresas(res.data)
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las empresas', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setSelectedEmpresa(null)
    setDialogVisible(true)
  }

  const openEdit = (empresa) => {
    setSelectedEmpresa(empresa)
    setDialogVisible(true)
  }

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Empresa guardada exitosamente', life: 3000 })
    loadEmpresas()
  }

  const confirmDelete = (empresa) => {
    confirmDialog({
      message: `¿Eliminar la empresa "${empresa.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => handleDelete(empresa.id),
    })
  }

  const handleDelete = async (id) => {
    try {
      await empresaService.remove(id)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Empresa eliminada exitosamente', life: 3000 })
      loadEmpresas()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar la empresa'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

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

  if (loading && empresas.length === 0) {
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
        <h1 className="text-2xl font-bold m-0">Empresas</h1>
        <Button label="Nueva Empresa" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <div className="mb-3">
        <span className="p-input-icon-left w-full md:w-4">
          <i className="pi pi-search" />
          <InputText
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full"
          />
        </span>
      </div>

      <DataTable
        value={empresas}
        globalFilter={globalFilter}
        loading={loading}
        paginator
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay empresas registradas"
        stripedRows
      >
        <Column field="id" header="ID" sortable style={{ width: '80px' }} />
        <Column field="nombre" header="Nombre" sortable filter filterPlaceholder="Filtrar..." />
        <Column
          field="ciudad"
          header="Ciudad"
          sortable
          filter
          filterPlaceholder="Filtrar..."
          body={(row) => row.ciudad || '—'}
        />
        <Column header="Acciones" body={accionesTemplate} style={{ width: '100px' }} />
      </DataTable>

      <EmpresaFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        empresa={selectedEmpresa}
      />
    </div>
  )
}
