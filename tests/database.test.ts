import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const db = new PGlite()
const a = '00000000-0000-0000-0000-000000000001', b = '00000000-0000-0000-0000-000000000002'
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
  `)
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    // PGlite has native gen_random_uuid(), but not the unrelated pgcrypto extension.
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8').replace('create extension if not exists "pgcrypto";', ''))
  }
  await db.query('insert into auth.users values ($1,$2),($3,$4)', [a, 'a@example.invalid', b, 'b@example.invalid'])
  await db.query("update profiles set stripe_customer_id='cus_a' where id=$1", [a])
})
afterAll(async () => { await db.close() })
async function asUser(id: string, run: () => Promise<void>) {
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
  try { await run() } finally { await db.exec('reset role') }
}
describe('migration permissions on a real PostgreSQL engine', () => {
  it('allows reading own profile, hides the other tenant, and prevents entitlement writes', async () => {
    await asUser(a, async () => {
      expect((await db.query('select id from profiles')).rows).toEqual([{ id: a }])
      for (const column of ['plan', 'stripe_customer_id', 'trial_ends_at', 'welcome_email_sent_at']) {
        await expect(db.query(`update profiles set ${column}=${column} where id=$1`, [a])).rejects.toThrow(/permission denied/i)
      }
      await expect(db.query('select * from billing_sync_locks')).rejects.toThrow(/permission denied/i)
      await expect(db.query("select begin_billing_sync('cus_a','evt_client')")).rejects.toThrow(/permission denied/i)
      await expect(db.query("insert into subscriptions(user_id,status) values($1,'active')", [a])).rejects.toThrow(/permission denied/i)
    })
  })
  it('isolates business records and rejects cross-tenant foreign keys', async () => {
    const product = '10000000-0000-0000-0000-000000000001'
    await asUser(a, async () => {
      await db.query("insert into products(id,user_id,sku,name,category,unit_cost,unit_price) values($1,$2,'x','x','x',1,2)", [product,a])
    })
    await asUser(b, async () => {
      expect((await db.query('select * from products')).rows).toHaveLength(0)
      await expect(db.query("insert into inventory(user_id,product_id,warehouse_location,quantity_on_hand,reorder_point,reorder_quantity) values($1,$2,'A',1,1,1)", [b,product])).rejects.toThrow(/foreign key/i)
      await expect(db.query("insert into products(user_id,sku,name,category,unit_cost,unit_price) values($1,'bad','bad','x',1,2)", [a])).rejects.toThrow(/row-level security/i)
    })
  })
  it('atomically persists subscription and plan, deduplicates events, and rejects stale leases', async () => {
    await db.exec('set role service_role')
    try {
      const claim = (await db.query<{ result: { token: string; status: string } }>("select begin_billing_sync('cus_a','evt_a') as result")).rows[0].result
      expect(claim.status).toBe('claimed')
      expect((await db.query<{ result: { status: string } }>("select begin_billing_sync('cus_a','evt_b') as result")).rows[0].result.status).toBe('busy')
      const finish = (token: string, eventId: string, status: string, trial: string | null = null) => db.query('select finish_billing_sync($1,$2,$3,100,$4,$5,null,$6)', [a,token,eventId,'sub_a',status,trial])
      await finish(claim.token, 'evt_a', 'active')
      expect((await db.query<{ plan: string }>('select plan from profiles where id=$1',[a])).rows[0].plan).toBe('pro')
      expect((await db.query<{ status: string }>('select status from subscriptions where user_id=$1',[a])).rows[0].status).toBe('active')
      expect((await db.query<{ result: { status: string } }>("select begin_billing_sync('cus_a','evt_a') as result")).rows[0].result.status).toBe('duplicate')
      const next = (await db.query<{ result: { token: string } }>("select begin_billing_sync('cus_a','evt_failed') as result")).rows[0].result
      await expect(finish(claim.token, 'evt_a', 'canceled')).rejects.toThrow(/lease/i)
      await finish(next.token, 'evt_failed', 'past_due')
      expect((await db.query<{ plan: string }>('select plan from profiles where id=$1',[a])).rows[0].plan).toBe('free')
      const trial = (await db.query<{ result: { token: string } }>("select begin_billing_sync('cus_a','evt_trial') as result")).rows[0].result
      await finish(trial.token, 'evt_trial', 'trialing', '2000-01-01T00:00:00Z')
      expect((await db.query<{ plan: string }>('select plan from profiles where id=$1',[a])).rows[0].plan).toBe('free')
    } finally { await db.exec('reset role') }
  })
})
