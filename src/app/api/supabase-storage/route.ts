import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      throw error;
    }
    
    return Response.json({
      buckets: buckets?.map(b => b.name) || [],
      message: 'Supabase storage buckets retrieved successfully'
    });
  } catch (error) {
    console.error('Supabase storage error:', error);
    return Response.json({ 
      error: 'Failed to retrieve Supabase storage buckets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
