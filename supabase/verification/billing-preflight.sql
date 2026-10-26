-- Operator-only: run with database-owner visibility after 0001 and 0002.
-- Never run as an app user: RLS could hide violations and produce a false pass.
-- No identifiers, personal data or mutations are returned. Zero counts are
-- prerequisites, not proof of Stripe ownership or deployed handler security.
begin transaction read only;
select 'duplicate_customer_groups' as check_name, count(*) as violations
from (select stripe_customer_id from public.profiles
      where stripe_customer_id is not null group by stripe_customer_id having count(*) > 1) duplicates
union all
select 'inventory_product', count(*) from public.inventory c join public.products p on p.id=c.product_id where c.user_id<>p.user_id
union all
select 'order_lines_order', count(*) from public.order_lines c join public.orders p on p.id=c.order_id where c.user_id<>p.user_id
union all
select 'order_lines_product', count(*) from public.order_lines c join public.products p on p.id=c.product_id where c.user_id<>p.user_id
union all
select 'shipments_order', count(*) from public.shipments c join public.orders p on p.id=c.order_id where c.user_id<>p.user_id
union all
select 'supplier_orders_supplier', count(*) from public.supplier_orders c join public.suppliers p on p.id=c.supplier_id where c.user_id<>p.user_id
union all
select 'supplier_orders_product', count(*) from public.supplier_orders c join public.products p on p.id=c.product_id where c.user_id<>p.user_id;
rollback;
