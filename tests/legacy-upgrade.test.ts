import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'

it('protects a legacy installation with duplicate mappings without altering its data', async () => {
  const db = new PGlite()
  const first = '00000000-0000-0000-0000-000000000001'
  const second = '00000000-0000-0000-0000-000000000002'
  const third = '00000000-0000-0000-0000-000000000003'
  const migrate = async (name: string) => db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8')
    .replace('create extension if not exists "pgcrypto";', ''))
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,service_role;
      grant execute on function auth.uid() to authenticated,service_role;
    `)
    await migrate('0001_initial_schema.sql')
    await migrate('0002_add_trial_ends_at.sql')
    await db.query('insert into auth.users values ($1,$2),($3,$4)', [first,'a@example.invalid',second,'b@example.invalid'])
    await db.exec(`
      update public.profiles set plan='pro', stripe_customer_id='cus_legacy_fixture';
      grant all on public.profiles,public.subscriptions to authenticated;
      create function public.trigger_welcome_email() returns trigger language plpgsql security definer as
        $$ begin raise exception 'Legacy HTTP email hook still active'; end; $$;
      create trigger on_profile_created_send_welcome after insert on public.profiles
        for each row execute function public.trigger_welcome_email();
      create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as
        $$ begin return; end; $$;
    `)
    const file = readdirSync('supabase/migrations').find(name => name.endsWith('_restrict_legacy_billing_access.sql'))!
    await migrate(file)
    expect((await db.query('select plan,stripe_customer_id from public.profiles order by id')).rows).toEqual([
      { plan: 'pro', stripe_customer_id: 'cus_legacy_fixture' },
      { plan: 'pro', stripe_customer_id: 'cus_legacy_fixture' },
    ])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [first])
    expect((await db.query('select id from public.profiles')).rows).toEqual([{ id: first }])
    await expect(db.exec("update public.profiles set plan='free'")).rejects.toThrow(/permission denied/i)
    await expect(db.exec('truncate public.subscriptions')).rejects.toThrow(/permission denied/i)
    await db.exec('reset role')
    for (const name of ['handle_new_user','trigger_welcome_email','rls_auto_enable']) {
      for (const role of ['anon','authenticated']) {
        const result = await db.query<{ permitted: boolean }>("select has_function_privilege($1,$2,'EXECUTE') as permitted", [role,`public.${name}()`])
        expect(result.rows[0].permitted).toBe(false)
      }
    }
    // Signup must still create a free profile without invoking the obsolete hook.
    await db.query('insert into auth.users values($1,$2)', [third,'c@example.invalid'])
    expect((await db.query('select plan from public.profiles where id=$1',[third])).rows).toEqual([{ plan: 'free' }])
  } finally { await db.close() }
})
