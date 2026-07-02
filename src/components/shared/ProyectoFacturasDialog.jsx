'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import FacturaFormDialog from '@/components/shared/FacturaFormDialog'
import PagoFormDialog from '@/components/shared/PagoFormDialog'
import { facturaService } from '@/services/facturaService'
import { pagoService } from '@/services/pagoService'
import { formatCurrency, formatDate } from '@/utils/format'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

export default function ProyectoFacturasDialog({ visible, onHide, proyecto }) {
  const toast = useRef(null)
  const { puede } = usePermisos()

  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState({})

  const [facturaDialogVisible, setFacturaDialogVisible] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState(null)
  const [pagoDialogVisible, setPagoDialogVisible] = useState(false)
  const [selectedPago, setSelectedPago] = useState(null)
  const [facturaParaPago, setFacturaParaPago] = useState(null)

  useEffect(() => {
    if (visible && proyecto?.id) loadFacturas()
    else setFacturas([])
  }, [visible, proyecto?.id])

  const loadFacturas = async () => {
    setLoading(true)
    try {
      const res = await facturaService.getAll({ proyecto_id: proyecto.id })
      setFacturas(res.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error cargando facturas', life: 3000 })
    } finally {
      setLoading(false)
    }
  }

  const openNewFactura = () => { setSelectedFactura(null); setFacturaDialogVisible(true) }
  const openEditFactura = (f) => { setSelectedFactura(f); setFacturaDialogVisible(true) }

  const handleSaveFactura = () => {
    setFacturaDialogVisible(false)
    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Factura guardada', life: 3000 })
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
      accept: async () => {
        try {
          await facturaService.remove(f.id)
          toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Factura eliminada', life: 3000 })
          loadFacturas()
        } catch (err) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  const openNewPago = (factura) => { setFacturaParaPago(factura); setSelectedPago(null); setPagoDialogVisible(true) }
  const openEditPago = (pago, factura) => { setFacturaParaPago(factura); setSelectedPago(pago); setPagoDialogVisible(true) }

  const handleSavePago = () => {
    setPagoDialogVisible(false)
    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Pago guardado', life: 3000 })
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
      accept: async () => {
        try {
          await pagoService.remove(pago.id)
          toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Pago eliminado', life: 3000 })
          loadFacturas()
        } catch {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar el pago', life: 4000 })
        }
      },
    })
  }

  const rowExpansionTemplate = (factura) => (
    <div className="p-3 surface-50 border-round">
      <div className="flex justify-content-between align-items-center mb-2">
        <span className="font-semibold text-sm"><i className="pi pi-credit-card mr-2" />Pagos registrados</span>
        {puede(PERMISOS.PAGOS.CREAR) && (
          <Button label="Registrar pago" icon="pi pi-plus" size="small" severity="success" outlined
            onClick={() => openNewPago(factura)} disabled={factura.saldo <= 0.001} />
        )}
      </div>
      {factura.pagos.length === 0 ? (
        <p className="text-color-secondary text-sm m-0">Sin pagos registrados.</p>
      ) : (
        <DataTable value={factura.pagos} size="small" stripedRows>
          <Column field="id" header="ID" style={{ width: '60px' }} />
          <Column header="Fecha" body={(p) => formatDate(p.fecha)} />
          <Column header="Valor" body={(p) => formatCurrency(Number(p.valor))} style={{ textAlign: 'right' }} />
          <Column field="observacion" header="Observación" body={(p) => p.observacion || '—'} />
          <Column header="Acciones" style={{ width: '100px' }} body={(p) => (
            <div className="flex gap-1">
              {puede(PERMISOS.PAGOS.EDITAR) && (
                <Button icon="pi pi-pencil" rounded text severity="info" size="small" onClick={() => openEditPago(p, factura)} />
              )}
              {puede(PERMISOS.PAGOS.ELIMINAR) && (
                <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => confirmDeletePago(p)} />
              )}
            </div>
          )} />
        </DataTable>
      )}
    </div>
  )

  const totalFacturado = facturas.reduce((s, f) => s + Number(f.valor), 0)
  const totalPagado = facturas.reduce((s, f) => s + Number(f.totalPagos), 0)
  const totalSaldo = totalFacturado - totalPagado

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />

      <Dialog
        header={
          <div className="flex align-items-center gap-2">
            <i className="pi pi-file" />
            <span>Facturas — {proyecto?.detalle}</span>
            {proyecto?.codigo && (
              <span className="text-sm font-normal text-color-secondary"
                style={{ fontFamily: 'monospace', background: 'var(--surface-100)', padding: '2px 8px', borderRadius: '4px' }}>
                {proyecto.codigo}
              </span>
            )}
          </div>
        }
        visible={visible}
        onHide={onHide}
        style={{ width: '900px' }}
        modal
        maximizable
      >
        {/* Resumen financiero compacto */}
        <div className="flex gap-3 mb-3">
          {[
            { label: 'Facturado', value: totalFacturado, color: '#2563eb' },
            { label: 'Pagado', value: totalPagado, color: '#16a34a' },
            { label: 'Saldo', value: totalSaldo, color: totalSaldo > 0.001 ? '#dc2626' : '#16a34a' },
          ].map((k) => (
            <div key={k.label} className="flex-1 surface-100 border-round p-3 text-center">
              <div className="text-xs text-color-secondary mb-1" style={{ textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{k.label}</div>
              <div className="font-bold text-lg" style={{ color: k.color }}>{formatCurrency(k.value)}</div>
            </div>
          ))}
        </div>

        {/* Barra de acciones */}
        <div className="flex justify-content-between align-items-center mb-2">
          <span className="text-color-secondary text-sm">{facturas.length} factura(s)</span>
          {puede(PERMISOS.FACTURAS.CREAR) && (
            <Button label="Nueva Factura" icon="pi pi-plus" size="small" onClick={openNewFactura} />
          )}
        </div>

        {loading ? (
          <div className="flex justify-content-center p-4"><ProgressSpinner style={{ width: '40px', height: '40px' }} /></div>
        ) : (
          <DataTable
            value={facturas}
            expandedRows={expandedRows}
            onRowToggle={(e) => setExpandedRows(e.data)}
            rowExpansionTemplate={rowExpansionTemplate}
            dataKey="id"
            emptyMessage="No hay facturas registradas para este proyecto."
            stripedRows
          >
            <Column expander style={{ width: '3rem' }} />
            <Column field="numFactura" header="Nº Factura" sortable />
            <Column field="ordenCompra" header="OC" body={(row) => row.ordenCompra || '—'} />
            <Column header="Fecha" body={(row) => formatDate(row.fechaFactura)} sortable sortField="fechaFactura" />
            <Column header="Valor" body={(row) => formatCurrency(row.valor)} sortable sortField="valor" style={{ textAlign: 'right' }} />
            <Column header="Pagado" body={(row) => formatCurrency(row.totalPagos)} style={{ textAlign: 'right' }} />
            <Column header="Saldo" style={{ textAlign: 'right' }} body={(row) => (
              <span style={{ color: row.saldo > 0.001 ? 'var(--red-500)' : 'var(--green-500)', fontWeight: 600 }}>
                {formatCurrency(row.saldo)}
              </span>
            )} />
            <Column header="Acciones" style={{ width: '120px' }} body={(row) => (
              <div className="flex gap-1">
                {puede(PERMISOS.PAGOS.CREAR) && (
                  <Button icon="pi pi-plus" rounded text severity="success" tooltip="Registrar pago" tooltipOptions={{ position: 'top' }}
                    onClick={() => openNewPago(row)} disabled={row.saldo <= 0.001} />
                )}
                {puede(PERMISOS.FACTURAS.EDITAR) && (
                  <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }}
                    onClick={() => openEditFactura(row)} />
                )}
                {puede(PERMISOS.FACTURAS.ELIMINAR) && (
                  <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                    onClick={() => confirmDeleteFactura(row)} />
                )}
              </div>
            )} />
          </DataTable>
        )}
      </Dialog>

      <FacturaFormDialog
        visible={facturaDialogVisible}
        onHide={() => setFacturaDialogVisible(false)}
        onSave={handleSaveFactura}
        factura={selectedFactura}
        proyectoId={proyecto?.id}
        valorDefault={proyecto?.valorMensual ? Number(proyecto.valorMensual) : Number(proyecto?.valor ?? 0)}
      />

      <PagoFormDialog
        visible={pagoDialogVisible}
        onHide={() => setPagoDialogVisible(false)}
        onSave={handleSavePago}
        pago={selectedPago}
        factura={facturaParaPago}
      />
    </>
  )
}
