# Rate Limit Cleanup Cron Job Setup (Vercel)

## Overview
This cron job runs daily to clean up expired rate limit entries, using Vercel's native cron functionality.

## What Changed
- ❌ **Removed**: Client-side `setInterval` that ran every minute
- ❌ **Removed**: Duplicate GitHub Actions cron workflows
- ✅ **Added**: Vercel cron job that runs daily (reduced from every 5 minutes)
- ✅ **Added**: API endpoint integrated with Vercel's infrastructure
- ✅ **Added**: No external cron setup needed

## Environment Variables
```bash
# No additional environment variables needed for Vercel cron
# The cron job runs automatically based on vercel.json configuration
```

## Cron Job Setup

### Vercel Cron (Automatic)
The cron job is automatically configured in your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/rate-limit-cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**No additional setup required!** Vercel automatically runs this endpoint daily at midnight UTC.

### Option 2: Docker Cron
If running in Docker, add to your Dockerfile:
```dockerfile
# Install cron
RUN apt-get update && apt-get install -y cron

# Copy the script
COPY scripts/cron-rate-limit-cleanup.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/cron-rate-limit-cleanup.sh

# Add cron job
RUN echo "*/5 * * * * /usr/local/bin/cron-rate-limit-cleanup.sh" | crontab -

# Start cron service
CMD ["cron", "-f"]
```

### Option 3: Kubernetes CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: rate-limit-cleanup
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: curlimages/curl:latest
            command:
            - /bin/sh
            - -c
            - |
              curl -X POST \
                -H "Authorization: Bearer $CRON_SECRET" \
                -H "Content-Type: application/json" \
                "$API_URL/api/cron/rate-limit-cleanup"
            env:
            - name: CRON_SECRET
              valueFrom:
                secretKeyRef:
                  name: cron-secrets
                  key: cron-secret
            - name: API_URL
              value: "https://forma.app"
          restartPolicy: OnFailure
```

## Testing

### Manual Test (Development Only)
```bash
# Test the cleanup endpoint manually
curl -X GET http://localhost:3000/api/cron/rate-limit-cleanup
```

### Production Test
```bash
# Test the cleanup endpoint (Vercel cron calls this automatically)
curl -X POST \
  -H "Content-Type: application/json" \
  "https://forma.app/api/cron/rate-limit-cleanup"
```

### Vercel Cron Monitoring
Vercel automatically monitors your cron jobs. Check the Vercel dashboard:
1. Go to your project in Vercel
2. Navigate to "Functions" tab
3. Look for cron job execution logs
4. Monitor success/failure rates

## Monitoring

### Logs
The cron job logs to stdout/stderr. Monitor with:
```bash
# View recent logs
tail -f /var/log/rate-limit-cleanup.log

# Check cron job status
crontab -l
```

### Health Check
The API returns cleanup statistics:
```json
{
  "success": true,
  "message": "Rate limit cleanup completed",
  "cleanedEntries": 15,
  "remainingEntries": 42,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Security
- **Vercel Internal**: Cron jobs are called by Vercel's infrastructure
- **No External Access**: Cleanup endpoint is designed for cron use
- **Rate Limited**: The cleanup itself is subject to rate limiting
- **Audit Logging**: All cleanup operations are logged
- **User-Agent Verification**: Optional verification of request source

## Benefits
1. **No Client Polling**: Zero client-side network requests
2. **Predictable Timing**: Runs every 5 minutes exactly
3. **Vercel Managed**: No external cron setup required
4. **Resource Efficient**: Only runs when needed
5. **Production Ready**: Integrated with Vercel's infrastructure
6. **Automatic Scaling**: Vercel handles the execution

## Troubleshooting

### Common Issues
1. **Cron Not Running**: Check Vercel deployment and vercel.json
2. **API Errors**: Check Vercel function logs
3. **Rate Limiting**: Verify cleanup endpoint isn't being rate limited
4. **Deployment Issues**: Ensure vercel.json is properly deployed

### Debug Commands
```bash
# Check Vercel deployment
vercel ls

# View function logs
vercel logs

# Test endpoint manually
curl -X POST https://forma.app/api/cron/rate-limit-cleanup

# Check Vercel dashboard for cron execution logs
```
