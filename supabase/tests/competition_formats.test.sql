begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

-- Test users. These are transaction-scoped and rolled back at the end.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'solo-test@zrizin.local', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'leader-test@zrizin.local', '{}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'leader-two@zrizin.local', '{}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'leader-three@zrizin.local', '{}'::jsonb);

-- SOLO ----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$ select public.create_league('Solo Test', 'Accountability test', 'solo') $$,
  'Solo league can be created by one authenticated user'
);

reset role;

select is(
  (select game_format from public.leagues where created_by='11111111-1111-4111-8111-111111111111'),
  'solo',
  'Solo league stores the solo format'
);

select ok(
  (select min_members=1 and max_members=1 and invite_code is null
   from public.leagues where created_by='11111111-1111-4111-8111-111111111111'),
  'Solo league has a one-person roster and no invite code'
);

insert into public.seasons (league_id,name,season_number,status,start_date,end_date,weeks_count)
select id,'Season 1',1,'draft',current_date,current_date+55,8
from public.leagues where created_by='11111111-1111-4111-8111-111111111111';

insert into public.league_task_configs (season_id,task_template_id,display_order)
select s.id,t.id,row_number() over(order by t.name)-1
from public.seasons s
cross join lateral (
  select id,name from public.task_templates where is_active=true order by name limit 3
) t
where s.league_id=(select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$ select public.start_league_season((select id from public.seasons where league_id=(select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111'))) $$,
  'Solo season starts without needing a second player'
);

reset role;

select ok(
  (select status='active' and start_date=(now() at time zone 'America/New_York')::date
   from public.seasons where league_id=(select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111')),
  'Solo season starts immediately on the local current day'
);

select ok(
  not exists(
    select 1 from public.weeks w
    join public.seasons s on s.id=w.season_id
    where s.league_id=(select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111')
      and w.week_number=0
  )
  and not exists(
    select 1 from public.matchups m
    join public.weeks w on w.id=m.week_id
    join public.seasons s on s.id=w.season_id
    where s.league_id=(select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111')
  ),
  'Solo creates neither preseason nor phantom matchups'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$ select public.create_accountability_share((select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111')) $$,
  'Solo owner can create an accountability link'
);

reset role;

-- Cache the opaque token before impersonating anon. The entire point of the
-- following tests is that anon cannot query accountability_shares directly.
select set_config(
  'test.accountability_token',
  (select token from public.accountability_shares where user_id='11111111-1111-4111-8111-111111111111'),
  false
);

set local role anon;
select isnt(
  public.get_public_accountability_snapshot(current_setting('test.accountability_token')),
  null::jsonb,
  'Valid accountability token returns a public snapshot'
);

select ok(
  not (public.get_public_accountability_snapshot(current_setting('test.accountability_token')) ? 'email')
  and not (public.get_public_accountability_snapshot(current_setting('test.accountability_token')) ? 'user_id'),
  'Public accountability snapshot omits email and private user id'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select lives_ok(
  $$ select public.revoke_accountability_share((select id from public.leagues where created_by='11111111-1111-4111-8111-111111111111')) $$,
  'Solo owner can revoke the accountability link'
);
reset role;

set local role anon;
select is(
  public.get_public_accountability_snapshot(current_setting('test.accountability_token')),
  null::jsonb,
  'Revoked accountability token stops returning data'
);
reset role;

select ok(
  not has_table_privilege('anon','public.accountability_shares','SELECT')
  and not has_table_privilege('authenticated','public.accountability_shares','SELECT'),
  'Share tokens cannot be read directly through client roles'
);

-- LEADERBOARD PUNISHMENT -----------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select lives_ok(
  $$ select public.create_league('Leaderboard Punishment Test', null, 'leaderboard') $$,
  'Leaderboard test league can be created'
);
reset role;

insert into public.league_members (league_id,user_id,role)
select l.id,u.id,'member'
from public.leagues l
cross join (values
  ('33333333-3333-4333-8333-333333333333'::uuid),
  ('44444444-4444-4444-8444-444444444444'::uuid)
) u(id)
where l.created_by='22222222-2222-4222-8222-222222222222';

insert into public.seasons (league_id,name,season_number,status,start_date,end_date,weeks_count)
select id,'Season 1',1,'active',current_date-6,current_date,1
from public.leagues where created_by='22222222-2222-4222-8222-222222222222';

-- Replace generated week dates/status with one explicit finalized week.
update public.weeks w
set start_date=current_date-6,end_date=current_date,is_locked=true
from public.seasons s
where w.season_id=s.id
  and s.league_id=(select id from public.leagues where created_by='22222222-2222-4222-8222-222222222222')
  and w.week_number=1;

insert into public.weekly_scores (user_id,week_id,total_points)
select v.user_id,w.id,v.points
from public.weeks w
join public.seasons s on s.id=w.season_id
cross join (values
  ('22222222-2222-4222-8222-222222222222'::uuid,10::numeric),
  ('33333333-3333-4333-8333-333333333333'::uuid,20::numeric),
  ('44444444-4444-4444-8444-444444444444'::uuid,30::numeric)
) v(user_id,points)
where s.league_id=(select id from public.leagues where created_by='22222222-2222-4222-8222-222222222222')
  and w.week_number=1
on conflict (user_id,week_id) do update set total_points=excluded.total_points;

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select lives_ok(
  $$ select public.spin_weekly_punishment((select w.id from public.weeks w join public.seasons s on s.id=w.season_id where s.league_id=(select id from public.leagues where created_by='22222222-2222-4222-8222-222222222222') and w.week_number=1)) $$,
  'Unique Leaderboard last place can spin once after finalization'
);

reset role;

select is(
  (select count(*)::int from public.punishment_spins where loser_user_id='22222222-2222-4222-8222-222222222222'),
  1,
  'First Leaderboard spin creates exactly one immutable result'
);

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select lives_ok(
  $$ select public.spin_weekly_punishment((select w.id from public.weeks w join public.seasons s on s.id=w.season_id where s.league_id=(select id from public.leagues where created_by='22222222-2222-4222-8222-222222222222') and w.week_number=1)) $$,
  'Repeated spin request returns the already-locked result rather than rerolling'
);
reset role;

select is(
  (select count(*)::int from public.punishment_spins where loser_user_id='22222222-2222-4222-8222-222222222222'),
  1,
  'Repeated spin cannot create a second punishment result'
);

-- Create a tie for last and verify the other tied player cannot spin.
update public.weekly_scores ws
set total_points=10
from public.weeks w, public.seasons s
where ws.week_id=w.id and w.season_id=s.id
  and s.league_id=(select id from public.leagues where created_by='22222222-2222-4222-8222-222222222222')
  and w.week_number=1
  and ws.user_id='33333333-3333-4333-8333-333333333333';

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select throws_ok(
  $$ select public.spin_weekly_punishment((select w.id from public.weeks w join public.seasons s on s.id=w.season_id where s.league_id=(select id from public.leagues where created_by='22222222-2222-4222-8222-222222222222') and w.week_number=1)) $$,
  'P0001',
  'Tie for last place — no punishment this week',
  'Tie for last place cancels the Leaderboard punishment'
);
reset role;

select * from finish();
rollback;
