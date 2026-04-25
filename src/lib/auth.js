// src/lib/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// Configuración de NextAuth - Equivalente a Laravel Sanctum del doc técnico
// Usa CredentialsProvider con email/password hasheado con bcrypt
// Sprint 11: carga permisos y estadosProyectoEditables del perfilUsuario en JWT
// ─────────────────────────────────────────────────────────────────────────────

import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email'    },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email y contraseña son requeridos')
        }

        // Buscar usuario en DB incluyendo su perfil de acceso (Sprint 11)
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { perfilUsuario: { select: { permisos: true, estadosProyectoEditables: true } } },
        })

        if (!user) {
          throw new Error('Credenciales incorrectas')
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)

        if (!passwordMatch) {
          throw new Error('Credenciales incorrectas')
        }

        // Retornar objeto usuario (se guarda en el token JWT)
        return {
          id:                      user.id.toString(),
          name:                    user.name,
          email:                   user.email,
          role:                    user.role,
          perfilUsuarioId:         user.perfilUsuarioId,
          permisos:                user.perfilUsuario?.permisos ?? [],
          estadosProyectoEditables: user.perfilUsuario?.estadosProyectoEditables ?? null,
        }
      },
    }),
  ],

  callbacks: {
    // Agrega id, role y permisos al JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id                      = user.id
        token.role                    = user.role
        token.perfilUsuarioId         = user.perfilUsuarioId
        token.permisos                = user.permisos
        token.estadosProyectoEditables = user.estadosProyectoEditables
      }
      return token
    },
    // Expone id, role y permisos en la sesión del cliente
    async session({ session, token }) {
      if (token) {
        session.user.id                      = token.id
        session.user.role                    = token.role
        session.user.perfilUsuarioId         = token.perfilUsuarioId
        session.user.permisos                = token.permisos ?? []
        session.user.estadosProyectoEditables = token.estadosProyectoEditables ?? null
      }
      return session
    },
  },

  pages: {
    signIn: '/login',  // Redirige a nuestra pantalla de login custom
    error:  '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60, // 8 horas (jornada laboral)
  },

  secret: process.env.NEXTAUTH_SECRET,
}
