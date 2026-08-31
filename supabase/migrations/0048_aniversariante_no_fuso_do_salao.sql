-- O mês do aniversário passa a ser o mês DO SALÃO, não o do servidor.
--
-- `is_aniversariante` comparava com `current_date`, que o Postgres avalia no fuso da SESSÃO — e a
-- sessão do PostgREST é UTC. Medido em produção em 2026-08-31 (`current_setting('TimeZone')` =
-- 'UTC'), e a divergência foi demonstrada com números:
--
--   31/08 20:00 no salão -> view diz mês 8, salão está no mês 8   (ok)
--   31/08 21:00 no salão -> view diz mês 9, salão está no mês 8   (ERRA)
--   31/08 23:30 no salão -> view diz mês 9, salão está no mês 8   (ERRA)
--
-- Ou seja: das 21h à meia-noite do último dia de todo mês, em Brasília, o segmento
-- "Aniversariantes do mês" lista as pessoas do mês SEGUINTE. Quem disparar a campanha nessa
-- janela — que é justamente o fim de expediente, quando dá tempo de mexer no sistema — manda
-- "feliz aniversário" para quem não faz aniversário, e deixa de mandar para quem faz.
--
-- É a terceira aparição da mesma classe neste projeto: `v_daily_cash` foi ABANDONADA por truncar
-- o dia no fuso da sessão (ver o comentário no topo de `src/server/services/caixa.ts`), e
-- `receitaAtribuidaAoCiclo` teve o mesmo defeito corrigido na auditoria de 28/08. A view de
-- segmentos ficou de fora das duas rodadas.
--
-- O `join tenants` é seguro sob `security_invoker`: a política `tenants_select` (0001) usa
-- `has_tenant(id)`, então todo membro autenticado enxerga a própria linha — e todos os leitores
-- desta view (`crm.ts`) consultam com o cliente do usuário, nunca com service_role.
-- `drop` + `create`, e não `create or replace`: o Postgres exige que o replace mantenha a MESMA
-- lista de colunas, na mesma ordem, e `c.*` deixou de bater. A migration 0047 adicionou
-- `clients.name_busca` (coluna gerada para busca sem acento) DEPOIS que esta view foi criada,
-- então a view em produção nem sequer expõe essa coluna — o replace tentava encaixar
-- `is_aniversariante` na posição de `preferences` e o banco recusou, corretamente.
--
-- O drop é seguro aqui: nada depende desta view (nem outra view, nem função, nem constraint) e a
-- migration roda em transação — se o `create` falhar, o `drop` volta atrás junto.
drop view if exists v_client_segments;

create view v_client_segments with (security_invoker = true) as
select
  c.*,
  (
    c.birth_date is not null
    and extract(month from c.birth_date) = extract(month from (now() at time zone t.timezone)::date)
  ) as is_aniversariante,
  (
    c.visits_count = 1
    and not exists (
      select 1 from appointments a
      where a.client_id = c.id and a.tenant_id = c.tenant_id and a.status in ('pending', 'confirmed', 'arrived')
    )
  ) as is_primeira_visita_sem_retorno,
  -- top 25% de LTV do próprio tenant, entre quem já teve visita — "alto" é relativo ao salão,
  -- não um valor fixo em reais (um salão de bairro e um spa premium não têm o mesmo "alto").
  (c.visits_count > 0 and percent_rank() over (partition by c.tenant_id order by c.ltv_cents) >= 0.75) as is_ticket_alto
from clients c
join tenants t on t.id = c.tenant_id
where c.deleted_at is null;
