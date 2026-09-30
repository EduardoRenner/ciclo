-- ============================================================================================
-- PLACAR DO PILOTO  (docs/87 §4.1 item 15 · docs/88 §5.3 · docs/runbooks/placar-de-distribuicao.md)
-- ============================================================================================
-- Só leitura. Cole no SQL Editor da Supabase de produção (eqzlvthzdjnsbogymcsw) ou rode pelo MCP.
-- Toda segunda-feira, 10 minutos, na mesma hora. Complementa o placar de distribuição: aquele
-- responde "qual CANAL traz conta"; este responde "a conta que chegou ATIVOU?".
--
-- COMO RODAR
--   Cada consulta abaixo é AUTOSSUFICIENTE (começa com `with` e termina em `;`). O SQL Editor só
--   mostra o resultado da ÚLTIMA instrução quando você roda o arquivo inteiro. Portanto: selecione
--   UMA consulta e rode a seleção (Ctrl+Enter), ou salve cada uma como um snippet com o nome do
--   cabeçalho dela (Q0 a Q3).
--
-- O QUE NUNCA APARECE AQUI
--   Nome, telefone ou e-mail de cliente final. Só contagens e o nome do negócio. O único telefone
--   é o do NEGÓCIO (tenants.phone, o da pessoa que abriu a conta), na Q3, para você ligar.
--
-- QUEM NÃO ENTRA NA CONTA (armadilha "tenant de teste polui o placar")
--   Demonstração, revisão de loja e resíduo de teste. A regra é a MESMA do placar de distribuição
--   (`contas_reais` no .md e `CONTA_QUE_NAO_E_NEGOCIO` em scripts/placar-distribuicao.mjs), MAIS
--   dois padrões que o banco local mostrou vazando: `resolver-lote-<hex>`/`precisao-<hex>`/`rls-*-<hex>`
--   (suítes de integração) e qualquer slug com a palavra `teste` no meio (`barbearia-teste-p5`).
--   Suas contas de teste pessoais entram na lista `minhas_contas` (cada consulta tem a sua, deixe
--   igual nas quatro). Conferido pela Q0, que lista o que FICOU DE FORA.
--
-- COMO OS EVENTOS SE COMPORTAM (lido no código em 2026-09-30)
--   conta_criada          1 por conta, gravado no cadastro. A âncora de todos os prazos é
--                         tenants.created_at (existe sempre; o evento pode faltar em conta antiga).
--   base_importada        MARCO, 1 por conta (a primeira importação de verdade), via CSV ou "Quem
--                         eu já atendo". O evento NÃO diz se a data da última visita veio junto.
--                         Por isso "importou" aqui exige o evento E pelo menos `minimo_com_data`
--                         clientes com last_visit_at cadastrados dentro do prazo (ver parâmetro).
--   motor_viu_valor       MARCO, 1 por conta: o painel "Hoje" mostrou quem sumiu pela 1a vez.
--   recuperacao_enviada   REPETÍVEL. Vale para os dois caminhos: "Chamar" pelo WhatsApp do dono
--                         (meta.via = 'manual', 1 por toque) e envio em lote (meta.queued = N).
--   cliente_voltou        REPETÍVEL, 1 por rodada do Motor: meta.fechadas = previsões fechadas.
--                         ATENÇÃO: conta quem voltou, foi chamado ou não. Não prova que a chamada
--                         funcionou; prova que a previsão do Motor se realizou.
--   cortesia_concedida    AINDA NÃO EXISTE no código (docs/87 §3.1). Quando existir, dá para
--                         separar "fundador" (entrou até 12/12) de 21 dias. Hoje não há como.
--
-- DEFINIÇÃO DE ATIVAÇÃO (docs/88 §5.3)
--   Conta ATIVA = base importada E pelo menos 1 chamada, as duas dentro de 14 dias da criação.
--   Taxa = ativas / criadas. Conta com menos de 14 dias ainda pode ativar, então a taxa "justa" usa
--   só as contas com a janela de 14 dias FECHADA. As consultas mostram as duas. REGRA: ativação
--   abaixo de 45% por 2 semanas seguidas = parar a rua fria e consertar a implantação.
--   Amostra pequena não é tendência: com menos de 10 contas, leia linha a linha.
-- ============================================================================================


