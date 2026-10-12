begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.user_role as enum ('EMPLOYEE', 'HR');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.attendance_status as enum ('PRESENT', 'LATE', 'ABSENT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.leave_status as enum ('PENDING', 'APPROVED', 'DECLINED');
exception when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete restrict,
  email text not null,
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  role public.user_role not null default 'EMPLOYEE',
  job_title text,
  department text,
  employment_status text not null default 'ACTIVE' check (employment_status in ('ACTIVE', 'ON_LEAVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create index if not exists profiles_company_id_idx on public.profiles (company_id);
create unique index if not exists profiles_email_lower_uidx on public.profiles (lower(email));

create table if not exists public.shift_config (
  company_id uuid primary key references public.companies(id) on delete cascade,
  shift_start time not null default time '09:00',
  shift_end time not null default time '17:00',
  grace_minutes smallint not null default 10 check (grace_minutes between 0 and 240),
  late_penalty_points smallint not null default 5 check (late_penalty_points between 0 and 100),
  max_daily_base numeric(8, 2) not null default 100 check (max_daily_base > 0),
  time_zone text not null default 'UTC' check (length(time_zone) between 1 and 64),
  working_days smallint[] not null default array[1, 2, 3, 4, 5]::smallint[]
    check (cardinality(working_days) between 1 and 7 and working_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (shift_end > shift_start)
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  date date not null,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  status public.attendance_status not null,
  late_minutes smallint not null default 0 check (late_minutes >= 0),
  penalty_points smallint not null default 0 check (penalty_points >= 0),
  sheets_synced_at timestamptz,
  sheets_sync_attempts smallint not null default 0 check (sheets_sync_attempts >= 0),
  sheets_last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, date),
  foreign key (user_id, company_id) references public.profiles(id, company_id) on delete cascade,
  check ((status = 'LATE' and penalty_points >= 0) or (status <> 'LATE' and penalty_points = 0))
);

create index if not exists attendance_logs_company_date_idx on public.attendance_logs (company_id, date desc);
create index if not exists attendance_logs_user_date_idx on public.attendance_logs (user_id, date desc);
create index if not exists attendance_logs_unsynced_idx on public.attendance_logs (created_at) where sheets_synced_at is null;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  leave_type text not null check (length(trim(leave_type)) between 2 and 50),
  start_date date not null,
  end_date date not null,
  working_days smallint not null check (working_days between 1 and 90),
  reason text not null check (length(trim(reason)) between 2 and 2000),
  status public.leave_status not null default 'PENDING',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, company_id) references public.profiles(id, company_id) on delete cascade,
  check (end_date >= start_date),
  check ((status = 'PENDING' and reviewed_by is null and reviewed_at is null) or (status <> 'PENDING' and reviewed_at is not null))
);

create index if not exists leave_requests_user_created_idx on public.leave_requests (user_id, created_at desc);
create index if not exists leave_requests_company_status_idx on public.leave_requests (company_id, status, start_date);

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function private.is_hr()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'HR'::public.user_role and p.company_id is not null
  )
$$;

create or replace function private.is_hr_for_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'HR'::public.user_role and p.company_id = target_company_id
  )
$$;

revoke all on function private.current_company_id() from public, anon;
revoke all on function private.is_hr() from public, anon;
revoke all on function private.is_hr_for_company(uuid) from public, anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;
grant execute on function private.current_company_id() to authenticated, service_role;
grant execute on function private.is_hr() to authenticated, service_role;
grant execute on function private.is_hr_for_company(uuid) to authenticated, service_role;

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'New employee'), '@', 1)),
    'EMPLOYEE'::public.user_role
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

