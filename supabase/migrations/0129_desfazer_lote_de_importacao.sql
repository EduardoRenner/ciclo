-- CICLO · desfazer uma importação em até 7 dias (docs/103 CNV-022).
--
-- ## O que desfaz
--
-- Tira as fichas que o lote CRIOU e que ninguém usou depois. Tirar é o mesmo `deleted_at` da exclusão
-- de ficha pela tela (`removerCliente`): some das listas, do Recuperar (`v_quem_sumiu` já filtra) e
-- libera o telefone para entrar de novo (o índice único de telefone ignora apagada).
--
-- ## O que NÃO desfaz
--
-- Ficha que já tem vida no CICLO fica: agendamento, comanda, pagamento, nota, consentimento, ficha de
-- saúde, pacote, mensagem enviada, foto, avaliação, indicação, carteira, fidelidade, lista de espera,
-- orçamento, caso do escritório. Apagar ali seria apagar trabalho de alguém. A função devolve quantas
-- ficaram, e a tela diz por quê. Ciclo, nota de cliente e previsão NÃO contam como uso: foram gerados
-- pelo próprio lote.
--
-- ## Por que função, e não várias idas do PostgREST
--
-- Uma transação só (as fichas e o estado do lote mudam juntos ou nada muda), e a pergunta "alguém usou?"
-- precisa enxergar tabelas que a RLS esconde de quem importou (a recepção não lê `health_records`).
-- Por isso SECURITY DEFINER, com as duas checagens que a RLS faria feitas aqui dentro: pertence ao
-- salão (`has_tenant`) e o papel é dos que importam (`client:create` em `rbac.ts`: dono, gerência,
-- recepção). Códigos de erro próprios (IMP0x): 42501 é ambíguo neste projeto (DECISOES).
--
-- Migration ADITIVA: vai ANTES do deploy do código que a usa.

create or replace function public.desfazer_lote_de_importacao(p_batch uuid)
returns table (removidas integer, mantidas integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v public.import_batches%rowtype;
  v_removidas integer;
  v_mantidas integer;
begin
  select * into v from public.import_batches where id = p_batch for update;
  if not found or not public.has_tenant(v.tenant_id) then
    raise exception 'Não achei esta importação.' using errcode = 'IMP01';
  end if;
  if public.tenant_role(v.tenant_id) not in ('owner', 'manager', 'reception') then
    raise exception 'Desfazer a importação é com o dono, a gerência ou a recepção.' using errcode = 'IMP02';
  end if;
  if v.status = 'desfeito' then
    raise exception 'Esta importação já foi desfeita.' using errcode = 'IMP03';
  end if;
  if v.created_at < now() - interval '7 days' then
    raise exception 'Passou o prazo de 7 dias para desfazer esta importação.' using errcode = 'IMP04';
  end if;

  with do_lote as (
    select c.id from public.clients c
    where c.import_batch_id = v.id and c.tenant_id = v.tenant_id and c.deleted_at is null
  ),
  usadas as (
    select d.id from do_lote d
    where exists (select 1 from public.appointments x where x.client_id = d.id)
       or exists (select 1 from public.appointment_series x where x.client_id = d.id)
       or exists (select 1 from public.tickets x where x.client_id = d.id)
       or exists (select 1 from public.payments x where x.client_id = d.id)
       or exists (select 1 from public.client_notes x where x.client_id = d.id)
       or exists (select 1 from public.client_reviews x where x.client_id = d.id)
       or exists (select 1 from public.client_subscriptions x where x.client_id = d.id)
       or exists (select 1 from public.consents x where x.client_id = d.id)
       or exists (select 1 from public.health_records x where x.client_id = d.id)
       or exists (select 1 from public.loyalty_entries x where x.client_id = d.id)
       or exists (select 1 from public.media x where x.client_id = d.id)
       or exists (select 1 from public.messages x where x.client_id = d.id)
       or exists (select 1 from public.packages x where x.client_id = d.id)
       or exists (select 1 from public.portfolio_photos x where x.client_id = d.id)
       or exists (select 1 from public.quotes x where x.client_id = d.id)
       or exists (select 1 from public.waitlist x where x.client_id = d.id)
       or exists (select 1 from public.wallet_entries x where x.client_id = d.id)
       or exists (select 1 from public.legal_cases x where x.client_id = d.id)
       or exists (select 1 from public.legal_deadlines x where x.client_id = d.id)
       or exists (select 1 from public.legal_documents x where x.client_id = d.id)
       or exists (select 1 from public.legal_entities x where x.client_id = d.id)
       or exists (select 1 from public.legal_persons x where x.client_id = d.id)
       or exists (select 1 from public.clients x where x.referred_by = d.id and x.deleted_at is null)
  ),
  tiradas as (
    update public.clients c set deleted_at = now()
    where c.id in (select id from do_lote except select id from usadas)
    returning c.id
  )
  select (select count(*) from tiradas), (select count(*) from usadas) into v_removidas, v_mantidas;

  update public.import_batches
     set status = 'desfeito', undone_at = now(), undone_by = auth.uid()
   where id = v.id;

  return query select v_removidas, v_mantidas;
end;
$$;

revoke all on function public.desfazer_lote_de_importacao(uuid) from public, anon;
grant execute on function public.desfazer_lote_de_importacao(uuid) to authenticated;

comment on function public.desfazer_lote_de_importacao(uuid) is
  'docs/103 CNV-022: tira (deleted_at) as fichas que o lote criou e ninguém usou; mantém as usadas e diz quantas. Até 7 dias, uma vez, dono/gerência/recepção.';