-- ============================================================================================
-- Q0 · CONFERÊNCIA (rode primeiro). Prova que o cenário existe antes de ler qualquer taxa.
--   Se `contas reais` for 0, ou se `com conta_criada` for bem menor que `contas reais`, as outras
--   consultas estão respondendo sobre um conjunto vazio ou incompleto. Zero não é bom resultado.
-- ============================================================================================
with parametros as (
  select array[]::text[] as minhas_contas          -- ex.: array['eduardo-teste', 'conta-do-eduardo']
),
todas as (
  select t.id, t.slug::text as slug, t.created_at,
         (t.deleted_at is null
          and t.slug::text !~ '^(demo-|apple-review|teste-|origem-e2e)'
          and t.slug::text !~ '^(health|alertas-estoque|recuperar|clientes|risco|teste|pe)-[0-9a-f]{6,}$'
          and t.slug::text !~ '^(resolver-lote|precisao|rls-[a-z0-9]+)-[0-9a-f]{6,}$'
          and t.slug::text !~ '(^|-)teste(-|$)'
          and t.slug::text <> all (p.minhas_contas)) as entra
  from tenants t cross join parametros p
)
select ordem, o_que, valor from (
  select 1 as ordem, 'contas reais (entram na conta)' as o_que,
         count(*) filter (where entra)::text as valor from todas
  union all
  select 2, 'contas fora do filtro (demo, revisão, teste, apagadas)',
         count(*) filter (where not entra)::text from todas
  union all
  select 3, 'contas reais com o evento conta_criada',
         count(distinct e.tenant_id)::text
  from todas d join product_events e on e.tenant_id = d.id and e.event_type = 'conta_criada'
  where d.entra
  union all
  select 4, 'contas reais SEM conta_criada (conta antiga ou evento perdido)',
         count(*)::text
  from todas d
  where d.entra and not exists (select 1 from product_events e where e.tenant_id = d.id and e.event_type = 'conta_criada')
  union all
  select 5, 'conta real mais recente criada em',
         coalesce(to_char(max(created_at) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), 'nenhuma')
  from todas where entra
  union all
  -- eventos do funil das contas reais nos últimos 30 dias, um por linha
  select 10 + row_number() over (order by e.event_type),
         'eventos nos últimos 30 dias: ' || e.event_type,
         count(*)::text
  from todas d join product_events e on e.tenant_id = d.id
  where d.entra and e.created_at >= now() - interval '30 days'
    and e.event_type in ('conta_criada','base_importada','motor_viu_valor','recuperacao_enviada','cliente_voltou',
                         'perfil_respondido','perfil_pulado','demanda_nao_atendida','cortesia_concedida')
  group by e.event_type
) x
order by ordem;


