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
    '/propuestas/:path*',
    '/casos-negocio/:path*',
    '/empleados/:path*',
    '/tarifarios/:path*',
    '/usuarios/:path*',
    '/perfiles/:path*',
    '/configuracion/:path*',
    '/perfil/:path*',
  ],
}
