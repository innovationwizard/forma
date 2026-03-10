#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function generateEnhancedArchitecture() {
  try {
    console.log('🚀 Starting enhanced architecture generation...');
    
    // Load configuration
    const config = {
      diagrams: {
        outputDir: './docs/architecture',
        format: 'mermaid',
        includeCodeBlocks: true,
        autoUpdate: true
      }
    };
    
    // Generate additional specialized diagrams
    const additionalDiagrams = [
      {
        name: 'database-schema-detailed.md',
        content: generateDetailedDatabaseSchema()
      },
      {
        name: 'security-architecture.md',
        content: generateSecurityArchitecture()
      },
      {
        name: 'deployment-pipeline.md',
        content: generateDeploymentPipeline()
      },
      {
        name: 'monitoring-architecture.md',
        content: generateMonitoringArchitecture()
      }
    ];
    
    // Ensure output directory exists
    const archDir = path.join(__dirname, '..', 'docs', 'architecture');
    if (!fs.existsSync(archDir)) {
      fs.mkdirSync(archDir, { recursive: true });
    }
    
    // Write additional diagrams
    additionalDiagrams.forEach(diagram => {
      const filePath = path.join(archDir, diagram.name);
      fs.writeFileSync(filePath, diagram.content);
      console.log(`✅ Generated: ${diagram.name}`);
    });
    
    // Create summary report
    const summary = createSummaryReport(additionalDiagrams);
    fs.writeFileSync(path.join(archDir, 'summary.md'), summary);
    
    console.log('📊 Enhanced architecture documentation generated');
    console.log(`✅ Total files: ${additionalDiagrams.length + 1}`);
    
  } catch (error) {
    console.error('❌ Error in enhanced architecture generation:', error);
    process.exit(1);
  }
}

function generateDetailedDatabaseSchema() {
  return `# Detailed Database Schema

## Entity Relationship Diagram
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
    
    Tasks ||--o{ TaskWorkerAssignments : assigned_to
    Tasks ||--o{ TaskProgressUpdates : tracks_progress
    Tasks ||--o{ TaskProjectAssignments : belongs_to_project
    
    Materials ||--o{ MaterialConsumptions : consumed_in
    Materials ||--o{ ProjectMaterials : used_in_project
    Materials ||--o{ InventoryMovements : tracked_in
    
    Companies {
        string id PK
        string name
        string name_es
        string slug UK
        enum status
        datetime created_at
        datetime updated_at
    }
    
    People {
        string id PK
        string email UK
        string name
        string password
        enum role
        enum status
        datetime created_at
        datetime updated_at
        string company_id FK
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
    
    Teams {
        string id PK
        string name
        string name_es
        string description
        string company_id FK
        enum status
        datetime created_at
        datetime updated_at
    }
    
    Tasks {
        string id PK
        string name
        string description
        enum status
        enum priority
        datetime due_date
        datetime created_at
        datetime updated_at
    }
    
    Materials {
        string id PK
        string name
        string name_es
        string description
        string unit
        decimal unit_cost
        int min_stock_level
        int max_stock_level
        int current_stock
        datetime created_at
        datetime updated_at
    }
\`\`\`

## Database Indexes
\`\`\`sql
-- Performance optimization indexes
CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_company_id ON people(company_id);
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_worklogs_person_id ON work_logs(person_id);
CREATE INDEX idx_worklogs_project_id ON work_logs(project_id);
CREATE INDEX idx_location_updates_person_id ON location_updates(person_id);
CREATE INDEX idx_audit_logs_person_id ON audit_logs(person_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
\`\`\`

## Data Constraints
\`\`\`sql
-- Foreign key constraints
ALTER TABLE people ADD CONSTRAINT fk_people_company 
    FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE projects ADD CONSTRAINT fk_projects_company 
    FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE teams ADD CONSTRAINT fk_teams_company 
    FOREIGN KEY (company_id) REFERENCES companies(id);

-- Check constraints
ALTER TABLE people ADD CONSTRAINT chk_people_role 
    CHECK (role IN ('WORKER', 'SUPERVISOR', 'ADMIN', 'SUPERUSER'));

ALTER TABLE projects ADD CONSTRAINT chk_projects_status 
    CHECK (status IN ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'));
\`\`\`
`;
}

