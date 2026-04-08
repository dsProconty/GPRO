// src/lib/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// Configuración de NextAuth - Equivalente a Laravel Sanctum del doc técnico
// Usa CredentialsProvider con email/password hasheado con bcrypt
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

        // Buscar usuario en DB (equivalente a POST /api/auth/login en Laravel)
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
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
          id:    user.id.toString(),
          name:  user.name,
          email: user.email,
          role:  user.role,
        }
      },
    }),
  ],

  callbacks: {
    // Agrega id y role al JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role
      }
      return token
    },
    // Expone id y role en la sesión del cliente
    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id
        session.user.role = token.role
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
