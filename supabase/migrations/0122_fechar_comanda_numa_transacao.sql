-- APR-033a (achados C-15, R-03, R-04): fechar a comanda, gravar comissão por item e baixar o estoque
-- numa transação só — ou nada.
--
-- O fechamento era uma sequência de escritas pela API: comissão de cada item, a comanda `closed`, e
-- DEPOIS a baixa de estoque produto a produto. Se a baixa falhava no meio, a comanda ficava fechada,
-- a tela dizia "falhou", a nova tentativa dizia "já foi fechada" e o estoque ficava parcial. Com o
-- profissional fechando a própria comanda, a RLS de `products` (só dono e gerente) fazia isso
-- acontecer SEMPRE (R-04, contornado na APR-038 com o cliente de serviço).
--
-- Esta função APLICA um fechamento já calculado. A regra (comissão, taxa, hora de cadeira, sobra,
-- consumo da ficha) continua no TypeScript (`core/`, `server/services/comanda.ts`): SQL não ganha
-- uma segunda cópia da fórmula. O que a função garante é a atomicidade e a permissão.
--
-- `security definer` porque o estoque é escrito em nome de quem tem o direito de fechar — e a RLS de
-- `products` não sabe disso. Por isso a permissão é conferida AQUI DENTRO, antes de qualquer escrita:
--   · servidor (`service_role`): já validou papel e tenant na rota;
--   · usuário: precisa ser do tenant, e dono, gerente, recepção — ou o profissional da PRÓPRIA comanda.
-- A auditoria continua na rota, antes da resposta (`docs/28` §8): `audit_log` não entra aqui.
--
-- Aditiva: nada usa a função até a APR-033b ligar a chamada.

create or replace function public.aplicar_fechamento_de_comanda(
  p_tenant uuid,
  p_ticket uuid,
  p_itens jsonb,        -- [{ "id": uuid, "commission_bps": int, "commission_cents": int }]
  p_ticket_campos jsonb, -- { subtotal_cents, total_cents, commission_cents, material_cost_cents,
                         --   payment_method, fixed_cost_cents, fee_bps, fee_cents, profit_cents }
  p_consumo jsonb        -- [{ "product_id": uuid, "qty": numeric }]
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

  -- Trava a linha: duas tentativas simultâneas não fecham a mesma comanda duas vezes (nem baixam o
  -- estoque em dobro).
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

  -- Estoque: o movimento (`out`, negativo) e o saldo na MESMA transação. Saldo negativo é permitido
  -- (alerta, não bloqueia — regra da casa). Produto de outro tenant ou inexistente faz a transação
  -- inteira voltar: a comanda continua aberta, sem movimento nenhum.
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
  'APR-033a: aplica um fechamento JÁ CALCULADO (comissão por item, totais, consumo de estoque) numa transação só, conferindo papel e tenant por dentro.';

revoke all on function public.aplicar_fechamento_de_comanda(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.aplicar_fechamento_de_comanda(uuid, uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
