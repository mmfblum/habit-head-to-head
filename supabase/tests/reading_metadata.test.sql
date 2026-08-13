begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-4777-8777-777777777777', 'reading-note-test@zrizin.local', '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select lives_ok(
  $$ select public.create_league('Reading Note Test', null, 'solo') $$,
  'Reading metadata fixture can create a Solo league'
);
reset role;

insert into public.seasons (league_id,name,season_number,status,start_date,end_date,weeks_count)
select id,'Season 1',1,'draft',(now() at time zone 'America/New_York')::date,(now() at time zone 'America/New_York')::date+55,8
from public.leagues where created_by='77777777-7777-4777-8777-777777777777';

insert into public.league_task_configs (season_id,task_template_id,config_overrides,display_order)
select s.id,t.id,t.default_config,0
from public.seasons s
cross join lateral (
  select id,default_config from public.task_templates where name='Reading' limit 1
) t
where s.league_id=(select id from public.leagues where created_by='77777777-7777-4777-8777-777777777777');

-- Solo requires at least three enabled tasks to start; add two innocuous defaults.
insert into public.league_task_configs (season_id,task_template_id,config_overrides,display_order)
select s.id,t.id,t.default_config,row_number() over(order by t.name)
from public.seasons s
cross join lateral (
  select id,name,default_config from public.task_templates
  where name in ('Healthy Eating','Stretching')
  order by name
) t
where s.league_id=(select id from public.leagues where created_by='77777777-7777-4777-8777-777777777777');

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select lives_ok(
  $$ select public.start_league_season((select id from public.seasons where league_id=(select id from public.leagues where created_by='77777777-7777-4777-8777-777777777777'))) $$,
  'Reading metadata fixture starts its Solo season'
);

insert into public.daily_checkins(user_id,task_instance_id,checkin_date,numeric_value,metadata)
select
  '77777777-7777-4777-8777-777777777777',
  ti.id,
  (now() at time zone 'America/New_York')::date,
  25,
  jsonb_build_object('source','manual')
from public.task_instances ti
where ti.season_id=(select id from public.seasons where league_id=(select id from public.leagues where created_by='77777777-7777-4777-8777-777777777777'))
  and ti.task_name='Reading';

select is(
  (
    select points_awarded
    from public.scoring_events se
    join public.daily_checkins dc on dc.id=se.daily_checkin_id
    where dc.user_id='77777777-7777-4777-8777-777777777777'
      and se.is_reversed=false
    limit 1
  ),
  3::numeric,
  'Reading earns its normal score before adding a social note'
);

update public.daily_checkins
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'reading_note','20 pages of To Kill a Mockingbird',
  'reading_shared_at',now()::text
)
where user_id='77777777-7777-4777-8777-777777777777';

select ok(
  (
    select count(*)=1
    from public.scoring_events se
    join public.daily_checkins dc on dc.id=se.daily_checkin_id
    where dc.user_id='77777777-7777-4777-8777-777777777777'
  )
  and (
    select points_awarded=3 and is_reversed=false
    from public.scoring_events se
    join public.daily_checkins dc on dc.id=se.daily_checkin_id
    where dc.user_id='77777777-7777-4777-8777-777777777777'
    limit 1
  ),
  'Adding a Reading note leaves the original scoring event untouched'
);

select * from finish();
rollback;
