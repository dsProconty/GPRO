// src/app/layout.jsx
import { Providers } from '@/components/providers'

// PrimeReact estilos globales
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

export const metadata = {
  title: 'GPRO - Gestor de Proyectos',
  description: 'Sistema de gestión de proyectos - Proconty',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
