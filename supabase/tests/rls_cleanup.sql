-- Removes the rls_seed.sql fixtures (and their responses).
update surveys set status = 'closed'
where id = '11111111-1111-4111-8111-111111111111' and status = 'active';
delete from surveys where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333');