function generateSecurityArchitecture() {
  return `# Security Architecture

## Authentication Flow
\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as NextAuth
    participant D as Database
    
    
    U->>F: Login Request
    F->>A: Authenticate Credentials
    A->>D: Verify User
    D->>A: User Data
    A->>R: Store Session
    A->>F: JWT Token
    F->>U: Authenticated Session
    
    Note over U,R: Session Management
    loop Active Session
        U->>F: API Request
        F->>A: Validate Token
        A->>R: Check Session
        A->>F: Authorization
        F->>U: Protected Content
    end
\`\`\`

## Authorization Matrix
\`\`\`mermaid
graph TB
    subgraph "Role Hierarchy"
        A[SUPERUSER] --> B[ADMIN]
        B --> C[SUPERVISOR]
        C --> D[WORKER]
    end
    
    subgraph "Permissions"
        E[System Management] --> A
        F[Company Management] --> B
        G[Project Management] --> C
        H[Time Tracking] --> D
        I[User Management] --> B
        J[Analytics] --> C
        K[Inventory] --> C
    end
    
    subgraph "Data Access"
        L[All Data] --> A
        M[Company Data] --> B
        N[Project Data] --> C
        O[Own Data] --> D
    end
\`\`\`

## Security Measures
\`\`\`typescript
// Password Security
const hashedPassword = await bcrypt.hash(password, 12);

// JWT Configuration
export const authOptions: NextAuthOptions = {
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  }
};

// Rate Limiting
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
};
\`\`\`

## Data Protection
\`\`\`typescript
// Input Sanitization
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

// SQL Injection Prevention
const user = await prisma.people.findUnique({
  where: { id: userId }, // Parameterized query
  select: { name: true, email: true }
});

// XSS Prevention
const safeContent = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
  ALLOWED_ATTR: []
});
\`\`\`
`;
}

function generateDeploymentPipeline() {
  return `# Deployment Pipeline

## CI/CD Flow
\`\`\`mermaid
graph LR
    subgraph "Development"
        A[Local Development] --> B[Feature Branch]
        B --> C[Code Review]
    end
    
    subgraph "Testing"
        C --> D[Automated Tests]
        D --> E[Security Scan]
        E --> F[Performance Tests]
    end
    
    subgraph "Deployment"
        F --> G[Build Process]
        G --> H[Staging Environment]
        H --> I[Production Deploy]
    end
    
    subgraph "Monitoring"
        I --> J[Health Checks]
        J --> K[Performance Monitoring]
        K --> L[Error Tracking]
    end
    
    A --> J
    L --> A
\`\`\`

## Infrastructure as Code
\`\`\`yaml
# Vercel Configuration
name: forma
version: 2
builds:
  - src: package.json
    use: '@vercel/next'

# Environment Variables
env:
  DATABASE_URL: @database-url
  NEXTAUTH_SECRET: @nextauth-secret


# Supabase Infrastructure
# Create project at supabase.com, configure DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
\`\`\`

## Deployment Commands
\`\`\`bash
# Development
npm run dev              # Local development
npm run build           # Build for production
npm run start           # Start production server

# Staging
vercel --env staging    # Deploy to staging
vercel --env preview    # Deploy preview

# Production
vercel --prod           # Deploy to production
vercel --env production # Set production environment

# Database
npx prisma migrate dev  # Apply migrations
npx prisma db push      # Push schema changes
npx prisma studio       # Open database GUI
\`\`\`

## Rollback Strategy
\`\`\`bash
# Quick Rollback
vercel rollback         # Rollback to previous deployment

# Database Rollback
npx prisma migrate reset # Reset to clean state
npx prisma migrate deploy # Deploy specific migration

# Environment Rollback
vercel env rm           # Remove environment variable
vercel env add          # Add previous environment variable
\`\`\`
`;
}

