// src/app/api/teams/route.ts
// Production teams route for CRUD operations

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schema for team data (companyId optional for single-tenant)
const teamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters'),
  nameEs: z.string().optional(),
  description: z.string().optional(),
  companyId: z.string().optional().transform(s => (s && s.trim().length > 0) ? s.trim() : undefined),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// GET - List all teams
export async function GET() {
  try {
    const prisma = await getPrisma();
    
    const teams = await prisma.teams.findMany({
      select: {
        id: true,
        name: true,
        nameEs: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        _count: {
          select: {
            people: true,
            projects: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    await prisma.$disconnect();
    
    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// POST - Create a new team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !['ADMIN', 'SUPERUSER'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = teamSchema.parse(body);
    
    const prisma = await getPrisma();
    
    // Resolve companyId: from body, session, personTenants, or Forma fallback
    let companyId = validatedData.companyId || session.user?.companyId;
    
    if (!companyId || companyId === 'unknown' || companyId === 'system') {
      const personTenant = await prisma.personTenants.findFirst({
        where: { personId: session.user?.id, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        select: { companyId: true }
      });
      companyId = personTenant?.companyId || companyId;
    }
    
    if (!companyId || companyId === 'unknown' || companyId === 'system') {
      const formaCompany = await prisma.companies.findFirst({
        where: { slug: 'forma' },
        select: { id: true }
      });
      companyId = formaCompany?.id || companyId;
    }
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company context available' },
        { status: 400 }
      );
    }
    
    // Verify company exists
    const company = await prisma.companies.findUnique({
      where: { id: companyId }
    });
    
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }
    
    // Create team (exclude companyId from validatedData to use resolved value)
    const { companyId: _, ...teamData } = validatedData;
    const team = await prisma.teams.create({
      data: {
        ...teamData,
        companyId
      },
      select: {
        id: true,
        name: true,
        nameEs: true,
        description: true,
        status: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      team
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating team:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
