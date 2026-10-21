-- CICLO · APR-112a: o fechamento da comanda leva desconto e gorjeta na MESMA transação.
--
-- Antes, desconto e gorjeta só entravam por um PATCH separado, disparado pelo `onBlur` do campo na
-- tela: quem digitava o desconto e tocava direto em "Receber" (o gesto natural) fechava a comanda
-- SEM o desconto, porque o blur e o close corriam juntos e o close lia o valor antigo (docs/98 C-13,
-- medido no roteiro c13). Agora `p_ticket_campos` pode trazer `discount_cents` e `tip_cents`; sem
-- eles, a função usa o que já está gravado (comportamento de antes, para o código antigo).
--
-- Migration EQUIVALENTE (troca o corpo da função, mesma assinatura): sobe junto do deploy do código,
-- antes dele; o código antigo continua funcionando porque as chaves novas são opcionais.

create or replace function public.aplicar_fechamento_de_comanda(
  p_tenant uuid,
  p_ticket uuid,
  p_itens jsonb,
  p_ticket_campos jsonb,
  p_consumo jsonb
)
returns public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets;
  v_papel text;
  v_item jsonb;
  v_uso jsonb;
  v_custo bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if not public.has_tenant(p_tenant) then
      raise exception 'Sem acesso a este negócio.' using errcode = '42501';
    end if;
    v_papel := public.tenant_role(p_tenant)::text;
    if v_papel not in ('owner', 'manager', 'reception') then
      if v_papel <> 'professional' or not exists (
        select 1 from public.tickets t
        where t.id = p_ticket and t.tenant_id = p_tenant and t.professional_id = public.my_professional_id(p_tenant)
      ) then
        raise exception 'Só quem atendeu fecha esta comanda.' using errcode = '42501';
      end if;
    end if;
  end if;

  select * into v_ticket from public.tickets
  where id = p_ticket and tenant_id = p_tenant and status = 'open'
  for update;
  if not found then
    raise exception 'Essa comanda já foi fechada.' using errcode = 'P0001', hint = 'INVALID_TRANSITION';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    update public.ticket_items
       set commission_bps = (v_item->>'commission_bps')::int,
           commission_cents = (v_item->>'commission_cents')::bigint
     where id = (v_item->>'id')::uuid and ticket_id = p_ticket and tenant_id = p_tenant;
  end loop;

  update public.tickets
     set status = 'closed',
         discount_cents = coalesce((p_ticket_campos->>'discount_cents')::bigint, discount_cents),
         tip_cents = coalesce((p_ticket_campos->>'tip_cents')::bigint, tip_cents),
         subtotal_cents = (p_ticket_campos->>'subtotal_cents')::bigint,
         total_cents = (p_ticket_campos->>'total_cents')::bigint,
         commission_cents = (p_ticket_campos->>'commission_cents')::bigint,
         material_cost_cents = (p_ticket_campos->>'material_cost_cents')::bigint,
         payment_method = (p_ticket_campos->>'payment_method')::public.payment_method,
         fixed_cost_cents = (p_ticket_campos->>'fixed_cost_cents')::bigint,
         fee_bps = (p_ticket_campos->>'fee_bps')::int,
         fee_cents = (p_ticket_campos->>'fee_cents')::bigint,
         profit_cents = (p_ticket_campos->>'profit_cents')::bigint,
         closed_at = now()
   where id = p_ticket and tenant_id = p_tenant
  returning * into v_ticket;

  for v_uso in select * from jsonb_array_elements(coalesce(p_consumo, '[]'::jsonb)) loop
    update public.products
       set stock_qty = stock_qty - (v_uso->>'qty')::numeric
     where id = (v_uso->>'product_id')::uuid and tenant_id = p_tenant
    returning avg_cost_cents into v_custo;
    if not found then
      raise exception 'Produto da comanda não existe mais neste negócio.' using errcode = '23503';
    end if;
    insert into public.stock_moves (tenant_id, product_id, kind, qty, unit_cost_cents, source, source_id)
    values (p_tenant, (v_uso->>'product_id')::uuid, 'out', -((v_uso->>'qty')::numeric), v_custo, 'ticket', p_ticket);
  end loop;

  return v_ticket;
end $$;

comment on function public.aplicar_fechamento_de_comanda(uuid, uuid, jsonb, jsonb, jsonb) is
  'APR-033a + APR-112a: aplica um fechamento JÁ CALCULADO (comissão por item, totais, desconto e gorjeta do próprio envio, consumo de estoque) numa transação só, conferindo papel e tenant por dentro.';
