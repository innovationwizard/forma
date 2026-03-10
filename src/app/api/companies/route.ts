// src/app/api/companies/route.ts
// Production companies route for CRUD operations

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

// Validation schema for company data
const companySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  nameEs: z.string().optional(),
  slug: z.string().min(2, 'Company slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Company slug must contain only lowercase letters, numbers, and hyphens'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL']).default('ACTIVE'),
})

// GET - List companies (for superusers) or single company (for admins)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'SUPERVISOR', 'SUPERUSER'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = await getPrisma()

    // If admin or supervisor, show their companies
    if (['ADMIN', 'SUPERVISOR'].includes(session.user?.role || '')) {
      const personTenants = await prisma.personTenants.findMany({
        where: { 
          personId: session.user.id,
          status: 'ACTIVE'
        },
        include: {
          company: {
            include: {
              _count: {
                select: {
                  people: true,
                  projects: true,
                  workLogs: true
                }
              }
            }
          }
        }
      })

      const companies = personTenants.map(ut => ({
        id: ut.company.id,
        name: ut.company.name,
        nameEs: ut.company.nameEs,
        slug: ut.company.slug,
        status: ut.company.status,
        createdAt: ut.company.createdAt,
        people: ut.company._count.people,
        projects: ut.company._count.projects,
        workLogs: ut.company._count.workLogs,
      }))

      return NextResponse.json({ companies })
    }

    // If superuser, show all companies
    const companies = await prisma.companies.findMany({
      include: {
        _count: {
          select: {
            people: true,
            projects: true,
            workLogs: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedCompanies = companies.map(company => ({
      id: company.id,
      name: company.name,
      nameEs: company.nameEs,
      slug: company.slug,
      status: company.status,
      createdAt: company.createdAt,
      people: company._count.people,
      projects: company._count.projects,
      workLogs: company._count.workLogs
    }))

    return NextResponse.json({ companies: formattedCompanies })

  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

// POST - Create new company (admin and superuser)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'SUPERUSER'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = companySchema.parse(body)
    
    const prisma = await getPrisma()

    // Check if company slug already exists
    const existingCompany = await prisma.companies.findUnique({
      where: { slug: validatedData.slug }
    })
    
    if (existingCompany) {
      return NextResponse.json(
        { error: 'Company slug already exists' },
        { status: 409 }
      )
    }

          // Create company in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create company
        const company = await tx.companies.create({
          data: {
            name: validatedData.name,
            nameEs: validatedData.nameEs,
            slug: validatedData.slug,
            status: validatedData.status,
          }
        })

        // If admin is creating the company, associate them with it
        if (session.user?.role === 'ADMIN') {
          // Create PersonTenant relationship for the admin
          await tx.personTenants.create({
            data: {
              personId: session.user.id,
              companyId: company.id,
              startDate: new Date(),
              status: 'ACTIVE'
            }
          })

          // Update the admin's direct companyId to the newly created company
          // This ensures the session stays in sync with their active company
          await tx.people.update({
            where: { id: session.user.id },
            data: { companyId: company.id }
          })
        }

        return company
      })

    return NextResponse.json({
      success: true,
      message: 'Company created successfully',
      company: {
        id: result.id,
        name: result.name,
        nameEs: result.nameEs,
        slug: result.slug,
        status: result.status
      }
    })

  } catch (error) {
    console.error('Error creating company:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

// PUT - Update company
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'SUPERUSER'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body
    
    // Validate the update data
    const validatedData = companySchema.partial().parse(updateData)
    
    const prisma = await getPrisma()

    // Admin can only update companies they have access to
    if (session.user?.role === 'ADMIN') {
      const personTenant = await prisma.personTenants.findFirst({
        where: { 
          personId: session.user.id,
          companyId: id,
          status: 'ACTIVE'
        }
      })
      
      if (!personTenant) {
        return NextResponse.json({ error: 'Unauthorized - No access to this company' }, { status: 401 })
      }
    }

    // Update company
    const updatedCompany = await prisma.companies.update({
      where: { id },
      data: validatedData
    })

    return NextResponse.json({
      success: true,
      message: 'Company updated successfully',
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        nameEs: updatedCompany.nameEs,
        slug: updatedCompany.slug,
        status: updatedCompany.status
      }
    })

  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}
