-- docs/18-MONETIZACAO-PLANO.md §L.6 e §D.5.
--
-- `tenant_modules.modulo` nasceu na 0025 como `text` sem check e sem referência — só `origem`
-- tem restrição. Enquanto nenhuma tela lia a tabela isso era inofensivo. Passa a não ser no
-- momento em que essa coluna vira a resposta de "o que este plano libera": um erro de digitação
-- ('fidelidade' × 'fidelidades') cria um módulo fantasma que nunca liga nada e que NENHUMA query
-- acusa. Mesmo argumento da 0040 — barato agora, caro depois de existir pagante.
--
-- A tabela também resolve a §4.7 do prompt (o produto vai de barbearia a eletricista): a coluna
-- `eixo` registra QUAL dos quatro eixos da 0023 condiciona o módulo. Isso existe porque há duas
-- razões diferentes para um módulo estar desligado, e confundi-las estraga a tela de bloqueio:
--
--   EIXO   → não faz sentido pra este negócio  → some da interface
--   PLANO  → não está liberado                 → aparece bloqueado, com motivo (regra 5.2)
--   DONO   → ele desligou                      → aparece desligado, reversível
--
-- Eixo vem ANTES de plano. Se plano viesse primeiro, um eletricista veria "Fidelidade bloqueada,
-- assine o Equipe" para um módulo que ele nunca vai usar — que é a regra 5.2 aplicada ao
-- contrário: vira ruído e queima a peça de conversão mais importante do produto.
--
-- Escopo desta migration é só o catálogo e a FK. Nenhum plano é mapeado para módulo aqui: os
-- limites por degrau ainda são [S] (o plano diz isso em D.3), e gravar palpite em migration é
-- pior que não gravar. Mesma disciplina da 0025.

create table modules (
  key           text primary key,
  label         text not null,
  -- qual eixo da 0023 condiciona este módulo; null = vale para qualquer negócio
  eixo          text check (eixo is null or eixo in ('onde', 'cobranca', 'inicio', 'ritmo')),
  sempre_ligado boolean not null default false,
  ordem         smallint not null
);

-- Os 16 módulos do docs/09-PLATAFORMA.md §6, na ordem em que aparecem lá.
insert into modules (key, label, eixo, sempre_ligado, ordem) values
  ('agenda',         'Agenda',                   null,       true,  1),
  ('cycle_engine',   'Motor de Ciclo',           null,       true,  2),
  ('public_page',    'Página pública',           null,       false, 3),
  ('clients',        'Clientes e CRM',           null,       false, 4),
  ('reminders',      'Lembrete e confirmação',   null,       false, 5),
  ('recurrence',     'Recorrência',              'ritmo',    false, 6),
  ('quotes',         'Orçamento',                'inicio',   false, 7),
  ('routing',        'Deslocamento e rota',      'onde',     false, 8),
  ('register',       'Comanda e caixa',          'cobranca', false, 9),
  ('stock',          'Estoque',                  null,       false, 10),
  ('loyalty',        'Fidelidade e pontos',      null,       false, 11),
  ('club',           'Assinatura e clube',       null,       false, 12),
  ('campaigns',      'Campanhas',                null,       false, 13),
  ('team',           'Equipe e comissão',        null,       false, 14),
  ('health_records', 'Anamnese e dado de saúde', null,       false, 15),
  ('documents',      'Documentos e contratos',   null,       false, 16);

-- tenant_modules está vazia em produção (conferido antes de escrever esta migration), então a
-- FK entra sem precisar de limpeza prévia.
alter table tenant_modules
  add constraint tenant_modules_modulo_fkey
  foreign key (modulo) references modules(key);

-- Catálogo é dado de plataforma, não de tenant: todo mundo autenticado lê, ninguém escreve pelo
-- PostgREST. RLS ligada mesmo assim, porque a regra 1 do CLAUDE.md não abre exceção — tabela sem
-- RLS quebra o teste de isolamento.
alter table modules enable row level security;
alter table modules force row level security;

create policy modules_leitura_autenticada on modules for select
  using (auth.role() = 'authenticated');

grant select on modules to authenticated;
