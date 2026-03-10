#!/bin/bash

# Rate Limit Cleanup Cron Job
# Runs every 5 minutes to clean up expired rate limit entries

# Configuration
CRON_SECRET="${CRON_SECRET}"
API_URL="${API_URL:-https://forma.app}/api/cron/rate-limit-cleanup"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rate Limit Cleanup: $1"
}

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    log "ERROR: CRON_SECRET environment variable not set"
    exit 1
fi

# Call the cleanup API
log "Starting cleanup..."
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    "$API_URL")

# Extract response body and status code
http_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

# Log results
if [ "$http_code" -eq 200 ]; then
    log "SUCCESS: Cleanup completed"
    log "Response: $response_body"
else
    log "ERROR: Cleanup failed with HTTP $http_code"
    log "Response: $response_body"
    exit 1
fi

log "Cleanup job completed successfully"
