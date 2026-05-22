import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

const handler = NextAuth(authOptions)

export function GET(req, context) {
  return handler(req, context)
}

export async function POST(req, context) {
  // Rate-limit login attempts: max 10 per IP per minute
  if (req.nextUrl.pathname.includes('/credentials')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (checkRateLimit(`login:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Demasiados intentos de acceso. Espera un minuto e intenta de nuevo.' },
        { status: 429 }
      )
    }
  }
  return handler(req, context)
}
