-- Harden the RLS helper functions (security advisor 0028/0029).
-- They only reveal the calling user's own membership (auth.uid()-scoped),
-- but anon has no business calling them at all. EXECUTE for `authenticated`
-- must remain: RLS policies evaluate these functions as the querying role.

revoke execute on function public.is_project_member(uuid) from public, anon;
revoke execute on function public.project_role(uuid) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
