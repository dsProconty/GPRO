'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import { ProgressBar } from 'primereact/progressbar'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { proyectoService } from '@/services/proyectoService'
import { facturaService } from '@/services/facturaService'
import { pagoService } from '@/services/pagoService'
import { formatCurrency, formatDate, calcTiempoVida } from '@/utils/format'
import FacturaFormDialog from '@/components/shared/FacturaFormDialog'
import PagoFormDialog from '@/components/shared/PagoFormDialog'

const ESTADO_CONFIG = {
  Prefactibilidad:       { severity: 'warning',   label: 'Prefactibilidad' },
  Elaboracion_Propuesta: { severity: 'info',       label: 'Elab. Propuesta' },
  Adjudicado:            { severity: 'success',    label: 'Adjudicado' },
  Rechazado:             { severity: 'danger',     label: 'Rechazado' },
  Cerrado:               { severity: 'secondary',  label: 'Cerrado' },
}

export default function ProyectoDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const id = parseInt(params.id)

  const [proyecto, setProyecto] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [loadingProyecto, setLoadingProyecto] = useState(true)
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [expandedRows, setExpandedRows] = useState(null)

  // Dialogs
  const [facturaDialogVisible, setFacturaDialogVisible] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState(null)
  const [pagoDialogVisible, setPagoDialogVisible] = useState(false)
  const [selectedPago, setSelectedPago] = useState(null)
  const [facturaParaPago, setFacturaParaPago] = useState(null)

  useEffect(() => {
    loadProyecto()
    loadFacturas()
  }, [id])

  const loadProyecto = async () => {
    setLoadingProyecto(true)
    try {
      const res = await proyectoService.getById(id)
      setProyecto(res.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el proyecto', life: 4000 })
    } finally {
      setLoadingProyecto(false)
    }
  }

  const loadFacturas = async () => {
    setLoadingFacturas(true)
    try {
      const res = await facturaService.getAll({ proyecto_id: id })
      setFacturas(res.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las facturas', life: 4000 })
    } finally {
      setLoadingFacturas(false)
    }
  }

  // Resumen financiero calculado desde facturas (reactivo)
  const resumen = useMemo(() => {
    const facturado = facturas.reduce((s, f) => s + f.valor, 0)
    const pagado = facturas.reduce((s, f) => s + f.totalPagos, 0)
    const saldo = facturado - pagado
    const valorContrato = proyecto ? Number(proyecto.valor) : 0
    const pctFacturado = valorContrato > 0 ? Math.min(100, Math.round((facturado / valorContrato) * 100)) : 0
    const pctPagado = facturado > 0 ? Math.min(100, Math.round((pagado / facturado) * 100)) : 0
    return { facturado, pagado, saldo, pctFacturado, pctPagado }
  }, [facturas, proyecto])

  // === Facturas ===
  const openNewFactura = () => { setSelectedFactura(null); setFacturaDialogVisible(true) }
  const openEditFactura = (f) => { setSelectedFactura(f); setFacturaDialogVisible(true) }

  const handleSaveFactura = () => {
    setFacturaDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Factura guardada', life: 3000 })
    loadFacturas()
  }

  const confirmDeleteFactura = (f) => {
    confirmDialog({
      message: `¿Eliminar la factura "${f.numFactura}"? Se eliminarán también sus pagos.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => handleDeleteFactura(f.id),
    })
  }

  const handleDeleteFactura = async (facturaId) => {
    try {
      await facturaService.remove(facturaId)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Factura eliminada', life: 3000 })
      loadFacturas()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar la factura'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

  // === Pagos ===
  const openNewPago = (factura) => { setFacturaParaPago(factura); setSelectedPago(null); setPagoDialogVisible(true) }
  const openEditPago = (pago, factura) => { setFacturaParaPago(factura); setSelectedPago(pago); setPagoDialogVisible(true) }

  const handleSavePago = () => {
    setPagoDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Pago guardado', life: 3000 })
    loadFacturas()
  }

  const confirmDeletePago = (pago) => {
    confirmDialog({
      message: `¿Eliminar el pago de ${formatCurrency(pago.valor)}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => handleDeletePago(pago.id),
    })
  }

  const handleDeletePago = async (pagoId) => {
    try {
      await pagoService.remove(pagoId)
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Pago eliminado', life: 3000 })
      loadFacturas()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al eliminar el pago'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    }
  }

  // === Templates columnas facturas ===
  const facturaValorTemplate = (row) => formatCurrency(row.valor)
  const facturaPagadoTemplate = (row) => formatCurrency(row.totalPagos)
  const facturaSaldoTemplate = (row) => (
    <span style={{ color: row.saldo > 0.001 ? 'var(--red-500)' : 'var(--green-500)', fontWeight: 600 }}>
      {formatCurrency(row.saldo)}
    </span>
  )
  const facturaFechaTemplate = (row) => formatDate(row.fechaFactura)
  const facturaAccionesTemplate = (row) => (
    <div className="flex gap-1">
      <Button icon="pi pi-plus" rounded text severity="success" tooltip="Registrar pago" tooltipOptions={{ position: 'top' }} onClick={() => openNewPago(row)} disabled={row.saldo <= 0.001} />
      <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar factura" tooltipOptions={{ position: 'top' }} onClick={() => openEditFactura(row)} />
      <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar factura" tooltipOptions={{ position: 'top' }} onClick={() => confirmDeleteFactura(row)} />
    </div>
  )

  // === Sub-tabla de pagos (row expansion) ===
  const rowExpansionTemplate = (factura) => (
    <div className="p-3 surface-50 border-round">
      <div className="flex justify-content-between align-items-center mb-2">
        <span className="font-semibold text-sm"><i className="pi pi-credit-card mr-2" />Pagos registrados</span>
        <Button
          label="Registrar pago"
          icon="pi pi-plus"
          size="small"
          severity="success"
          outlined
          onClick={() => openNewPago(factura)}
          disabled={factura.saldo <= 0.001}
        />
      </div>
      {factura.pagos.length === 0 ? (
        <p className="text-color-secondary text-sm m-0">Sin pagos registrados para esta factura.</p>
      ) : (
        <DataTable value={factura.pagos} size="small" stripedRows>
          <Column field="id" header="ID" style={{ width: '60px' }} />
          <Column header="Fecha" body={(p) => formatDate(p.fecha)} />
          <Column header="Valor" body={(p) => formatCurrency(Number(p.valor))} style={{ textAlign: 'right' }} />
          <Column field="observacion" header="Observación" body={(p) => p.observacion || '—'} />
          <Column
            header="Acciones"
            style={{ width: '100px' }}
            body={(p) => (
              <div className="flex gap-1">
                <Button icon="pi pi-pencil" rounded text severity="info" size="small" tooltip="Editar" onClick={() => openEditPago(p, factura)} />
                <Button icon="pi pi-trash" rounded text severity="danger" size="small" tooltip="Eliminar" onClick={() => confirmDeletePago(p)} />
              </div>
            )}
          />
        </DataTable>
      )}
    </div>
  )

  if (loadingProyecto) return (
    <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <ProgressSpinner />
    </div>
  )

  if (!proyecto) return (
    <div className="p-4">
      <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/proyectos')} />
      <p className="mt-3 text-color-secondary">Proyecto no encontrado.</p>
    </div>
  )

  const estadoCfg = ESTADO_CONFIG[proyecto.estado?.nombre] || { severity: 'secondary', label: proyecto.estado?.nombre }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Breadcrumb */}
      <div className="flex align-items-center gap-2 mb-4">
        <Button label="Proyectos" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/proyectos')} />
        <i className="pi pi-angle-right text-color-secondary" />
        <span className="text-900 font-semibold">{proyecto.detalle}</span>
      </div>

      <div className="grid">
        {/* Info principal */}
        <div className="col-12 lg:col-8">
          <Card className="mb-3">
            <div className="mb-3">
              <h2 className="text-2xl font-bold m-0 mb-2">{proyecto.detalle}</h2>
              <div className="flex gap-2 align-items-center flex-wrap">
                <Tag value={estadoCfg.label} severity={estadoCfg.severity} />
                <span className="text-color-secondary"><i className="pi pi-building mr-1" />{proyecto.empresa?.nombre}</span>
                <span className="text-color-secondary"><i className="pi pi-clock mr-1" />{calcTiempoVida(proyecto.fechaCreacion, proyecto.fechaCierre)}</span>
              </div>
            </div>
            <div className="grid text-sm">
              <div className="col-6"><span className="text-color-secondary">Fecha inicio:</span> <strong>{formatDate(proyecto.fechaCreacion)}</strong></div>
              <div className="col-6"><span className="text-color-secondary">Fecha cierre:</span> <strong>{formatDate(proyecto.fechaCierre)}</strong></div>
              {proyecto.projectOnline && (
                <div className="col-12">
                  <span className="text-color-secondary">URL:</span>{' '}
                  <a href={proyecto.projectOnline} target="_blank" rel="noopener noreferrer" className="text-primary">{proyecto.projectOnline}</a>
                </div>
              )}
            </div>
          </Card>

          {/* Contactos y Responsables */}
          <Card>
            <div className="grid">
              <div className="col-6">
                <p className="font-semibold mb-2"><i className="pi pi-users mr-2" />Contactos / PMs</p>
                {proyecto.clientes.length === 0
                  ? <p className="text-color-secondary text-sm">Sin contactos asignados</p>
                  : proyecto.clientes.map((c) => (
                      <div key={c.clienteId} className="text-sm mb-1">
                        <i className="pi pi-user mr-1 text-color-secondary" />
                        {c.cliente.nombre} {c.cliente.apellido}
                      </div>
                    ))}
              </div>
              <div className="col-6">
                <p className="font-semibold mb-2"><i className="pi pi-briefcase mr-2" />Responsables Proconty</p>
                {proyecto.responsables.length === 0
                  ? <p className="text-color-secondary text-sm">Sin responsables asignados</p>
                  : proyecto.responsables.map((r) => (
                      <div key={r.userId} className="text-sm mb-1">
                        <i className="pi pi-user mr-1 text-color-secondary" />
                        {r.user.name}
                      </div>
                    ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Resumen Financiero */}
        <div className="col-12 lg:col-4">
          <Card title="Resumen Financiero">
            <div className="flex flex-column gap-3">
              <div className="flex justify-content-between">
                <span className="text-color-secondary">Valor contrato</span>
                <strong>{formatCurrency(proyecto.valor)}</strong>
              </div>
              <div className="flex justify-content-between">
                <span className="text-color-secondary">Facturado</span>
                <strong>{formatCurrency(resumen.facturado)}</strong>
              </div>
              <div className="mb-1">
                <div className="flex justify-content-between mb-1">
                  <span className="text-xs text-color-secondary">% Facturado</span>
                  <span className="text-xs font-semibold">{resumen.pctFacturado}%</span>
                </div>
                <ProgressBar value={resumen.pctFacturado} showValue={false} style={{ height: '6px' }} />
              </div>
              <div className="flex justify-content-between">
                <span className="text-color-secondary">Pagado</span>
                <strong>{formatCurrency(resumen.pagado)}</strong>
              </div>
              <div className="mb-1">
                <div className="flex justify-content-between mb-1">
                  <span className="text-xs text-color-secondary">% Cobrado</span>
                  <span className="text-xs font-semibold">{resumen.pctPagado}%</span>
                </div>
                <ProgressBar value={resumen.pctPagado} showValue={false} style={{ height: '6px' }} color="var(--green-500)" />
              </div>
              <hr className="my-1" />
              <div className="flex justify-content-between">
                <span className="font-semibold">Saldo pendiente</span>
                <strong style={{ color: resumen.saldo > 0.001 ? 'var(--red-500)' : 'var(--green-500)' }}>
                  {formatCurrency(resumen.saldo)}
                </strong>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Facturas */}
      <Card className="mt-3">
        <div className="flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="m-0 font-semibold"><i className="pi pi-file mr-2" />Facturas</h3>
            <p className="text-color-secondary text-sm mt-1 mb-0">{facturas.length} factura(s)</p>
          </div>
          <Button label="Nueva Factura" icon="pi pi-plus" onClick={openNewFactura} />
        </div>

        <DataTable
          value={facturas}
          loading={loadingFacturas}
          expandedRows={expandedRows}
          onRowToggle={(e) => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate}
          dataKey="id"
          emptyMessage="No hay facturas registradas"
          stripedRows
        >
          <Column expander style={{ width: '3rem' }} />
          <Column field="id" header="ID" style={{ width: '60px' }} />
          <Column field="numFactura" header="Nº Factura" sortable />
          <Column field="ordenCompra" header="OC" body={(row) => row.ordenCompra || '—'} />
          <Column header="Fecha" body={facturaFechaTemplate} sortable sortField="fechaFactura" />
          <Column header="Valor" body={facturaValorTemplate} sortable sortField="valor" style={{ textAlign: 'right' }} />
          <Column header="Pagado" body={facturaPagadoTemplate} style={{ textAlign: 'right' }} />
          <Column header="Saldo" body={facturaSaldoTemplate} style={{ textAlign: 'right' }} />
          <Column header="Acciones" body={facturaAccionesTemplate} style={{ width: '130px' }} />
        </DataTable>
      </Card>

      {/* Dialogs */}
      <FacturaFormDialog
        visible={facturaDialogVisible}
        onHide={() => setFacturaDialogVisible(false)}
        onSave={handleSaveFactura}
        factura={selectedFactura}
        proyectoId={id}
      />

      <PagoFormDialog
        visible={pagoDialogVisible}
        onHide={() => setPagoDialogVisible(false)}
        onSave={handleSavePago}
        pago={selectedPago}
        factura={facturaParaPago}
      />
    </div>
  )
}
