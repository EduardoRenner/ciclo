-- docs/101 T4.2: a decisão da triagem de uma intimação. `legal_intimations` não tem política de escrita
-- para ninguém (0109): o que o tribunal publicou só muda de ESTADO, e só por esta porta.
--
-- p = { id, acao: 'vincular' | 'criar_prazo' | 'sem_prazo' | 'descartar', case_id?, due_on?, internal_due_on?,
--       title?, motivo? }
--
-- `security definer` porque grava em duas tabelas sem política de escrita para o usuário (a intimação) e
-- com política restrita (o prazo). Por isso a função REPETE as checagens que a RLS faria: tenant, papel,
-- alcance do caso. Códigos próprios para o servidor traduzir sem ambiguidade (memória
-- `sqlstate-42501-e-ambiguo`): LGL01 sem permissão, LGL02 entrada inválida, LGL04 não encontrada.
create or replace function public.legal_intimacao_decidir(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.legal_intimations;
  v_acao text := p->>'acao';
  v_caso uuid := nullif(p->>'case_id', '')::uuid;
  v_motivo text := nullif(btrim(coalesce(p->>'motivo', '')), '');
  v_due date := nullif(p->>'due_on', '')::date;
  v_interno date := nullif(p->>'internal_due_on', '')::date;
  v_titulo text := coalesce(nullif(btrim(coalesce(p->>'title', '')), ''), 'Prazo da intimação');
  v_cliente uuid;
  v_responsavel uuid;
  v_sug public.legal_intimation_suggestions;
  v_estagio boolean;
  v_prazo uuid;
begin
  select * into v from public.legal_intimations i where i.id = nullif(p->>'id', '')::uuid for update;
  if v.id is null or not public.has_tenant(v.tenant_id) then
    raise exception 'Essa intimação não está mais disponível.' using errcode = 'LGL04';
  end if;
  if public.tenant_role(v.tenant_id) not in ('owner', 'manager', 'professional') then
    raise exception 'Seu perfil não decide intimações.' using errcode = 'LGL01';
  end if;
  if v.case_id is not null and not public.legal_can_access_case(v.case_id) then
    raise exception 'Essa intimação não está mais disponível.' using errcode = 'LGL04';
  end if;
  if v.status in ('prazo_criado', 'sem_prazo', 'descartada') then
    raise exception 'Esta intimação já foi decidida.' using errcode = 'LGL02';
  end if;
  if v_acao not in ('vincular', 'criar_prazo', 'sem_prazo', 'descartar') then
    raise exception 'Ação desconhecida.' using errcode = 'LGL02';
  end if;

  -- o caso: o informado agora, ou o já vinculado
  v_caso := coalesce(v_caso, v.case_id);
  if v_caso is not null then
    select c.client_id, c.responsible_professional_id into v_cliente, v_responsavel
      from public.legal_cases c where c.id = v_caso and c.tenant_id = v.tenant_id;
    if v_cliente is null or not public.legal_can_access_case(v_caso) then
      raise exception 'Esse caso não está disponível.' using errcode = 'LGL04';
    end if;
  end if;

  if v_acao in ('vincular', 'criar_prazo') and v_caso is null then
    raise exception 'Escolha o caso desta intimação.' using errcode = 'LGL02';
  end if;
  if v_acao in ('sem_prazo', 'descartar') and char_length(coalesce(v_motivo, '')) < 5 then
    raise exception 'Escreva o motivo (pelo menos 5 letras): ele fica no histórico.' using errcode = 'LGL02';
  end if;

  if v_acao = 'vincular' then
    update public.legal_intimations set case_id = v_caso, status = 'vinculada' where id = v.id;
    return jsonb_build_object('status', 'vinculada');
  end if;

  if v_acao = 'criar_prazo' then
    if v_due is null then
      raise exception 'Informe a data do prazo.' using errcode = 'LGL02';
    end if;
    if v_interno is not null and v_interno > v_due then
      raise exception 'O dia interno precisa ser antes do prazo fatal.' using errcode = 'LGL02';
    end if;
    select * into v_sug from public.legal_intimation_suggestions s
      where s.intimation_id = v.id and s.suggested_due_on is not null order by s.created_at desc limit 1;
    -- quem é de estágio cria, mas o prazo nasce sem confirmação: a advocacia ou a direção confirma
    select coalesce(pr.legal_role = 'estagio', false) into v_estagio
      from public.professionals pr where pr.tenant_id = v.tenant_id and pr.user_id = auth.uid() limit 1;
    insert into public.legal_deadlines (
      tenant_id, client_id, case_id, kind, title, due_on, internal_due_on, source, intimation_id,
      calc_memo, calc_rule_version, suggested_due_on, calc_divergence, responsible_professional_id,
      confirmed_by, confirmed_at, created_by)
    values (
      v.tenant_id, v_cliente, v_caso, 'fatal', v_titulo, v_due, v_interno, 'djen', v.id,
      v_sug.calc_memo, v_sug.calc_rule_version, v_sug.suggested_due_on,
      case when v_sug.id is null then null else v_sug.suggested_due_on is distinct from v_due end,
      v_responsavel,
      case when coalesce(v_estagio, false) then null else auth.uid() end,
      case when coalesce(v_estagio, false) then null else now() end,
      auth.uid())
    returning id into v_prazo;
    update public.legal_intimations
       set case_id = v_caso, status = 'prazo_criado', triaged_by = auth.uid(), triaged_at = now(), reason = v_motivo
     where id = v.id;
    return jsonb_build_object('status', 'prazo_criado', 'deadline_id', v_prazo, 'confirmado', not coalesce(v_estagio, false));
  end if;

  update public.legal_intimations
     set case_id = v_caso, status = case v_acao when 'sem_prazo' then 'sem_prazo' else 'descartada' end,
         triaged_by = auth.uid(), triaged_at = now(), reason = v_motivo
   where id = v.id;
  return jsonb_build_object('status', case v_acao when 'sem_prazo' then 'sem_prazo' else 'descartada' end);
end $$;

revoke all on function public.legal_intimacao_decidir(jsonb) from public, anon;
grant execute on function public.legal_intimacao_decidir(jsonb) to authenticated;
