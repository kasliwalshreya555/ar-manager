# Brightwater Advisory Receivables Hub

Next.js App Router + TypeScript + Tailwind + Supabase + Vitest. This project follows the supplied Brightwater assignment brief and uses the fixed six-table Supabase schema.

## Setup
1. Install current Node.js LTS and Git.
2. Copy `.env.example` to `.env.local`.
3. Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `AR_WORKSPACE_ID`. Keep `.env.local` private and never use `NEXT_PUBLIC_` for these values.
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. Tests: `npm test`; production compile: `npm run build`.

## Workspace
Create your own workspace once using the RPC described in the supplied assignment. Do not share the returned workspace id. The app never creates tables or schema.

## Architecture
- `lib/db.ts`: server-only Supabase client; injects `x-workspace`.
- `lib/ar/`: paise-based calculations; all amounts are integers in paise.
- `lib/actions.ts`: server actions validate before writes and revalidate views.
- `lib/asof.ts`: validates `?asof=YYYY-MM-DD`, defaults to Asia/Kolkata.
- Screens read shared calculations; components should not calculate balances themselves.

## Current implementation status
- Calculation functions for invoice/receipt/customer positions, R14 control check, statements, promise status, follow-ups, DSO, GST and FY numbering.
- Dashboard, customer list, invoice list and receipts list.
- Server-side mutations include customer create/update, invoice create/cancel/dispute, receipt creation with cleanup on allocation failure, credit note, note and allocation removal.
- CSV export and print-ready statement/report route foundations.
- UI and mutation coverage is a starter implementation; review `Known gaps` before submission.

## Assumptions and known gaps
- This scaffold has not been connected to a workspace because workspace creation must be performed by the user and the workspace id must remain private.
- The full official dataset should be snapshotted from Supabase after resetting the workspace, then all spot checks from the supplied brief should be encoded as fixture tests.
- The Supabase API does not offer transactions across separate requests; receipt creation deletes the just-created receipt if allocation insert fails, matching the brief.
- Add exhaustive Zod validation and improve the allocation editor and statement CSV before production submission.
