'use client'
// src/components/providers.jsx
// SessionProvider necesita ser client component
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
