'use client'

import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { useRouter } from 'next/navigation'

export default function EmpresaDetallePage({ params }) {
  const router = useRouter()

  return (
    <div className="p-4">
      <div className="mb-3">
        <Button
          label="Volver a Empresas"
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          onClick={() => router.push('/empresas')}
        />
      </div>
      <Card title={`Empresa #${params.id}`}>
        <p className="text-color-secondary">Detalle de empresa — disponible en Sprint 4.</p>
      </Card>
    </div>
  )
}
