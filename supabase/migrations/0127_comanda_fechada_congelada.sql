-- APR-009 (achados E-04, G-01, G-55; desenho corrigido pela revisão R-02): o dinheiro de comanda
-- fechada fica congelado no BANCO, e comanda não se apaga.
--
-- Medido no banco local, com o JWT de cada papel (`tests/rls/comanda-fechada-congelada.test.ts`): a
-- profissional mudava a comissão do próprio item depois de fechar, o dono mudava total, taxa e forma
-- de comanda fechada, e qualquer membro apagava comanda e item. As políticas eram `has_tenant` puro e
-- não havia gatilho nenhum.
--
-- A 0073 justificou deixar UPDATE e DELETE abertos dizendo que "as rotas usam service_role". A
-- premissa estava errada: `POST /tickets/[id]/close` e o resto da comanda usam o cliente do usuário.
-- A 0073 já foi aplicada e não se edita; a correção é esta.
--
-- O desenho, e por que não é o primeiro que vem à cabeça (R-02):
--   · gatilho só `before update`, decidindo por `OLD.status` e comparando SÓ as colunas de dinheiro.
--     Um `before delete` dispararia na cascata do `tenants.delete()` (testes, seeds, LGPD) mesmo com
--     `service_role`; olhar a linha inteira bloquearia o `on delete set null` das FKs e o fechamento.
--     Mudar `status` (`closed` → `canceled`, o cancelamento) e `closed_at` continua livre;
--   · DELETE de item fora de `open` é recusado por POLÍTICA, que a cascata (feita pelo dono da
--     tabela) não consulta. "Remover item" de comanda aberta continua funcionando;
--   · `revoke delete` só em `tickets`. `ticket_items` precisa do DELETE para "remover item".
-- O erro tem código próprio (55000, `hint = 'COMANDA_FECHADA'`): 42501 é o mesmo de privilégio
-- negado, e confundir os dois já custou diagnóstico nesta base.
--
-- Fica de fora, de propósito: dois aparelhos lançando ou removendo item no MESMO instante em que um
-- terceiro fecha. É uma corrida de milissegundos que a APR-008 trata no código; fechá-la no banco
-- pede travar a comanda nas escritas de item e conferir o conjunto de itens dentro de
-- `aplicar_fechamento_de_comanda` (proposta registrada no `_progresso.md`).
--
-- Restritiva: sobe DEPOIS do deploy do código das APR-006, 007, 008 e 033 (o app já não depende de
-- editar comanda fechada). A reversão está no fim do arquivo.

create or replace function public.recusar_dinheiro_de_comanda_fechada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('closed', 'paid', 'canceled') and (
       new.subtotal_cents is distinct from old.subtotal_cents
    or new.discount_cents is distinct from old.discount_cents
    or new.tip_cents is distinct from old.tip_cents
    or new.total_cents is distinct from old.total_cents
    or new.material_cost_cents is distinct from old.material_cost_cents
    or new.fee_cents is distinct from old.fee_cents
    or new.fee_bps is distinct from old.fee_bps
    or new.commission_cents is distinct from old.commission_cents
    or new.fixed_cost_cents is distinct from old.fixed_cost_cents
    or new.profit_cents is distinct from old.profit_cents
    or new.payment_method is distinct from old.payment_method
  ) then
    raise exception 'Comanda fechada não muda de valor. Para corrigir, cancele a comanda e abra outra.'
      using errcode = '55000', hint = 'COMANDA_FECHADA';
  end if;
  return new;
end $$;

drop trigger if exists tickets_dinheiro_congelado on public.tickets;
create trigger tickets_dinheiro_congelado
  before update on public.tickets
  for each row execute function public.recusar_dinheiro_de_comanda_fechada();

-- Item: o estado é o da comanda. `security definer` para ler o estado mesmo quando a RLS de `tickets`
-- não mostra a comanda a quem escreve (profissional com a visão restrita): sem isso, o gatilho veria
-- "nenhuma comanda" e decidiria às cegas.
create or replace function public.recusar_dinheiro_de_item_fechado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.ticket_status;
begin
  if new.qty is distinct from old.qty
    or new.unit_price_cents is distinct from old.unit_price_cents
    or new.discount_cents is distinct from old.discount_cents
    or new.total_cents is distinct from old.total_cents
    or new.cost_cents is distinct from old.cost_cents
    or new.commission_bps is distinct from old.commission_bps
    or new.commission_cents is distinct from old.commission_cents
    or new.ticket_id is distinct from old.ticket_id
  then
    select t.status into v_status from public.tickets t where t.id = old.ticket_id;
    if v_status is distinct from 'open' then
      raise exception 'Comanda fechada não muda de valor. Para corrigir, cancele a comanda e abra outra.'
        using errcode = '55000', hint = 'COMANDA_FECHADA';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.recusar_dinheiro_de_item_fechado() from public, anon, authenticated;

drop trigger if exists ticket_items_dinheiro_congelado on public.ticket_items;
create trigger ticket_items_dinheiro_congelado
  before update on public.ticket_items
  for each row execute function public.recusar_dinheiro_de_item_fechado();

-- Item só sai de comanda aberta.
drop policy if exists ticket_items_delete on public.ticket_items;
create policy ticket_items_delete on public.ticket_items for delete using (
  public.has_tenant(tenant_id)
  and exists (select 1 from public.tickets t where t.id = ticket_items.ticket_id and t.status = 'open')
);

-- Comanda não se apaga (regra 11 do CLAUDE.md): corrigir é cancelar, que é compensação.
drop policy if exists tickets_delete on public.tickets;
revoke delete on public.tickets from authenticated, anon;

-- Reversão (compensatória), se for preciso voltar:
--
--   drop trigger if exists tickets_dinheiro_congelado on public.tickets;
--   drop trigger if exists ticket_items_dinheiro_congelado on public.ticket_items;
--   drop policy if exists ticket_items_delete on public.ticket_items;
--   create policy ticket_items_delete on public.ticket_items for delete using (public.has_tenant(tenant_id));
--   grant delete on public.tickets to authenticated;
--   create policy tickets_delete on public.tickets for delete using (public.has_tenant(tenant_id));
