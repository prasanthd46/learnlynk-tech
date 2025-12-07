-- LearnLynk Tech Test - Task 2: RLS Policies on leads

alter table public.leads enable row level security;

-- Example helper: assume JWT has tenant_id, user_id, role.
-- You can use: current_setting('request.jwt.claims', true)::jsonb

-- TODO: write a policy so:
-- - counselors see leads where they are owner_id OR in one of their teams
-- - admins can see all leads of their tenant


-- Example skeleton for SELECT (replace with your own logic):

create policy "leads_select_policy"
on public.leads
for select
using (
  
  -- TODO: add real RLS logic here, refer to README instructions
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (
    
    (auth.jwt() ->> 'role') = 'admin'
    OR

    owner_id = auth.uid()
    OR

    exists (
      select 1
      from public.user_teams my_teams
      join public.user_teams teammate_teams 
        on my_teams.team_id = teammate_teams.team_id
      where my_teams.user_id = auth.uid()         
      and teammate_teams.user_id = leads.owner_id
    )
  )
);

-- TODO: add INSERT policy that:
-- - allows counselors/admins to insert leads for their tenant
-- - ensures tenant_id is correctly set/validated
create policy "leads_insert_policy"
on public.leads
for insert
with check (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND
  (auth.jwt() ->> 'role') in ('admin', 'counselor')
);