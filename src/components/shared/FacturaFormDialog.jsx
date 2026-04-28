'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Calendar } from 'primereact/calendar'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import { facturaService } from '@/services/facturaService'

export default function FacturaFormDialog({ visible, onHide, onSave, factura, proyectoId }) {
  const toast = useRef(null)

  const emptyForm = {
    numFactura: '',
    ordenCompra: '',
    valor: 0,
    fechaFactura: new Date(),
    observacion: '',
  }

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (factura) {
        setForm({
          numFactura: factura.numFactura || '',
          ordenCompra: factura.ordenCompra || '',
          valor: Number(factura.valor) || 0,
          fechaFactura: factura.fechaFactura ? new Date(factura.fechaFactura) : null,
          observacion: factura.observacion || '',
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
    }
  }, [factura, visible])

  const validate = () => {
    const e = {}
    if (!form.numFactura.trim()) e.numFactura = 'Requerido'
    else if (!/^\d{3}-\d{3}-\d{7,9}$/.test(form.numFactura.trim())) e.numFactura = 'Formato: 001-001-0000000(00)'
    if (!form.valor || form.valor <= 0) e.valor = 'Debe ser mayor a 0'
    if (!form.fechaFactura) e.fechaFactura = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        proyectoId,
        fechaFactura: form.fechaFactura?.toISOString().split('T')[0],
      }
      if (factura) {
        await facturaService.update(factura.id, payload)
      } else {
        await facturaService.create(payload)
      }
      onSave()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al guardar la factura'
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
        header={factura ? 'Editar Factura' : 'Nueva Factura'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '560px' }}
        modal
        closable={!loading}
      >
        <div className="flex flex-column gap-3 pt-2">

          {/* Nº Factura + OC */}
          <div className="grid">
            <div className="col-7">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Nº Factura (SRI) <span className="text-red-500">*</span></label>
                <InputText
                  value={form.numFactura}
                  onChange={(e) => setForm({ ...form, numFactura: e.target.value })}
                  className={`w-full ${errors.numFactura ? 'p-invalid' : ''}`}
                  placeholder="001-001-000000000"
                />
                {errors.numFactura && <small className="p-error">{errors.numFactura}</small>}
              </div>
            </div>
            <div className="col-5">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Orden de Compra</label>
                <InputText
                  value={form.ordenCompra}
                  onChange={(e) => setForm({ ...form, ordenCompra: e.target.value })}
                  className="w-full"
                  placeholder="OC-XXX (opcional)"
                />
              </div>
            </div>
          </div>

          {/* Valor + Fecha */}
          <div className="grid">
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Valor (USD) <span className="text-red-500">*</span></label>
                <InputNumber
                  value={form.valor}
                  onValueChange={(e) => setForm({ ...form, valor: e.value ?? 0 })}
                  mode="currency"
                  currency="USD"
                  locale="es-EC"
                  className={`w-full ${errors.valor ? 'p-invalid' : ''}`}
                  minFractionDigits={2}
                />
                {errors.valor && <small className="p-error">{errors.valor}</small>}
              </div>
            </div>
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Fecha de Factura <span className="text-red-500">*</span></label>
                <Calendar
                  value={form.fechaFactura}
                  onChange={(e) => setForm({ ...form, fechaFactura: e.value })}
                  className={`w-full ${errors.fechaFactura ? 'p-invalid' : ''}`}
                  dateFormat="dd/mm/yy"
                  showIcon
                  placeholder="dd/mm/aaaa"
                />
                {errors.fechaFactura && <small className="p-error">{errors.fechaFactura}</small>}
              </div>
            </div>
          </div>

          {/* Observación */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Observación</label>
            <InputTextarea
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              className="w-full"
              rows={3}
              placeholder="Observaciones (opcional)"
            />
          </div>

        </div>
      </Dialog>
    </>
  )
}
