'use client'
import { InputTextarea as PrInputTextarea } from 'primereact/inputtextarea'

export function InputTextarea({ onChange, ...props }) {
  return <PrInputTextarea {...props} onChange={onChange} />
}
