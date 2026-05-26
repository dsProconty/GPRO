'use client'
// Drop-in wrapper de PrimeReact InputTextarea que convierte el valor a minúsculas en tiempo real.
import { InputTextarea as PrInputTextarea } from 'primereact/inputtextarea'

export function InputTextarea({ onChange, ...props }) {
  const handleChange = (e) => {
    e.target.value = e.target.value.toLowerCase()
    onChange?.(e)
  }
  return <PrInputTextarea {...props} onChange={handleChange} style={{ textTransform: 'lowercase', ...props.style }} />
}
