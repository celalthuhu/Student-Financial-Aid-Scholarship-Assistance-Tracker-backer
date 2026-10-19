-- Apply after schema.sql to add live Finance Admin and Student access.
-- Re-runnable; does not delete existing application data.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('SUPER_ADMIN', 'WORKING_SCHOLAR_ADMIN', 'FINANCE_ADMIN', 'STUDENT'));

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
  add column if not exists application_type text not null default 'WORKING_SCHOLAR';
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

create table if not exists public.scholarship_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 3 and 120),
  application_type text not null check (application_type in ('WORKING_SCHOLAR', 'FINANCIAL_AID')),
  description text not null default '',
  eligibility text not null,
  requirements text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scholarship_programs_name_type_unique unique (name, application_type)
);
alter table public.working_scholar_applications
  add column if not exists program_id uuid references public.scholarship_programs(id) on delete set null;
create index if not exists scholarship_programs_active_idx
  on public.scholarship_programs (is_active, application_type);
alter table public.scholarship_programs enable row level security;

create or replace function public.is_finance_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_admin_role() = 'FINANCE_ADMIN', false)
$$;

create or replace function public.is_student()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_admin_role() = 'STUDENT', false)
$$;

create or replace function public.update_student_profile(p_full_name text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
begin
  if not public.is_student() then
    raise exception 'Only the signed-in student can update this profile.' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Full name must be between 2 and 120 characters.';
  end if;
  update public.profiles
     set full_name = v_name
   where id = auth.uid()
   returning * into v_profile;
  if not found then raise exception 'Student profile not found.' using errcode = 'P0002'; end if;
  return v_profile;
end $$;

-- Admin-only legacy features stay limited to Super Admin and Working Scholar Admin.
create or replace function public.is_any_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_admin_role() in ('SUPER_ADMIN', 'WORKING_SCHOLAR_ADMIN')
$$;

drop policy if exists apps_select on public.working_scholar_applications;
create policy apps_select on public.working_scholar_applications for select to authenticated
  using (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID' and assigned_office = 'Finance')
    or (public.is_student() and student_user_id = auth.uid())
  );

drop policy if exists apps_insert on public.working_scholar_applications;
create policy apps_insert on public.working_scholar_applications for insert to authenticated
  with check (
    (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR' and status = 'PENDING')
    or (public.is_student() and student_user_id = auth.uid() and status = 'PENDING')
  );

drop policy if exists apps_update on public.working_scholar_applications;
create policy apps_update on public.working_scholar_applications for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID' and assigned_office = 'Finance')
  )
  with check (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID' and assigned_office = 'Finance')
  );

create or replace function public.change_application_status(
  p_application_id uuid, p_new_status text, p_reason text default null)
returns public.working_scholar_applications
language plpgsql security definer set search_path = public as $$
declare
  v_app public.working_scholar_applications;
  v_old text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_role text := public.current_admin_role();
begin
  select * into v_app from public.working_scholar_applications
   where id = p_application_id for update;
  if not found then raise exception 'Application not found.' using errcode = 'P0002'; end if;
  if not (
    v_role = 'SUPER_ADMIN'
    or (v_role = 'WORKING_SCHOLAR_ADMIN' and v_app.application_type = 'WORKING_SCHOLAR')
    or (v_role = 'FINANCE_ADMIN' and v_app.application_type = 'FINANCIAL_AID' and v_app.assigned_office = 'Finance')
  ) then
    raise exception 'You are not authorized to change this application status.' using errcode = '42501';
  end if;
  v_old := v_app.status;
  if not public.is_valid_status_transition(v_old, p_new_status) then
    raise exception 'Invalid status change: % to %.', v_old, p_new_status;
  end if;
  if p_new_status = 'DENIED' and v_reason is null then
    raise exception 'A denial reason is required.';
  end if;
  if p_new_status = 'FOR_FOLLOW_UP' and v_reason is null then
    raise exception 'A follow-up message is required.';
  end if;

  perform set_config('app.status_rpc', 'on', true);
  update public.working_scholar_applications set
    status = p_new_status,
    denial_reason = case when p_new_status = 'DENIED' then v_reason else null end,
    decided_by = case when p_new_status in ('APPROVED','DENIED') then auth.uid()
                      when p_new_status = 'INACTIVE' then decided_by else null end,
    decided_at = case when p_new_status in ('APPROVED','DENIED') then now()
                      when p_new_status = 'INACTIVE' then decided_at else null end
   where id = p_application_id returning * into v_app;
  perform set_config('app.status_rpc', 'off', true);
  insert into public.application_status_history
    (application_id, from_status, to_status, reason, changed_by)
  values (p_application_id, v_old, p_new_status, v_reason, auth.uid());
  return v_app;
end $$;

drop policy if exists programs_select on public.scholarship_programs;
create policy programs_select on public.scholarship_programs for select to authenticated
  using (
    (public.is_student() and is_active)
    or public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  );
drop policy if exists programs_insert on public.scholarship_programs;
create policy programs_insert on public.scholarship_programs for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  );
drop policy if exists programs_update on public.scholarship_programs;
create policy programs_update on public.scholarship_programs for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  )
  with check (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  );