-- ============================================================================================
-- Q1 · POR CONTA E NO TOTAL. A linha TOTAL vem primeiro; depois cada conta, da mais nova para a
--   mais antiga. Colunas com 1 ou 0 (soma no total):
--     importou_48h / importou_7d   base importada COM data da última visita (>= minimo_com_data
--                                  clientes) dentro de 48 h / 7 dias da criação da conta
--     importou_sem_data            importou (evento) mas sem data suficiente: o Motor não tem o que mostrar
--     viu_quem_sumiu               o painel mostrou "quem sumiu" (motor_viu_valor), a qualquer hora
--     alpha_48h                    base COM data E "quem sumiu" dentro de 48 h. É o Portão A do
--                                  docs/87 §5 (>= 7 de 10 do alpha), contado só sobre as contas
--                                  com janela de 48 h fechada (coluna janela_48h)
--     chamou_14d / chamadas_14d    houve >= 1 chamada em 14 dias / quantas (1 por toque + as do lote)
--     clientes_voltaram            previsões fechadas até hoje (ver aviso de cliente_voltou acima)
--     ativa / janela_14d           ativa = base + 1 chamada em 14 dias; janela_14d = 14 dias já passaram
-- ============================================================================================
with parametros as (
  select 5 as minimo_com_data,                     -- clientes com data de última visita para a base contar
         array[]::text[] as minhas_contas
),
contas as (
  select t.id, t.name as negocio, t.created_at as criada_em
  from tenants t cross join parametros p
  where t.deleted_at is null
    and t.slug::text !~ '^(demo-|apple-review|teste-|origem-e2e)'
    and t.slug::text !~ '^(health|alertas-estoque|recuperar|clientes|risco|teste|pe)-[0-9a-f]{6,}$'
    and t.slug::text !~ '^(resolver-lote|precisao|rls-[a-z0-9]+)-[0-9a-f]{6,}$'
    and t.slug::text !~ '(^|-)teste(-|$)'
    and t.slug::text <> all (p.minhas_contas)
),
eventos as (
  select k.id as tenant_id, e.event_type, e.created_at, e.meta
  from contas k
  join product_events e on e.tenant_id = k.id
  where e.event_type in ('base_importada','motor_viu_valor','recuperacao_enviada','cliente_voltou')
),
marcos as (
  select tenant_id,
         min(created_at) filter (where event_type = 'base_importada')      as importou_em,
         min(created_at) filter (where event_type = 'motor_viu_valor')     as viu_em,
         min(created_at) filter (where event_type = 'recuperacao_enviada') as chamou_em
  from eventos group by tenant_id
),
chamadas as (
  select e.tenant_id,
         sum(case when e.meta->>'queued' ~ '^[0-9]+$' then (e.meta->>'queued')::int else 1 end) as n
  from eventos e join contas k on k.id = e.tenant_id
  where e.event_type = 'recuperacao_enviada' and e.created_at <= k.criada_em + interval '14 days'
  group by e.tenant_id
),
voltaram as (
  select tenant_id,
         sum(case when meta->>'fechadas' ~ '^[0-9]+$' then (meta->>'fechadas')::int else 0 end) as n
  from eventos where event_type = 'cliente_voltou' group by tenant_id
),
com_data as (          -- só contagem; nenhum nome ou telefone sai daqui
  select k.id as tenant_id,
         count(*) filter (where cl.created_at <= k.criada_em + interval '48 hours') as ate_48h,
         count(*) filter (where cl.created_at <= k.criada_em + interval '7 days')   as ate_7d
  from contas k
  join clients cl on cl.tenant_id = k.id and cl.deleted_at is null and cl.last_visit_at is not null
  group by k.id
),
por_conta as (
  select k.id, k.negocio, k.criada_em,
    coalesce(m.importou_em <= k.criada_em + interval '48 hours' and coalesce(d.ate_48h, 0) >= p.minimo_com_data, false)::int as importou_48h,
    coalesce(m.importou_em <= k.criada_em + interval '7 days' and coalesce(d.ate_7d, 0) >= p.minimo_com_data, false)::int as importou_7d,
    coalesce(m.importou_em <= k.criada_em + interval '7 days' and coalesce(d.ate_7d, 0) < p.minimo_com_data, false)::int as importou_sem_data,
    (m.viu_em is not null)::int as viu_quem_sumiu,
    coalesce(m.importou_em <= k.criada_em + interval '48 hours' and coalesce(d.ate_48h, 0) >= p.minimo_com_data
             and m.viu_em <= k.criada_em + interval '48 hours', false)::int as alpha_48h,
    coalesce(m.chamou_em <= k.criada_em + interval '14 days', false)::int as chamou_14d,
    coalesce(c.n, 0) as chamadas_14d,
    coalesce(v.n, 0) as clientes_voltaram,
    coalesce(m.importou_em <= k.criada_em + interval '14 days' and m.chamou_em <= k.criada_em + interval '14 days', false)::int as ativa,
    (now() >= k.criada_em + interval '48 hours')::int as janela_48h,
    (now() >= k.criada_em + interval '14 days')::int  as janela_14d,
    case
      when m.importou_em is null            then '1 criou e nao importou a base'
      when m.viu_em is null                 then '2 importou, "quem sumiu" nao apareceu'
      when m.chamou_em is null              then '3 viu quem sumiu e nao chamou ninguem'
      when coalesce(v.n, 0) = 0             then '4 chamou, ninguem voltou ainda'
      else                                       '5 cliente voltou'
    end as onde_esta
  from contas k
  cross join parametros p
  left join marcos   m on m.tenant_id = k.id
  left join chamadas c on c.tenant_id = k.id
  left join voltaram v on v.tenant_id = k.id
  left join com_data d on d.tenant_id = k.id
)
select negocio, criada_em, importou_48h, importou_7d, importou_sem_data, viu_quem_sumiu, alpha_48h, janela_48h,
       chamou_14d, chamadas_14d, clientes_voltaram, ativa, janela_14d, onde_esta
