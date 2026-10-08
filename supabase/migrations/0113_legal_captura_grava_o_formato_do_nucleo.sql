-- docs/101 T4.1: a gravação da captura passa a ler o corpo que o núcleo MONTA (`corpoDaRpc` em
-- core/advocacia/intimacoes.ts, portado do LUBI com teste próprio).
--
-- O defeito da 0109: a função lia `texto`, `cancelado_em` e `motivo_cancelamento`, e o núcleo manda
-- `texto_sanitizado`, `cancelled_at` e `cancel_reason`. Toda intimação real cairia no `not null` do texto,
-- e o dia ficaria sem gravar. Achado ao escrever a captura, antes de qualquer chamada real.
--
-- Também: o `ok` e o `detalhe` do chamador (itens recusados por formato, de outro alvo, repetidos) passam
-- a valer junto com a contagem; e a SUGESTÃO de prazo de cada item novo (calculada no servidor por
-- `sugerirPrazo`) é gravada na mesma transação, só quando a intimação nasce (recaptura não duplica).
create or replace function public.legal_intimacoes_gravar(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := (p->>'tenant_id')::uuid;
  v_item jsonb;
  v_novas int := 0;
  v_vinculadas int := 0;
  v_id uuid;
  v_inserida boolean;
  v_caso uuid;
  v_gravadas int;
  v_ok boolean;
  v_detalhe text;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p->'itens', '[]'::jsonb)) loop
    select c.id into v_caso from public.legal_cases c
     where c.tenant_id = v_tenant and c.cnj_number = v_item->>'numero_processo' and c.archived_at is null
     order by c.created_at limit 1;
    insert into public.legal_intimations (tenant_id, djen_id, hash, numero_processo, data_disponibilizacao, tribunal, orgao, tipo,
                                          classe, texto_sanitizado, link, destinatarios, alvo, case_id, status, cancelled_at, cancel_reason)
    values (v_tenant, (v_item->>'djen_id')::bigint, v_item->>'hash', v_item->>'numero_processo', (v_item->>'data_disponibilizacao')::date,
            v_item->>'tribunal', v_item->>'orgao', v_item->>'tipo', v_item->>'classe', v_item->>'texto_sanitizado', v_item->>'link',
            coalesce(v_item->'destinatarios', '[]'::jsonb), p->>'alvo', v_caso,
            case when v_caso is null then 'nova' else 'vinculada' end,
            (v_item->>'cancelled_at')::timestamptz, v_item->>'cancel_reason')
    on conflict (tenant_id, djen_id) do update
       set cancelled_at = coalesce(public.legal_intimations.cancelled_at, excluded.cancelled_at),
           cancel_reason = coalesce(public.legal_intimations.cancel_reason, excluded.cancel_reason)
    returning id, (xmax = 0) into v_id, v_inserida;

    if v_inserida then
      v_novas := v_novas + 1;
      if v_caso is not null then v_vinculadas := v_vinculadas + 1; end if;
      if v_item ? 'sugestao' then
        insert into public.legal_intimation_suggestions
          (tenant_id, intimation_id, suggested_due_on, internal_due_on, calc_memo, calc_rule_version, sem_sugestao)
        values (v_tenant, v_id,
                (v_item->'sugestao'->>'suggested_due_on')::date, (v_item->'sugestao'->>'internal_due_on')::date,
                v_item->'sugestao'->'calc_memo', v_item->'sugestao'->>'calc_rule_version',
                left(v_item->'sugestao'->>'sem_sugestao', 300));
      end if;
    end if;
  end loop;

  select count(*) into v_gravadas from public.legal_intimations
   where tenant_id = v_tenant and alvo = p->>'alvo' and data_disponibilizacao = (p->>'dia')::date;
  v_ok := coalesce((p->>'ok')::boolean, true) and v_gravadas >= (p->>'count_fonte')::int;
  v_detalhe := left(concat_ws('; ',
    nullif(p->>'detalhe', ''),
    case when v_gravadas < (p->>'count_fonte')::int then format('gravadas %s de %s', v_gravadas, p->>'count_fonte') end), 300);
  insert into public.legal_intimation_sync (tenant_id, alvo, dia, count_fonte, count_gravado, ok, detalhe)
  values (v_tenant, p->>'alvo', (p->>'dia')::date, (p->>'count_fonte')::int, v_gravadas, v_ok, nullif(v_detalhe, ''))
  on conflict (tenant_id, alvo, dia) do update
     set count_fonte = excluded.count_fonte, count_gravado = excluded.count_gravado, ok = excluded.ok, detalhe = excluded.detalhe,
         updated_at = now();
  return jsonb_build_object('novas', v_novas, 'vinculadas', v_vinculadas, 'gravadas_no_dia', v_gravadas, 'ok', v_ok);
end $$;
revoke all on function public.legal_intimacoes_gravar(jsonb) from public, anon, authenticated;
grant execute on function public.legal_intimacoes_gravar(jsonb) to service_role;

-- Falha de rede ou de formato num dia: o dia fica VERMELHO com o motivo, sem apagar o que já foi gravado
-- (um "ok" de ontem não vira falso por uma consulta de hoje que caiu). Só o servidor chama.
create or replace function public.legal_intimacoes_falha(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.legal_intimation_sync (tenant_id, alvo, dia, count_fonte, count_gravado, ok, detalhe)
  values ((p->>'tenant_id')::uuid, p->>'alvo', (p->>'dia')::date, 0,
          (select count(*) from public.legal_intimations i
            where i.tenant_id = (p->>'tenant_id')::uuid and i.alvo = p->>'alvo' and i.data_disponibilizacao = (p->>'dia')::date),
          false, left(p->>'detalhe', 300))
  on conflict (tenant_id, alvo, dia) do update set ok = false, detalhe = excluded.detalhe, updated_at = now();
end $$;
revoke all on function public.legal_intimacoes_falha(jsonb) from public, anon, authenticated;
grant execute on function public.legal_intimacoes_falha(jsonb) to service_role;
