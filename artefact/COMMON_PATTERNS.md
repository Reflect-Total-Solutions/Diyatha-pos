# Common Patterns & Conventions — Carnival POS System

## Overview

This document defines the standard patterns used **consistently across the entire codebase**.
Every developer and AI assistant working on this system must follow these patterns without deviation.
Consistency is more important than personal preference.

---

## 1. Debounce & Throttle

### Rule
- All button tap handlers: **debounce 300ms, leading edge**
- All search inputs: **debounce 400ms, trailing edge**
- All scroll/resize handlers: **throttle 100ms**

### Standard Hook
```typescript
// hooks/useDebouncedCallback.ts
import { useMemo } from 'react'
import debounce from 'lodash/debounce'

export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options?: { leading?: boolean; trailing?: boolean }
) {
  return useMemo(
    () => debounce(fn, delay, options ?? { leading: false, trailing: true }),
    [fn, delay]
  )
}

// Usage — activity button tap
const handleTap = useDebouncedCallback(
  () => openConfirmDialog(activity.id),
  300,
  { leading: true, trailing: false }  // fires immediately, ignores rapid re-taps
)

// Usage — search input
const handleSearch = useDebouncedCallback(
  (value: string) => setSearchQuery(value),
  400
  // trailing: true (default) — fires after user stops typing
)
```

---

## 2. Search

### Rule
- Every searchable list has its **own dedicated API route** — never reuse a list API with a query param bolted on
- Search always goes through the API — never filter client-side for anything stored in DB
- Search input always debounced 400ms before triggering API call
- Search results paginated (see Pagination section)
- Empty query → do not call search API → return to default list

### Search API Pattern
```typescript
// app/api/transactions/search/route.ts
export async function GET(request: Request) {
  const user = await requireAuth(request)
  const { searchParams } = new URL(request.url)
  
  const query = searchParams.get('q')?.trim()
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  
  // Validate
  if (!query || query.length < 2) {
    return Response.json({ data: [], total: 0, page, limit })
  }
  
  const offset = (page - 1) * limit
  
  const { data, count } = await supabaseServer
    .from('transactions')
    .select('*, activity:activities(name), cashier:users(name)', { count: 'exact' })
    .or(`token_number.ilike.%${query}%,txn_reference.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  return Response.json({ data, total: count, page, limit })
}
```

### Search UI Component
```typescript
// components/SearchInput.tsx — standard component, use everywhere
interface SearchInputProps {
  onSearch: (query: string) => void
  placeholder?: string
  minLength?: number   // default: 2
}

