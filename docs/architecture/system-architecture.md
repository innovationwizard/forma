# Forma System Architecture

## High-Level System Overview
```mermaid
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
```

## Database Schema Architecture
```mermaid
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
```

## Component Architecture
```mermaid
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
```

## API Endpoint Architecture
```mermaid
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
```

## Security Architecture
```mermaid
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
```

## Deployment Architecture
```mermaid
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
```

## Technology Stack
```mermaid
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
```

## Data Flow Architecture
```mermaid
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
```

## Performance Optimization
```mermaid
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
```
