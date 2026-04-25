'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Tag } from 'primereact/tag'
import { Dropdown } from 'primereact/dropdown'
import EmpresaFormDialog from '@/components/shared/EmpresaFormDialog'
import ClienteFormDialog from '@/components/shared/ClienteFormDialog'
import { empresaService } from '@/services/empresaService'
import { clienteService } from '@/services/clienteService'
import { tarifarioService } from '@/services/tarifarioService'

export default function ClienteDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const id = parseInt(params.id)

  const [cliente, setCliente] = useState(null)
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)

  const [editDialogVisible, setEditDialogVisible] = useState(false)
  const [contactoDialogVisible, setContactoDialogVisible] = useState(false)
  const [selectedContacto, setSelectedContacto] = useState(null)
  const [tarifarios, setTarifarios] = useState([])
  const [tarifarioSeleccionado, setTarifarioSeleccionado] = useState(null)
  const [savingTarifario, setSavingTarifario] = useState(false)

  useEffect(() => {
    loadAll()
  }, [id])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [clienteRes, contactosRes, tarifRes] = await Promise.all([
        empresaService.getById(id),
        clienteService.getAll({ empresa_id: id }),
        tarifarioService.getAll({ activo: true }),
      ])
      setCliente(clienteRes.data)
      setContactos(contactosRes.data)
      setTarifarios(tarifRes.data.data || [])
      setTarifarioSeleccionado(clienteRes.data?.tarifarioId || null)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el cliente', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarTarifario = async () => {
    setSavingTarifario(true)
    try {
      await empresaService.update(id, { nombre: cliente.nombre, ciudad: cliente.ciudad, tarifarioId: tarifarioSeleccionado })
      toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Tarifario actualizado', life: 3000 })
      loadAll()
    } catch (err) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    } finally {
      setSavingTarifario(false)
    }
  }

  const handleClienteSaved = () => {
    setEditDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Cliente actualizado', life: 3000 })
    loadAll()
  }

  const openNuevoContacto = () => {
    setSelectedContacto(null)
    setContactoDialogVisible(true)
  }

  const openEditContacto = (contacto) => {
    setSelectedContacto(contacto)
    setContactoDialogVisible(true)
  }

  const handleContactoSaved = () => {
    setContactoDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Contacto guardado exitosamente', life: 3000 })
    loadAll()
  }

  const confirmDeleteContacto = (contacto) => {
    confirmDialog({
      message: `¿Eliminar el contacto "${contacto.nombre} ${contacto.apellido}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => handleDeleteContacto(contacto.id),
    })
  }

  const handleDeleteContacto = async (contactoId) => {
    try {
      await clienteService.remove(contactoId)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Contacto eliminado', life: 3000 })
      loadAll()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar el contacto'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

  const accionesContacto = (rowData) => (
    <div className="flex gap-1">
      <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEditContacto(rowData)} />
      <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => confirmDeleteContacto(rowData)} />
    </div>
  )

  if (loading) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <ProgressSpinner />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="p-4">
        <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/clientes')} />
        <p className="mt-3 text-color-secondary">Cliente no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Breadcrumb */}
      <div className="flex align-items-center gap-2 mb-4">
        <Button label="Clientes" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/clientes')} />
        <i className="pi pi-angle-right text-color-secondary" />
        <span className="text-900 font-semibold">{cliente.nombre}</span>
      </div>

      {/* Datos del cliente */}
      <Card className="mb-4">
        <div className="flex justify-content-between align-items-start">
          <div>
            <div className="flex align-items-center gap-3 mb-2">
              <div className="flex align-items-center justify-content-center border-round" style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #1e3a5f, #2e75b6)' }}>
                <i className="pi pi-building text-white text-xl" />
              </div>
              <div>
                <h2 className="text-2xl font-bold m-0">{cliente.nombre}</h2>
                {cliente.ciudad && <p className="text-color-secondary m-0 mt-1"><i className="pi pi-map-marker mr-1" />{cliente.ciudad}</p>}
              </div>
            </div>
            <Tag value={`${contactos.length} contacto${contactos.length !== 1 ? 's' : ''}`} severity="info" icon="pi pi-users" />
          </div>
          <Button label="Editar" icon="pi pi-pencil" severity="secondary" outlined onClick={() => setEditDialogVisible(true)} />
        </div>
      </Card>

      {/* Tarifario activo */}
      <Card className="mb-4">
        <div className="flex justify-content-between align-items-center">
          <div>
            <h3 className="text-lg font-bold m-0"><i className="pi pi-dollar mr-2 text-primary" />Tarifario activo</h3>
            <p className="text-color-secondary text-sm mt-1 mb-0">Lista de precios asociada a este cliente</p>
          </div>
          <div className="flex align-items-center gap-2">
            <Dropdown
              value={tarifarioSeleccionado}
              options={tarifarios.map((t) => ({ label: t.nombre, value: t.id }))}
              onChange={(e) => setTarifarioSeleccionado(e.value)}
              placeholder="Sin tarifario"
              showClear
              style={{ minWidth: '220px' }}
            />
            <Button
              label="Guardar"
              icon="pi pi-save"
              loading={savingTarifario}
              onClick={handleGuardarTarifario}
              disabled={tarifarioSeleccionado === (cliente?.tarifarioId || null)}
            />
          </div>
        </div>
        {cliente?.tarifario && (
          <div className="mt-2 flex align-items-center gap-2 text-sm text-color-secondary">
            <i className="pi pi-check-circle text-green-500" />
            <span>Tarifario actual: <strong>{cliente.tarifario.nombre}</strong></span>
          </div>
        )}
      </Card>

      {/* Contactos / PMs */}
      <Card>
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="text-xl font-bold m-0">Contactos / PMs</h3>
            <p className="text-color-secondary text-sm mt-1 mb-0">Personas de contacto dentro de {cliente.nombre}</p>
          </div>
          <Button label="Nuevo Contacto" icon="pi pi-user-plus" onClick={openNuevoContacto} />
        </div>

        <DataTable
          value={contactos}
          emptyMessage="No hay contactos registrados. Agrega el primer PM."
          stripedRows
        >
          <Column header="Nombre" body={(row) => `${row.nombre} ${row.apellido}`} sortable sortField="apellido" />
          <Column header="Teléfono" body={(row) => row.telefono || '—'} />
          <Column header="Email" body={(row) => row.mail || '—'} />
          <Column header="Acciones" body={accionesContacto} style={{ width: '100px' }} />
        </DataTable>
      </Card>

      {/* Dialog editar cliente */}
      <EmpresaFormDialog
        visible={editDialogVisible}
        onHide={() => setEditDialogVisible(false)}
        onSave={handleClienteSaved}
        empresa={cliente}
        labelOverride="Cliente"
      />

      {/* Dialog contacto */}
      <ClienteFormDialog
        visible={contactoDialogVisible}
        onHide={() => setContactoDialogVisible(false)}
        onSave={handleContactoSaved}
        cliente={selectedContacto}
        empresas={[cliente]}
        empresaFija={cliente.id}
      />
    </div>
  )
}
