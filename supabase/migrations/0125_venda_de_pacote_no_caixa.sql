-- APR-016a (achados C-02, G-52): a venda de pacote vira dinheiro registrado.
--
-- Vender um pacote de 4 sessões por R$ 320 gravava só `packages.paid_cents`: o "Entrou" do dia não
-- via a venda, e cada sessão depois entrava a preço cheio. `payments` existe desde a 0001 e ninguém
-- escreve nem lê (o CLAUDE.md diz "dinheiro entra em `payments`"). Decisão provisória em
-- `docs/DECISOES.md` (2026-10-13 · APR-016), seguindo a recomendação dos documentos 03 e 07 do
-- `docs/98-aprimoramento`: a venda é uma linha em `payments` com `kind = 'package'`, paga na forma
-- que a pessoa escolheu, e entra no "Entrou" do dia da venda.
--
-- Aditiva, antes do deploy: um valor novo no enum, uma coluna anulável, um índice e uma função que
-- nada chama até a APR-016b.

alter type public.payment_kind add value if not exists 'package';

alter table public.payments add column if not exists package_id uuid references public.packages (id) on delete restrict;
comment on column public.payments.package_id is 'APR-016: a venda de pacote que este pagamento registra (kind = package).';

-- O "Entrou" do dia soma as vendas pagas por negócio e intervalo de `paid_at`.
create index if not exists payments_tenant_paid_at_idx on public.payments (tenant_id, paid_at) where status = 'paid';
create index if not exists payments_package_id_idx on public.payments (package_id) where package_id is not null;

-- Pacote e pagamento numa transação só: um pacote vendido sem o dinheiro registrado é o defeito que
-- esta migration existe para fechar, e duas escritas soltas o recriariam na primeira falha de rede.
--
-- `security invoker`: as políticas de `packages` e `payments` decidem, com o JWT de quem vende (a
-- rota já exigiu o papel). O pagamento é inserido SEM `returning`: `payments_select` só mostra a
-- quem vê comissão (`can_see_commission`), e o profissional que vende não passaria por ela — o id
-- é gerado aqui para não precisar ler a linha de volta.
create or replace function public.registrar_venda_de_pacote(
  p_tenant uuid,
  p_client uuid,
  p_service uuid,
  p_total_sessions int,
  p_paid_cents bigint,
  p_expires_on date,
  p_method public.payment_method,
  p_fee_cents bigint
)
returns public.packages
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pacote public.packages;
begin
  if p_method in ('club', 'package', 'voucher') then
    raise exception 'Forma de pagamento inválida para vender pacote.' using errcode = '22023';
  end if;

  insert into public.packages (tenant_id, client_id, service_id, total_sessions, paid_cents, expires_on)
  values (p_tenant, p_client, p_service, p_total_sessions, p_paid_cents, p_expires_on)
  returning * into v_pacote;

  -- Pacote de cortesia (R$ 0) não é dinheiro: sem linha em `payments`.
  if p_paid_cents > 0 then
    insert into public.payments (id, tenant_id, client_id, package_id, kind, method, status, amount_cents, fee_cents, net_cents, paid_at)
    values (gen_random_uuid(), p_tenant, p_client, v_pacote.id, 'package', p_method, 'paid', p_paid_cents, p_fee_cents, p_paid_cents - p_fee_cents, now());
  end if;

  return v_pacote;
end $$;

comment on function public.registrar_venda_de_pacote(uuid, uuid, uuid, int, bigint, date, public.payment_method, bigint) is
  'APR-016: grava o pacote e o pagamento da venda numa transação só (security invoker: a RLS de quem vende decide).';

revoke all on function public.registrar_venda_de_pacote(uuid, uuid, uuid, int, bigint, date, public.payment_method, bigint) from public, anon;
grant execute on function public.registrar_venda_de_pacote(uuid, uuid, uuid, int, bigint, date, public.payment_method, bigint) to authenticated, service_role;
