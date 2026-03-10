# Supabase Integration

## Overview

Forma uses Supabase for database (PostgreSQL) and storage. Supabase provides a fully managed PostgreSQL database with connection pooling, and object storage for files.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Forma App     │───▶│   Supabase        │
│   (Vercel)      │    │   - PostgreSQL    │
│                 │    │   - Storage       │
└─────────────────┘    └──────────────────┘
```

## Environment Variables

```bash
# Database (from Supabase Project Settings > Database)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Supabase (for Storage API)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Implementation Details

### Core Files

#### `src/lib/getDbConfig.ts`
- Uses `DATABASE_URL` directly from environment
- Supabase provides this in Project Settings > Database > Connection string

#### `src/lib/supabase.ts`
- Server-side Supabase client for API routes
- Uses `SUPABASE_SERVICE_ROLE_KEY` for admin operations (Storage, etc.)

#### `src/lib/prisma.ts`
- Prisma client configured with `DATABASE_URL`
- Works with Supabase PostgreSQL (standard Postgres)

## Health Check Endpoints

- `GET /api/supabase-db` - Database connection status
- `GET /api/supabase-storage` - Storage buckets status

## Deployment

1. Create a Supabase project at supabase.com
2. Copy `DATABASE_URL` from Project Settings > Database
3. Copy `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings > API
4. Add these to your Vercel environment variables
5. Run `npx prisma db push` or `prisma migrate deploy` to sync schema
