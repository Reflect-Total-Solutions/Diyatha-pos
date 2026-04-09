# Carnival POS System — Complete Architecture Guide

**Status**: Planning complete. Ready for implementation.
**Last Updated**: 2026-04-09

---

## EXECUTIVE SUMMARY

### Core Constraint
**ONE ACTIVITY = ONE BILL** → 8 different activity purchases = 8 separate tickets, all grouped under one transaction group with sequential indexing ("1 of 8", "2 of 8"...).

### Tech Stack
- Next.js 14 (App Router) | Supabase (Auth + DB + Storage) | Tailwind + shadcn/ui | Zustand
- Xprinter XP-80T (80mm thermal, ESC/POS, LAN with network discovery)
- Target: Windows PC (CM-H500, i5, 8GB, 256GB) running Chrome Kiosk
- Performance: Print within 2s, POS load <300ms, Printer discovery auto-detect

### Data Model Clarification
- **Transaction Group**: Grouping key for all activity purchases in one customer session
  - Created on first activity tap for a customer
  - All subsequent taps link to same group until "End Customer" or timeout
- **Individual Transactions**: One per activity tap
  - Immediate DB insert + immediate print
  - Immutable (no UPDATE/DELETE via RLS)
- **Tokens**: One per transaction
  - Unique number: `CWPCCMB-YYYYMMDD-XXXX` (daily sequence, 4-digit)
  - Shows index: "1 of 8" (resolved from transaction group at print time)
  - Can be reprinted unlimited times, flagged in reports after 1st reprint

---

## PART 1: DATABASE SCHEMA (Complete)

### Table: `users` (via Supabase Auth)
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role 'cashier' | 'admin' DEFAULT 'cashier',
  display_name text NOT NULL,
  phone text,
  is_active boolean DEFAULT true,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;
CREATE INDEX idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own"
  ON users FOR SELECT USING (id = auth.uid());

CREATE POLICY "admin_read_all_users"
  ON users FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admin_manage_users"
  ON users FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admin_insert_users"
  ON users FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `categories`
```sql
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_categories_active ON categories(is_active);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_categories"
  ON categories FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "admin_read_all_categories"
  ON categories FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admin_manage_categories"
  ON categories FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `activities`
```sql
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id),
  image_url text,
  local_price numeric(10, 2) NOT NULL DEFAULT 500.00,
  foreign_price numeric(10, 2) NOT NULL DEFAULT 750.00,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activities_active ON activities(is_active);
CREATE INDEX idx_activities_category_id ON activities(category_id);
CREATE INDEX idx_activities_display_order ON activities(display_order);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_activities"
  ON activities FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "admin_read_all_activities"
  ON activities FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "admin_manage_activities"
  ON activities FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `transaction_groups` (NEW)
```sql
CREATE TABLE transaction_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid NOT NULL REFERENCES users(id),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transaction_groups_cashier_id ON transaction_groups(cashier_id);
CREATE INDEX idx_transaction_groups_started_at ON transaction_groups(started_at DESC);

ALTER TABLE transaction_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_read_own_groups"
  ON transaction_groups FOR SELECT
  USING (cashier_id = auth.uid());

CREATE POLICY "cashier_insert_groups"
  ON transaction_groups FOR INSERT
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "admin_read_all_groups"
  ON transaction_groups FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `transactions`
```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_group_id uuid NOT NULL REFERENCES transaction_groups(id) ON DELETE CASCADE,
  cashier_id uuid NOT NULL REFERENCES users(id),
  activity_id uuid NOT NULL REFERENCES activities(id),
  price_type 'local' | 'foreign' NOT NULL,
  amount numeric(10, 2) NOT NULL,
  token_index integer,  -- 1, 2, 3, ... (NULL until group is finalized)
  token_total integer,  -- Total in group (NULL until group is finalized)
  txn_reference text NOT NULL UNIQUE,  -- TXN-YYYYMMDDHHmmssSSS-S
  print_status 'pending' | 'printed' | 'failed' DEFAULT 'pending',
  printed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transactions_transaction_group_id ON transactions(transaction_group_id);
