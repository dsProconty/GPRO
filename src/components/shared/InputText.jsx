'use client'
// Drop-in wrapper de PrimeReact InputText que permite mayúscula en el primer carácter
// y fuerza minúsculas en el resto. Campos type="password" quedan excluidos.
import { InputText as PrInputText } from 'primereact/inputtext'

export function InputText({ onChange, type, ...props }) {
  const handleChange = (e) => {
    if (type !== 'password') {
      const v = e.target.value
      e.target.value = v.length > 0 ? v[0] + v.slice(1).toLowerCase() : v
    }
    onChange?.(e)
  }
  return <PrInputText {...props} type={type} onChange={handleChange} />
}
