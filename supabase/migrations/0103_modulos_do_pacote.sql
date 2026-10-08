-- =====================================================================
-- CICLO · os cinco módulos do pacote Advocacia (migration 0103)
--
-- docs/101-MVP-ADVOGADO.md §3.3 (T0.2). Mesmo desenho da 0043: a 0041 já foi aplicada em
-- produção e não se edita, então módulo novo entra como INSERT em migration própria. A guarda
-- `tests/unit/core/modulos-catalogo.test.ts` lê as três (0041, 0043, 0103) e exige que o
-- `CATALOGO` de `core/billing/planos.ts` tenha as mesmas chaves, na mesma ordem.
--
-- Sem `eixo`: o que condiciona estes cinco não é um dos quatro eixos da 0023, é o PACOTE da
-- profissão (0102). Essa quarta camada mora em código (`CONDICAO_DE_PACOTE`, antes do eixo na
-- ordem de `podeUsarModulo`), e não ganhou coluna aqui de propósito: `modules.eixo` existe porque
-- a tela de bloqueio precisa explicar "não se aplica ao seu tipo de atendimento"; módulo fora do
-- pacote não aparece para explicar nada. Se um dia a tela precisar, a coluna entra aditiva.
--
-- `sempre_ligado = false` em todos: o escritório pode desligar o que não usa (Estrutura, por
-- exemplo, num escritório só de contencioso). Tenant de beleza nunca vê nenhum deles.
-- =====================================================================

insert into modules (key, label, eixo, sempre_ligado, ordem) values
  ('legal_cases',      'Casos',                  null, false, 18),
  ('legal_checklists', 'Pendências do cliente',  null, false, 19),
  ('legal_structure',  'Estrutura da família',   null, false, 20),
  ('legal_deadlines',  'Prazos e intimações',    null, false, 21),
  ('legal_documents',  'Documentos do caso',     null, false, 22);
