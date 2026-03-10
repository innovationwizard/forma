import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const prisma = await getPrisma();
    
    // Test database connection with a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    return Response.json({ 
      message: 'Database connection successful (Supabase)',
      result: result
    });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Database connection failed' }, { status: 500 });
  }
}
