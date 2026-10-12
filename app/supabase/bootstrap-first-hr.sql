do $bootstrap$
declare
  target_email text := 'replace-with-first-hr@example.com';
  target_company_name text := 'Replace with company name';
  target_profile_id uuid;
  target_company_id uuid;
begin
  select p.id into target_profile_id
  from public.profiles p
  where lower(p.email) = lower(target_email)
  for update;

  if target_profile_id is null then
    raise exception 'Create/invite the first HR Auth user before running this script.';
  end if;

  insert into public.companies (name)
  values (target_company_name)
  returning id into target_company_id;

  update public.profiles
  set company_id = target_company_id,
      role = 'HR',
      employment_status = 'ACTIVE',
      updated_at = now()
  where id = target_profile_id;

  insert into public.shift_config (company_id)
  values (target_company_id);
end
$bootstrap$;