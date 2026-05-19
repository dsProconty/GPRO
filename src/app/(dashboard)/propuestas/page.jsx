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
import { proyectoService } from '@/services/proyectoService'
import { empresaService } from '@/services/empresaService'
import { usuarioService } from '@/services/usuarioService'
import { configuracionService, buildPropuestaConfig } from '@/services/configuracionService'
import { formatCurrency, formatDate } from '@/utils/format'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'

import axios from 'axios'

const ESTADOS_LEGACY = ['Elaboracion_Propuesta', 'Rechazado']

export default function PropuestasPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()

  const [propuestas, setPropuestas] = useState([])
  const [proyectosLegacy, setProyectosLegacy] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [propuestaConfig, setPropuestaConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selected, setSelected] = useState(null)

  // Quick-edit dialog para propuestas históricas
  const [quickEditVisible, setQuickEditVisible] = useState(false)
  const [quickEditProyecto, setQuickEditProyecto] = useState(null)
  const [quickEditForm, setQuickEditForm] = useState({})
  const [quickEditLoading, setQuickEditLoading] = useState(false)
  const [estadosAll, setEstadosAll] = useState([])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [propRes, empRes, usrRes, cfgRes, proyRes, estRes] = await Promise.all([
        propuestaService.getAll(),
        empresaService.getAll(),
        usuarioService.getAll(),
        configuracionService.getAll(),
        proyectoService.getAll(),
        axios.get('/api/v1/estados'),
      ])
      setPropuestas(propRes.data)
      setEmpresas(empRes.data)
      setUsuarios(usrRes.data)
      setPropuestaConfig(buildPropuestaConfig(cfgRes.data.data.estadosPropuesta))
      setProyectosLegacy(proyRes.data.filter((p) => ESTADOS_LEGACY.includes(p.estado?.nombre)))
      setEstadosAll(estRes.data.data || [])
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

  const openQuickEdit = (p) => {
    setQuickEditProyecto(p)
    setQuickEditForm({
      detalle:   p.detalle || '',
      valor:     Number(p.valor) || 0,
      aplicativo: p.aplicativo || '',
      ot:        p.ot || '',
      estadoId:  p.estadoId || null,
    })
    setQuickEditVisible(true)
  }

  const handleQuickEditSave = async () => {
    if (!quickEditForm.estadoId) {
      toast.current.show({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un estado', life: 3000 })
      return
    }
    setQuickEditLoading(true)
    try {
      await proyectoService.update(quickEditProyecto.id, {
        detalle:      quickEditForm.detalle,
        empresaId:    quickEditProyecto.empresaId,
        valor:        quickEditForm.valor,
        fechaCreacion: quickEditProyecto.fechaCreacion?.split('T')[0] || quickEditProyecto.fechaCreacion,
        fechaCierre:   quickEditProyecto.fechaCierre ? (quickEditProyecto.fechaCierre?.split('T')[0] || quickEditProyecto.fechaCierre) : null,
        estadoId:     quickEditForm.estadoId,
        aplicativo:   quickEditForm.aplicativo,
        ot:           quickEditForm.ot,
        clienteIds:   quickEditProyecto.clientes?.map((c) => c.clienteId) || [],
        responsableIds: quickEditProyecto.responsables?.map((r) => r.userId) || [],
      })
      toast.current.show({ severity: 'success', summary: 'Guardado', detail: 'Propuesta actualizada', life: 3000 })
      setQuickEditVisible(false)
      loadAll()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    } finally {
      setQuickEditLoading(false)
    }
  }

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
        filterDisplay="menu"
      >
        <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable filter filterPlaceholder="Buscar código..." style={{ width: '130px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        <Column field="tipoPropuesta" header="Tipo" style={{ width: '130px' }} sortable filter filterPlaceholder="Buscar tipo..."
          body={(r) => (
            <Tag
              value={r.tipoPropuesta === 'Mensualizada' ? '📅 Mensualizada' : '⏱ Por Horas'}
              severity={r.tipoPropuesta === 'Mensualizada' ? 'info' : 'secondary'}
              style={{ fontSize: '0.75rem' }}
            />
          )}
        />
        <Column field="titulo" header="Título" sortable filter filterPlaceholder="Buscar título..." style={{ minWidth: '200px' }} body={(r) => (
          <Button label={r.titulo} link className="p-0 text-left" style={{ fontWeight: 500 }}
            onClick={() => router.push('/propuestas/' + r.id)} />
        )} />
        <Column field="empresa.nombre" header="Empresa" body={(r) => r.empresa?.nombre} sortable filter filterPlaceholder="Buscar empresa..." />
        <Column field="aplicativo" header="Aplicativo" body={(r) => r.aplicativo || '—'} sortable filter filterPlaceholder="Buscar aplicativo..." style={{ width: '120px' }} />
        <Column header="Valor est." sortable sortField="valorEstimado" dataType="numeric" style={{ textAlign: 'right', width: '130px' }}
          body={(r) => r.valorEstimado ? formatCurrency(r.valorEstimado) : '—'} />
        <Column field="estado" header="Estado" sortable filter filterPlaceholder="Buscar estado..." style={{ width: '180px' }} body={(r) => {
          const cfg = propuestaConfig[r.estado] || { severity: 'secondary', label: r.estado }
          return <Tag value={cfg.label} severity={cfg.severity} />
        }} />
        <Column header="Responsables" body={(r) => (
          <span className="text-sm text-color-secondary">
            {r.responsables?.map((res) => res.user?.name).join(', ') || '—'}
          </span>
        )} />
        <Column header="Creada" sortable sortField="fechaCreacion" style={{ width: '110px' }} body={(r) => formatDate(r.fechaCreacion)} />
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

      {proyectosLegacy.length > 0 && (
        <div className="mt-5">
          <div className="mb-3">
            <h2 className="text-xl font-semibold m-0">Propuestas históricas</h2>
            <p className="text-color-secondary text-sm mt-1 mb-0">
              Registros migrados desde PowerApps · {proyectosLegacy.length} propuesta(s)
            </p>
          </div>
          <DataTable
            value={proyectosLegacy}
            paginator rows={15} rowsPerPageOptions={[15, 50, 100]}
            emptyMessage="Sin datos"
            stripedRows
            filterDisplay="menu"
          >
            <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable style={{ width: '130px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            <Column field="detalle" header="Proyecto" sortable body={(r) => (
              <Button label={r.detalle} link className="p-0 text-left" style={{ fontWeight: 500 }}
                onClick={() => router.push('/proyectos/' + r.id)} />
            )} style={{ minWidth: '200px' }} />
            <Column field="empresa.nombre" header="Empresa" body={(r) => r.empresa?.nombre} sortable />
            <Column field="aplicativo" header="Aplicativo" body={(r) => r.aplicativo || '—'} sortable style={{ width: '120px' }} />
            <Column field="valor" header="Valor" sortable dataType="numeric" style={{ textAlign: 'right', width: '130px' }}
              body={(r) => r.valor ? formatCurrency(r.valor) : '—'} />
            <Column field="estado.nombre" header="Estado" sortable style={{ width: '180px' }} body={(r) => (
              <Tag
                value={r.estado?.nombre === 'Elaboracion_Propuesta' ? 'Elab. Propuesta' : r.estado?.nombre}
                severity={r.estado?.nombre === 'Rechazado' ? 'danger' : 'info'}
              />
            )} />
            <Column field="fechaCreacion" header="Fecha" sortable style={{ width: '110px' }} body={(r) => formatDate(r.fechaCreacion)} />
            <Column header="Acciones" style={{ width: '100px' }} body={(r) => (
              <div className="flex gap-1">
                <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Edición rápida" tooltipOptions={{ position: 'top' }}
                  onClick={() => openQuickEdit(r)} />
                <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver detalle" tooltipOptions={{ position: 'top' }}
                  onClick={() => router.push('/proyectos/' + r.id)} />
              </div>
            )} />
          </DataTable>
        </div>
      )}

      <PropuestaFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        propuesta={selected}
        empresas={empresas}
        usuarios={usuarios}
      />

      {/* ── Quick-edit dialog para propuestas históricas ─────────────────── */}
      <Dialog
        visible={quickEditVisible}
        onHide={() => setQuickEditVisible(false)}
        header={
          <div>
            <div className="font-bold text-lg">{quickEditProyecto?.empresa?.nombre}</div>
            <div className="text-sm text-color-secondary font-normal mt-1" style={{ maxWidth: '480px' }}>
              {quickEditProyecto?.detalle}
            </div>
          </div>
        }
        style={{ width: '540px' }}
        modal
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={() => setQuickEditVisible(false)} disabled={quickEditLoading} />
            <Button label="Guardar cambios" icon="pi pi-check" onClick={handleQuickEditSave} loading={quickEditLoading} />
          </div>
        }
      >
        <div className="flex flex-column gap-4 pt-2">

          {/* Estado — campo principal */}
          <div className="field mb-0">
            <label className="font-semibold block mb-2">
              Estado <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={quickEditForm.estadoId}
              options={estadosAll}
              optionLabel="nombre"
              optionValue="id"
              onChange={(e) => setQuickEditForm({ ...quickEditForm, estadoId: e.value })}
              placeholder="Seleccionar estado"
              className="w-full"
              filter
            />
          </div>

          {/* Nombre del proyecto */}
          <div className="field mb-0">
            <label className="font-semibold block mb-2">Nombre del proyecto</label>
            <InputText
              value={quickEditForm.detalle || ''}
              onChange={(e) => setQuickEditForm({ ...quickEditForm, detalle: e.target.value })}
              className="w-full"
            />
          </div>

          {/* Valor + Aplicativo en fila */}
          <div className="grid">
            <div className="col-6 field mb-0">
              <label className="font-semibold block mb-2">Valor</label>
              <InputNumber
                value={quickEditForm.valor}
                onValueChange={(e) => setQuickEditForm({ ...quickEditForm, valor: e.value || 0 })}
                mode="currency" currency="USD" locale="es-EC"
                className="w-full"
              />
            </div>
            <div className="col-6 field mb-0">
              <label className="font-semibold block mb-2">Aplicativo</label>
              <InputText
                value={quickEditForm.aplicativo || ''}
                onChange={(e) => setQuickEditForm({ ...quickEditForm, aplicativo: e.target.value })}
                className="w-full"
                placeholder="ej: CRV, TIPS"
              />
            </div>
          </div>

          {/* OT */}
          <div className="field mb-0">
            <label className="font-semibold block mb-2">OT (Orden de Trabajo)</label>
            <InputText
              value={quickEditForm.ot || ''}
              onChange={(e) => setQuickEditForm({ ...quickEditForm, ot: e.target.value })}
              className="w-full"
              placeholder="ej: 35689 (opcional)"
            />
          </div>

        </div>
      </Dialog>
    </div>
  )
}