CREATE INDEX idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX idx_transactions_activity_id ON transactions(activity_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_txn_reference ON transactions(txn_reference);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_read_own_transactions"
  ON transactions FOR SELECT
  USING (cashier_id = auth.uid());

CREATE POLICY "cashier_insert_transactions"
  ON transactions FOR INSERT
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "admin_read_all_transactions"
  ON transactions FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `tokens`
```sql
CREATE TABLE tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  token_number text NOT NULL UNIQUE,  -- CWPCCMB-YYYYMMDD-XXXX
  reprint_count integer DEFAULT 0,
  first_reprinted_at timestamptz,
  latest_reprinted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tokens_token_number ON tokens(token_number);
CREATE INDEX idx_tokens_transaction_id ON tokens(transaction_id);

ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_read_own_tokens"
  ON tokens FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE cashier_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_all_tokens"
  ON tokens FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `audit_log`
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,  -- LOGIN, LOGOUT, TXN_CREATE, PRINT, REPRINT, CANCEL, USER_CREATE, etc.
  entity_type text,      -- transaction, activity, user, category
  entity_id uuid,
  metadata jsonb,        -- Extra context
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_read_own_audit"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admin_read_all_audit"
  ON audit_log FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `error_logs`
```sql
CREATE TABLE error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  message text NOT NULL,
  stack text,
  context jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_error_logs"
  ON error_logs FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

### Table: `printer_status_cache`
```sql
CREATE TABLE printer_status_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_ip text NOT NULL UNIQUE,
  is_online boolean DEFAULT false,
  last_checked_at timestamptz DEFAULT now(),
  error_message text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_printer_status_cache_ip ON printer_status_cache(printer_ip);

ALTER TABLE printer_status_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_printer_status"
  ON printer_status_cache FOR SELECT TO authenticated USING (true);
```

---

### SEQUENCE: `daily_token_seq`
```sql
CREATE SEQUENCE daily_token_seq START 1 INCREMENT 1 MAXVALUE 9999 CYCLE;

-- SQL Function to generate token number
CREATE OR REPLACE FUNCTION generate_token_number()
RETURNS text AS $$
DECLARE
  v_seq_val integer;
BEGIN
  v_seq_val := nextval('daily_token_seq');
  RETURN 'CWPCCMB-' || to_char(NOW() AT TIME ZONE 'Asia/Colombo', 'YYYYMMDD') || '-' || LPAD(v_seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql STABLE;
```

---

### MATERIALIZED VIEW: `daily_summary`
```sql
CREATE MATERIALIZED VIEW daily_summary AS
  SELECT
    t.cashier_id,
    DATE(t.created_at AT TIME ZONE 'Asia/Colombo') AS sale_date,
    a.id AS activity_id,
    a.name AS activity_name,
    t.price_type,
    COUNT(*) FILTER (WHERE t.cancelled_at IS NULL) AS count,
    SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL) AS total_amount
  FROM transactions t
  JOIN activities a ON t.activity_id = a.id
  WHERE t.created_at >= NOW() - INTERVAL '2 years'
  GROUP BY t.cashier_id, DATE(t.created_at), a.id, a.name, t.price_type;

CREATE UNIQUE INDEX idx_daily_summary_refresh
  ON daily_summary (cashier_id, sale_date, activity_id, price_type);

-- Refresh via Edge Function cron: every 5 minutes
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_summary;
```

---

## PART 2: PROJECT STRUCTURE (No `src/` folder)

```
port-city-carnival/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── logout/page.tsx
│   ├── (pos)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/page.tsx
│   │   └── middleware.ts
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── users/page.tsx
│   │   ├── users/[id]/page.tsx
│   │   ├── activities/page.tsx
│   │   ├── activities/[id]/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── reports/daily/page.tsx
│   │   ├── reports/activity/page.tsx
│   │   ├── reports/cashier/page.tsx
│   │   ├── reports/transactions/page.tsx
│   │   ├── audit-log/page.tsx
│   │   └── maintenance/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── activities/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── [id]/image/route.ts
│   │   ├── categories/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── transaction-groups/route.ts
│   │   ├── transactions/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── [id]/reprint/route.ts
│   │   │   └── search/route.ts
│   │   ├── print/
│   │   │   ├── route.ts
│   │   │   └── discover/route.ts
│   │   ├── reports/
│   │   │   ├── daily/route.ts
│   │   │   ├── activity/route.ts
│   │   │   ├── cashier/route.ts
│   │   │   └── export/route.ts
│   │   ├── admin/users/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── health/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── error.tsx
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── LogoutButton.tsx
│   ├── pos/
│   │   ├── ActivityGrid.tsx
│   │   ├── ActivityButton.tsx
│   │   ├── PricingToggle.tsx
│   │   ├── PaymentConfirmation.tsx
│   │   ├── DailySummary.tsx
│   │   ├── TransactionHistory.tsx
│   │   └── PrintingStatus.tsx
│   ├── admin/
│   │   ├── UserForm.tsx
│   │   ├── ActivityForm.tsx
│   │   ├── PricingTable.tsx
│   │   └── AuditLog.tsx
│   └── common/
│       ├── SearchInput.tsx
│       ├── Pagination.tsx
│       ├── LoadingSpinner.tsx
│       ├── ErrorState.tsx
│       ├── EmptyState.tsx
│       └── Toast.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useDebouncedCallback.ts
│   ├── useActivities.ts
│   ├── useTransactions.ts
│   ├── usePriceMode.ts
│   ├── usePrint.ts
│   └── useReports.ts
├── lib/
│   ├── auth.ts
│   ├── supabase-client.ts
│   ├── supabase-server.ts
│   ├── printer.ts
│   ├── printer-discovery.ts
│   ├── dateUtils.ts
│   ├── errors.ts
│   ├── rateLimit.ts
│   ├── logger.ts
│   ├── schemas.ts
│   ├── constants.ts
│   └── export-helpers.ts
├── stores/
│   ├── priceMode.ts
│   ├── notifications.ts
│   ├── printerStatus.ts
│   └── transactionGroup.ts
├── types/
│   ├── activity.ts
│   ├── transaction.ts
│   ├── token.ts
│   ├── category.ts
│   ├── user.ts
│   ├── printer.ts
│   ├── database.ts (generated from Supabase)
│   └── api.ts
├── middleware.ts
├── public/
│   ├── logo.png
│   └── fonts/
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_auth_tables.sql
│   │   ├── 002_create_categories.sql
│   │   ├── 003_create_activities.sql
│   │   ├── 004_create_transaction_groups.sql
│   │   ├── 005_create_transactions.sql
│   │   ├── 006_create_tokens.sql
│   │   ├── 007_create_audit_log.sql
│   │   ├── 008_create_error_logs.sql
│   │   ├── 009_create_printer_status_cache.sql
│   │   ├── 010_setup_sequences_and_functions.sql
│   │   ├── 011_create_materialized_view.sql
│   │   └── 012_setup_rls_policies.sql
│   └── seed.sql
├── .env.example
├── .env.local (NOT committed)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## PART 3: KEY IMPLEMENTATION PATTERNS

### Transaction Group Workflow
```
1. Cashier taps first activity for customer
   → Create transaction_group (if none in current session)
   → Store group_id in Zustand store

2. Each activity tap
   → Create transaction (linked to group_id)
   → Query all transactions in group to get total count
   → Print ticket with "X of Y"
   → Increment token sequence

3. Click "End Customer" or session timeout
   → Finalize transaction_group (set completed_at)
   → Clear Zustand store
   → Next activity tap creates new group
```

### Printer Discovery & Connection
```typescript
// lib/printer-discovery.ts
- Poll common ports (9100, 515, 631)
- Check SNMP if available
- Try TCP connect to static IP from env
- Store status in printer_status_cache table
- Return: { ip, port, model, online }
```

### Print Flow
```typescript
// app/api/print/route.ts
1. Validate transaction exists and belongs to cashier
2. Query transaction_group to get token_total
3. Calculate token_index (position in group)
4. Generate token_number via DB function
5. Create token record
6. Build ESC/POS ticket data
7. Establish printer connection (use discovered IP/port)
8. Send print job
9. On success: update transaction (print_status = 'printed', printed_at)
10. On failure: update transaction (print_status = 'failed')
11. Log to audit_log
12. Return status to client (toast notification)
```

### Reprint Policy
```typescript
// Allows unlimited reprints
// After 1st reprint, flags in reports
if (token.reprint_count === 0) {
  // First reprint - update first_reprinted_at
  token.first_reprinted_at = now()
}
token.latest_reprinted_at = now()
token.reprint_count++
// Report query: WHERE reprint_count > 0
```

---

## PART 4: STATE MANAGEMENT (Zustand)

### Price Mode Store
```typescript
// stores/priceMode.ts
{
  priceType: 'local' | 'foreign'
  toggle: () => void
  getPrice: (activity: Activity) => number
}
```

### Transaction Group Store (NEW)
```typescript
// stores/transactionGroup.ts
{
  currentGroupId: uuid | null
  createdAt: timestamp
  transactionCount: number
  totalAmount: number

  startNewGroup: () => void
  endGroup: () => void
  increment: (amount: number) => void
  getItemCount: () => number
}
```

### Printer Status Store
```typescript
// stores/printerStatus.ts
{
  isOnline: boolean
  ip: string
  port: number
  lastCheckedAt: timestamp
  error: string | null

  checkStatus: () => Promise<void>
  setOffline: (reason: string) => void
}
```

---

## PART 5: VALIDATION SCHEMAS (Zod)

```typescript
// lib/schemas.ts

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export const ActivitySchema = z.object({
  name: z.string().min(1).max(100),
  category_id: z.string().uuid().optional(),
  local_price: z.number().min(0).max(99999),
  foreign_price: z.number().min(0).max(99999),
  image_url: z.string().url().optional()
})

export const TransactionSchema = z.object({
  transaction_group_id: z.string().uuid(),
  activity_id: z.string().uuid(),
  price_type: z.enum(['local', 'foreign']),
  amount: z.number().min(0)
})

export const PrintRequestSchema = z.object({
  transaction_id: z.string().uuid()
})
```

---

## PART 6: RATE LIMITING

```typescript
// lib/rateLimit.ts
{
  login: 5 attempts / 15 minutes per IP
  print: 10 requests / minute per user
  report_export: 5 exports / hour per user
  admin_mutations: 30 requests / minute per user
  read_operations: 120 requests / minute per user
}
```

---

## PART 7: LIBRARIES & DEPENDENCIES

**No ORM. Using Supabase JS Client + type generation.**

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.40.0",
    "@supabase/ssr": "^0.1.0",
    "zustand": "^4.4.0",
    "tailwindcss": "^3.3.0",
    "@shadcn/ui": "^0.x",
    "lodash": "^4.17.21",
    "date-fns": "^2.31.0",
    "date-fns-tz": "^2.0.0",
    "zod": "^3.22.0",
    "node-thermal-printer": "^8.0.0",
    "sheetjs-ce": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/lodash": "^4.14.0",
    "@supabase/supabase-js": "^2.40.0"
  }
}
```

**Why no ORM?**
- Supabase PostgREST API is fast and native
- Need raw SQL access (sequences, functions, RLS)
- API target: <200ms response (Prisma adds 150-250ms overhead)
- Simple schema, no complex relationships
- Type safety via generated types from Supabase schema

**Type Generation:**
```bash
# Generate TypeScript types from Supabase schema
supabase gen types typescript --db-url=$DATABASE_URL > types/database.ts
```

This gives you full type safety without ORM complexity.

**API Pattern (Supabase JS Client):**
```typescript
// lib/supabase-server.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabaseServer = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Usage in API route — fully typed
const { data, error } = await supabaseServer
  .from('transactions')
  .insert({
    transaction_group_id: groupId,
    cashier_id: userId,
    activity_id: activityId,
    price_type,
    amount
  })
  .select()

// For complex queries, use raw SQL:
const { data } = await supabaseServer.rpc('generate_token_number')
```

---

## PART 8: ENVIRONMENT VARIABLES (.env.example)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Printer (Network Discovery)
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
PRINTER_DISCOVERY_ENABLED=true
PRINTER_DISCOVERY_TIMEOUT_MS=5000
PRINTER_DISCOVERY_PORTS=9100,515,631

# App
APP_ENV=development
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=City of Wonder POS
```

---

## PART 9: ERROR HANDLING HIERARCHY

```typescript
// lib/errors.ts

UnauthorizedError (401)
  ↓
ForbiddenError (403)
  ↓
NotFoundError (404)
  ↓
ValidationError (400, with Zod details)
  ↓
PrintError (500, with transaction_id)
  ↓
DatabaseError (500)
  ↓
PrinterDiscoveryError (500, with attempted IPs)
  ↓
RateLimitError (429)
```

---

## PART 10: SECURITY MATRIX

| Layer | Implementation |
|---|---|
| Auth | Supabase JWT + session timeout (8h) |
| API | requireAuth middleware + role checks |
| DB | RLS policies (row-level, all tables) |
| Input | Zod validation on all endpoints |
| Pricing | Server-side recalculation, never trust client amount |
| Printer | Local network only, requires valid transaction_id |
| Audit | All actions logged (login, txn, print, reprint, admin changes) |
| Token | Unique constraint + DB sequence prevents duplicates |

