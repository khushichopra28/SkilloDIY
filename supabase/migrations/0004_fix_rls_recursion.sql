-- Migration: 0004_fix_rls_recursion.sql
-- Root cause: The profile_read and profile_admin_write policies call is_super_admin() and
-- can_manage_city(), which internally query public.profiles. Because these subqueries are
-- evaluated WITHOUT SECURITY DEFINER, they themselves must pass the profile_read policy,
-- which calls is_super_admin() again → infinite recursion (PG error 42P17).
--
-- Fix: Introduce current_org_id() as a SECURITY DEFINER helper that reads organization_id
-- from profiles bypassing RLS. Rewrite affected policies to use current_org_id() instead
-- of the inline (select organization_id from profiles where id=auth.uid()) subquery.
-- Every other table's policies that already call is_super_admin() / can_manage_city() are
-- safe because those functions are themselves SECURITY DEFINER.

-- 1. Helper function: reads the caller's organization_id bypassing RLS.
create or replace function public.current_org_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_org_id() to authenticated;

-- 2. Re-create profiles policies without inline self-referencing subquery.
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select using (
  id = auth.uid()
  or (public.is_super_admin() and organization_id = public.current_org_id())
  or (public.can_manage_city(home_city_id) and role = 'handler')
);

drop policy if exists profile_admin_write on public.profiles;
create policy profile_admin_write on public.profiles for all using (
  (public.is_super_admin() and organization_id = public.current_org_id())
  or (role = 'handler' and public.can_manage_city(home_city_id))
) with check (
  (public.is_super_admin() and organization_id = public.current_org_id())
  or (role = 'handler' and public.can_manage_city(home_city_id) and organization_id = public.current_org_id())
);

-- 3. Re-create organizations policy using current_org_id() to avoid recursion chain.
drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select using (
  id = public.current_org_id()
);
