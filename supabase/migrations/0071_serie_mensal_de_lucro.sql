-- CICLO · o fechamento mensal congelado, por tenant
--
-- ## O que ela é
--
-- `docs/50` L-09. O `docs/46` escolheu, como mecanismo de defesa, o que **acumula por salão com o
-- tempo de uso** — não com escala, porque mecanismo cuja força cresce com o tamanho da base é o
-- campo onde o líder vence por definição. A `0064` fez isso para a previsão do Motor. Esta faz
-- para o dinheiro: mês, receita, material, taxa, comissão, sobra e número de comandas, congelados.
--
-- A tela que ela sustenta é *"seu lucro por atendimento subiu 12% desde março"* — a frase que
-- nenhum concorrente pode dizer sobre o salão de outra pessoa, e que nem o CICLO consegue dizer
-- sobre um salão que acabou de chegar. Ela não precisa de mais ticket nenhum; precisa de uso.
--
-- ## Quem escreve, e por que NÃO é um cron
--
-- O `docs/50` L-09 pede "job mensal idempotente". Aqui ele é idempotente e **não é agendado**: a
-- linha de um mês é gravada na primeira vez que alguém abre a série DEPOIS que aquele mês fechou.
--
-- A troca é deliberada e o motivo está medido nesta base: cron do GitHub atrasa em horas, o
-- `/api/health` devolveu 503 por meses sem ninguém olhar, e o Motor de Ciclo passou um período
-- inteiro sem rodar sozinho. Um fosso que depende de um disparo que ninguém confere não é um
-- fosso. Gravar na leitura tem a propriedade que importa — a linha nasce uma vez e nunca é
-- reescrita — sem herdar o único componente desta casa que já falhou em silêncio.
--
-- Só mês ENCERRADO é congelado. O mês corrente continua sendo somado ao vivo dos `tickets`: ele
-- ainda vai mudar, e congelá-lo seria congelar um número errado.
--
-- ## Por que congelar, se `tickets.profit_cents` já é congelado
--
-- Porque comanda reaberta e refechada muda o passado. `fecharComanda` aceita refechar, e nesse dia
-- o agregado de agosto passaria a responder diferente de como respondeu em agosto. É pouco
-- frequente e é exatamente o caso em que uma série histórica perde o valor: o dono não pode abrir
-- a tela e ver março diferente do que viu no mês passado, sem explicação.
--
-- ## Append-only de verdade
--
-- Sem `updated_at` e sem caminho de UPDATE no código. A chave primária `(tenant_id, month)` e o
-- `on conflict do nothing` da escrita são o que garante que a segunda tentativa não reescreve a
-- primeira — regra 11 do `CLAUDE.md`, aplicada a um agregado.

create table monthly_profit (
  tenant_id        uuid not null references tenants(id) on delete cascade,
  -- Primeiro dia do mês, no fuso do tenant. `date` e não `text` para a ordenação ser a do banco.
  month            date not null,

  revenue_cents    bigint not null,
  material_cents   bigint not null,
  fee_cents        bigint not null,
  commission_cents bigint not null,
  profit_cents     bigint not null,
  tickets_count    int    not null,

  -- Quando foi congelado, que não é o mesmo que o mês a que se refere: uma conta que só abriu a
  -- tela em dezembro congela março, abril e maio no mesmo instante, e saber disso importa para
  -- quem for auditar a série depois.
  frozen_at        timestamptz not null default now(),

  primary key (tenant_id, month)
);

comment on table monthly_profit is
  'Fechamento mensal congelado por tenant, append-only. Gravado na primeira leitura APÓS o mês encerrar, nunca reescrito, nunca recalculado. O mês corrente não entra: ele ainda muda. Ver docs/50 L-09 e o cabeçalho da 0071.';
comment on column monthly_profit.month is
  'Primeiro dia do mês, no fuso do tenant.';
comment on column monthly_profit.frozen_at is
  'Quando a linha foi congelada. Diferente do mês a que se refere: uma conta que só abriu a tela em dezembro congela vários meses no mesmo instante.';

alter table monthly_profit enable row level security;
alter table monthly_profit force row level security;

-- Mesmo padrão-blanket da 0001 (`tenant_tables`) e da 0064: a trava por papel é da rota; aqui nada
-- é público. O `docs/46` rejeitou comparar salões entre si com um argumento estrutural, e esta é
-- justamente a tabela que tornaria isso fácil — a política existe para que continue impossível.
create policy monthly_profit_tenant_all on monthly_profit
  for all
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));
