# Manual Usage Logs Email System

## Overview
This system sends usage log email notifications to track user activity for adoption monitoring. The system is now manually triggered via web endpoint to reduce Vercel cron usage.

## Components

### 1. Email Service (`src/lib/emailService.ts`)
- SMTP configuration using nodemailer
- Formats usage logs as simple text lines
- Sends to: jorgeluiscontrerasherrera@gmail.com
- Time zone: Guatemala City (UTC-6)

### 2. API Endpoint (`src/app/api/cron/usage-logs-email/route.ts`)
- Processes audit logs from the last 9 days
- Converts audit logs to user-friendly action descriptions
- Sends formatted email with usage data

### 3. Manual Trigger Configuration
- **Web Endpoint**: Accessible via GET request to `/api/cron/usage-logs-email`
- **No Cron Jobs**: Removed from Vercel cron to reduce usage limits
- **External Bot Friendly**: Can be triggered by external monitoring systems

### 4. Activity Tracking
Added audit logging to key endpoints:
- **Authentication**: Login/logout events
- **Worklogs**: Creation and updates
- **Projects**: Creation
- **Tasks**: Creation and progress updates
- **Materials**: Creation and updates (existing)

## Environment Variables Required

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

## Email Format

```
Forma Usage Logs - 2025-01-27 10:00:00

2025-01-27 09:45:00 | John Doe | log in
2025-01-27 09:50:00 | John Doe | added new project
2025-01-27 09:55:00 | Jane Smith | submitted worklog entry
2025-01-27 10:00:00 | Bob Wilson | updated task progress

---
This is an automated hourly report for adoption monitoring.
comment-for-human: This high frequency will be dialed down gradually as management determines optimal frequency.
```

## Action Mapping

The system maps technical audit log actions to user-friendly descriptions:

- `LOGIN` → "log in"
- `LOGOUT` → "log out"
- `WORKLOG_CREATE` → "submitted worklog entry"
- `WORKLOG_UPDATE` → "updated worklog entry"
- `TASK_PROGRESS` → "updated task progress"
- `PROJECT_CREATE` → "added new project"
- `TASK_CREATE` → "added new task"
- `MATERIAL_CREATE` → "added new material"
- `MATERIAL_UPDATE` → "updated material"
- `LOCATION_UPDATE` → "location update"
- `PASSWORD_SET` → "set password"
- `PASSWORD_RESET` → "reset password"

## Testing

### Manual Trigger (Development)
```bash
curl -X GET http://localhost:3000/api/cron/usage-logs-email
```

### Manual Trigger (Production)
```bash
curl -X GET https://forma.app/api/cron/usage-logs-email
```

### External Bot Usage
You can set up external monitoring systems to hit this endpoint:
- **URL**: `https://forma.app/api/cron/usage-logs-email`
- **Method**: GET
- **Frequency**: As needed (no longer automated)

## Monitoring

- Email delivery status logged to console
- Check endpoint response for success/failure
- Monitor external trigger system if using one

## Future Adjustments

The system can be easily adjusted by:

1. **Modifying time range** in the API endpoint (currently 9 days)
2. **Changing email frequency** by adjusting external trigger schedule
3. **Adding authentication** if needed for security

## Security Notes

- Email service uses SMTP with authentication
- Endpoint is publicly accessible (consider adding auth if needed)
- Audit logs are read-only for email generation
- No automatic execution - manual trigger only

## Dependencies Added

- `nodemailer`: ^6.9.8
- `@types/nodemailer`: ^6.4.14
