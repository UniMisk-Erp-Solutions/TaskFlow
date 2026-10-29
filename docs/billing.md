# Plans, the Pro trial and payments

The server is the only source of truth. The browser shows what `GET /billing/status` returns and never decides anything itself.

## Where it lives
- Database: `organizations.plan` (`free` | `pro` | `business`) and `plan_status` (`none` | `trialing` | `active` | `expired`), plus `trial_started_at`, `trial_ends_at`, `trial_used`, `paid_until`. A trigger stops the browser from changing any of them. Tables `payments` and `business_inquiries` have row level security and no policies, so only the API can use them. Migrations: `20261029120000_organization_plan.sql`, `20261029140000_billing.sql`.
- API: `supabase/functions/api/billing.ts` (the rules) and `index.ts` (`/billing/*`, `/public/business-inquiry`, and the lock inside `requireAuth`).
- App: `BillingContext.jsx`, `components/SubscriptionGate.jsx`, `landing/pages/Pricing.tsx`, `landing/components/BusinessInquiryModal.tsx`.

## Flows
- **Free "Get Started"**: sends a visitor to sign up, a signed-in person to the app. It never changes a plan, so a paid subscription is never overwritten.
- **Pro "Start 7-Day Free Trial"**: a workspace admin only. One conditional update (`plan = free`, `plan_status = none`, `trial_used = false`) so a trial can start once and never over a paid plan. The trial ends 7 days later, measured on the server.
- **After the 7 days**: the server reports the workspace as locked. Every protected API route answers `402 subscription_required` (sign-in, profile, billing and notification routes stay open). The app shows a payment popup that cannot be dismissed. Non-admins are told to ask their admin.
- **Payments**: `POST /billing/checkout` answers `503 payments_not_configured` until `PAYMENT_PROVIDER` is set on the server and a provider is built in. No payment is ever recorded or marked successful without a real provider confirmation. A pending payment can be cancelled with `POST /billing/payments/:id/cancel`; failed and cancelled payments are shown in the popup and keep the workspace locked.
- **Business "Contact Team Unimisk"**: `POST /public/business-inquiry` validates every field, ignores bots (hidden field), limits repeats (3 per email and 40 overall per hour) and stores the request in `business_inquiries`. Read them with SQL: `select * from business_inquiries order by created_at desc;`.

## Not done yet
- A payment provider (Razorpay or Stripe) with a signed webhook that sets `plan_status = active` and `paid_until`.
- Chat messages and file uploads go straight to the database, not through the API, so the lock does not cover them yet.
