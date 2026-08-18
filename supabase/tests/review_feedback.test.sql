begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-4555-8555-555555555555', 'multi-league-owner@zrizin.local', '{}'::jsonb),
  ('66666666-6666-4666-8666-666666666666', 'multi-league-friend@zrizin.local', '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select lives_ok(
  $$ select public.create_league('League One', null, 'head_to_head') $$,
  'A user can create a first league'
);

select lives_ok(
  $$ select public.create_league('League Two', null, 'leaderboard') $$,
  'The same user can create a second league'
);

reset role;

select is(
  (select count(*)::int from public.league_members where user_id='55555555-5555-4555-8555-555555555555'),
  2,
  'A user can belong to multiple leagues simultaneously'
);

insert into public.seasons (league_id,name,season_number,status,start_date,end_date,weeks_count)
select id,'Season 1',1,'draft',current_date,current_date+55,8
from public.leagues
where name='League One';

-- The reusable custom-checkoff template may appear more than once in a season,
-- with each row carrying a different league-specific name/config.
insert into public.league_task_configs (season_id, task_template_id, config_overrides, display_order)
select s.id, t.id, jsonb_build_object('custom_name','Torah Study','scoring_mode','binary','binary_points',3), 0
from public.seasons s
join public.leagues l on l.id=s.league_id
cross join lateral (
  select id from public.task_templates where name='Custom Challenge — Checkoff' limit 1
) t
where l.name='League One';

select lives_ok(
  $$
  insert into public.league_task_configs (season_id, task_template_id, config_overrides, display_order)
  select s.id, t.id, jsonb_build_object('custom_name','No Dessert','scoring_mode','binary','binary_points',3), 1
  from public.seasons s
  join public.leagues l on l.id=s.league_id
  cross join lateral (
    select id from public.task_templates where name='Custom Challenge — Checkoff' limit 1
  ) t
  where l.name='League One'
  $$,
  'The same custom template can be instantiated repeatedly with different names'
);

select is(
  (
    select count(*)::int
    from public.league_task_configs ltc
    join public.seasons s on s.id=ltc.season_id
    join public.leagues l on l.id=s.league_id
    where l.name='League One'
  ),
  2,
  'Both repeated custom tasks are stored independently'
);

-- Quantity-aware names must survive beyond setup preview into real task instances.
insert into public.league_task_configs (season_id, task_template_id, config_overrides, display_order)
select s.id, t.id, jsonb_build_object('target',30,'scoring_mode','binary','binary_points',3), 2
from public.seasons s
join public.leagues l on l.id=s.league_id
cross join lateral (
  select id from public.task_templates where name='Pushups' limit 1
) t
where l.name='League One';

-- Reuse the same Count template twice to model the unlimited custom-task UI.
insert into public.league_task_configs (season_id, task_template_id, config_overrides, display_order)
select s.id, t.id, jsonb_build_object('custom_name','Situps','threshold',40,'scoring_mode','binary','binary_points',3), 3
from public.seasons s
join public.leagues l on l.id=s.league_id
cross join lateral (
  select id from public.task_templates where name='Custom Challenge — Count' limit 1
) t
where l.name='League One';

insert into public.league_task_configs (season_id, task_template_id, config_overrides, display_order)
select s.id, t.id, jsonb_build_object('custom_name','Pullups','threshold',12,'scoring_mode','binary','binary_points',3), 4
from public.seasons s
join public.leagues l on l.id=s.league_id
cross join lateral (
  select id from public.task_templates where name='Custom Challenge — Count' limit 1
) t
where l.name='League One';

select public.generate_task_instances_for_user(
  (select s.id from public.seasons s join public.leagues l on l.id=s.league_id where l.name='League One' limit 1),
  null
);

select is(
  (
    select ti.task_name
    from public.task_instances ti
    join public.seasons s on s.id=ti.season_id
    join public.leagues l on l.id=s.league_id
    join public.league_task_configs ltc on ltc.id=ti.league_task_config_id
    join public.task_templates tt on tt.id=ltc.task_template_id
    where l.name='League One' and tt.name='Pushups'
    limit 1
  ),
  '30 Pushups',
  'A 30-rep Pushups goal is named 30 Pushups on the live task instance'
);

select is(
  (
    select count(*)::int
    from public.task_instances ti
    join public.seasons s on s.id=ti.season_id
    join public.leagues l on l.id=s.league_id
    where l.name='League One' and ti.task_name in ('40 Situps','12 Pullups')
  ),
  2,
  'Repeated custom Count tasks generate independent quantity-aware task instances'
);

select ok(
  exists(
    select 1
    from public.task_instances ti
    join public.seasons s on s.id=ti.season_id
    join public.leagues l on l.id=s.league_id
    where l.name='League One' and ti.task_name='40 Situps'
  ) and exists(
    select 1
    from public.task_instances ti
    join public.seasons s on s.id=ti.season_id
    join public.leagues l on l.id=s.league_id
    where l.name='League One' and ti.task_name='12 Pullups'
  ),
  'Each custom quantity is preserved in its own displayed task name'
);

select ok(
  exists(select 1 from public.task_templates where name='Stopped Eating After 8 PM' and category='nutrition' and is_active=true),
  'Stopped Eating After 8 PM is available as an active nutrition task'
);

-- Join the friend to League One, then prove league members can comment and
-- outsiders/anonymous users cannot read the comments table directly.
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
select lives_ok(
  $$
  select public.join_league_by_code((select invite_code from public.leagues where name='League One'))
  $$,
  'A user who already may have other memberships can still join another league'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select lives_ok(
  $$
  insert into public.feed_comments(league_id,event_key,user_id,body)
  select id,'test-event','55555555-5555-4555-8555-555555555555','Nice work' from public.leagues where name='League One'
  $$,
  'League member can add a feed comment'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
select is(
  (select count(*)::int from public.feed_comments where event_key='test-event'),
  1,
  'Another league member can read the feed comment'
);
reset role;

select ok(
  not has_table_privilege('anon','public.feed_comments','SELECT'),
  'Anonymous users cannot read league feed comments directly'
);

select ok(
  (select max_custom_tasks >= 999 from public.leagues where name='League One'),
  'New leagues carry the effectively-unlimited custom task allowance'
);

select * from finish();
rollback;