create or replace function private.score_for_user(target_user_id uuid, target_company_id uuid, as_of date)
returns table (total_working_days integer, absences integer, penalty_points integer, score_percent numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with member as (
    select p.id, p.company_id, p.created_at::date as member_since, s.working_days, s.max_daily_base, s.time_zone, s.shift_end
    from public.profiles p
    join public.shift_config s on s.company_id = p.company_id
    where p.id = target_user_id and p.company_id = target_company_id
  ), bounds as (
    select member.*,
      least(as_of, (now() at time zone member.time_zone)::date) as local_today,
      (now() at time zone member.time_zone)::time as local_time
    from member
  ), expected as (
    select b.id, b.company_id, b.max_daily_base, day::date as work_date
    from bounds b
    cross join lateral generate_series(b.member_since, b.local_today, interval '1 day') day
    where extract(isodow from day)::smallint = any(b.working_days)
      and (day::date < b.local_today or b.local_time >= b.shift_end or as_of < b.local_today)
  ), eligible as (
    select e.* from expected e
    where not exists (
      select 1 from public.leave_requests l
      where l.user_id = e.id and l.company_id = e.company_id and l.status = 'APPROVED'
        and e.work_date between l.start_date and l.end_date
    )
  ), totals as (
    select
      (select count(*)::integer from eligible) as work_days,
      (select count(*)::integer from eligible e where not exists (
        select 1 from public.attendance_logs a where a.user_id = e.id and a.date = e.work_date
      )) as missed_days,
      coalesce((select sum(a.penalty_points)::integer from public.attendance_logs a
        join bounds b on b.id = a.user_id where a.date between b.member_since and b.local_today), 0) as penalties,
      coalesce((select max(b.max_daily_base) from bounds b), 100) as daily_base
  )
  select t.work_days, t.missed_days, t.penalties,
    case when t.work_days = 0 then 100::numeric
      else greatest(0::numeric, least(100::numeric,
        round(((t.work_days - t.missed_days - (t.penalties / t.daily_base)) / t.work_days) * 100, 2)))
    end
  from totals t
$$;

revoke all on function private.score_for_user(uuid, uuid, date) from public, anon, authenticated;
grant execute on function private.score_for_user(uuid, uuid, date) to service_role;

create or replace function public.get_my_attendance_score()
returns table (total_working_days integer, absences integer, penalty_points integer, score_percent numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.score_for_user((select auth.uid()), private.current_company_id(),
    (now() at time zone coalesce((select s.time_zone from public.shift_config s where s.company_id = private.current_company_id()), 'UTC'))::date)
$$;

revoke all on function public.get_my_attendance_score() from public, anon;
grant execute on function public.get_my_attendance_score() to authenticated;

create or replace function public.get_company_attendance_leaderboard(p_as_of date default null)
returns table (
  user_id uuid,
  full_name text,
  department text,
  job_title text,
  check_in_status public.attendance_status,
  checked_in_at timestamptz,
  penalty_points integer,
  score_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.department, p.job_title,
    coalesce(a.status, 'ABSENT'::public.attendance_status), a.checked_in_at,
    coalesce(a.penalty_points, 0)::integer, score.score_percent
  from public.profiles p
  left join public.attendance_logs a
    on a.user_id = p.id and a.company_id = p.company_id and a.date = coalesce(p_as_of, current_date)
  left join lateral private.score_for_user(p.id, p.company_id, coalesce(p_as_of, current_date)) score on true
  where p.company_id = private.current_company_id()
    and p.employment_status <> 'INACTIVE'
    and private.current_company_id() is not null
  order by score.score_percent desc nulls last, p.full_name asc
$$;

revoke all on function public.get_company_attendance_leaderboard(date) from public, anon;
grant execute on function public.get_company_attendance_leaderboard(date) to authenticated;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.shift_config enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.leave_requests enable row level security;

revoke all on table public.companies, public.profiles, public.shift_config, public.attendance_logs, public.leave_requests from anon, authenticated;
grant select on table public.companies, public.profiles, public.shift_config, public.attendance_logs to authenticated;
grant select, insert on table public.leave_requests to authenticated;
grant update (status, reviewed_by, reviewed_at, updated_at) on table public.leave_requests to authenticated;
grant all on table public.companies, public.profiles, public.shift_config, public.attendance_logs, public.leave_requests to service_role;

drop policy if exists companies_read_same_company on public.companies;
create policy companies_read_same_company on public.companies
  for select to authenticated using (id = (select private.current_company_id()));

drop policy if exists profiles_read_self_or_hr_company on public.profiles;
create policy profiles_read_self_or_hr_company on public.profiles
  for select to authenticated using (
    id = (select auth.uid()) or (
      (select private.is_hr()) and company_id = (select private.current_company_id())
    )
  );

drop policy if exists shifts_read_company on public.shift_config;
create policy shifts_read_company on public.shift_config
  for select to authenticated using (company_id = (select private.current_company_id()));

drop policy if exists attendance_read_self_or_hr on public.attendance_logs;
create policy attendance_read_self_or_hr on public.attendance_logs
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_hr_for_company(company_id))
  );

drop policy if exists leave_requests_read_self_or_hr on public.leave_requests;
create policy leave_requests_read_self_or_hr on public.leave_requests
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.is_hr_for_company(company_id))
  );

drop policy if exists leave_requests_employee_insert on public.leave_requests;
create policy leave_requests_employee_insert on public.leave_requests
  for insert to authenticated with check (
    user_id = (select auth.uid()) and company_id = (select private.current_company_id())
    and status = 'PENDING' and reviewed_by is null and reviewed_at is null
  );

drop policy if exists leave_requests_hr_update on public.leave_requests;
create policy leave_requests_hr_update on public.leave_requests
  for update to authenticated
  using ((select private.is_hr_for_company(company_id)) and status = 'PENDING')
  with check (
    (select private.is_hr_for_company(company_id)) and status in ('APPROVED', 'DECLINED')
    and reviewed_by = (select auth.uid()) and reviewed_at is not null
  );

commit;