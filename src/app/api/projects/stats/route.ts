import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const prisma = await getPrisma()
    
    // Filter projects based on user role
    let whereClause: any = {}
    
    if (session.user.role === 'SUPERUSER') {
      // SUPERUSER sees all projects
    } else if (session.user.role === 'ADMIN') {
      // ADMIN sees projects from their companies
      // First try to use session companyId if available
      let companyIds: string[] = [];
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
        })
        const tenantCompanyIds = personTenants.map(ut => ut.companyId);
        // Merge with session companyId, avoiding duplicates
        companyIds = Array.from(new Set([...companyIds, ...tenantCompanyIds]));
      } catch (error: any) {
        // If personTenants query fails (e.g., permission denied), log and continue with session companyId
        console.warn('Could not query personTenants in stats, using session companyId:', error?.code || error?.message);
      }
      
      // Single-tenant fallback: use Forma company when no context available
      if (companyIds.length === 0) {
        const formaCompany = await prisma.companies.findFirst({
          where: { slug: 'forma' },
          select: { id: true }
        });
        if (formaCompany) companyIds = [formaCompany.id];
      }
      
      if (companyIds.length > 0) {
        whereClause.companyId = { in: companyIds };
      } else {
        return NextResponse.json({ projectStats: [] });
      }
    } else if (session.user.role === 'SUPERVISOR') {
      // SUPERVISOR sees projects they are assigned to
      const personProjects = await prisma.personProjects.findMany({
        where: {
          personId: session.user.id,
          status: 'ACTIVE'
        },
        select: { projectId: true }
      })
      const projectIds = personProjects.map(pp => pp.projectId)
      whereClause.id = { in: projectIds }
    } else {
      // WORKER sees only their assigned projects
      const personProjects = await prisma.personProjects.findMany({
        where: {
          personId: session.user.id,
          status: 'ACTIVE'
        },
        select: { projectId: true }
      })
      const projectIds = personProjects.map(pp => pp.projectId)
      whereClause.id = { in: projectIds }
    }
    
    // Get filtered projects with people counts
    const projects = await prisma.projects.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        companyId: true,
        status: true
      }
    })
    
    // For each project, count active people (this is a workaround until Prisma client is fixed)
    const projectStats = await Promise.all(
      projects.map(async (project) => {
        // Count people assigned to this project via PersonProjects
        const peopleCount = await prisma.personProjects.count({
          where: {
            projectId: project.id,
            status: 'ACTIVE'
          }
        })
        
        return {
          id: project.id,
          peopleCount,
          workLogCount: 0 // Simplified for now
        }
      })
    )
    
    return NextResponse.json({ projectStats })

  } catch (error) {
    console.error('Error fetching project stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project stats' },
      { status: 500 }
    )
  }
}
