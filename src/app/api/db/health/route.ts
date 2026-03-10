import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const prisma = await getPrisma()
    const rows = await prisma.$queryRaw<any[]>`SELECT current_database() AS db, current_user AS user, inet_server_addr() AS host`;

    const info = Array.isArray(rows) && rows[0] ? rows[0] : { db: null, user: null, host: null }
    // Supabase default db is 'postgres'; accept forma if migrated
    const isOk = info.db === 'forma' || info.db === 'postgres'

    const body = {
      ok: isOk,
      database: info.db,
      user: info.user,
      serverAddress: info.host,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(body, { status: isOk ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Healthcheck failed' }, { status: 503 })
  }
}


