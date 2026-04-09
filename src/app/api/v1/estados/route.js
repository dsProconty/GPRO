import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const estados = await prisma.estado.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json({ success: true, data: estados, message: '' })
}
