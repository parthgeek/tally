# Plaid Integration - Production Deployment Guide

This guide covers the complete deployment and configuration of the Plaid integration for the Nexus platform.

## Environment Variables

### Required Environment Variables

Configure these environment variables in your production environment:

```bash
# Plaid Configuration
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret_key
PLAID_ENV=production  # or 'development' for testing
PLAID_WEBHOOK_SECRET=your_plaid_webhook_secret  # Optional but recommended

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key  # Generate a strong 32+ character key

# Supabase (existing)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Monitoring (optional but recommended)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_url
```

### Generating Secure Encryption Key

The `ENCRYPTION_KEY` is used for encrypting Plaid access tokens. Generate a secure key:

```bash
# Generate a random 32-character key
openssl rand -hex 16

# Or use a longer key (recommended)
openssl rand -hex 32
```

## Database Migration

Run the Plaid integration database migration:

```bash
cd packages/db
pnpm run migrate
```

This will apply migration `004_plaid_integration.sql` which adds:
- `connection_secrets` table for encrypted access tokens
- `plaid_cursors` table for sync state management
- Additional columns for Plaid-specific data
- Proper indexes and RLS policies

## Supabase Edge Functions Deployment

Deploy the Edge Functions to Supabase:

```bash
cd apps/edge

# Deploy all Plaid-related functions
supabase functions deploy plaid-exchange
supabase functions deploy plaid-sync-accounts
supabase functions deploy plaid-sync-transactions
supabase functions deploy plaid-backfill-transactions
supabase functions deploy plaid-webhook
supabase functions deploy jobs-plaid-daily-sync
```

### Edge Function Environment Variables

Configure environment variables for Edge Functions in Supabase Dashboard:

1. Go to **Project Settings > Edge Functions**
2. Add environment variables:
   - `PLAID_CLIENT_ID`
   - `PLAID_SECRET`
   - `PLAID_ENV`
   - `PLAID_WEBHOOK_SECRET`
   - `ENCRYPTION_KEY`
   - `NEXT_PUBLIC_POSTHOG_KEY` (optional)
   - `NEXT_PUBLIC_SENTRY_DSN` (optional)

## Plaid Dashboard Configuration

### 1. Webhook Configuration

In your Plaid Dashboard:

1. Go to **API** > **Webhooks**
2. Add webhook URL: `https://your-project.supabase.co/functions/v1/plaid/webhook`
3. Configure webhook events:
   - `TRANSACTIONS` > `DEFAULT_UPDATE`
   - `TRANSACTIONS` > `HISTORICAL_UPDATE`
   - `TRANSACTIONS` > `TRANSACTIONS_REMOVED`
   - `ITEM` > `ERROR`

### 2. Allowed Redirect URIs

Add your production domain to allowed redirect URIs:
- `https://your-domain.com`

### 3. Environment Promotion

When moving from sandbox to production:

1. **Sandbox to Development:**
   - Update `PLAID_ENV=development`
   - Request development access from Plaid
   - Test with real bank credentials

2. **Development to Production:**
   - Update `PLAID_ENV=production`
   - Complete Plaid's production approval process
   - Update webhook URLs to production endpoints

## Scheduled Jobs Configuration

Configure the daily sync job in Supabase Dashboard:

1. Go to **Database** > **Cron Jobs**
2. Create new cron job:
   - **Name:** `plaid-daily-sync`
   - **Schedule:** `0 6 * * *` (6 AM UTC daily)
   - **Command:** 
     ```sql
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/jobs/plaid-daily-sync',
       headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '", "Content-Type": "application/json"}'::jsonb
     );
     ```

Alternative using Supabase CLI:
```bash
supabase functions schedule jobs-plaid-daily-sync --cron "0 6 * * *"
```

## Security Checklist

### ✅ Access Token Security
- [x] Access tokens encrypted with AES-GCM
- [x] Encryption key stored securely in environment variables
- [x] `connection_secrets` table has no RLS (service-role only)
- [x] Legacy base64 tokens supported with fallback

### ✅ Webhook Security
- [x] Webhook signature verification implemented
- [x] PLAID_WEBHOOK_SECRET configured
- [x] Unauthorized requests rejected

### ✅ Database Security
- [x] All queries scoped by `org_id`
- [x] RLS policies prevent cross-org access
- [x] Service role used for Edge Function database access
- [x] Unique constraints prevent duplicate data

### ✅ Error Handling
- [x] Structured error responses
- [x] Sentry integration for error tracking
- [x] PostHog analytics for sync metrics
- [x] Graceful handling of Plaid API errors

## Monitoring and Alerting

### PostHog Events

The integration tracks these events:
- `plaid_sync_completed` - Sync operation results
- `connection_event` - Connection lifecycle events

### Sentry Error Tracking

Errors are automatically captured for:
- Token exchange failures
- Sync operation errors
- Webhook processing errors
- Database operation failures

### Key Metrics to Monitor

1. **Sync Success Rate:** Monitor failed syncs per connection
2. **Webhook Delivery:** Track webhook processing success
3. **API Error Rates:** Monitor Plaid API error responses
4. **Token Encryption:** Monitor encryption/decryption failures

## Testing in Production

### 1. Smoke Tests

After deployment, verify:

```bash
# Test link token creation
curl -X POST https://your-domain.com/api/plaid/link-token \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json"

# Test connections list
curl https://your-domain.com/api/connections/list \
  -H "Authorization: Bearer <user-token>"
```

### 2. End-to-End Testing

1. Connect a test bank account via Plaid Link
2. Verify account sync completes successfully
3. Check transaction backfill populates data
4. Confirm daily sync job runs correctly
5. Test webhook handling with Plaid webhook tester

## Rollback Procedures

### Immediate Rollback (< 15 minutes)

1. **Disable Plaid Integration:**
   ```bash
   # Set environment variable to disable UI
   PLAID_INTEGRATION_ENABLED=false
   ```

2. **Pause Scheduled Jobs:**
   ```sql
   -- Disable cron job temporarily
   SELECT cron.unschedule('plaid-daily-sync');
   ```

3. **Remove Webhook:** Delete webhook URL from Plaid Dashboard

### Full Rollback (< 2 hours)

1. **Revert Database Migration:**
   ```bash
   cd packages/db
   # Run rollback migration if needed
   psql $DATABASE_URL -f migrations/rollback_004_plaid_integration.sql
   ```

2. **Undeploy Edge Functions:**
   ```bash
   supabase functions delete plaid-exchange
   supabase functions delete plaid-sync-accounts
   supabase functions delete plaid-sync-transactions
   supabase functions delete plaid-backfill-transactions
   supabase functions delete plaid-webhook
   supabase functions delete jobs-plaid-daily-sync
   ```

3. **Remove UI Components:** Revert frontend changes

### Data Recovery

- All Plaid data is isolated in specific tables/columns
- Raw transaction data preserved in `raw` JSONB column
- Can replay sync operations from stored cursors
- Export data before rollback if needed:

```sql
-- Export connection data
COPY (SELECT * FROM connections WHERE provider = 'plaid') 
TO '/tmp/plaid_connections_backup.csv' CSV HEADER;

-- Export transaction data
COPY (SELECT * FROM transactions WHERE source = 'plaid') 
TO '/tmp/plaid_transactions_backup.csv' CSV HEADER;
```

## Performance Optimization

### Database Indexes

Monitor query performance and add indexes if needed:

```sql
-- Transaction queries by date range
CREATE INDEX CONCURRENTLY idx_transactions_org_date 
ON transactions(org_id, date DESC) WHERE source = 'plaid';

-- Account lookups by provider ID
CREATE INDEX CONCURRENTLY idx_accounts_provider_lookup 
ON accounts(org_id, provider_account_id) WHERE provider_account_id IS NOT NULL;
```

### Edge Function Optimization

- Monitor Edge Function execution times
- Consider caching frequently accessed data
- Batch database operations where possible
- Use connection pooling for database connections

## Compliance and Auditing

### Data Retention

- Raw transaction data stored indefinitely for audit purposes
- Access tokens encrypted and rotated per Plaid guidelines
- Webhook events logged for compliance tracking

### Access Logging

- All API access logged with user/org context
- Database operations audited via RLS policies
- Edge Function execution logged in Supabase

### GDPR/Privacy Compliance

- User data scoped by organization
- Data export capabilities available
- Data deletion cascades properly through foreign keys

---

## Support and Troubleshooting

### Common Issues

1. **Token Exchange Failures**
   - Verify Plaid credentials are correct
   - Check environment variable configuration
   - Confirm webhook URL is accessible

2. **Sync Failures**
   - Check Edge Function logs in Supabase
   - Verify database permissions
   - Monitor Plaid API status

3. **Webhook Issues**
   - Verify signature verification settings
   - Check webhook URL configuration
   - Monitor webhook delivery logs

### Getting Help

- Check Supabase Edge Function logs
- Monitor Sentry error reports
- Review PostHog analytics for patterns
- Contact Plaid support for API issues

For additional support, refer to:
- [Plaid Documentation](https://plaid.com/docs/)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Nexus Platform Documentation](./README.md)