#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure docs directory exists
const docsDir = path.join(__dirname, '..', 'docs');
const archDir = path.join(docsDir, 'architecture');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
if (!fs.existsSync(archDir)) {
  fs.mkdirSync(archDir, { recursive: true });
}

// Generate system architecture diagram
const systemArchitecture = `# Forma System Architecture

## High-Level System Overview
\`\`\`mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js App] --> B[React Components]
        B --> C[TypeScript Types]
        C --> D[Tailwind CSS]
    end
    
    subgraph "API Layer"
        E[Next.js API Routes] --> F[Authentication]
        F --> G[Authorization]
        G --> H[Rate Limiting]
    end
    
    subgraph "Data Layer"
        I[Prisma ORM] --> J[PostgreSQL]
        I --> K[In-Memory Cache]
    end
    
    subgraph "Infrastructure"
        L[Supabase PostgreSQL] --> M[Vercel Deployment]
        L --> N[Supabase Storage]
    end
    
    A --> E
    E --> I
    I --> L
\`\`\`

## Database Schema Architecture
\`\`\`mermaid
erDiagram
    Companies ||--o{ People : employs
    Companies ||--o{ Projects : owns
    Companies ||--o{ Teams : has
    Companies ||--o{ WorkLogs : tracks
    
    People ||--o{ PersonTenants : belongs_to
    People ||--o{ PersonTeams : member_of
    People ||--o{ PersonProjects : assigned_to
    People ||--o{ WorkLogs : creates
    People ||--o{ LocationUpdates : tracks
    People ||--o{ AuditLogs : generates
    
    Projects ||--o{ ProjectTeams : uses
    Projects ||--o{ WorkLogs : contains
    Projects ||--o{ TaskProjectAssignments : manages
    Projects ||--o{ ProjectMaterials : consumes
    
    Teams ||--o{ PersonTeams : includes
    Teams ||--o{ ProjectTeams : works_on
    
    People {
        string id PK
        string email UK
        string name
        string password
        enum role
        enum status
        datetime created_at
        datetime updated_at
    }
    
    Companies {
        string id PK
        string name
        string name_es
        string slug UK
        enum status
        datetime created_at
        datetime updated_at
    }
    
    Projects {
        string id PK
        string name
        string name_es
        string description
        string description_es
        string company_id FK
        enum status
        datetime created_at
        datetime updated_at
    }
\`\`\`

## Component Architecture
\`\`\`mermaid
graph LR
    subgraph "Dashboard Components"
        A[Header] --> B[Sidebar]
        B --> C[ProjectSelector]
        C --> D[RecentWorkLogs]
        D --> E[LocationTracker]
    end
    
    subgraph "Task Management"
        F[TaskList] --> G[TaskForm]
        G --> H[TaskEditForm]
        H --> I[TaskAssignmentModal]
        I --> J[TaskProgressModal]
        J --> K[TaskValidationModal]
    end
    
    subgraph "Inventory System"
        L[InventoryManager] --> M[MaterialConsumptionTracker]
        M --> N[MaterialManager]
    end
    
    subgraph "Analytics"
        O[AdvancedAnalytics] --> P[AIInsights]
    end
    
    B --> F
    B --> L
    B --> O
\`\`\`

## API Endpoint Architecture
\`\`\`mermaid
graph TD
    subgraph "Authentication"
        A1[/api/auth/...nextauth] --> A2[Login/Logout]
        A3[/api/auth/set-password] --> A4[Password Management]
        A5[/api/auth/refresh-company] --> A6[Company Context]
    end
    
    subgraph "Core Business Logic"
        B1[/api/projects] --> B2[Project CRUD]
        B3[/api/tasks] --> B4[Task Management]
        B5[/api/people] --> B6[User Management]
        B7[/api/teams] --> B8[Team Operations]
    end
    
    subgraph "Workflow Management"
        C1[/api/worklog] --> C2[Time Tracking]
        C3[/api/location] --> C4[GPS Tracking]
        C4[/api/location/batch] --> C5[Batch Updates]
    end
    
    subgraph "Inventory & Materials"
        D1[/api/materials] --> D2[Material CRUD]
        D3[/api/inventory/movements] --> D4[Stock Movements]
        D5[/api/inventory/reorder-requests] --> D6[Reorder Management]
    end
    
    subgraph "Analytics & Insights"
        E1[/api/analytics] --> E2[Business Metrics]
        E3[/api/ai-insights] --> E4[AI-Powered Analysis]
        E5[/api/analytics/superuser-stats] --> E6[System Statistics]
    end
    
    subgraph "System Operations"
        F1[/api/system-health] --> F2[Health Monitoring]
        F3[/api/cron/rate-limit-cleanup] --> F4[Maintenance Tasks]
        F5[/api/health] --> F6[Status Checks]
    end
\`\`\`

## Security Architecture
\`\`\`mermaid
graph TB
    subgraph "Authentication Layer"
        A[NextAuth.js] --> B[JWT Tokens]
        B --> C[Session Management]
        C --> D[Role-Based Access]
    end
    
    subgraph "Authorization"
        E[Role Validation] --> F[Permission Checks]
        F --> G[Route Protection]
        G --> H[API Security]
    end
    
    subgraph "Data Protection"
        I[Input Sanitization] --> J[SQL Injection Prevention]
        J --> K[Rate Limiting]
        K --> L[Audit Logging]
    end
    
    subgraph "Infrastructure Security"
        M[HTTPS Only] --> N[Environment Variables]
        N --> O[Supabase RLS]
        O --> P[Database Encryption]
    end
    
    A --> E
    E --> I
    I --> M
\`\`\`

## Deployment Architecture
\`\`\`mermaid
graph TB
    subgraph "Development"
        A[Local Development] --> B[Git Repository]
        B --> C[Feature Branches]
    end
    
    subgraph "CI/CD Pipeline"
        D[GitHub Actions] --> E[Automated Testing]
        E --> F[Build Process]
        F --> G[Deployment]
    end
    
    subgraph "Production Environment"
        H[Vercel Platform] --> I[Edge Functions]
        I --> J[Global CDN]
        J --> K[Supabase Services]
    end
    
    subgraph "Monitoring"
        L[Vercel Analytics] --> M[Error Tracking]
        M --> N[Performance Monitoring]
        N --> O[Health Checks]
    end
    
    C --> D
    G --> H
    K --> L
\`\`\`

## Technology Stack
\`\`\`mermaid
graph LR
    subgraph "Frontend"
        A[Next.js 14] --> B[React 18]
        B --> C[TypeScript]
        C --> D[Tailwind CSS]
        D --> E[Radix UI]
    end
    
    subgraph "Backend"
        F[Node.js] --> G[Prisma ORM]
        G --> H[PostgreSQL]
    
    end
    
    subgraph "Authentication"
        J[NextAuth.js] --> K[JWT]
        K --> L[bcryptjs]
    end
    
    subgraph "Infrastructure"
        M[Supabase PostgreSQL] --> N[Supabase Storage]
        N --> P[Vercel]
    end
    
    subgraph "Development Tools"
        Q[ESLint] --> R[Prettier]
        R --> S[TypeScript Compiler]
        S --> T[Prisma Studio]
    end
\`\`\`

## Data Flow Architecture
\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database
    participant C as Cache
    participant S as External Services
    
    U->>F: User Action
    F->>A: API Request
    A->>C: Check Cache
    alt Cache Hit
        C->>A: Return Cached Data
    else Cache Miss
        A->>D: Database Query
        D->>A: Return Data
        A->>C: Update Cache
    end
    A->>F: API Response
    F->>U: Update UI
    
    Note over U,S: Real-time Updates
    loop Location Tracking
        U->>F: GPS Update
        F->>A: Location API
        A->>D: Store Location
        A->>S: Notify Team
    end
\`\`\`

## Performance Optimization
\`\`\`mermaid
graph TB
    subgraph "Frontend Optimization"
        A[Code Splitting] --> B[Lazy Loading]
        B --> C[Image Optimization]
        C --> D[Bundle Analysis]
    end
    
    subgraph "Backend Optimization"
        E[Database Indexing] --> F[Query Optimization]
        F --> G[Connection Pooling]
        G --> H[Caching Strategy]
    end
    
    subgraph "Infrastructure Optimization"
        I[CDN Distribution] --> J[Edge Computing]
        J --> K[Auto-scaling]
        K --> L[Load Balancing]
    end
    
    subgraph "Monitoring & Analytics"
        M[Performance Metrics] --> N[Error Tracking]
        N --> O[User Analytics]
        O --> P[System Health]
    end
    
    A --> E
    E --> I
    I --> M
\`\`\`
`;

