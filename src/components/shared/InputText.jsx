'use client'
// Drop-in wrapper de PrimeReact InputText que convierte el valor a minúsculas en tiempo real.
// Campos type="password" quedan excluidos automáticamente.
import { InputText as PrInputText } from 'primereact/inputtext'

export function InputText({ onChange, type, ...props }) {
  const handleChange = (e) => {
    if (type !== 'password') {
      e.target.value = e.target.value.toLowerCase()
    }
    onChange?.(e)
  }
  return <PrInputText {...props} type={type} onChange={handleChange} style={{ textTransform: type !== 'password' ? 'lowercase' : undefined, ...props.style }} />
}
