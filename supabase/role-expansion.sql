-- FIXED COMPLETE MIGRATION: paste this entire file into a fresh Supabase SQL Editor query.
-- Do not run a fragment beginning with 'end if;'.
-- The transaction keeps database changes atomic if any statement fails.

BEGIN;

-- Aid Tracker role expansion migration.
-- Apply only to the intended Supabase project after reviewing the existing schema.
-- Intended to be additive and re-runnable; do not use as a substitute for schema.sql
-- when the base application tables are missing.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.working_scholar_applications') IS NULL
     OR to_regclass('public.document_requirements') IS NULL
     OR to_regclass('public.working_scholars') IS NULL
     OR to_regclass('public.slot_settings') IS NULL
     OR to_regclass('public.application_documents') IS NULL
     OR to_regclass('public.application_status_history') IS NULL
     OR to_regclass('public.follow_ups') IS NULL THEN
    RAISE EXCEPTION 'Aid Tracker base schema is incomplete. Verify schema.sql and required base tables before applying role-expansion.sql.';
  END IF;
END $$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'STUDENT'));

alter table public.working_scholar_applications
  add column if not exists application_type text not null default 'WORKING_SCHOLAR',
  add column if not exists student_user_id uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.working_scholar_applications'::regclass
      and conname = 'working_scholar_applications_type_check'
  ) then
    alter table public.working_scholar_applications
      add constraint working_scholar_applications_type_check
      check (application_type in ('WORKING_SCHOLAR', 'FINANCIAL_AID'));
  end if;
end $$;

create index if not exists applications_owner_idx
  on public.working_scholar_applications (student_user_id, application_date desc);
create index if not exists applications_type_idx
  on public.working_scholar_applications (application_type, application_date desc);

alter table public.document_requirements
  add column if not exists application_type text not null default 'WORKING_SCHOLAR',
  add column if not exists accepted_mime_types text[] not null default array['application/pdf','image/png','image/jpeg','image/webp'],
  add column if not exists max_file_size_bytes bigint not null default 10485760;
alter table public.document_requirements
  drop constraint if exists document_requirements_max_file_size_bytes_check;
alter table public.document_requirements
  add constraint document_requirements_max_file_size_bytes_check
    check (max_file_size_bytes between 1 and 10485760);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.document_requirements'::regclass
      and conname = 'document_requirements_type_check'
  ) then
    alter table public.document_requirements
      add constraint document_requirements_type_check
      check (application_type in ('WORKING_SCHOLAR', 'FINANCIAL_AID'));
  end if;
end $$;

create table if not exists public.application_requirement_snapshots (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.working_scholar_applications(id) on delete cascade,
  requirement_id uuid references public.document_requirements(id) on delete set null,
  application_type text not null check (application_type in ('WORKING_SCHOLAR','FINANCIAL_AID')),
  name text not null,
  description text,
  is_required boolean not null,
  accepted_mime_types text[] not null,
  max_file_size_bytes bigint not null check (max_file_size_bytes between 1 and 10485760),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (application_id, requirement_id)
);
create table if not exists public.application_requirement_snapshot_headers (
  application_id uuid primary key references public.working_scholar_applications(id) on delete cascade,
  application_type text not null check (application_type in ('WORKING_SCHOLAR','FINANCIAL_AID')),
  created_at timestamptz not null default now()
);
create index if not exists app_req_snapshots_application_idx
  on public.application_requirement_snapshots (application_id, sort_order);
alter table public.application_requirement_snapshots enable row level security;
alter table public.application_requirement_snapshot_headers enable row level security;