// Generate component dependency diagram
const componentDependencies = `# Component Dependencies

## Dashboard Component Hierarchy
\`\`\`mermaid
graph TD
    subgraph "Main Layout"
        A[layout.tsx] --> B[AuthProvider]
        A --> C[TenantProvider]
        A --> D[Toaster]
    end
    
    subgraph "Dashboard"
        E[dashboard/page.tsx] --> F[Header]
        E --> G[Sidebar]
        E --> H[ProjectSelector]
        E --> I[RecentWorkLogs]
        E --> J[LocationTracker]
        E --> K[ClockInCard]
    end
    
    subgraph "Admin Panel"
        L[admin/page.tsx] --> M[admin/people/page.tsx]
        L --> N[admin/tenants/page.tsx]
        L --> O[admin/settings/page.tsx]
    end
    
    subgraph "Task Management"
        P[tasks/page.tsx] --> Q[TaskList]
        P --> R[TaskForm]
        P --> S[TaskEditForm]
        P --> T[TaskAssignmentModal]
    end
    
    subgraph "UI Components"
        U[ui/button.tsx] --> V[ui/card.tsx]
        U --> W[ui/dialog.tsx]
        U --> X[ui/input.tsx]
        U --> Y[ui/select.tsx]
    end
    
    B --> E
    C --> E
    F --> U
    G --> U
    Q --> U
    R --> U
\`\`\`

## State Management Flow
\`\`\`mermaid
graph LR
    subgraph "Global State"
        A[Zustand Store] --> B[Tenant Context]
        B --> C[Auth Context]
    end
    
    subgraph "Component State"
        D[Local State] --> E[Form State]
        E --> F[UI State]
        F --> G[Data State]
    end
    
    subgraph "API State"
        H[API Calls] --> I[Loading States]
        I --> J[Error Handling]
        J --> K[Data Caching]
    end
    
    A --> D
    D --> H
    H --> A
\`\`\`

## Data Flow Between Components
\`\`\`mermaid
graph TB
    subgraph "User Input"
        A[Form Components] --> B[Validation]
        B --> C[State Updates]
    end
    
    subgraph "API Communication"
        C --> D[API Routes]
        D --> E[Database Operations]
        E --> F[Response Handling]
    end
    
    subgraph "UI Updates"
        F --> G[Component Re-renders]
        G --> H[State Synchronization]
        H --> I[User Feedback]
    end
    
    subgraph "Real-time Updates"
        J[WebSocket/SSE] --> K[Live Data Updates]
        K --> L[UI Synchronization]
    end
    
    A --> J
    F --> J
    L --> I
\`\`\`
`;

