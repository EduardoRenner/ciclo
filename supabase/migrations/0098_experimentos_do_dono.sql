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
