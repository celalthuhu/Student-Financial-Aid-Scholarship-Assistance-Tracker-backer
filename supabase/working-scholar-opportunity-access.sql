-- Apply after the complete role-expansion schema has created scholarship_programs
-- and added student_user_id/program_id to working_scholar_applications.
-- No application or scholarship records are deleted or rewritten.

begin;

do $$
begin
  if to_regclass('public.scholarship_programs') is null
     or to_regclass('public.working_scholar_applications') is null
     or to_regclass('public.working_scholars') is null
     or to_regclass('public.slot_settings') is null
     or to_regprocedure('public.current_admin_role()') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'scholarship_programs'
          and column_name = 'application_type'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'working_scholar_applications'
          and column_name = 'program_id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'working_scholar_applications'
          and column_name = 'student_user_id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'working_scholar_applications'
          and column_name = 'id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'working_scholar_applications'
          and column_name = 'status'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'working_scholars'
          and column_name = 'application_id'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'working_scholars'
          and column_name = 'participation_status'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'slot_settings'
          and column_name = 'applications_open'
     )
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'slot_settings'
          and column_name = 'created_at'
     ) then
    raise exception 'Working Scholar opportunity prerequisites are missing. Verify the complete schema, role-expansion objects, slot settings, and role helper before this migration.';
  end if;
end $$;

alter table public.scholarship_programs enable row level security;
alter table public.scholarship_programs
  add column if not exists max_slots integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.scholarship_programs'::regclass
       and conname = 'scholarship_programs_max_slots_check'
  ) then
    alter table public.scholarship_programs
      add constraint scholarship_programs_max_slots_check
      check (max_slots is null or max_slots between 0 and 100000);
  end if;
end $$;

grant select, insert, update on public.scholarship_programs to authenticated;

drop policy if exists working_scholar_admin_manage_programs on public.scholarship_programs;
create policy working_scholar_admin_manage_programs
  on public.scholarship_programs
  for all
  to authenticated
  using (
    (select public.current_admin_role()) = 'WORKING_SCHOLAR_ADMIN'
    and application_type = 'WORKING_SCHOLAR'
  )
  with check (
    (select public.current_admin_role()) = 'WORKING_SCHOLAR_ADMIN'
    and application_type = 'WORKING_SCHOLAR'
  );

create or replace function public.student_working_scholar_program_slots()
returns table (
  program_id uuid,
  configured boolean,
  max_slots integer,
  active_scholars bigint,
  remaining integer,
  applications_open boolean,
  uses_program_limit boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.current_admin_role() not in ('STUDENT','WORKING_SCHOLAR_ADMIN','SUPER_ADMIN'), true) then
    raise exception 'You are not authorized to view Working Scholar slot summaries.' using errcode = '42501';
  end if;

  return query
  with latest as (
    select s.max_slots as global_max, s.applications_open as is_open
      from public.slot_settings s
     order by s.created_at desc
     limit 1
  ),
  global_active as (
    select count(*)::bigint as occupied
      from public.working_scholars w
     where w.participation_status = 'ACTIVE'
  ),
  program_active as (
    select a.program_id, count(*)::bigint as occupied
      from public.working_scholars w
      join public.working_scholar_applications a on a.id = w.application_id
     where w.participation_status = 'ACTIVE'
       and a.program_id is not null
     group by a.program_id
  )
  select p.id,
         l.global_max is not null,
         coalesce(p.max_slots, l.global_max, 0),
         coalesce(pa.occupied, 0),
         greatest(least(
           coalesce(l.global_max, 0) - ga.occupied,
           coalesce(p.max_slots, l.global_max, 0) - coalesce(pa.occupied, 0)
         ), 0)::integer,
         coalesce(l.is_open, false),
         p.max_slots is not null
    from public.scholarship_programs p
    cross join global_active ga
    left join latest l on true
    left join program_active pa on pa.program_id = p.id
   where p.application_type = 'WORKING_SCHOLAR'
     and p.is_active;
end $$;
revoke all on function public.student_working_scholar_program_slots() from public, anon;
grant execute on function public.student_working_scholar_program_slots() to authenticated;

create or replace function public.guard_working_scholar_program_slot_capacity()
returns trigger language plpgsql set search_path = public as $$
declare
  v_program_id uuid;
  v_program_limit integer;
  v_program_active bigint;
begin
  if new.participation_status <> 'ACTIVE' then return new; end if;
  if tg_op = 'UPDATE' and old.participation_status = 'ACTIVE' then return new; end if;

  perform pg_advisory_xact_lock(hashtext('working_scholar_slots'));
  select a.program_id, p.max_slots
    into v_program_id, v_program_limit
    from public.working_scholar_applications a
    left join public.scholarship_programs p on p.id = a.program_id
   where a.id = new.application_id;

  if v_program_id is not null and v_program_limit is not null then
    select count(*) into v_program_active
      from public.working_scholars w
      join public.working_scholar_applications a on a.id = w.application_id
     where a.program_id = v_program_id
       and w.participation_status = 'ACTIVE'
       and (tg_op = 'INSERT' or w.id <> new.id);
    if v_program_active >= v_program_limit then
      raise exception 'No Working Scholar program slots are available (% of % in use).', v_program_active, v_program_limit;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_working_scholar_program_slot_capacity on public.working_scholars;
create trigger guard_working_scholar_program_slot_capacity
  before insert or update of participation_status on public.working_scholars
  for each row execute function public.guard_working_scholar_program_slot_capacity();

create or replace function public.guard_working_scholar_program_slot_limit()
returns trigger language plpgsql set search_path = public as $$
declare
  v_active bigint;
begin
  if new.max_slots is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('working_scholar_slots'));
  select count(*) into v_active
    from public.working_scholars w
    join public.working_scholar_applications a on a.id = w.application_id
   where a.program_id = new.id
     and w.participation_status = 'ACTIVE';
  if new.max_slots < v_active then
    raise exception 'Program maximum (%) cannot be lower than its active scholars (%).', new.max_slots, v_active;
  end if;
  return new;
end $$;

drop trigger if exists guard_working_scholar_program_slot_limit on public.scholarship_programs;
create trigger guard_working_scholar_program_slot_limit
  before update of max_slots on public.scholarship_programs
  for each row execute function public.guard_working_scholar_program_slot_limit();

do $$
begin
  if exists (
    select 1
      from public.working_scholar_applications
     where student_user_id is not null
       and program_id is not null
       and status not in ('DENIED', 'INACTIVE')
     group by student_user_id, program_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate active student applications exist for the same program. Review these records before enabling duplicate prevention.';
  end if;
end $$;

create unique index if not exists student_active_program_application_unique
  on public.working_scholar_applications (student_user_id, program_id)
  where student_user_id is not null
    and program_id is not null
    and status not in ('DENIED', 'INACTIVE');

notify pgrst, 'reload schema';
commit;