// Generate API documentation
const apiDocumentation = `# API Documentation

## Authentication Endpoints
\`\`\`typescript
// NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      // Custom credentials provider
    })
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      // JWT token handling
    },
    session: ({ session, token }) => {
      // Session management
    }
  }
}
\`\`\`

## Core API Routes
\`\`\`typescript
// Project management
GET    /api/projects          // List projects
POST   /api/projects          // Create project
GET    /api/projects/[id]     // Get project details
PUT    /api/projects/[id]     // Update project
DELETE /api/projects/[id]     // Delete project

// Task management
GET    /api/tasks             // List tasks
POST   /api/tasks             // Create task
GET    /api/tasks/[id]        // Get task details
PUT    /api/tasks/[id]        // Update task
DELETE /api/tasks/[id]        // Delete task

// User management
GET    /api/people            // List users
POST   /api/people            // Create user
GET    /api/people/[id]       // Get user details
PUT    /api/people/[id]       // Update user
DELETE /api/people/[id]       // Delete user

// Work logging
GET    /api/worklog           // List work logs
POST   /api/worklog           // Create work log
PUT    /api/worklog/[id]      // Update work log
\`\`\`

## Database Models
\`\`\`typescript
// Core entities
interface People {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: PersonStatus;
  companyId?: string;
}

interface Companies {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
}

interface Projects {
  id: string;
  name: string;
  companyId: string;
  status: ProjectStatus;
}

interface WorkLogs {
  id: string;
  personId: string;
  projectId: string;
  clockIn: Date;
  clockOut?: Date;
  location?: string;
  tasksCompleted: any[];
  materialsUsed: any[];
}
\`\`\`
`;