// Always show:
// - Loading spinner while fetching
// - "No results for X" when empty
// - Clear (X) button when has value
// - Character minimum hint: "Type at least 2 characters"
```

---

## 3. Pagination

### Rule
- Every list that can exceed 20 items **must** be paginated — no infinite scroll on admin tables
- Default page size: **20 items** for tables, **12 items** for image grids
- Always return `total`, `page`, `limit`, `totalPages` from list APIs
- URL reflects current page: `/admin/transactions?page=2`

### Standard API Response Shape
```typescript
interface PaginatedResponse<T> {
  data: T[]
  total: number       // total matching records
  page: number        // current page (1-indexed)
  limit: number       // items per page
  totalPages: number  // Math.ceil(total / limit)
}
```

### Standard List API Pattern
```typescript
// app/api/transactions/route.ts
export async function GET(request: Request) {
  await requireAuth(request)
  const { searchParams } = new URL(request.url)
  
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const offset = (page - 1) * limit
  
  const { data, count, error } = await supabaseServer
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) throw error
  
  return Response.json({
    data,
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit)
  })
}
```

### Pagination UI Component
```typescript
// components/Pagination.tsx — single component used everywhere
// Shows: Previous | 1 2 3 ... 10 | Next
// On touch screens: large Previous/Next buttons only (no page numbers)
// Always shows: "Showing 21–40 of 150 results"
```

---

## 4. Rate Limiting

### Rule
- Every API route that mutates data **must** be rate limited
- Read-only list/search routes: rate limited but more generous
- Rate limit state stored in-memory (local app) using a sliding window counter

### Limits by Route Type
| Route Type | Limit | Window |
|---|---|---|
| `POST /api/print` | 10 requests | per minute per user |
| `POST /api/auth/login` | 5 attempts | per 15 min per IP |
| `GET /api/reports/export` | 5 exports | per hour per user |
| `POST /api/admin/*` | 30 requests | per minute per user |
| `GET /api/*` (reads) | 120 requests | per minute per user |

### Rate Limit Implementation
```typescript
// lib/rateLimit.ts
const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = store.get(key)
  
  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true  // allowed
  }
  
  if (record.count >= limit) return false  // blocked
  
  record.count++
  return true  // allowed
}

// Usage in API route
export async function POST(request: Request) {
  const user = await requireAuth(request)
  const allowed = rateLimit(`print:${user.id}`, 10, 60_000)
  
  if (!allowed) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }
  // ...
}
```

---

## 5. API Structure

### Rule
- All API routes live under `app/api/`
- Route folders mirror the resource they serve
- Never mix concerns — one route = one resource action

### Folder Structure
```
app/api/
  auth/
    login/route.ts
    logout/route.ts
  activities/
    route.ts              ← GET (list), POST (create)
    [id]/route.ts         ← GET, PUT, DELETE
    [id]/image/route.ts   ← POST (upload image)
  categories/
    route.ts
    [id]/route.ts
  transactions/
    route.ts              ← GET (list), POST (create)
    [id]/route.ts         ← GET single
    search/route.ts       ← GET (search — separate route)
  print/
    route.ts              ← POST (trigger print)
    status/route.ts       ← GET (printer status)
  reports/
    daily/route.ts
    activity/route.ts
    cashier/route.ts
    export/route.ts       ← GET (PDF/Excel export)
  admin/
    users/route.ts
    users/[id]/route.ts
  health/
    route.ts
```

### Standard API Response Format
```typescript
// Success
{ data: T, message?: string }

// Error
{ error: string, code?: string, details?: unknown }

// Paginated
{ data: T[], total: number, page: number, limit: number, totalPages: number }
```

### HTTP Status Codes — Always Use Correctly
| Situation | Status |
|---|---|
| Success with data | 200 |
| Created successfully | 201 |
| No content (delete) | 204 |
| Bad request / validation fail | 400 |
| Unauthenticated | 401 |
| Authenticated but no permission | 403 |
| Not found | 404 |
| Rate limited | 429 |
| Server error | 500 |

---

## 6. Reports Section

### Rule
- Reports are read-only — never mutate data from a report route
- Each report type has its own dedicated API route
- All reports support date range filtering: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- All reports support export: `?export=pdf` or `?export=excel`
- Report queries run against `daily_summary` materialized view (not raw transactions) for speed

### Report Types

#### Daily Summary (`/api/reports/daily`)
```typescript
// Returns: total sales, total transactions, breakdown by activity — for one day
// Filter: ?date=YYYY-MM-DD (defaults to today)
// Used by: Cashier dashboard (own data only) + Admin (all cashiers)
```

#### Activity Report (`/api/reports/activity`)
```typescript
// Returns: per-activity count and revenue, sorted by revenue desc
// Filter: ?from=&to=&activity_id= (optional)
// Used by: Admin only
```

#### Cashier Report (`/api/reports/cashier`)
```typescript
// Returns: per-cashier totals and transaction counts
// Filter: ?from=&to=&cashier_id= (optional)
// Used by: Admin only
```

#### Full Transaction Report (`/api/reports/transactions`)
```typescript
// Returns: paginated list of all transactions with all fields
// Filter: ?from=&to=&cashier_id=&activity_id=&price_type=
// Used by: Admin only — shows raw data
```

### Export Pattern
```typescript
// app/api/reports/export/route.ts
export async function GET(request: Request) {
  const user = await requireAdminAuth(request)
  
  // Rate limit exports
  const allowed = rateLimit(`export:${user.id}`, 5, 3_600_000)
  if (!allowed) return Response.json({ error: 'Export limit reached' }, { status: 429 })
  
  const format = searchParams.get('export')  // 'pdf' | 'excel'
  const reportType = searchParams.get('type')
  
  const data = await fetchReportData(reportType, filters)
  
  if (format === 'excel') {
    const buffer = await generateExcel(data)
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report-${Date.now()}.xlsx"`
      }
    })
  }
  
  if (format === 'pdf') {
    const buffer = await generatePDF(data)
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${Date.now()}.pdf"`
      }
    })
  }
}
```

---

## 7. Error Handling

### Rule
- Never let errors fail silently
- Every async operation wrapped in try/catch
- User always sees a toast notification for any error
- Errors logged to `error_logs` table

### Standard Error Classes
```typescript
// lib/errors.ts
export class UnauthorizedError extends Error {
  status = 401
  constructor() { super('Unauthorized') }
}

export class ForbiddenError extends Error {
  status = 403
  constructor() { super('Forbidden') }
}

export class NotFoundError extends Error {
  status = 404
  constructor(resource: string) { super(`${resource} not found`) }
}

export class ValidationError extends Error {
  status = 400
  constructor(public details: unknown) { super('Validation failed') }
}

export class PrintError extends Error {
  status = 500
  constructor(public txnId: string) { super('Print failed') }
}
```

### Global API Error Handler
```typescript
// lib/apiHandler.ts — wrap every route handler
export function apiHandler(handler: Function) {
  return async (request: Request, context: unknown) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return Response.json({ error: error.message }, { status: 401 })
      }
      // ... other known errors
      
      // Unknown error — log and return 500
      await logError(error as Error, { url: request.url })
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
```

---

## 8. Loading & Empty States

### Rule — Every data-fetching component must handle all 4 states:
1. **Loading** — skeleton or spinner
2. **Error** — error message + retry button
3. **Empty** — friendly empty state message
4. **Data** — the actual content

```typescript
// Standard pattern
if (isLoading) return <ActivityGridSkeleton />
if (error) return <ErrorState message={error.message} onRetry={refetch} />
if (!activities?.length) return <EmptyState message="No activities found" />
return <ActivityGrid activities={activities} />
```

---

## 9. Date & Time

### Rule
- **All timestamps stored in UTC** in the database
- **All display times in Asia/Colombo timezone** (UTC+5:30)
- Use `date-fns` + `date-fns-tz` for all date operations — never raw `Date` manipulation
- Date display format: `DD-MM-YYYY`
- Time display format: `hh:mm:ss aa` (12-hour with seconds)
- Server always generates timestamps — never trust client time for transactions

```typescript
// lib/dateUtils.ts
import { format, toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'Asia/Colombo'

export function toDisplayDate(utcDate: string | Date): string {
  return format(toZonedTime(utcDate, TIMEZONE), 'dd-MM-yyyy', { timeZone: TIMEZONE })
}

export function toDisplayTime(utcDate: string | Date): string {
  return format(toZonedTime(utcDate, TIMEZONE), 'hh:mm:ss aa', { timeZone: TIMEZONE })
}
```

---

## 10. Environment Variables

### Rule
- Never hardcode URLs, keys, IPs, or ports
- All env vars documented in `.env.example` (committed to git)
- `.env.local` never committed

```bash
# .env.example — commit this
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=         # Server-only, never expose to client
PRINTER_IP=                        # Static IP of Xprinter XP-80T
PRINTER_PORT=9100                  # Default ESC/POS port
APP_ENV=development                # 'development' | 'production'
```
