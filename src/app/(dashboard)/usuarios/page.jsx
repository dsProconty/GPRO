'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import UsuarioFormDialog from '@/components/shared/UsuarioFormDialog'
import axios from 'axios'
import { formatDate } from '@/utils/format'

export default function UsuariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useRef(null)

  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (status === 'loading') return
    if (session?.user?.role !== 'admin') {
      router.push('/dashboard')
    } else {
      loadUsuarios()
    }
  }, [status, session])

  const loadUsuarios = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/v1/usuarios')
      setUsuarios(res.data.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la lista de usuarios', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => { setSelected(null); setDialogVisible(true) }
  const openEdit = (u) => { setSelected(u); setDialogVisible(true) }

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: selected ? 'Usuario actualizado' : 'Usuario creado', life: 3000 })
    loadUsuarios()
  }

  const confirmDelete = (u) => {
    confirmDialog({
      message: `¿Eliminar al usuario "${u.name}"? Esta acción no se puede deshacer.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await axios.delete(`/api/v1/usuarios/${u.id}`)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Usuario eliminado', life: 3000 })
          loadUsuarios()
        } catch (err) {
          const msg = err.response?.data?.message || 'Error al eliminar'
          toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
        }
      },
    })
  }

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin')) {
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
          <h1 className="text-2xl font-bold m-0">Usuarios del Sistema</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">{usuarios.length} usuario(s) registrado(s)</p>
        </div>
        <Button label="Nuevo Usuario" icon="pi pi-plus" onClick={openCreate} />
      </div>

      <DataTable
        value={usuarios}
        loading={loading}
        stripedRows
        emptyMessage="No hay usuarios registrados"
      >
        <Column field="id" header="ID" style={{ width: '60px' }} sortable dataType="numeric" />
        <Column field="name" header="Nombre" sortable />
        <Column field="email" header="Email" sortable />
        <Column header="Rol" style={{ width: '130px' }} body={(u) => (
          <Tag
            value={u.role === 'admin' ? 'Administrador' : 'Usuario'}
            severity={u.role === 'admin' ? 'danger' : 'info'}
          />
        )} />
        <Column header="Registrado" style={{ width: '130px' }} body={(u) => formatDate(u.createdAt)} />
        <Column header="Acciones" style={{ width: '120px' }} body={(u) => (
          <div className="flex gap-1">
            <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEdit(u)} />
            <Button
              icon="pi pi-trash"
              rounded text severity="danger"
              tooltip={parseInt(session?.user?.id) === u.id ? 'No puedes eliminarte a ti mismo' : 'Eliminar'}
              tooltipOptions={{ position: 'top' }}
              onClick={() => confirmDelete(u)}
              disabled={parseInt(session?.user?.id) === u.id}
            />
          </div>
        )} />
      </DataTable>

      <UsuarioFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        usuario={selected}
      />
    </div>
  )
}
