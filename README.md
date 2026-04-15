# SAIACS POD — Print on Demand app

Technical implementation of the SAIACS Press & Media Print-on-Demand service per
`POD_Development_Spec.md` v1.1. Built to run entirely on free-tier
**Supabase + Vercel**.

Two surfaces:

- **Public order form** (`/`) — unauthenticated, 3-step with conditional routing and file upload.
- **Internal dashboard** (`/dashboard`) — role-based (manager / production / bookstore) covering
  orders, pricing, production status, shipping, and invoicing.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui (SAIACS brand palette + Merriweather/Raleway fonts)
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Vercel for frontend hosting

## Project layout

```
src/
  components/
    form/            # 3-step public order form
    dashboard/       # internal dashboard + orders + admin
    dashboard/tabs/  # order detail tabs (Details/Files/Pricing/Production/Shipping/Invoice/Audit)
    pricing/         # calculator + rate card admin
    shared/          # Logo, StatusBadge, ProtectedRoute, EmailTemplateDialog
    ui/              # shadcn primitives
  lib/               # supabase client, auth provider, types, email templates, utils
  hooks/             # useToast
  pages/             # OrderForm, OrderSubmitted, Login, NotAuthorized, Dashboard
supabase/
  migrations/        # 10 timestamped SQL migrations (schema, RLS, triggers, storage)
  functions/
    generate-order-number/
    calculate-price/
    create-user/
  seed.sql           # placeholder rate card
  config.toml        # Supabase CLI config
```

## Local development

```bash
npm install
cp .env.example .env     # then paste real values
npm run dev              # http://localhost:5173
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL e.g. `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | yes | Safe to expose; RLS enforces access |
| `VITE_DEBUG` | no | `true` for verbose logging |

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. `npx supabase link --project-ref <your-project-ref>`
3. `npx supabase db push` — runs all migrations in `supabase/migrations/`.
4. `npx supabase db execute --file supabase/seed.sql` — placeholder rate card.
5. `npx supabase functions deploy generate-order-number calculate-price create-user`
6. In Supabase Studio → **Auth → Users**, create the first **manager** account manually.
   Then in the SQL editor:
   ```sql
   INSERT INTO public.users (id, email, name, role)
   VALUES ('<auth user id>', '<email>', '<name>', 'manager');
   ```
   Subsequent users can be created via the in-app **Users** admin screen.
7. Regenerate typed DB types any time the schema changes:
   ```bash
   npm run gen:types
   ```

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |
| `npm run gen:types` | Regenerate Supabase TS types |

## Deployment (Vercel)

1. Push repo to GitHub.
2. Import the repo at [vercel.com](https://vercel.com).
3. Framework: **Vite**. Build command `npm run build`. Output `dist`.
4. Env vars: set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel project settings.
5. `vercel.json` contains the SPA rewrite so client-side routes work on refresh.

## Brand

SAIACS brand system is wired into `tailwind.config.js` and `src/index.css`:

- `bg-brand-foundations` `#1A2549` (primary navy)
- `bg-brand-traditions` `#183154` (darker navy / hover)
- `bg-brand-snow` `#F0F7FA` (background)
- `bg-brand-sky` `#9FC3F1` (accent)
- `bg-brand-gold` `#F5D700` (highlight)
- `bg-brand-tangerine` `#F79358` (on-hold / attention)
- `font-display` = Merriweather (headings)
- `font-sans` = Raleway (body/UI)

`src/components/shared/Logo.tsx` is a placeholder mark. Drop a real
`logo-primary.svg` / `logo-inverse.svg` into `src/assets/logo/` and import
them there.

## Security model

- Every table has RLS enabled — no API middleware is trusted.
- `get_user_role()` SECURITY DEFINER function resolves the caller's role and
  `is_active` flag in one shot.
- **Public order form** uses only the anon key. Row-level policies explicitly
  allow anonymous inserts into `orders` and `order_files`, plus uploads to the
  `order-files` storage bucket.
- **Manager** can see and mutate everything.
- **Production** is scoped to orders in `confirmed / in_production / ready`.
- **Bookstore** is scoped to `ready` orders with `delivery_method = courier`.
- Audit log is populated by a Postgres trigger on `UPDATE orders` — client code
  cannot bypass it. The client calls `set_audit_user(auth.uid())` once per
  session so the trigger can attribute changes.
- Edge functions use the service role key to bypass RLS; each function
  re-verifies the caller's role via the JWT before running.

## Status state machine

```
new → under_review → quoted → confirmed → in_production → ready
                                                    ├→ picked_up → invoiced → closed
                                                    └→ shipped    → invoiced → closed
Any → cancelled (manager only)
```

Production sub-status: `not_started → started → in_progress → sample_approval → full_production → completed`.
Hold/resume is tracked in `order_holds`; resuming restores the captured
`production_status_before_hold`.

## Phase 1 email workflow

Per spec §9, Phase 1 generates **copyable email content** instead of sending
anything automatically. `EmailTemplateDialog` renders 6 templates
(Quote / Confirmation / Sample / Ready / Shipped / Invoice) with
order-specific variables interpolated, a subject + body copy button, and a
fallback "Open in mail app" mailto link.

Phase 2 (Resend automation) can be added behind the same UI without changing
any callers.

## Roadmap (Phase 2+)

- Automated email via Resend edge function (free 100/day)
- Client-facing tracking page via a public `/track/:order_number` route
- Zoho Inventory sync for invoicing
- Rate card audit log
- On-hold escalation rules

---

Built by the SAIACS team.