function generateMonitoringArchitecture() {
  return `# Monitoring Architecture

## System Health Monitoring
\`\`\`mermaid
graph TB
    subgraph "Application Layer"
        A[Next.js App] --> B[Health Check API]
        B --> C[Performance Metrics]
        C --> D[Error Tracking]
    end
    
    subgraph "Infrastructure Layer"
        E[Supabase PostgreSQL] --> F[Database Monitoring]
        G[Supabase Storage] --> H[Storage Monitoring]
        I[Vercel] --> J[Platform Monitoring]
    end
    
    subgraph "External Services"
        K[In-Memory Cache] --> L[Cache Monitoring]
        M[PostgreSQL] --> N[Query Performance]
    end
    
    subgraph "Alerting"
        O[Health Alerts] --> P[Email Notifications]
        Q[Performance Alerts] --> R[Slack Notifications]
        S[Error Alerts] --> T[PagerDuty]
    end
    
    B --> O
    C --> Q
    D --> S
    F --> O
    H --> O
    J --> O
\`\`\`

## Metrics Collection
\`\`\`typescript
// Health Check Endpoints
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      
      supabase: await checkSupabase(),
      external: await checkExternalServices()
    }
  };
  
  return Response.json(health);
}

// Performance Metrics
export const performanceMetrics = {
  responseTime: new Map(),
  throughput: new Map(),
  errorRate: new Map(),
  
  recordResponseTime(endpoint: string, time: number) {
    if (!this.responseTime.has(endpoint)) {
      this.responseTime.set(endpoint, []);
    }
    this.responseTime.get(endpoint).push(time);
  }
};
\`\`\`

## Logging Strategy
\`\`\`typescript
// Structured Logging
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  error: (message: string, error?: Error, meta?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};

// Audit Logging
export async function logAuditEvent(
  personId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: any,
  newValues?: any
) {
  await prisma.auditLogs.create({
    data: {
      personId,
      action,
      entityType,
      entityId,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null
    }
  });
}
\`\`\`

## Alerting Rules
\`\`\`yaml
# Health Check Alerts
alerts:
  - name: "Database Down"
    condition: "database_status != 'healthy'"
    severity: "critical"
    notification: "pagerduty"
    
  - name: "High Response Time"
    condition: "avg_response_time > 2000ms"
    severity: "warning"
    notification: "slack"
    
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    severity: "critical"
    notification: "pagerduty"
    
  - name: "Low Disk Space"
    condition: "disk_usage > 90%"
    severity: "warning"
    notification: "email"
\`\`\`
`;
}

function createSummaryReport(diagrams) {
  return `# Enhanced Architecture Generation Summary

Generated on: ${new Date().toISOString()}

## Generated Files
${diagrams.map(d => `- ${d.name}: Enhanced architecture diagram`).join('\n')}

## Features Added
- **Detailed Database Schema**: Complete ERD with constraints and indexes
- **Security Architecture**: Authentication flow and authorization matrix
- **Deployment Pipeline**: CI/CD flow and infrastructure as code
- **Monitoring Architecture**: Health checks and alerting systems

## Next Steps
1. Review generated diagrams for accuracy
2. Customize diagrams for your specific needs
3. Integrate with your CI/CD pipeline
4. Set up automated monitoring and alerting

## Integration Notes
- All diagrams use Mermaid format for GitHub compatibility
- Diagrams are automatically generated and can be updated
- Use \`npm run generate-architecture\` for basic diagrams
- Use \`npm run generate-enhanced-architecture\` for detailed diagrams
`;
}

// Run if called directly
if (require.main === module) {
  generateEnhancedArchitecture();
}

module.exports = { generateEnhancedArchitecture };