drop policy if exists programs_delete on public.scholarship_programs;
create policy programs_delete on public.scholarship_programs for delete to authenticated
  using (public.is_super_admin());

drop policy if exists docs_select on public.application_documents;
create policy docs_select on public.application_documents for select to authenticated
  using (exists (
    select 1 from public.working_scholar_applications a
    where a.id = application_documents.application_id
      and (
        public.is_super_admin()
        or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
        or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
        or (public.is_student() and a.student_user_id = auth.uid())
      )
  ));

drop policy if exists req_select on public.document_requirements;
create policy req_select on public.document_requirements for select to authenticated
  using (
    (public.is_student() and is_active)
    or public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  );
drop policy if exists req_insert on public.document_requirements;
create policy req_insert on public.document_requirements for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  );
drop policy if exists req_update on public.document_requirements;
create policy req_update on public.document_requirements for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  )
  with check (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and application_type = 'WORKING_SCHOLAR')
    or (public.is_finance_admin() and application_type = 'FINANCIAL_AID')
  );
drop policy if exists docs_insert on public.application_documents;
create policy docs_insert on public.application_documents for insert to authenticated
  with check (exists (
    select 1 from public.working_scholar_applications a
    where a.id = application_documents.application_id
      and (
        (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
        or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
        or (public.is_student() and a.student_user_id = auth.uid() and a.status = 'PENDING')
      )
  ));
drop policy if exists docs_update on public.application_documents;
create policy docs_update on public.application_documents for update to authenticated
  using (exists (
    select 1 from public.working_scholar_applications a
    where a.id = application_documents.application_id
      and (
        public.is_super_admin()
        or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
        or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
      )
  ))
  with check (exists (
    select 1 from public.working_scholar_applications a
    where a.id = application_documents.application_id
      and (
        public.is_super_admin()
        or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
        or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
      )
  ));
drop policy if exists docs_delete on public.application_documents;
create policy docs_delete on public.application_documents for delete to authenticated
  using (exists (
    select 1 from public.working_scholar_applications a
    where a.id = application_documents.application_id
      and (
        public.is_super_admin()
        or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
        or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
        or (public.is_student() and a.student_user_id = auth.uid() and a.status = 'PENDING')
      )
  ));

drop policy if exists history_select on public.application_status_history;
create policy history_select on public.application_status_history for select to authenticated
  using (exists (
    select 1 from public.working_scholar_applications a
    where a.id = application_status_history.application_id
      and (
        public.is_super_admin()
        or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
        or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
        or (public.is_student() and a.student_user_id = auth.uid())
      )
  ));

drop policy if exists follow_ups_select on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select to authenticated
  using (
    public.is_super_admin()
    or (public.is_working_scholar_admin() and exists (
      select 1 from public.working_scholar_applications a
      where a.id = follow_ups.application_id and a.application_type = 'WORKING_SCHOLAR'
    ))
    or (public.is_finance_admin() and exists (
      select 1 from public.working_scholar_applications a
      where a.id = follow_ups.application_id
        and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance'
    ))
    or (public.is_student() and exists (
      select 1 from public.working_scholar_applications a
      where a.id = follow_ups.application_id and a.student_user_id = auth.uid()
    ))
  );

grant select on public.scholarship_programs to authenticated;
grant insert, update, delete on public.scholarship_programs to authenticated;
revoke all on function public.update_student_profile(text) from public, anon;
grant execute on function public.update_student_profile(text) to authenticated;

drop policy if exists app_docs_storage_select on storage.objects;
create policy app_docs_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.working_scholar_applications a
      where a.id::text = (storage.foldername(name))[1]
        and (
          public.is_super_admin()
          or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
          or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
          or (public.is_student() and a.student_user_id = auth.uid())
        )
    )
  );
drop policy if exists app_docs_storage_insert on storage.objects;
create policy app_docs_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.working_scholar_applications a
      where a.id::text = (storage.foldername(name))[1]
        and (
          (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
          or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
          or (public.is_student() and a.student_user_id = auth.uid() and a.status = 'PENDING')
        )
    )
  );
drop policy if exists app_docs_storage_delete on storage.objects;
create policy app_docs_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.working_scholar_applications a
      where a.id::text = (storage.foldername(name))[1]
        and (
          public.is_super_admin()
          or (public.is_working_scholar_admin() and a.application_type = 'WORKING_SCHOLAR')
          or (public.is_finance_admin() and a.application_type = 'FINANCIAL_AID' and a.assigned_office = 'Finance')
          or (public.is_student() and a.student_user_id = auth.uid() and a.status = 'PENDING')
        )
    )
  );
