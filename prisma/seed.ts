// prisma/seed.ts
// Fix the missing slug field and other required fields

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo company with all required fields
  const demoCompany = await prisma.companies.upsert({
    where: { id: 'demo-company' },
    update: {},
    create: {
      id: 'demo-company',
      name: 'Demo Construction Company',
      nameEs: 'Empresa de Construcción Demo',
      slug: 'demo-company', // Add required slug field
      status: 'ACTIVE', // Add required status field
    },
  });

  // Create Forma company
  const formaCompany = await prisma.companies.upsert({
    where: { slug: 'forma' },
    update: {},
    create: {
      name: 'Forma',
      nameEs: 'Forma',
      slug: 'forma',
      status: 'ACTIVE',
    },
  });

  // Hash passwords
  const hashedPassword = await bcrypt.hash('password123', 12);
  const formaPassword = await bcrypt.hash('Forma2026', 12);

  // Primary user: ffranco@forma.gt
  await prisma.people.upsert({
    where: { email: 'ffranco@forma.gt' },
    update: { password: formaPassword },
    create: {
      email: 'ffranco@forma.gt',
      name: 'ffranco',
      password: formaPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      companyId: formaCompany.id,
    },
  });

  // PersonTenant for ffranco
  const ffranco = await prisma.people.findUnique({ where: { email: 'ffranco@forma.gt' } });
  if (ffranco) {
    await prisma.personTenants.upsert({
      where: {
        personId_companyId_startDate: {
          personId: ffranco.id,
          companyId: formaCompany.id,
          startDate: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      update: {},
      create: {
        personId: ffranco.id,
        companyId: formaCompany.id,
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
  }

  // Create demo users with all required fields
  const demoUsers = [
    {
      id: 'demo-worker',
      email: 'worker@demo.com',
      name: 'Juan Ejemplo',
      password: hashedPassword,
      role: 'WORKER' as const,
      status: 'ACTIVE' as const,
      companyId: demoCompany.id,
    },
    {
      id: 'demo-supervisor',
      email: 'supervisor@demo.com',
      name: 'María Ejemplo',
      password: hashedPassword,
      role: 'SUPERVISOR' as const,
      status: 'ACTIVE' as const,
      companyId: demoCompany.id,
    },
    {
      id: 'demo-admin',
      email: 'admin@demo.com',
      name: 'Carlos Ejemplo',
      password: hashedPassword,
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      companyId: demoCompany.id,
    },
    {
      id: 'demo-superuser',
      email: 'superuser@demo.com',
      name: 'Ana Ejemplo',
      password: hashedPassword,
      role: 'SUPERUSER' as const,
      status: 'ACTIVE' as const,
      companyId: demoCompany.id,
    },
  ];

  for (const userData of demoUsers) {
    await prisma.people.upsert({
      where: { id: userData.id },
      update: { name: userData.name },
      create: userData,
    });
  }

  // Create demo projects
  const demoProjects = [
    {
      id: 'demo-project-1',
      name: 'Downtown Office Complex',
      nameEs: 'Complejo de Oficinas Centro',
      description: 'Modern office building construction',
      descriptionEs: 'Construcción de edificio de oficinas moderno',
      status: 'ACTIVE' as const,
      companyId: demoCompany.id,
    },
    {
      id: 'demo-project-2',
      name: 'Residential Tower A',
      nameEs: 'Torre Residencial A',
      description: 'High-rise residential construction',
      descriptionEs: 'Construcción de torre residencial',
      status: 'ACTIVE' as const,
      companyId: demoCompany.id,
    },
  ];

  for (const projectData of demoProjects) {
    await prisma.projects.upsert({
      where: { id: projectData.id },
      update: {},
      create: projectData,
    });
  }

  // Create PersonTenants relationships for all users
  for (const userData of demoUsers) {
    await prisma.personTenants.upsert({
      where: { 
        personId_companyId_startDate: {
          personId: userData.id,
          companyId: demoCompany.id,
          startDate: new Date()
        }
      },
      update: {},
      create: {
        personId: userData.id,
        companyId: demoCompany.id,
        startDate: new Date(),
        status: 'ACTIVE'
      },
    });
  }

  // Create PersonProjects relationships for all users
  for (const userData of demoUsers) {
    for (const projectData of demoProjects) {
      await prisma.personProjects.upsert({
        where: {
          personId_projectId_startDate: {
            personId: userData.id,
            projectId: projectData.id,
            startDate: new Date()
          }
        },
        update: {},
        create: {
          personId: userData.id,
          projectId: projectData.id,
          startDate: new Date(),
          status: 'ACTIVE'
        },
      });
    }
  }

  console.log('✅ Seed data created successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });