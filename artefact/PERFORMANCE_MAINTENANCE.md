# Performance & Maintenance — Carnival POS System

## Overview

The system runs locally on the CM-H500 (i5, 8GB, 256GB). Performance targets
are set for a busy carnival environment where speed directly impacts queue length.

---

## Performance Targets

| Action | Target | Hard Limit |
|---|---|---|
| Activity screen load | < 300ms | 1s |
| Payment confirmation dialog | < 100ms | 300ms |
| Transaction creation (DB write) | < 200ms | 500ms |
| Ticket print (tap to paper) | < 2s | 4s |
| Daily summary load | < 500ms | 2s |
| Report generation | < 3s | 10s |
| Login | < 1s | 3s |

---

## Frontend Performance

### Touch Response
- All tap handlers debounced at **300ms** to prevent double-tap double-billing
- Activity buttons use `touchstart` event (not `click`) for 300ms faster response on touch
- Disable button immediately on tap, re-enable only after transaction completes

```typescript
// hooks/useActivityPress.ts
const handleActivityPress = useMemo(() => 
  debounce(async (activityId: string) => {
    setButtonDisabled(activityId, true)
    try {
      await confirmAndBill(activityId)
    } finally {
      setButtonDisabled(activityId, false)
    }
  }, 300, { leading: true, trailing: false }),
[])
```

### Image Optimization
- Activity images stored in Supabase Storage
- Serve via Supabase CDN URL with `?width=300&quality=75` transform params
- Use Next.js `<Image>` component with `priority` on above-fold activity buttons
- Pre-load all activity images on cashier screen mount (they're always visible)

```typescript
// All activity images pre-fetched at session start
const { data: activities } = useActivities()
activities?.forEach(a => {
  const img = new Image()
  img.src = a.image_url  // browser caches for the session
})
```

### Bundle Size
- Keep client bundle lean — this runs on a local LAN, but Chrome still parses JS
- No heavy charting libraries on POS screen (only on admin/reports)
- Lazy-load admin and reports routes: `dynamic(() => import('./admin'), { ssr: false })`

---

## Backend Performance

### Supabase Query Optimization

```sql
-- Always index foreign keys and frequently filtered columns
CREATE INDEX idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_activity_id ON transactions(activity_id);
CREATE INDEX idx_tokens_token_number ON tokens(token_number);

-- Daily summary query — must be fast, cashiers check it often
-- Use a materialized view refreshed every 5 minutes instead of
-- running COUNT/SUM on raw transactions table during peak hours
CREATE MATERIALIZED VIEW daily_summary AS
  SELECT 
    cashier_id,
    DATE(created_at) AS sale_date,
    activity_id,
    COUNT(*) AS count,
    SUM(amount) AS total
  FROM transactions
  WHERE created_at >= NOW() - INTERVAL '2 years'
  GROUP BY cashier_id, DATE(created_at), activity_id;

-- Refresh job (call from cron or Supabase Edge Function)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_summary;
```

### Connection Pooling
- Use Supabase's built-in PgBouncer (Transaction mode)
- Next.js API routes are serverless-style — use connection pooling URL, not direct

```typescript
// lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js'

// Use pooler URL for API routes (transaction pooling)
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'public' } }
)
```

---

## Printer Performance

### Pre-flight Check
Run printer status check on cashier login — not on every print:

```typescript
// Check once at login, cache result, re-check if print fails
async function checkPrinterStatus(): Promise<PrinterStatus> {
  try {
    const isConnected = await printer.isPrinterConnected()
    return { online: isConnected, checkedAt: Date.now() }
  } catch {
    return { online: false, checkedAt: Date.now() }
  }
}
```

### Print Queue
Handle rapid successive prints (cashier selling multiple tokens):

```typescript
// lib/printQueue.ts — simple FIFO queue
const queue: PrintJob[] = []
let isProcessing = false

async function addToQueue(job: PrintJob) {
  queue.push(job)
  if (!isProcessing) processQueue()
}

async function processQueue() {
  isProcessing = true
  while (queue.length > 0) {
    const job = queue.shift()!
    await executePrint(job)
  }
  isProcessing = false
}
```

---

## Maintenance Tasks

### Daily (Automated)
| Task | How |
|---|---|
| Reset token sequence | Supabase Edge Function cron at 00:00 |
| Refresh materialized view | Every 5 min via Edge Function |
| Log cleanup (audit_log > 2 years) | Nightly delete job |

### Weekly
| Task | How |
|---|---|
| Local DB backup export | Manual export to Excel, save to USB |
| Review failed print logs | Admin panel → Failed Prints report |
| Check disk space on CM-H500 | Windows Task Scheduler reminder |

### Monthly
| Task | How |
|---|---|
| Archive transactions > 1 year to cold storage | Admin panel → Archive button |
| Review and rotate any stale cashier accounts | Admin → User Management |
| Check for Xprinter firmware updates | Manual check |
| Clear Next.js build cache and rebuild | `npm run build` fresh |

---

## Monitoring

### Health Check Endpoint
```typescript
// app/api/health/route.ts
export async function GET() {
  const dbOk = await checkDatabaseConnection()
  const printerOk = await checkPrinterConnection()
  
  return Response.json({
    status: dbOk && printerOk ? 'ok' : 'degraded',
    database: dbOk,
    printer: printerOk,
    timestamp: new Date().toISOString()
  })
}
```

### Error Logging
```typescript
// lib/logger.ts — write to Supabase error_logs table + console
export async function logError(error: Error, context: Record<string, unknown>) {
  console.error('[POS Error]', error.message, context)
  
  await supabaseServer.from('error_logs').insert({
    message: error.message,
    stack: error.stack,
    context,
    created_at: new Date().toISOString()
  })
}
```

---

## Recovery Procedures

### Printer Goes Offline Mid-Shift
1. Transaction is created in DB first, `print_status = 'pending'`
2. Print attempt fails → status updated to `print_failed`
3. Cashier sees error toast with "Retry Print" button
4. Cashier can retry from Transaction History → find transaction → Reprint

### Database Connection Lost
1. Supabase client retries automatically (3 attempts, exponential backoff)
2. If all fail: show full-screen "Connection Lost" overlay, block all billing
3. When reconnected: overlay dismisses automatically, pending operations resume

### System Restart During Shift
1. Chrome Kiosk auto-starts via Windows startup shortcut
2. Cashier must re-login (sessions don't persist across restart by design)
3. Any `print_pending` transactions from before restart visible in history for reprint

---

## Build & Deployment

```bash
# Local build on CM-H500
npm run build
npm run start  # production mode, port 3000

# Windows startup (Task Scheduler or startup folder shortcut)
# Target: chrome.exe --kiosk --app=http://localhost:3000

# Environment variables stored in .env.local (not committed to git)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PRINTER_IP=192.168.1.100   # static IP of XP-80T
PRINTER_PORT=9100
```
