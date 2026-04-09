# Security — Carnival POS System

## Overview

This system handles cash transactions and printed tokens. Security focuses on
preventing unauthorized access, transaction tampering, and fraudulent ticket reprinting.

---

## Authentication

### Cashier Login
- Supabase Auth with email + password
- Passwords minimum 8 characters, must include number and special character
- Sessions expire after **8 hours** of inactivity (one shift)
- No "remember me" — every shift requires fresh login
- Failed login attempts: **5 attempts → 15 minute lockout** (enforced server-side)

### Admin Login
- Separate admin role in Supabase (`role: 'admin'`)
- Admin routes protected by middleware checking role claim in JWT
- Admin panel accessible at `/admin` — redirect to login if no valid admin session

### Session Management
```typescript
// middleware.ts — protect all POS routes
export async function middleware(request: NextRequest) {
  const session = await getSession(request)
  
  if (!session && request.nextUrl.pathname.startsWith('/pos')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session || session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
}
```

---

## Row Level Security (RLS) — Supabase

Every table has RLS enabled. No table is publicly readable or writable.

```sql
-- Cashiers can only read their own transactions
CREATE POLICY "cashier_own_transactions"
ON transactions FOR SELECT
USING (cashier_id = auth.uid());

-- Cashiers can insert transactions (create billing)
CREATE POLICY "cashier_insert_transactions"
ON transactions FOR INSERT
WITH CHECK (cashier_id = auth.uid());

-- Cashiers CANNOT update or delete transactions
-- (only admin via service role)

-- Activities: all authenticated users can read
CREATE POLICY "authenticated_read_activities"
ON activities FOR SELECT
TO authenticated USING (true);

-- Activities: only admin can write
CREATE POLICY "admin_manage_activities"
ON activities FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- Tokens: cashier can read own, admin reads all
CREATE POLICY "cashier_own_tokens"
ON tokens FOR SELECT
USING (
  transaction_id IN (
    SELECT id FROM transactions WHERE cashier_id = auth.uid()
  )
);
```

---

## API Security

### All API Routes Must Validate Session
```typescript
// lib/auth.ts — reusable guard
export async function requireAuth(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new UnauthorizedError()
  
  const { data: user, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new UnauthorizedError()
  
  return user
}

// Usage in every API route
export async function POST(request: Request) {
  const user = await requireAuth(request)  // throws 401 if invalid
  // ... rest of handler
}
```

### Rate Limiting
```typescript
// Implemented via upstash/ratelimit or simple in-memory for local deployment
// Print endpoint: max 10 requests per minute per cashier
// Login endpoint: max 5 attempts per 15 minutes per IP
// Report export: max 5 exports per hour per user
```

### Input Validation
- All API inputs validated with **Zod** before processing
- Activity IDs validated as valid UUIDs
- Price type must be exactly `'local'` or `'foreign'`
- Amount validated against DB price (server recalculates, never trusts client amount)

```typescript
// CRITICAL: Never trust client-sent price
// Always recalculate server-side
const activity = await db.activities.findById(activityId)
const price = priceType === 'local' ? activity.local_price : activity.foreign_price
// Use this `price`, ignore any amount sent in request body
```

---

## Transaction Integrity

### Immutable Transactions
- Transactions are **write-once** — no UPDATE allowed via RLS
- Cancellations are recorded as a new `cancellation` record referencing original txn
- Token numbers are unique constraints in DB — duplicates rejected at DB level

### Bill Number Generation
```sql
-- Server-side sequence generation — never client-generated
CREATE SEQUENCE daily_token_seq START 1;

-- Reset daily via cron job at midnight
-- Token format built in DB function:
CREATE OR REPLACE FUNCTION generate_token_number()
RETURNS text AS $$
  SELECT 'CWPCCMB-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
         LPAD(nextval('daily_token_seq')::text, 4, '0')
$$ LANGUAGE sql;
```

### Payment Confirmation Gate
- Transaction record is only created **after** cashier taps "Payment Received"
- Confirmation dialog shows activity name + price before creating any DB record
- No transaction = no ticket printed (enforced: print API requires valid transaction ID)

---

## Printer Security

- Printer accessible only on local LAN (not exposed to internet)
- Print API route validates transaction exists and belongs to requesting cashier
- Print API checks `print_status` — will not reprint unless explicitly requested
- All print requests logged with timestamp, cashier ID, transaction ID

---

## Data Protection

### Sensitive Data
- No customer personal data is collected or stored
- Cashier passwords hashed by Supabase Auth (bcrypt)
- Transaction records contain: activity, price, cashier, timestamp — no PII

### Database Backups
- Supabase automatic daily backups (Pro plan)
- Additional local export via scheduled task (weekly Excel export to local drive)

---

## Audit Trail

Every significant action is logged in an `audit_log` table:

```sql
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,   -- 'LOGIN', 'PRINT', 'REPRINT', 'CANCEL', etc.
  entity_type text,            -- 'transaction', 'activity', 'user'
  entity_id   uuid,
  metadata    jsonb,           -- extra context
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);
```

Events that are always logged:
- Cashier login / logout
- Every transaction created
- Every ticket printed
- Every reprint
- Admin user creation / modification
- Activity price changes
- Report exports

---

## Physical Security Checklist

| Item | Recommendation |
|---|---|
| Chrome Kiosk Mode | Lock browser to `localhost:3000` only |
| Windows auto-login | Set to cashier OS account (no admin rights) |
| USB ports | Disable unused USB ports in BIOS |
| Printer LAN | Put printer on isolated VLAN or same switch, not internet-facing |
| Screen lock | Auto-lock after 10 min inactivity |
| POS logout | Cashier must logout before leaving terminal |
