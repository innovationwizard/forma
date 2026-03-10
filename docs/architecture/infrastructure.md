# Infrastructure & Deployment

## Environment Configuration
```bash
# Required environment variables
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="https://your-domain.com"

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Database Setup
```bash
# Prisma commands
npx prisma generate          # Generate Prisma client
npx prisma db push          # Push schema to database
npx prisma migrate dev      # Create and apply migrations
npx prisma studio           # Open database GUI
```

## Deployment Commands
```bash
# Build and deploy
npm run build               # Build production version
npm run start               # Start production server
vercel --prod               # Deploy to Vercel production
```

## Monitoring & Health Checks
```typescript
// Health check endpoints
GET /api/health             // Basic health status
GET /api/system-health      // Detailed system health
GET /api/supabase-db        // Database connection status (Supabase)
GET /api/supabase-storage   // Supabase storage connection status
```