from (
  select 0 as ordem, null::timestamptz as criada_ord,
         'TOTAL (' || count(*) || ' contas)' as negocio, null::text as criada_em,
         coalesce(sum(importou_48h), 0)::int as importou_48h, coalesce(sum(importou_7d), 0)::int as importou_7d,
         coalesce(sum(importou_sem_data), 0)::int as importou_sem_data, coalesce(sum(viu_quem_sumiu), 0)::int as viu_quem_sumiu,
         coalesce(sum(alpha_48h), 0)::int as alpha_48h, coalesce(sum(janela_48h), 0)::int as janela_48h,
         coalesce(sum(chamou_14d), 0)::int as chamou_14d, coalesce(sum(chamadas_14d), 0)::int as chamadas_14d,
         coalesce(sum(clientes_voltaram), 0)::int as clientes_voltaram,
         coalesce(sum(ativa), 0)::int as ativa, coalesce(sum(janela_14d), 0)::int as janela_14d,
         'ativacao sobre janela fechada: ' || coalesce(round(100.0 * sum(ativa) filter (where janela_14d = 1)
              / nullif(sum(janela_14d), 0))::text || '%', 'sem conta com 14 dias ainda')
         || ' | sobre todas as criadas: ' || coalesce(round(100.0 * sum(ativa) / nullif(count(*), 0))::text || '%', 'n/a')
         || ' | portao A (alpha): ' || coalesce(sum(alpha_48h), 0) || ' de ' || coalesce(sum(janela_48h), 0) as onde_esta
  from por_conta
  union all
  select 1, criada_em, negocio, to_char(criada_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
         importou_48h, importou_7d, importou_sem_data, viu_quem_sumiu, alpha_48h, janela_48h,
         chamou_14d, chamadas_14d::int, clientes_voltaram::int, ativa, janela_14d, onde_esta
  from por_conta
) x
order by ordem, criada_ord desc nulls last;


-- ============================================================================================
-- Q2 · POR SEMANA DE CRIAÇÃO (segunda a domingo, horário de Brasília) e a REGRA DOS 45%.
--   Cada linha é uma turma: as contas criadas naquela semana. `ativacao_pct` usa só as contas
--   com a janela de 14 dias fechada (`janela_fechada`); a turma da semana corrente ainda está
--   amadurecendo e mostra "janela aberta". `regra_parar_rua` só acende quando a turma e a anterior
--   (as duas com janela fechada) estão abaixo de 45%.
-- ============================================================================================
with parametros as (
  select 5 as minimo_com_data,
         array[]::text[] as minhas_contas
),
contas as (
  select t.id, t.name as negocio, t.created_at as criada_em
  from tenants t cross join parametros p
  where t.deleted_at is null
    and t.slug::text !~ '^(demo-|apple-review|teste-|origem-e2e)'
    and t.slug::text !~ '^(health|alertas-estoque|recuperar|clientes|risco|teste|pe)-[0-9a-f]{6,}$'
    and t.slug::text !~ '^(resolver-lote|precisao|rls-[a-z0-9]+)-[0-9a-f]{6,}$'
    and t.slug::text !~ '(^|-)teste(-|$)'
    and t.slug::text <> all (p.minhas_contas)
),
eventos as (
  select k.id as tenant_id, e.event_type, e.created_at, e.meta
  from contas k
  join product_events e on e.tenant_id = k.id
  where e.event_type in ('base_importada','motor_viu_valor','recuperacao_enviada','cliente_voltou')
),
marcos as (
  select tenant_id,
         min(created_at) filter (where event_type = 'base_importada')      as importou_em,
         min(created_at) filter (where event_type = 'motor_viu_valor')     as viu_em,
         min(created_at) filter (where event_type = 'recuperacao_enviada') as chamou_em
  from eventos group by tenant_id
),
chamadas as (
  select e.tenant_id,
         sum(case when e.meta->>'queued' ~ '^[0-9]+$' then (e.meta->>'queued')::int else 1 end) as n
  from eventos e join contas k on k.id = e.tenant_id
  where e.event_type = 'recuperacao_enviada' and e.created_at <= k.criada_em + interval '14 days'
  group by e.tenant_id
),
voltaram as (
  select tenant_id,
         sum(case when meta->>'fechadas' ~ '^[0-9]+$' then (meta->>'fechadas')::int else 0 end) as n
  from eventos where event_type = 'cliente_voltou' group by tenant_id
),
com_data as (
  select k.id as tenant_id,
         count(*) filter (where cl.created_at <= k.criada_em + interval '48 hours') as ate_48h,
         count(*) filter (where cl.created_at <= k.criada_em + interval '7 days')   as ate_7d
  from contas k
  join clients cl on cl.tenant_id = k.id and cl.deleted_at is null and cl.last_visit_at is not null
  group by k.id
),
por_conta as (
  select k.id, k.negocio, k.criada_em,
    coalesce(m.importou_em <= k.criada_em + interval '48 hours' and coalesce(d.ate_48h, 0) >= p.minimo_com_data, false)::int as importou_48h,
    coalesce(m.importou_em <= k.criada_em + interval '7 days' and coalesce(d.ate_7d, 0) >= p.minimo_com_data, false)::int as importou_7d,
    coalesce(m.importou_em <= k.criada_em + interval '7 days' and coalesce(d.ate_7d, 0) < p.minimo_com_data, false)::int as importou_sem_data,
    (m.viu_em is not null)::int as viu_quem_sumiu,
    coalesce(m.importou_em <= k.criada_em + interval '48 hours' and coalesce(d.ate_48h, 0) >= p.minimo_com_data
             and m.viu_em <= k.criada_em + interval '48 hours', false)::int as alpha_48h,
    coalesce(m.chamou_em <= k.criada_em + interval '14 days', false)::int as chamou_14d,
    coalesce(c.n, 0) as chamadas_14d,
    coalesce(v.n, 0) as clientes_voltaram,
    coalesce(m.importou_em <= k.criada_em + interval '14 days' and m.chamou_em <= k.criada_em + interval '14 days', false)::int as ativa,
    (now() >= k.criada_em + interval '48 hours')::int as janela_48h,
    (now() >= k.criada_em + interval '14 days')::int  as janela_14d
  from contas k
  cross join parametros p
  left join marcos   m on m.tenant_id = k.id
  left join chamadas c on c.tenant_id = k.id
  left join voltaram v on v.tenant_id = k.id
  left join com_data d on d.tenant_id = k.id
),
turmas as (
  select (date_trunc('week', criada_em at time zone 'America/Sao_Paulo'))::date as semana,
         count(*)::int as criadas,
         coalesce(sum(importou_48h), 0)::int as importou_48h, coalesce(sum(importou_7d), 0)::int as importou_7d,
         coalesce(sum(viu_quem_sumiu), 0)::int as viu_quem_sumiu,
         coalesce(sum(chamou_14d), 0)::int as chamou_14d, coalesce(sum(clientes_voltaram), 0)::int as clientes_voltaram,
         sum(janela_14d)::int as janela_fechada,
         (sum(ativa) filter (where janela_14d = 1))::int as ativas_na_janela,
         coalesce(sum(ativa), 0)::int as ativas_ate_agora
  from por_conta
  group by 1
),
com_taxa as (
  select t.*,
         round(100.0 * ativas_na_janela / nullif(janela_fechada, 0)) as pct,
         coalesce(100.0 * ativas_na_janela / nullif(janela_fechada, 0) < 45, false) as abaixo
  from turmas t
)
select to_char(semana, 'DD/MM') as semana_de_segunda,
       criadas, importou_48h, importou_7d, viu_quem_sumiu, chamou_14d, clientes_voltaram,
       janela_fechada, ativas_na_janela,
       coalesce(pct::text || '%', 'janela aberta') as ativacao_pct,
       case when janela_fechada = 0 then 'amadurece ate ' || to_char(semana + 7 + 14, 'DD/MM')
            when janela_fechada < 10 then 'poucas contas: leia uma a uma' else '' end as amostra,
       case when abaixo and coalesce(lag(abaixo) over (order by semana), false)
            then 'PARE a rua fria e conserte a implantacao (2 turmas abaixo de 45%)'
            when abaixo then 'abaixo de 45% (1a turma)'
            else '' end as regra_parar_rua
from com_taxa
order by semana desc;


-- ============================================================================================
-- Q3 · CONTAS PARADAS HÁ MAIS DE 7 DIAS (a lista para o Eduardo ligar).
--   "Parada" = nenhuma AÇÃO nos últimos 7 dias: ato de uma pessoa da conta no registro de auditoria,
--   cliente ou agendamento novo, importação, chamada ou resposta do perfil. Entrar no app SEM fazer
--   nada não conta como ação, e aparece em `ultimo_acesso` para você saber se a pessoa nem abre
--   ("entra e não faz nada" e "nem entra" pedem conversas diferentes). Ordem: quem parou mais cedo
--   no funil primeiro (1 = nem importou a base), depois quem está parado há mais tempo.
--   `telefone_do_negocio` é o telefone que a pessoa deixou no cadastro (pode estar vazio).
-- ============================================================================================
with parametros as (
  select array[]::text[] as minhas_contas
),
contas as (
  select t.id, t.name as negocio, t.phone, t.created_at as criada_em
  from tenants t cross join parametros p
  where t.deleted_at is null
    and t.slug::text !~ '^(demo-|apple-review|teste-|origem-e2e)'
    and t.slug::text !~ '^(health|alertas-estoque|recuperar|clientes|risco|teste|pe)-[0-9a-f]{6,}$'
    and t.slug::text !~ '^(resolver-lote|precisao|rls-[a-z0-9]+)-[0-9a-f]{6,}$'
    and t.slug::text !~ '(^|-)teste(-|$)'
    and t.slug::text <> all (p.minhas_contas)
),
marcos as (
  select e.tenant_id,
         bool_or(e.event_type = 'base_importada')      as importou,
         bool_or(e.event_type = 'motor_viu_valor')     as viu,
         bool_or(e.event_type = 'recuperacao_enviada') as chamou,
         bool_or(e.event_type = 'cliente_voltou')      as voltou
  from product_events e
  where e.tenant_id in (select id from contas)
  group by e.tenant_id
),
acoes as (
  select tenant_id, max(t) as ultima_acao
  from (
    select tenant_id, max(created_at) as t from audit_log
      where actor_id is not null and tenant_id in (select id from contas) group by tenant_id
    union all
    select tenant_id, max(created_at) from product_events
      where event_type in ('base_importada','recuperacao_enviada','perfil_respondido','perfil_pulado')
        and tenant_id in (select id from contas) group by tenant_id
    union all
    select tenant_id, max(created_at) from clients
      where tenant_id in (select id from contas) group by tenant_id
    union all
    select tenant_id, max(created_at) from appointments
      where tenant_id in (select id from contas) group by tenant_id
  ) u
  group by tenant_id
),
acessos as (
  select m.tenant_id, max(u.last_sign_in_at) as ultimo_acesso
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.active and m.tenant_id in (select id from contas)
  group by m.tenant_id
),
tamanho as (
  select tenant_id, count(*) as clientes_na_base
  from clients
  where deleted_at is null and tenant_id in (select id from contas)
  group by tenant_id
),
situacao as (
  select k.id, k.negocio, k.phone, k.criada_em,
         greatest(k.criada_em, a.ultima_acao) as ultima_acao,
         ac.ultimo_acesso,
         coalesce(tm.clientes_na_base, 0) as clientes_na_base,
         case
           when not coalesce(m.importou, false) then 1
           when not coalesce(m.viu, false)      then 2
           when not coalesce(m.chamou, false)   then 3
           when not coalesce(m.voltou, false)   then 4
           else 5
         end as etapa
  from contas k
  left join marcos   m  on m.tenant_id = k.id
  left join acoes    a  on a.tenant_id = k.id
  left join acessos  ac on ac.tenant_id = k.id
  left join tamanho  tm on tm.tenant_id = k.id
)
select negocio,
       coalesce(nullif(phone, ''), 'sem telefone') as telefone_do_negocio,
       to_char(criada_em at time zone 'America/Sao_Paulo', 'DD/MM') as criada_em,
       floor(extract(epoch from (now() - ultima_acao)) / 86400)::int as dias_parada,
       case when ultimo_acesso is null then 'sem registro de acesso'
            else to_char(ultimo_acesso at time zone 'America/Sao_Paulo', 'DD/MM') end as ultimo_acesso,
       clientes_na_base,
       case etapa
         when 1 then '1 criou e nao importou a base'
         when 2 then '2 importou, "quem sumiu" nao apareceu'
         when 3 then '3 viu quem sumiu e nao chamou ninguem'
         when 4 then '4 chamou, ninguem voltou ainda'
         else        '5 cliente voltou (parada mesmo assim)'
       end as onde_parou
from situacao
where ultima_acao < now() - interval '7 days'
order by etapa, ultima_acao;
