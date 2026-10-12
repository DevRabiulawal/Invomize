import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const companyA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const companyB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const hrUser = '11111111-1111-4111-8111-111111111111'
const employeeA = '22222222-2222-4222-8222-222222222222'
const employeeB = '33333333-3333-4333-8333-333333333333'
const employeeOtherCompany = '44444444-4444-4444-8444-444444444444'
const pendingLeave = '55555555-5555-4555-8555-555555555555'

let db: PGlite

async function useIdentity(userId: string) {
  await db.exec('set role authenticated')
  await db.query('select set_config($1, $2, false)', ['request.jwt.claim.sub', userId])
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb
    );
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `)
  await db.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'))
  await db.exec(`
    insert into public.companies (id, name) values
      ('${companyA}', 'Northstar'), ('${companyB}', 'Southstar');
    insert into public.shift_config (company_id, time_zone) values
      ('${companyA}', 'UTC'), ('${companyB}', 'UTC');
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${hrUser}', 'hr@northstar.example', '{"full_name":"Harper HR"}'),
      ('${employeeA}', 'alex@northstar.example', '{"full_name":"Alex Employee"}'),
      ('${employeeB}', 'blair@northstar.example', '{"full_name":"Blair Employee"}'),
      ('${employeeOtherCompany}', 'sam@southstar.example', '{"full_name":"Sam Employee"}');
    update public.profiles set company_id = '${companyA}' where id in ('${hrUser}', '${employeeA}', '${employeeB}');
    update public.profiles set company_id = '${companyB}' where id = '${employeeOtherCompany}';
    update public.profiles set role = 'HR' where id = '${hrUser}';
    update public.profiles set created_at = '2026-01-05T00:00:00Z';
    insert into public.attendance_logs (company_id, user_id, date, checked_in_at, status, penalty_points)
    values
      ('${companyA}', '${employeeA}', current_date, now(), 'PRESENT', 0),
      ('${companyA}', '${employeeB}', current_date, now(), 'LATE', 5),
      ('${companyB}', '${employeeOtherCompany}', current_date, now(), 'PRESENT', 0);
    insert into public.leave_requests (id, company_id, user_id, leave_type, start_date, end_date, working_days, reason)
    values ('${pendingLeave}', '${companyA}', '${employeeA}', 'Annual leave', current_date + 7, current_date + 7, 1, 'Personal time');
  `)
})

afterEach(async () => {
  await db.close()
})

describe('employee portal RLS', () => {
  it('limits profile, attendance, and leave reads to the signed-in employee', async () => {
    await useIdentity(employeeA)
    const profiles = await db.query('select id from public.profiles order by id')
    const attendance = await db.query('select user_id from public.attendance_logs order by user_id')
    const leaves = await db.query('select user_id from public.leave_requests')
    expect(profiles.rows).toEqual([{ id: employeeA }])
    expect(attendance.rows).toEqual([{ user_id: employeeA }])
    expect(leaves.rows).toEqual([{ user_id: employeeA }])
  })

  it('allows own leave applications but rejects another user or tenant', async () => {
    await useIdentity(employeeA)
    await db.query(`insert into public.leave_requests (company_id, user_id, leave_type, start_date, end_date, working_days, reason)
      values ($1, $2, 'Personal day', current_date + 9, current_date + 9, 1, 'Appointment')`, [companyA, employeeA])
    await expect(db.query(`insert into public.leave_requests (company_id, user_id, leave_type, start_date, end_date, working_days, reason)
      values ($1, $2, 'Personal day', current_date + 10, current_date + 10, 1, 'Forged owner')`, [companyA, employeeB])).rejects.toMatchObject({ code: '42501' })
    await expect(db.query(`insert into public.leave_requests (company_id, user_id, leave_type, start_date, end_date, working_days, reason)
      values ($1, $2, 'Personal day', current_date + 11, current_date + 11, 1, 'Forged tenant')`, [companyB, employeeA])).rejects.toMatchObject({ code: '42501' })
  })

  it('does not allow employees to bypass the check-in API with direct attendance writes', async () => {
    await useIdentity(employeeA)
    await expect(db.query(`insert into public.attendance_logs (company_id, user_id, date, checked_in_at, status)
      values ($1, $2, current_date + 1, now(), 'PRESENT')`, [companyA, employeeA])).rejects.toMatchObject({ code: '42501' })
  })

  it('calculates the attendance score from elapsed workdays, penalties, and approved leave', async () => {
    await db.exec(`insert into public.leave_requests (company_id, user_id, leave_type, start_date, end_date, working_days, reason, status, reviewed_by, reviewed_at)
      values ('${companyA}', '${employeeA}', 'Annual leave', '2026-01-08', '2026-01-08', 1, 'Approved time', 'APPROVED', '${hrUser}', now());
      insert into public.attendance_logs (company_id, user_id, date, checked_in_at, status, penalty_points) values
        ('${companyA}', '${employeeA}', '2026-01-05', now(), 'PRESENT', 0),
        ('${companyA}', '${employeeA}', '2026-01-06', now(), 'LATE', 5),
        ('${companyA}', '${employeeA}', '2026-01-07', now(), 'PRESENT', 0),
        ('${companyA}', '${employeeA}', '2026-01-09', now(), 'PRESENT', 0);`)
    await db.exec('set role service_role')
    const { rows } = await db.query(`select * from private.score_for_user($1, $2, '2026-01-09')`, [employeeA, companyA])
    expect(rows).toEqual([{ total_working_days: 4, absences: 0, penalty_points: 5, score_percent: '98.75' }])
  })

  it('rejects duplicate daily attendance entries at the database constraint', async () => {
    await db.exec('set role service_role')
    await expect(db.query(`insert into public.attendance_logs (company_id, user_id, date, checked_in_at, status)
      values ($1, $2, current_date, now(), 'PRESENT')`, [companyA, employeeA])).rejects.toMatchObject({ code: '23505' })
  })

  it('returns a company-only leaderboard without exposing other tenant data', async () => {
    await useIdentity(employeeA)
    const leaderboard = await db.query('select user_id, full_name, check_in_status from public.get_company_attendance_leaderboard(current_date) order by user_id')
    expect(leaderboard.rows).toEqual([
      { user_id: hrUser, full_name: 'Harper HR', check_in_status: 'ABSENT' },
      { user_id: employeeA, full_name: 'Alex Employee', check_in_status: 'PRESENT' },
      { user_id: employeeB, full_name: 'Blair Employee', check_in_status: 'LATE' },
    ])
  })
})

describe('HR portal RLS', () => {
  it('allows HR to read only its own company records and process pending requests', async () => {
    await useIdentity(hrUser)
    const profiles = await db.query('select id from public.profiles order by id')
    const attendance = await db.query('select user_id from public.attendance_logs order by user_id')
    expect(profiles.rows).toHaveLength(3)
    expect(attendance.rows).toHaveLength(2)
    await db.query(`update public.leave_requests set status = 'APPROVED', reviewed_by = $1, reviewed_at = now(), updated_at = now() where id = $2`, [hrUser, pendingLeave])
    const reviewed = await db.query('select status, reviewed_by from public.leave_requests where id = $1', [pendingLeave])
    expect(reviewed.rows).toEqual([{ status: 'APPROVED', reviewed_by: hrUser }])
  })

  it('prevents HR from approving a leave request for a different company', async () => {
    await db.exec(`insert into public.leave_requests (company_id, user_id, leave_type, start_date, end_date, working_days, reason)
      values ('${companyB}', '${employeeOtherCompany}', 'Personal day', current_date + 8, current_date + 8, 1, 'Other tenant')`)
    await useIdentity(hrUser)
    const result = await db.query(`update public.leave_requests set status = 'APPROVED', reviewed_by = $1, reviewed_at = now(), updated_at = now() where user_id = $2 returning id`, [hrUser, employeeOtherCompany])
    expect(result.rows).toEqual([])
  })

  it('preserves reviewed leave history if the reviewing HR account is deleted', async () => {
    await useIdentity(hrUser)
    await db.query(`update public.leave_requests set status = 'APPROVED', reviewed_by = $1, reviewed_at = now(), updated_at = now() where id = $2`, [hrUser, pendingLeave])
    await db.exec(`reset role; delete from auth.users where id = '${hrUser}';`)
    const { rows } = await db.query('select status, reviewed_by, reviewed_at from public.leave_requests where id = $1', [pendingLeave])
    const reviewed = rows[0] as { status: string; reviewed_by: string | null; reviewed_at: string | null }
    expect(reviewed).toMatchObject({ status: 'APPROVED', reviewed_by: null })
    expect(reviewed.reviewed_at).not.toBeNull()
  })
})

describe('first HR bootstrap', () => {
  it('assigns an existing Auth user to a new company and creates the default shift', async () => {
    const bootstrap = (await readFile(new URL('../bootstrap-first-hr.sql', import.meta.url), 'utf8'))
      .replace('replace-with-first-hr@example.com', 'hr@northstar.example')
      .replace('Replace with company name', 'Bootstrap Company')
    await db.exec(bootstrap)
    const { rows } = await db.query(`select p.role, c.name, s.shift_start, s.grace_minutes
      from public.profiles p join public.companies c on c.id = p.company_id
      join public.shift_config s on s.company_id = c.id where p.id = $1`, [hrUser])
    expect(rows).toEqual([{ role: 'HR', name: 'Bootstrap Company', shift_start: '09:00:00', grace_minutes: 10 }])
  })
})