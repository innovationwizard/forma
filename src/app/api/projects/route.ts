// src/app/api/projects/route.ts
// Projects route for CRUD operations

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  companyId: z.string().optional().transform(s => (s && s.trim().length > 0) ? s.trim() : undefined),
  status: z.enum(['ACTIVE', 'INACTIVE', 'COMPLETED']).default('ACTIVE')
})

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  companyId: z.string().optional().transform(s => (s && s.trim().length > 0) ? s.trim() : undefined),
  status: z.enum(['ACTIVE', 'INACTIVE', 'COMPLETED'])
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const prisma = await getPrisma();
    
    // Step 1: Determine company scope based on role
    let companyIds: string[] = [];
    
    if (session.user.role === 'SUPERUSER') {
      // SUPERUSER sees all projects - no company filter needed
    } else if (session.user.role === 'ADMIN') {
      // ADMIN sees projects from ALL their companies
      // First try to use session companyId if available
      if (session.user.companyId && session.user.companyId !== 'unknown' && session.user.companyId !== 'system') {
        companyIds = [session.user.companyId];
      }
      
      // Try to get additional companies from personTenants (if permissions allow)
      try {
        const personTenants = await prisma.personTenants.findMany({
          where: {
            personId: session.user.id,
            status: 'ACTIVE'
          },
          select: { companyId: true }
        });
        const tenantCompanyIds = personTenants.map(ut => ut.companyId);
        // Merge with session companyId, avoiding duplicates
        companyIds = Array.from(new Set([...companyIds, ...tenantCompanyIds]));
      } catch (error: any) {
        // If personTenants query fails (e.g., permission denied), log and continue with session companyId
        console.warn('Could not query personTenants, using session companyId:', error?.code || error?.message);
      }
      // Single-tenant fallback: use Forma company when no context available
      if (companyIds.length === 0) {
        const formaCompany = await prisma.companies.findFirst({
          where: { slug: 'forma' },
          select: { id: true }
        });
        if (formaCompany) companyIds = [formaCompany.id];
      }
    } else {
      // SUPERVISOR/WORKER sees projects from their companies
      // First try to use session companyId if available
      if (session.user.companyId && session.user.companyId !== 'unknown' && session.user.companyId !== 'system') {
        companyIds = [session.user.companyId];
      }
      
      // Try to get additional companies from personTenants (if permissions allow)
      try {
        const personTenants = await prisma.personTenants.findMany({
          where: {
            personId: session.user.id,
            status: 'ACTIVE'
          },
          select: { companyId: true }
        });
        const tenantCompanyIds = personTenants.map(ut => ut.companyId);
        // Merge with session companyId, avoiding duplicates
        companyIds = Array.from(new Set([...companyIds, ...tenantCompanyIds]));
      } catch (error: any) {
        // If personTenants query fails (e.g., permission denied), log and continue with session companyId
        console.warn('Could not query personTenants, using session companyId:', error?.code || error?.message);
      }
      // Single-tenant fallback: use Forma company when no context available
      if (companyIds.length === 0) {
        const formaCompany = await prisma.companies.findFirst({
          where: { slug: 'forma' },
          select: { id: true }
        });
        if (formaCompany) companyIds = [formaCompany.id];
      }
    }
    
    // Step 2: Build query based on role
    let whereClause: any = {};
    let assignedProjectIds: string[] | undefined = undefined;
    
    if (session.user.role === 'WORKER') {
      // WORKER can only see projects they are assigned to
      const assignedProjects = await prisma.personProjects.findMany({
        where: {
          personId: session.user.id,
          status: 'ACTIVE'
        },
        select: { projectId: true }
      });
      
      assignedProjectIds = assignedProjects.map(ap => ap.projectId);
      
      if (assignedProjectIds.length === 0) {
        return NextResponse.json({
          projects: []
        });
      }
      
      whereClause.id = { in: assignedProjectIds };
    } else if (companyIds.length > 0) {
      whereClause.companyId = { in: companyIds };
    } else if (session.user.role !== 'SUPERUSER') {
      // No companies found for non-SUPERUSER, return empty
      return NextResponse.json({
        projects: []
      });
    }
    
    const projects = await prisma.projects.findMany({
      where: whereClause,
      include: {
        company: true,
        people: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            person: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        taskAssignments: {
          include: {
            task: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    nameEs: true
                  }
                }
              }
            }
          }
        },
        workerAssignments: {
          include: {
            task: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    nameEs: true
                  }
                }
              }
            },
            worker: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({
      projects: projects
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'SUPERUSER'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createProjectSchema.parse(body)
    
    const prisma = await getPrisma()

    // Step 1: Determine current company context
    let currentCompanyId: string | undefined = session.user?.companyId
    
    // If no company in session, try to get from PersonTenant (most recent active)
    if (!currentCompanyId || currentCompanyId === 'unknown' || currentCompanyId === 'system') {
      try {
        const personTenant = await prisma.personTenants.findFirst({
          where: {
            personId: session.user?.id,
            status: 'ACTIVE'
          },
          orderBy: { createdAt: 'desc' },
          select: { companyId: true }
        })
        currentCompanyId = personTenant?.companyId || currentCompanyId || undefined
      } catch (error: any) {
        // If personTenants query fails, log and use session companyId if available
        console.warn('Could not query personTenants in POST, using session companyId:', error?.code || error?.message);
      }
    }

    // Single-tenant fallback: use Forma company when no context available
    if (!currentCompanyId || currentCompanyId === 'unknown' || currentCompanyId === 'system') {
      const formaCompany = await prisma.companies.findFirst({
        where: { slug: 'forma' },
        select: { id: true }
      })
      currentCompanyId = formaCompany?.id || currentCompanyId || undefined
    }
    
    // Step 2: Get user's role from session
    const userRole = (session.user?.role as string) || 'WORKER'
    
    // Step 3: Check permissions
    if (userRole !== 'ADMIN' && userRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
    }
    
    // Use current company context if no specific company provided
    const targetCompanyId = validatedData.companyId || currentCompanyId
    
    if (!targetCompanyId) {
      return NextResponse.json(
        { error: 'No company context available. Ensure Forma company exists (run supabase-prod-seed.sql).' },
        { status: 400 }
      )
    }
    
    // TypeScript guard to ensure targetCompanyId is string
    if (typeof targetCompanyId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid company context' },
        { status: 400 }
      )
    }

    // Check if project name already exists in the company
    const existingProject = await prisma.projects.findFirst({
      where: {
        name: validatedData.name,
        companyId: targetCompanyId
      }
    })

    if (existingProject) {
      return NextResponse.json(
        { error: 'A project with this name already exists in this company' },
        { status: 409 }
      )
    }

    
    const project = await prisma.projects.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || '',
        status: validatedData.status,
        companyId: targetCompanyId
      },
      include: {
        company: true
      }
    })
    
    // Create audit log for project creation
    await prisma.auditLogs.create({
      data: {
        personId: session.user?.id!,
        action: 'PROJECT_CREATE',
        entityType: 'PROJECT',
        entityId: project.id,
        newValues: {
          name: project.name,
          description: project.description,
          status: project.status,
          companyId: project.companyId
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      project
    })

  } catch (error) {
    console.error('Error creating project:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

// PUT - Update a project
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'SUPERUSER'].includes(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body
    const validatedData = updateProjectSchema.parse(updateData)
    
    const prisma = await getPrisma()

    // Check if admin has access to both the current and new company (if changing)
    if (session.user?.role === 'ADMIN') {
      const project = await prisma.projects.findUnique({
        where: { id },
        select: { companyId: true }
      })
      
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      // Check access to current company - use session companyId as fallback
      let hasCurrentCompanyAccess = false;
      if (session.user?.companyId === project.companyId) {
        hasCurrentCompanyAccess = true;
      } else {
        try {
          const currentCompanyAccess = await prisma.personTenants.findFirst({
            where: {
              personId: session.user?.id,
              companyId: project.companyId,
              status: 'ACTIVE'
            }
          })
          hasCurrentCompanyAccess = !!currentCompanyAccess;
        } catch (error: any) {
          console.warn('Could not verify company access via personTenants, using session companyId:', error?.code || error?.message);
          // If query fails, fall back to session companyId check
          hasCurrentCompanyAccess = session.user?.companyId === project.companyId;
        }
      }
      
      if (!hasCurrentCompanyAccess) {
        return NextResponse.json({ error: 'Unauthorized to current company' }, { status: 401 })
      }

      // If changing companies, check access to new company
      if (validatedData.companyId && validatedData.companyId !== project.companyId) {
        let hasNewCompanyAccess = false;
        if (session.user?.companyId === validatedData.companyId) {
          hasNewCompanyAccess = true;
        } else {
          try {
            const newCompanyAccess = await prisma.personTenants.findFirst({
              where: {
                personId: session.user?.id,
                companyId: validatedData.companyId,
                status: 'ACTIVE'
              }
            })
            hasNewCompanyAccess = !!newCompanyAccess;
          } catch (error: any) {
            console.warn('Could not verify new company access via personTenants, using session companyId:', error?.code || error?.message);
            // If query fails, fall back to session companyId check
            hasNewCompanyAccess = session.user?.companyId === validatedData.companyId;
          }
        }
        
        if (!hasNewCompanyAccess) {
          return NextResponse.json({ error: 'Unauthorized to new company' }, { status: 401 })
        }
      }
    }

    const updatePayload = Object.fromEntries(
      Object.entries(validatedData).filter(([_, v]) => v !== undefined)
    )

    const updatedProject = await prisma.projects.update({
      where: { id },
      data: updatePayload,
      include: {
        company: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Project updated successfully',
      project: updatedProject
    })

  } catch (error) {
    console.error('Error updating project:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}
