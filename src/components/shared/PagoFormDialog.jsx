'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputNumber } from 'primereact/inputnumber'
import { Calendar } from 'primereact/calendar'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import { pagoService } from '@/services/pagoService'
import { formatCurrency } from '@/utils/format'

export default function PagoFormDialog({ visible, onHide, onSave, pago, factura }) {
  const toast = useRef(null)

  const emptyForm = { valor: 0, fecha: null, observacion: '' }
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Saldo disponible (excluding current pago if editing)
  const saldoDisponible = factura
    ? Number(factura.valor) - factura.pagos
        .filter((p) => !pago || p.id !== pago.id)
        .reduce((s, p) => s + Number(p.valor), 0)
    : 0

  useEffect(() => {
    if (visible) {
      if (pago) {
        setForm({
          valor: Number(pago.valor) || 0,
          fecha: pago.fecha ? new Date(pago.fecha) : null,
          observacion: pago.observacion || '',
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
    }
  }, [pago, visible])

  const validate = () => {
    const e = {}
    if (!form.valor || form.valor <= 0) e.valor = 'Debe ser mayor a 0'
    else if (form.valor > saldoDisponible + 0.001) e.valor = `Máximo: ${formatCurrency(saldoDisponible)}`
    if (!form.fecha) e.fecha = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        facturaId: factura.id,
        valor: form.valor,
        fecha: form.fecha?.toISOString().split('T')[0],
        observacion: form.observacion,
      }
      if (pago) {
        await pagoService.update(pago.id, payload)
      } else {
        await pagoService.create(payload)
      }
      onSave()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al guardar el pago'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div>
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" text onClick={onHide} disabled={loading} />
      <Button label="Guardar" icon="pi pi-check" onClick={handleSubmit} loading={loading} />
    </div>
  )

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        header={pago ? 'Editar Pago' : 'Registrar Pago'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '420px' }}
        modal
        closable={!loading}
      >
        <div className="flex flex-column gap-3 pt-2">

          {/* Saldo disponible */}
          {factura && (
            <div className="surface-100 border-round p-3 text-center">
              <span className="text-color-secondary text-sm">Saldo disponible</span>
              <div className="text-2xl font-bold" style={{ color: saldoDisponible > 0 ? 'var(--primary-color)' : 'var(--green-500)' }}>
                {formatCurrency(saldoDisponible)}
              </div>
              <span className="text-xs text-color-secondary">Factura {factura.numFactura}</span>
            </div>
          )}

          {/* Valor */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Valor del pago (USD) <span className="text-red-500">*</span></label>
            <InputNumber
              value={form.valor}
              onValueChange={(e) => setForm({ ...form, valor: e.value ?? 0 })}
              mode="currency"
              currency="USD"
              locale="es-EC"
              className={`w-full ${errors.valor ? 'p-invalid' : ''}`}
              minFractionDigits={2}
              max={saldoDisponible}
            />
            {errors.valor && <small className="p-error">{errors.valor}</small>}
          </div>

          {/* Fecha */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Fecha de pago <span className="text-red-500">*</span></label>
            <Calendar
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.value })}
              className={`w-full ${errors.fecha ? 'p-invalid' : ''}`}
              dateFormat="dd/mm/yy"
              showIcon
              placeholder="dd/mm/aaaa"
            />
            {errors.fecha && <small className="p-error">{errors.fecha}</small>}
          </div>

          {/* Observación */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Observación</label>
            <InputTextarea
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              className="w-full"
              rows={2}
              placeholder="Observaciones (opcional)"
            />
          </div>

        </div>
      </Dialog>
    </>
  )
}
