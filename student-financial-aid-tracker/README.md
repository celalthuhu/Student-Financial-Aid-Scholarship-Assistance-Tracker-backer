# Student Financial Aid & Scholarship Assistance Tracker

Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase Auth and Postgres. Login uses real Supabase email/password accounts; no local mock identity is used by the login flow.

## Requirements

- Node.js 20 LTS or later
- A Supabase project with the Auth and Postgres APIs enabled

## Install and configure

From PowerShell in this folder:

```powershell
npm install
Copy-Item .env.example .env.local
notepad .env.local
```

Configure the project URL and public anon/publishable key:

| Variable | Supabase source | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API > anon/publishable key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API > service_role/secret key | Private server-only |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally | Public |

Never expose, print, or commit `SUPABASE_SERVICE_ROLE_KEY`. `.env.local` is gitignored.

## Apply database schema and RLS

In the Supabase Dashboard SQL Editor, run these files in order:

1. `supabase/schema.sql`
2. `supabase/role-expansion.sql`

The second script adds Finance Admin and Student roles, application ownership and category fields, scholarship programs, and role-scoped policies. Apply both before setting up accounts. Review schemas before applying to a database with existing custom tables.

## Create the four real Supabase accounts

There are no hard-coded passwords. Set `SETUP_EMAIL_DOMAIN=student.local` and private initial passwords of at least 12 characters in `.env.local`. Unless email overrides are set, the script provisions these Auth users:

- `superadmin@student.local` — Super Admin
- `workingscholar@student.local` — Working Scholar Admin
- `financeadmin@student.local` — Finance Admin
- `acdstudent@student.local` — Student

The `.local` domain is for development and does not receive mail. The provisioning script creates confirmed users through Supabase's server-side Admin API; it does not use email delivery. Set `SETUP_*_FULL_NAME` and `SETUP_*_PASSWORD` for each account. You can override an address with its matching `SETUP_*_EMAIL` variable.

Keep `SUPABASE_SERVICE_ROLE_KEY` private in that same file. `SUPABASE_URL` is optional; if omitted, the script uses `NEXT_PUBLIC_SUPABASE_URL`. Then run:

```powershell
npm run provision:accounts
```

The script creates users in Supabase Auth, links each profile to that Auth user's UUID, and can be rerun without duplicating users. It refuses a conflicting role assignment. New users are email-confirmed and must change their initial password on first sign-in. Existing Auth passwords are left untouched unless `RESET_EXISTING_ACCOUNT_PASSWORDS=true` is explicitly set. Output includes actual configured emails and roles, but never prints passwords. Use the values entered in your private `.env.local` as initial credentials.

The Super Admin User Management screen can also create Working Scholar Admin, Finance Admin, or Student users or send invitations. Invite and recovery links require the Supabase email templates to point at `/auth/callback` and the Site URL to match `NEXT_PUBLIC_SITE_URL`.

## Run

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Other checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

## Live role workflows

- **Super Admin** → `/super-admin/dashboard`: administer user accounts, scholarship programs, and system-wide records.
- **Working Scholar Admin** → `/working-scholar/dashboard`: review and manage working-scholar records.
- **Finance Admin** → `/finance/dashboard`: review financial-aid applications assigned to Finance and see Finance reports.
- **Student** → `/student/dashboard`: a student-oriented home, searchable published programs, guided application submission, application status history, private requirement uploads, profile name updates, real application activity, and help guidance.

The role is taken from the authenticated user's `public.profiles` row. Server page/API checks and Postgres Row Level Security apply; Student data is constrained to the authenticated user's own profile ID, and Finance operations are scoped to financial-aid applications assigned to the Finance office. Status transitions remain validated by the database function.

Student application drafts are saved in that browser's local storage until submission because the current database schema does not include a draft model. Submitted applications, statuses, profile names, and uploaded files use Supabase. Deadlines, announcements, office contact details, and read/unread notification state are shown as unconfigured unless the database provides them; the portal does not invent those details.

## Troubleshooting

| Error | Action |
|---|---|
| `Supabase is not configured` | Check URL and public key in `.env.local`; restart `npm run dev`. |
| `Email or password is incorrect` | Supabase intentionally uses a generic response for an unknown user or wrong password. Check that the account is in this exact project, confirmed, and using the current password. |
| `profiles` returns `PGRST205` or 404 | Run `supabase/schema.sql` and then `supabase/role-expansion.sql` in the project matching `.env.local`; refresh the Supabase API schema cache if needed. |
| User has no profile | Run `npm run provision:accounts` after applying both SQL files. |
| `SUPABASE_SERVICE_ROLE_KEY` missing | Add it privately to `.env.local`; never use a `NEXT_PUBLIC_` variable for it. |
| `Could not find the function public.…` | Rerun the schema scripts and refresh the API schema cache. |
| Document upload fails | Confirm the private `application-documents` bucket from `schema.sql` exists; supported file types are PDF, PNG, JPEG, and WebP. |
