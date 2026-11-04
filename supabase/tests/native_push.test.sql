begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values ('55555555-5555-4555-8555-555555555555', 'push-test@zrizin.local', '{}'::jsonb);

select ok(
  not has_table_privilege('anon', 'public.device_push_tokens', 'SELECT')
  and not has_table_privilege('authenticated', 'public.device_push_tokens', 'SELECT')
  and not has_table_privilege('authenticated', 'public.device_push_tokens', 'INSERT'),
  'Client roles cannot read or write raw device push tokens'
);

select ok(
  not has_function_privilege('anon', 'public.register_push_token(text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.register_push_token(text,text)', 'EXECUTE'),
  'Only authenticated clients can invoke push-token registration'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select lives_ok(
  $$ select public.register_push_token('ios', '0123456789abcdef0123456789abcdef') $$,
  'Authenticated user can register a native push token'
);

reset role;

select is(
  (select count(*)::int from public.device_push_tokens
   where user_id = '55555555-5555-4555-8555-555555555555'
     and platform = 'ios'
     and enabled = true),
  1,
  'Registration stores one enabled token for the authenticated user'
);

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select lives_ok(
  $$ select public.unregister_push_token('ios', '0123456789abcdef0123456789abcdef') $$,
  'Authenticated user can disable their registered token'
);

reset role;

select is(
  (select count(*)::int from public.device_push_tokens
   where user_id = '55555555-5555-4555-8555-555555555555'
     and platform = 'ios'
     and enabled = false),
  1,
  'Unregistering disables the token without exposing it to the client'
);

select * from finish();
rollback;
