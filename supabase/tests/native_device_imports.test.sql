begin;

create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email, raw_user_meta_data)
values ('77777777-7777-4777-8777-777777777777', 'native-import@zrizin.local', '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select public.create_league('Native Import Test', null, 'solo');
reset role;

insert into public.seasons (league_id,name,season_number,status,start_date,end_date,weeks_count)
select id,'Season 1',1,'draft',current_date,current_date+6,1
from public.leagues
where created_by='77777777-7777-4777-8777-777777777777';

insert into public.league_task_configs (season_id,task_template_id,display_order)
select s.id,t.id,row_number() over(order by t.name)-1
from public.seasons s
join public.leagues l on l.id=s.league_id
cross join lateral (
  select id,name from public.task_templates
  where name in ('Screen Time','Healthy Eating','Something New')
  order by name
) t
where l.created_by='77777777-7777-4777-8777-777777777777';

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select public.start_league_season((
  select s.id from public.seasons s
  join public.leagues l on l.id=s.league_id
  where l.created_by='77777777-7777-4777-8777-777777777777'
));

insert into public.daily_checkins (
  user_id, task_instance_id, checkin_date, numeric_value, metadata
)
select
  '77777777-7777-4777-8777-777777777777',
  ti.id,
  current_date,
  60,
  '{"source":"android_usage","imported":true,"native_metric":"screen_time_minutes"}'::jsonb
from public.task_instances ti
join public.seasons s on s.id=ti.season_id
join public.leagues l on l.id=s.league_id
where l.created_by='77777777-7777-4777-8777-777777777777'
  and ti.task_name='Screen Time';
reset role;

select is(
  (
    select se.points_awarded
    from public.scoring_events se
    join public.task_instances ti on ti.id=se.task_instance_id
    where se.user_id='77777777-7777-4777-8777-777777777777'
      and ti.task_name='Screen Time'
      and se.is_reversed=false
    order by se.created_at desc
    limit 1
  ),
  3::numeric,
  'Imported Android Screen Time scores without requiring a manual confirmation tap'
);

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
update public.daily_checkins dc
set metadata='{"source":"manual"}'::jsonb
from public.task_instances ti
where dc.task_instance_id=ti.id
  and dc.user_id='77777777-7777-4777-8777-777777777777'
  and ti.task_name='Screen Time';
reset role;

select is(
  (
    select se.points_awarded
    from public.scoring_events se
    join public.task_instances ti on ti.id=se.task_instance_id
    where se.user_id='77777777-7777-4777-8777-777777777777'
      and ti.task_name='Screen Time'
      and se.is_reversed=false
    order by se.created_at desc
    limit 1
  ),
  0::numeric,
  'Manual exact Screen Time still requires explicit confirmation'
);

select * from finish();
rollback;
