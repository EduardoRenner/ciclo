-- CICLO · product_events — a instrumentação mínima do funil (migration 0088)
--
-- G-05a (docs/60): sem isto, tudo que o produto faz vira anedota — nenhum número diz se a conta
-- nova chega a ver dinheiro na tela do Motor. `docs/27` §P5 já desenhava a tabela; esta migration
-- entra com o mínimo que fecha a pergunta que importa agora — não os oito eventos do funil
-- completo, só dois:
--
--   conta_criada     → quando o tenant nasce (`executarOnboarding`)
--   motor_viu_valor  → quando o Motor de Ciclo mostra o herói em `/admin/hoje`
--                      pela primeira vez (`atribuicaoCount > 0`)
--
-- Os outros quatro (`base_importada`, `recuperacao_enviada`, `cliente_voltou`, `onboarding_ok`) são
-- G-05b, represados até este par estar gravando em produção de verdade.
--
-- ## Por que não tem UPDATE nem DELETE
--
-- É trilha de funil, não estado editável — o mesmo raciocínio de `audit_log` e de
-- `cycle_predictions` (0064): a linha nasce e nunca muda. Sem política de update/delete, com RLS
-- forçada, ausência de política é negação (mesmo padrão de `wallet_entries`, 0083).
--
-- ## Por que não tem constraint de unicidade em (tenant_id, event_type)
--
-- Só os dois eventos de agora são marco (uma vez por tenant); os quatro do G-05b são repetíveis
-- (`recuperacao_enviada` acontece a cada envio). Uma unique aqui hipotecaria o desenho dos outros
-- quatro antes de precisar. Dedupe de "primeiro visto" fica por conta de quem grava (ver
-- `registrarPrimeiraOcorrencia` em `server/services/product-events.ts`), não do schema.
--
-- ## Por que `registrarEvento` nunca lança (não é regra deste arquivo, mas é o motivo do desenho)
--
-- Evento perdido não pode derrubar o fluxo que ele observa — mesma regra do heartbeat do cron. A
-- tabela existe para OBSERVAR o produto, nunca para bloqueá-lo.

create table product_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  event_type text not null check (char_length(event_type) > 0),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A consulta do funil: por tenant e tipo, ordenado no tempo — acha a primeira ocorrência de cada
-- evento com `min(created_at)` sem varrer a tabela inteira.
create index product_events_tenant_tipo_idx on product_events (tenant_id, event_type, created_at);

alter table product_events enable row level security;
alter table product_events force row level security;

create policy product_events_select on product_events
  for select using (public.has_tenant(tenant_id));

create policy product_events_insert on product_events
  for insert with check (public.has_tenant(tenant_id));

comment on table product_events is
  'Append-only: trilha do funil de ativação. G-05a grava conta_criada e motor_viu_valor; ver docs/27 §P5 e docs/60 G-05.';
