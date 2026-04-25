import { redirect } from 'next/navigation'

export default function EmpresaDetalleRedirect({ params }) {
  redirect(`/clientes/${params.id}`)
}
