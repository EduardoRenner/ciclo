-- CICLO · lote 0092 a 0098, para colar UMA vez no SQL Editor do Supabase de PRODUCAO.
-- Ordem: 0092 antes de 0093. Tudo numa transacao: se falhar, nada e aplicado.
begin;

-- ===== migrations\0092_ritmo_na_lista_de_recuperar.sql =====
-- CICLO · "por que essa pessoa está na lista" chega em Recuperar receita
--
-- `core/ciclo/ritmo-do-cliente.ts` já existe desde o `docs/48` C4 ("o João vem a cada 18 dias,
-- está há 31") e já é honesto sobre procedência — só nunca ganhou os dados que precisa na tela de
-- MAIOR tráfego do produto (`/admin/recuperar`, o botão central da barra desde 31/08). Hoje ele só
-- aparece na ficha individual do cliente, uma pessoa de cada vez.
--
-- `v_recover_revenue` (0001, alterada em 0067) não expõe `personal_cycle_days` nem `last_visit_on`
-- — só dá para dizer O ESTADO e O ATRASO, nunca o RITMO por trás dele. E falta um dado que a view
-- não tem em lugar nenhum: quantos intervalos formaram aquele número. Sem isso a tela não consegue
-- distinguir "medido em 5 visitas" de "só o palpite do catálogo, cliente com 1 visita só" — a
-- MESMA distinção que `ritmo-do-cliente.ts` já protege na ficha, e que este arquivo existe para
-- levar também a Recuperar, sem repetir a fórmula (ela mora só em `computeCycle`, passo 3).
--
-- `sample_size`: quantos intervalos (gaps) entraram na mediana que decidiu `personal_cycle_days` —
-- 0 quando o valor é só o padrão do serviço. Escrito pelas três portas que gravam `client_cycles`
-- (`server/services/ciclo.ts`, duas vezes, e `ciclo-de-quem-ja-atende.ts`), a partir do campo novo
-- `amostra` de `ResultadoComputeCycle`. Sem escritor nas três, a coluna ficaria certa numa porta e
-- mentindo nas outras duas — a mesma classe de defeito que este projeto já se cobrou antes
-- ("coluna sem escritor vem em fila").
alter table client_cycles add column if not exists sample_size int not null default 0;
comment on column client_cycles.sample_size is
  'Quantos intervalos (gaps) formaram personal_cycle_days — 0 quando o valor é só o padrão do serviço, sem nada pessoal medido. Ver core/cycle/compute.ts, passo 3.';

-- Mesma armadilha de sempre (`0067`, comentário original): `create or replace view` só aceita
-- coluna NOVA no fim, e `security_invoker = true` não é herdado — tem que repetir, senão a view
-- volta a rodar com o dono e fura a RLS de `client_cycles`.
create or replace view v_recover_revenue with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name        as client_name,
  c.phone_e164,
  cc.service_id,
  s.name        as service_name,
  cc.state,
  cc.late_days,
  cc.predicted_on,
  cc.value_at_risk_cents,
  cc.last_campaign_at,
  cc.profit_at_risk_cents,
  cc.personal_cycle_days,
  cc.last_visit_on,
  cc.sample_size
from client_cycles cc
join clients  c on c.id = cc.client_id and c.deleted_at is null
join services s on s.id = cc.service_id
where cc.state in ('due','late','at_risk','lost')
order by cc.value_at_risk_cents desc;

-- ===== migrations\0093_servico_arquivado_sai_das_telas_de_dinheiro.sql =====
-- CICLO · BL-48 (.claude/ciclo/autonomous-backlog.md), partes 2 e 3: serviço arquivado sai das
-- duas telas de dinheiro do Motor de Ciclo, não só do job noturno (migration anterior a esta, em
-- server/services/ciclo.ts, já filtrou `active = true` na leitura de `services`).
--
-- Sem isto, `v_recover_revenue` (Recuperar receita) e `v_clientes_a_recuperar` (alerta do "Hoje")
-- continuam mostrando/contando `client_cycles` de um serviço que o salão não oferece mais — a
-- profissional lê "fulana atrasada, Platinado" para um serviço tirado do catálogo há meses, e o
-- número "N clientes sumindo · R$ X em risco" da tela inicial infla com gente cujo único estado
-- não-em-dia é desse serviço fantasma.
--
-- `create or replace view` só aceita coluna NOVA no fim, e não muda a lista de colunas aqui —
-- ambas ganham só una condição de filtro. `security_invoker = true` é repetido nas duas por
-- obrigação: `create or replace view` NÃO herda as opções da definição anterior (armadilha já
-- nomeada na migration 0067 desta mesma família).
--
-- A view lista as 15 colunas da `0092` (ritmo na lista de recuperar) e mantém `and s.active`.
-- Ordem obrigatória: `0092` ANTES desta.

create or replace view public.v_recover_revenue with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name        as client_name,
  c.phone_e164,
  cc.service_id,
  s.name        as service_name,
  cc.state,
  cc.late_days,
  cc.predicted_on,
  cc.value_at_risk_cents,
  cc.last_campaign_at,
  cc.profit_at_risk_cents,
  cc.personal_cycle_days,
  cc.last_visit_on,
  cc.sample_size
from public.client_cycles cc
join public.clients  c on c.id = cc.client_id and c.deleted_at is null
join public.services s on s.id = cc.service_id and s.active
where cc.state in ('due','late','at_risk','lost')
order by cc.value_at_risk_cents desc;

-- `v_clientes_a_recuperar` (0058): mesma exclusão, nos dois lados da lógica — no cálculo do que
-- CONTA como "atrasado" (o `from`/`join` principal) e no que conta como "em dia" (o `not exists`
-- correlacionado). Um cliente cujo único ciclo não-`on_track` é de serviço arquivado não pode
-- aparecer como "sumindo"; e um `on_track` de serviço arquivado não pode blindar (nem prejudicar)
-- ninguém — o serviço arquivado some da conta dos dois lados, como se nunca tivesse existido para
-- esta pergunta.
create or replace view public.v_clientes_a_recuperar
with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  max(cc.value_at_risk_cents) as maior_valor_cents,
  max(cc.late_days) as maior_atraso_dias,
  bool_or(cc.state in ('late', 'at_risk', 'lost')) as ja_atrasado
from public.client_cycles cc
join public.services s on s.id = cc.service_id and s.active
where cc.state in ('due', 'late', 'at_risk', 'lost')
  and not exists (
    select 1 from public.client_cycles saudavel
    join public.services s2 on s2.id = saudavel.service_id and s2.active
    where saudavel.tenant_id = cc.tenant_id
      and saudavel.client_id = cc.client_id
      and saudavel.state = 'on_track'
  )
group by cc.tenant_id, cc.client_id;

comment on view public.v_clientes_a_recuperar is
  'Uma linha por CLIENTE a recuperar (não por cliente×serviço). Exclui quem tem qualquer ciclo em dia, e ignora ciclo de serviço arquivado dos dois lados da conta (BL-48).';

-- ===== migrations\0094_resolver_previsoes_em_lote.sql =====
-- CICLO · BL-46 (`.claude/ciclo/autonomous-backlog.md`) — RPC em lote para fechar previsões
--
-- Medido em 2026-09-27 (`tests/integration/ciclo.test.ts`, `'resolverPrevisoes isolado'`): o laço
-- por linha de `resolverPrevisoes` (`server/services/previsao.ts`) leva 17,6ms por previsão — 5 mil
-- previsões abertas levam 87,8s para fechar. Um tenant com ~3.400 previsões fechando no mesmo dia
-- (ex.: depois de uma campanha de recuperação bem-sucedida trazendo muita gente de volta na mesma
-- semana) já estouraria o teto de 60s que o job inteiro promete.
--
-- A parte cara não é DECIDIR quem fechou — isso continua em TypeScript, em memória, contra o
-- `historicoPorCombinacao` que o recálculo já montou (mudar isso para SQL duplicaria a regra "a
-- primeira visita ESTRITAMENTE depois da que originou a previsão" num segundo lugar, a mesma
-- armadilha de "duas cópias da mesma fórmula" já registrada nesta base). A parte cara é a IDA DE
-- REDE: uma por linha. Esta função troca N idas por 1, recebendo o lote já decidido.
--
-- ## Por que `security invoker` (o padrão da casa, não o mais conveniente)
--
-- Mesmo raciocínio da `0034` (`debitar_carteira`): esta função só precisa do privilégio de quem
-- chama. `resolverPrevisoes` roda sempre com `service_role` (dentro do job noturno e das duas
-- portas de "quem já atendo"/importação, nunca por uma rota de usuário direto) — `service_role`
-- ignora RLS por desenho (`BYPASSRLS`), então `security invoker` não abre mão de proteção nenhuma
-- aqui e ainda deixa a política `cycle_predictions_tenant_all` (`0064`) como a última linha de
-- defesa, caso um dia alguém chame isto fora do caminho de hoje.
--
-- ## Por que a trava (`resolved_at is null`) continua dentro do `UPDATE`, não some
--
-- É o CAS (compare-and-swap) que já existia por linha: duas execuções simultâneas do job (corrida
-- real, não hipotética — dois cron disparando perto um do outro, ou o recálculo síncrono de
-- `concluirAgendamento` correndo junto do noturno) só podem fechar cada previsão UMA vez. Um
-- `UPDATE ... WHERE id = ANY(...)` simples, sem a condição, perderia essa garantia — é exatamente o
-- erro que o achado original do BL-46 avisava para não cometer.
create or replace function public.resolver_previsoes_em_lote(p_tenant_id uuid, p_atualizacoes jsonb)
returns int
language plpgsql
volatile
set search_path = public
as $$
declare
  v_agora timestamptz := now();
  v_count int;
begin
  with entrada as (
    select
      (elem->>'id')::uuid as id,
      (elem->>'actual_return_on')::date as actual_return_on
    from jsonb_array_elements(p_atualizacoes) as elem
  )
  update public.cycle_predictions cp
  set actual_return_on = entrada.actual_return_on,
      resolved_at = v_agora
  from entrada
  where cp.id = entrada.id
    and cp.tenant_id = p_tenant_id
    and cp.resolved_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.resolver_previsoes_em_lote(uuid, jsonb) is
  'Fecha em UMA ida de rede as previsões já decididas em memória (server/services/previsao.ts). p_atualizacoes é um array de {id, actual_return_on}; devolve quantas linhas realmente mudaram (a trava resolved_at is null continua por linha, para duas execuções simultâneas não contarem a mesma duas vezes). BL-46.';

-- Privilégio mínimo: nenhuma rota de usuário chama isto, só o caminho de `service_role`.
revoke execute on function public.resolver_previsoes_em_lote(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.resolver_previsoes_em_lote(uuid, jsonb) to service_role;

-- ===== migrations\0095_aceite_versionado_dos_termos.sql =====
-- CICLO · aceite versionado dos termos e da privacidade (BL-50)
--
-- ## O que faltava
--
-- `tenants.created_at` sempre deu o carimbo de "quando a conta nasceu" — a evidência mínima do
-- aceite pelo ato de contratar (decisão registrada em `termos/page.tsx`: sem checkbox). O que não
-- existia era a ligação entre esse carimbo e QUAL VERSÃO dos termos estava no ar naquele dia:
-- reconstruir exigia cruzar `created_at` com `git log` de `termos/page.tsx`, à mão.
--
-- O BL-50 dizia para esperar a terceira mudança de termos. Ela chegou: a cláusula de dados
-- agregados (docs/84, DECISOES 28/09) muda os termos de novo, e a partir dela "o que valia quando
-- esta conta assinou" passa a ter resposta diferente conforme a conta.
--
-- ## O desenho
--
-- Uma linha por aceite: quem, qual documento, qual versão, quando, por qual caminho. Append-only —
-- é prova, não estado: sem política de UPDATE nem DELETE, e com RLS forçada ausência de política é
-- negação (mesmo padrão de `product_events`, 0088, e `wallet_entries`, 0083). Quem grava é o
-- servidor no cadastro (`executarOnboarding`, com a chave de serviço); ninguém grava pela API.
--
-- `versao` é a data ISO em que o texto entrou no ar — a mesma constante que a página mostra
-- (`core/legal/versoes.ts`), para a prova e a página não divergirem.
--
-- ## O que NÃO faz: preencher o passado
--
-- Contas que já existem ficam sem linha. Não há como afirmar qual versão cada uma viu sem
-- reconstruir pelo git — e gravar uma versão deduzida como se fosse aceite registrado seria criar
-- prova que não existe. "Sem linha" quer dizer "anterior ao versionamento": `created_at` × histórico
-- da página, como sempre foi.
--
-- `user_id` com `on delete set null`: a pessoa pode ser apagada (LGPD, art. 18), e a prova de que
-- a CONTA aceitou aquela versão continua.

create table terms_acceptances (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  documento  text not null check (documento in ('termos', 'privacidade')),
  versao     text not null check (versao ~ '^\d{4}-\d{2}-\d{2}$'),
  via        text not null check (via in ('cadastro', 'reaceite')),
  aceito_em  timestamptz not null default now()
);

create index terms_acceptances_tenant_idx on terms_acceptances (tenant_id, documento, aceito_em);
create index terms_acceptances_user_idx on terms_acceptances (user_id);

alter table terms_acceptances enable row level security;
alter table terms_acceptances force row level security;

-- Só leitura, e só do próprio negócio. Escrita é do servidor, no cadastro.
create policy terms_acceptances_select on terms_acceptances
  for select using (public.has_tenant(tenant_id));

comment on table terms_acceptances is
  'Append-only: qual versão dos termos/privacidade cada conta aceitou, e quando. Versão = data ISO de core/legal/versoes.ts. Contas anteriores à 0095 não têm linha (não se inventa prova). Ver BL-50.';

-- ===== migrations\0096_ultima_visita_informada_ao_meio_dia.sql =====
-- CICLO · a última visita informada não pode voltar um dia (29/09/2026)
--
-- ## O defeito
--
-- A importação por planilha e o "Quem você já atende" gravavam `clients.last_visit_at` (que é
-- `timestamptz`) com uma DATA pura: `'2026-08-15'`. O Postgres guarda isso como MEIA-NOITE UTC —
-- que em Brasília é 21h do dia 14. Quem lê a data no fuso do salão vê a visita UM DIA ANTES.
-- Medido pelo teste da exportação da base (docs/83 P3): o arquivo sairia com o dia errado e, ao
-- voltar pelo importador, a pessoa ficaria "atrasada" um dia a mais.
--
-- O código novo grava MEIO-DIA UTC (`instanteDoDiaInformado`), que cai no mesmo dia em qualquer
-- fuso de UTC−11 a UTC+11. Esta migration conserta o que já foi gravado.
--
-- ## Quem é mexido, e quem NÃO é
--
-- Só as linhas em meia-noite UTC EXATA que não vieram de um atendimento. `last_visit_at` também é
-- escrito a partir de `appointments.starts_at` (segmentos); um atendimento às 21h00 em Brasília é
-- 00:00:00 UTC exato e é VERDADE — mexer nele empurraria a visita para o dia seguinte. Por isso a
-- condição `not exists` com o mesmo instante em `appointments`.
--
-- Soma 12 horas: meia-noite UTC do dia D vira meio-dia UTC do mesmo dia D — a data informada fica
-- a mesma, só deixa de ser ambígua. Idempotente: rodar de novo não acha mais nenhuma linha.

update clients c
set last_visit_at = c.last_visit_at + interval '12 hours'
where c.last_visit_at is not null
  and (c.last_visit_at at time zone 'UTC')::time = time '00:00:00'
  and not exists (
    select 1 from appointments a
    where a.client_id = c.id and a.tenant_id = c.tenant_id and a.starts_at = c.last_visit_at
  );

-- ===== migrations\0097_servico_canonico.sql =====
-- =====================================================================
-- CICLO · serviço canônico (migration 0097) — docs/84 §2.3
--
-- Cada salão escreve o mesmo serviço de um jeito ("Corte masc.", "Corte degradê", "Social"). Para
-- o agregado anonimizado (ritmo mediano, preço, falta por serviço) comparar negócios, precisa saber
-- de QUAL item do catálogo cada serviço nasceu — e esse vínculo não pode morar no nome, que o dono
-- renomeia quando quiser.
--
-- ## A chave
--
-- `services.canonical_key` guarda a origem, em texto, porque os catálogos são dois:
--   · `pack:<vertical>:<nome no pack>` — `vertical_packs` (as 8 verticais legadas), que não tem id
--     por item; o nome dentro do pack é o identificador estável do item.
--   · `prof:<profession_services.id>` — o catálogo novo das profissões.
-- Serviço criado à mão pelo dono fica NULL: não tem origem, e inventar uma seria pior que ficar
-- de fora do agregado.
--
-- ## Renomear não quebra
--
-- A chave é gravada uma vez, na criação, e nenhuma rota de edição a recebe (o esquema Zod de
-- serviço não tem o campo). Renomear "Corte masculino" para "Corte do Zé" mantém a origem.
--
-- ## Backfill
--
-- Só liga serviço que AINDA tem o nome do catálogo — se o dono já renomeou, não há como saber a
-- origem sem chutar, e fica NULL. Usa a mesma regra de `executarOnboarding` para decidir o
-- catálogo: as 8 verticais legadas vieram de `vertical_packs`; as outras, de `profession_services`.
--
-- ## Deploy
--
-- Aditiva e anulável: pode (e deve) ir para produção ANTES do código. Código velho não escreve a
-- coluna e segue funcionando.
-- =====================================================================

alter table services add column if not exists canonical_key text;

create index if not exists services_canonical_key_idx
  on services (canonical_key) where canonical_key is not null and deleted_at is null;

create or replace function public.apply_vertical_pack(p_tenant uuid, p_vertical vertical_pack)
returns void language plpgsql security definer set search_path = public as $$
declare
  pk record; item jsonb;
  svc_ids jsonb := '{}'::jsonb; prod_ids jsonb := '{}'::jsonb;
  new_id uuid;
begin
  select * into pk from vertical_packs where vertical = p_vertical;

  if found then
    -- serviços
    for item in select * from jsonb_array_elements(pk.services) loop
      insert into services (tenant_id, name, duration_min, price_cents, cycle_days,
                            deposit_bps, requires_anamnesis, buffer_after_min, canonical_key)
      values (p_tenant, item->>'name', (item->>'duration_min')::int, (item->>'price_cents')::bigint,
              -- "sem ciclo" (0) vira o padrão da coluna, não 1 (0063).
              case when coalesce((item->>'cycle_days')::int, 0) < 1 then 21
                   else (item->>'cycle_days')::int end,
              (item->>'deposit_bps')::int,
              (item->>'requires_anamnesis')::boolean, coalesce((item->>'buffer_after_min')::int, 0),
              'pack:' || p_vertical::text || ':' || (item->>'name'))
      on conflict do nothing
      returning id into new_id;
      if new_id is not null then svc_ids := svc_ids || jsonb_build_object(item->>'name', new_id); end if;
    end loop;

    -- produtos
    for item in select * from jsonb_array_elements(pk.products) loop
      insert into products (tenant_id, name, unit, avg_cost_cents, reorder_point)
      values (p_tenant, item->>'name', item->>'unit', (item->>'avg_cost_cents')::bigint,
              (item->>'reorder_point')::numeric)
      on conflict do nothing
      returning id into new_id;
      if new_id is not null then prod_ids := prod_ids || jsonb_build_object(item->>'name', new_id); end if;
    end loop;

    -- ficha de consumo
    for item in select * from jsonb_array_elements(pk.consumption) loop
      if svc_ids ? (item->>'service') and prod_ids ? (item->>'product') then
        insert into service_products (tenant_id, service_id, product_id, qty)
        values (p_tenant, (svc_ids->>(item->>'service'))::uuid,
                (prod_ids->>(item->>'product'))::uuid, (item->>'qty')::numeric)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- expediente padrão: seg-sex 9h-19h, sáb 9h-14h. Roda mesmo sem pack.
  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1,6) d
  on conflict do nothing;
end $$;

revoke all on function public.apply_vertical_pack(uuid, vertical_pack) from public, anon, authenticated;
grant execute on function public.apply_vertical_pack(uuid, vertical_pack) to service_role;

create or replace function public.apply_profession_pack(p_tenant uuid, p_profession_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  svc record;
begin
  for svc in select * from profession_services where profession_id = p_profession_id loop
    insert into services (tenant_id, name, duration_min, price_cents, cycle_days, canonical_key)
    values (p_tenant, svc.nome, svc.duracao_min, svc.preco_sugerido_cents, coalesce(svc.ciclo_dias, 21),
            'prof:' || svc.id::text)
    on conflict do nothing;
  end loop;

  insert into business_hours (tenant_id, weekday, opens_at, closes_at)
  select p_tenant, d, '09:00'::time, case when d = 6 then '14:00'::time else '19:00'::time end
  from generate_series(1, 6) d
  on conflict do nothing;
end $$;

revoke all on function public.apply_profession_pack(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_profession_pack(uuid, uuid) to service_role;

-- Backfill: verticais legadas → vertical_packs, pelo nome ainda intacto.
update services s
set canonical_key = 'pack:' || t.vertical::text || ':' || s.name
from tenants t, vertical_packs vp
where s.tenant_id = t.id
  and s.canonical_key is null
  and vp.vertical = t.vertical
  and t.vertical in ('barber', 'nails', 'lashes', 'brows', 'waxing', 'aesthetics', 'tattoo', 'hair')
  and exists (select 1 from jsonb_array_elements(vp.services) e where e->>'name' = s.name);

-- Backfill: as outras profissões → profession_services, pelo nome ainda intacto. Nome repetido
-- dentro do catálogo da mesma profissão não liga nada (ambíguo = não chuta).
update services s
set canonical_key = 'prof:' || ps.id::text
from tenants t, profession_services ps
where s.tenant_id = t.id
  and s.canonical_key is null
  and t.profession_id is not null
  and t.vertical not in ('barber', 'nails', 'lashes', 'brows', 'waxing', 'aesthetics', 'tattoo', 'hair')
  and ps.profession_id = t.profession_id
  and ps.nome = s.name
  and (select count(*) from profession_services d where d.profession_id = t.profession_id and d.nome = s.name) = 1;

-- ===== migrations\0098_experimentos_do_dono.sql =====
-- CICLO · experimentos que o dono liga e o CICLO mede (docs/84 Aposta C, P3)
--
-- ## O que é
--
-- "Vou abrir a quinta à noite por 14 dias", "vou postar a agenda todo domingo": o dono diz o que vai
-- testar, por quantos dias, e qual número olhar. O CICLO guarda o ANTES no momento em que o teste é
-- criado e mede o DEPOIS com os atendimentos de verdade. É a mesma mecânica da previsão auditada
-- (`cycle_predictions`, 0064): registrar antes, comparar depois — previsão feita depois do fato não é
-- previsão, e "antes" recalculado depois do fato também não é antes.
--
-- ## Por que `baseline` é jsonb congelado, e não recalculado
--
-- O antes sai dos atendimentos concluídos dos N dias anteriores ao início. Recalcular na hora de ler
-- deixaria o antes mudar com um atendimento remarcado ou concluído com atraso — e o dono veria o
-- "resultado" de um teste mexer sem ele ter feito nada. Congela na criação; o depois é que é vivo.
--
-- ## O que NÃO é
--
-- Não é ciência (docs/84 §7.3): 14 dias não separam o efeito da semana de pagamento. A tela diz
-- "teste prático", mostra o tamanho da amostra e nunca diz "comprovado". Não muda nada no negócio
-- sozinho: quem abre a quinta é o dono, na agenda. Aqui só fica o registro e a medida.
--
-- ## Sem DELETE
--
-- Teste que deu errado é informação. Cancelar é `canceled_at` (UPDATE), e com RLS forçada a ausência
-- de política de DELETE é negação — o mesmo padrão das tabelas que não se apagam (0085/0086).
--
-- Migration ADITIVA: vai ANTES do deploy do código que a usa (regra da ordem, DECISOES).

create table experiments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  titulo      text not null check (char_length(btrim(titulo)) between 3 and 120),
  metrica     text not null check (metrica in ('atendimentos', 'atendido_cents')),
  -- 0 = domingo … 6 = sábado (mesma convenção de `business_hours.weekday`); nulo = todos os dias.
  weekday     smallint check (weekday between 0 and 6),
  starts_on   date not null,
  dias        integer not null check (dias between 7 and 60),
  -- { "de": "YYYY-MM-DD", "ate": "YYYY-MM-DD", "atendimentos": n, "atendidoCents": n }
  baseline    jsonb not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  canceled_at timestamptz
);

create index experiments_tenant_idx on experiments (tenant_id, starts_on desc);
create index experiments_created_by_idx on experiments (created_by);

alter table experiments enable row level security;
alter table experiments force row level security;

create policy experiments_select on experiments for select using (public.has_tenant(tenant_id));
create policy experiments_insert on experiments for insert with check (public.has_tenant(tenant_id));
create policy experiments_update on experiments for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

comment on table experiments is
  'docs/84 Aposta C: teste ligado pelo dono. baseline congelado na criação (o antes), o depois é medido dos atendimentos. Sem DELETE: cancelar é canceled_at.';

commit;
