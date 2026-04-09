# Ticket Structure — Carnival POS System

## Overview

Every printed ticket is the **single source of truth** for an activity token.
One ticket = one activity = one transaction. No exceptions.

---

## Physical Specs

| Property | Value |
|---|---|
| Paper width | 80mm thermal |
| Printer | Xprinter XP-80T |
| Protocol | ESC/POS over LAN (static IP) |
| Library | `node-thermal-printer` (npm) |
| Print trigger | `POST /api/print` (Next.js API route) |
| Max print time | 2 seconds from confirmation tap |

---

## Ticket Layout (Top to Bottom)

```
┌─────────────────────────────────┐
│                                 │
│     [CITY OF WONDER LOGO]       │  ← Centered, ~40mm wide
│   AT PORT CITY COLOMBO          │  ← Subtitle, small font
│                                 │
│ ================================│  ← Divider
│       ACTIVITY TOKEN            │  ← Bold, centered
│  CWPCCMB-20260401-0001          │  ← Token ID, monospace
│ ================================│  ← Divider
│                                 │
│ Activity : Speed Car            │  ← Activity name, bold
│ Date     : 01-04-2026           │  ← DD-MM-YYYY
│ Time     : 12:40:56 AM          │  ← HH:MM:SS AM/PM
│ Cashier  : John D.              │  ← Cashier display name
│ Token    : 1 of 1               │  ← Index of total in txn
│                                 │
│ ================================│
│ Value  :  Rs. 500.00            │  ← LARGE FONT, bold
│ Txn No : TXN-20260401XXXX-S     │  ← Transaction reference
│ ================================│
│                                 │
│  Please surrender this token    │  ← Small font, centered
│  at the activity point.         │
│  Cannot be reused.              │
│  No Cash refund.                │
│                                 │
└─────────────────────────────────┘
```

---

## Field Definitions

### Token ID
```
Format  : CWPCCMB-YYYYMMDD-XXXX
Example : CWPCCMB-20260401-0001

- CWPCCMB  → Venue code (City of Wonder Port City CMB)
- YYYYMMDD → Print date
- XXXX     → 4-digit daily sequence, resets to 0001 each day
```

### Transaction Number
```
Format  : TXN-YYYYMMDDHHmmssSSS-S
Example : TXN-20260401124056001-S

- TXN        → Prefix
- Timestamp  → YYYYMMDDHHmmssSSS (milliseconds for uniqueness)
- S          → Suffix (S = Standard, can extend for other types)
```

### Token Index ("X of Y")
```
- Appears when cashier prints same activity multiple times in one session
- Each ticket is still a separate bill
- "1 of 3" means this is the 1st token out of 3 purchased in this transaction group
- Y is stored in the transaction record, not calculated at print time
```

### Date & Time
```
- Date format : DD-MM-YYYY  (matches Sri Lankan standard)
- Time format : HH:MM:SS AM/PM
- Source      : Server time at moment of transaction creation (never client time)
```

---

## Pricing Display Rules

| Price Type | Display |
|---|---|
| Local | `Rs. 500.00` |
| Foreign | `Rs. 750.00` |
| Cricket - Two Overs (Local) | `Rs. 900.00` |
| Horse Ride - Family (Foreign) | `Rs. 1,750.00` |

- Always show 2 decimal places
- Always prefix with `Rs.`
- Use comma separator for thousands: `Rs. 1,500.00`

---

## ESC/POS Print Sequence

```javascript
// Pseudocode — actual implementation in /lib/printer.ts

printer.alignCenter()
printer.printImage(logo)           // Logo bitmap, pre-converted
printer.drawLine()
printer.bold(true)
printer.println("ACTIVITY TOKEN")
printer.bold(false)
printer.println(tokenId)           // CWPCCMB-YYYYMMDD-XXXX
printer.drawLine()

printer.tableCustom([
  { text: "Activity", align: "LEFT", width: 0.4 },
  { text: activityName, align: "RIGHT", width: 0.6 }
])
// ... date, time, cashier, token index rows

printer.drawLine()
printer.setTextSize(1, 1)          // Double height for value
printer.bold(true)
printer.println(`Value  :  Rs. ${amount}`)
printer.bold(false)
printer.setTextSize(0, 0)          // Reset
printer.println(`Txn No : ${txnNumber}`)
printer.drawLine()

printer.alignCenter()
printer.println("Please surrender this token")
printer.println("at the activity point.")
printer.println("Cannot be reused. No Cash refund.")
printer.cut()
```

---

## Ticket Data Model (Supabase)

```sql
-- tokens table
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
transaction_id uuid REFERENCES transactions(id)
token_number  text NOT NULL UNIQUE     -- CWPCCMB-20260401-0001
token_index   int  NOT NULL DEFAULT 1  -- 1 of Y
token_total   int  NOT NULL DEFAULT 1  -- Y
printed_at    timestamptz DEFAULT now()
reprint_count int  DEFAULT 0
```

---

## Reprint Policy

- Cashier can reprint a ticket from the transaction history screen
- Reprinted ticket is **identical** to original (same token ID, same txn number)
- Reprint is logged: `reprint_count` incremented, `reprinted_by`, `reprinted_at` recorded
- Reprints are flagged in admin reports
- Maximum **1 reprint** allowed per token (configurable in admin settings)

---

## Error States

| Situation | Behaviour |
|---|---|
| Printer offline | Show error toast, do NOT create transaction, retry button shown |
| Print job times out (>5s) | Mark transaction as `print_failed`, alert cashier, allow reprint |
| Paper out | ESC/POS status check before print; warn cashier before confirming payment |
| Duplicate token ID | Server rejects, regenerates sequence, retries automatically (max 3 attempts) |