// Generate deployment and infrastructure documentation
const infrastructureDocs = `# Infrastructure & Deployment

## Environment Configuration
\`\`\`bash
# Required environment variables
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="https://your-domain.com"

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
\`\`\`

## Database Setup
\`\`\`bash
# Prisma commands
npx prisma generate          # Generate Prisma client
npx prisma db push          # Push schema to database
npx prisma migrate dev      # Create and apply migrations
npx prisma studio           # Open database GUI
\`\`\`

## Deployment Commands
\`\`\`bash
# Build and deploy
npm run build               # Build production version
npm run start               # Start production server
vercel --prod               # Deploy to Vercel production
\`\`\`

## Monitoring & Health Checks
\`\`\`typescript
// Health check endpoints
GET /api/health             // Basic health status
GET /api/system-health      // Detailed system health
GET /api/supabase-db        // Database connection status (Supabase)
GET /api/supabase-storage   // Supabase storage connection status
\`\`\`
`;

// Write all documentation files
const files = [
  { name: 'system-architecture.md', content: systemArchitecture },
  { name: 'component-dependencies.md', content: componentDependencies },
  { name: 'api-documentation.md', content: apiDocumentation },
  { name: 'infrastructure.md', content: infrastructureDocs }
];

files.forEach(file => {
  const filePath = path.join(archDir, file.name);
  fs.writeFileSync(filePath, file.content);
  console.log(`✅ Generated: ${file.name}`);
});

// Generate README for architecture docs
const architectureReadme = `# Forma Architecture Documentation

This directory contains automatically generated architecture documentation for the Forma construction management platform.

## Files

- **system-architecture.md** - High-level system overview, database schema, and component architecture
- **component-dependencies.md** - Component hierarchy and dependency relationships
- **api-documentation.md** - API endpoints and data models
- **infrastructure.md** - Deployment and infrastructure configuration

## Regeneration

To update these diagrams, run:

\`\`\`bash
npm run generate-architecture
\`\`\`

## Integration with Swark

These diagrams are generated using Swark for automated architecture documentation. The diagrams are updated automatically when the codebase changes.

## Last Updated

${new Date().toISOString()}
`;

fs.writeFileSync(path.join(archDir, 'README.md'), architectureReadme);
console.log('✅ Generated: README.md');

// Create a simple architecture overview for the main project README
const mainReadmeUpdate = `
## Architecture Documentation

Automated architecture diagrams are available in the [docs/architecture](./docs/architecture/) directory. These diagrams are generated using Swark and provide:

- System architecture overview
- Database schema relationships
- Component dependencies
- API documentation
- Infrastructure setup

To regenerate the diagrams, run:

\`\`\`bash
npm run generate-architecture
\`\`\`
`;

console.log('\n🎉 Architecture documentation generated successfully!');
console.log('📁 Files created in: docs/architecture/');
console.log('📖 Add the following to your main README.md:');
console.log(mainReadmeUpdate);
console.log('\n🚀 Next steps:');
console.log('1. Review the generated diagrams');
console.log('2. Add the README update to your main README.md');
console.log('3. Commit the changes: npm run update-architecture');
console.log('4. Set up automated regeneration in your CI/CD pipeline');
