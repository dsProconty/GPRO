// middleware.js (en la raíz del proyecto)
// ─────────────────────────────────────────────────────────────────────────────
// Protege todas las rutas del dashboard con NextAuth
// Equivalente al middleware auth de Laravel
// ─────────────────────────────────────────────────────────────────────────────

export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/proyectos/:path*',
    '/empresas/:path*',
    '/clientes/:path*',
    '/facturas/:path*',
  ],
}
