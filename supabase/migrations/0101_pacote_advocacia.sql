-- =====================================================================
-- CICLO · a profissão ganha um PACOTE, e nasce a Advocacia (migration 0101)
--
-- docs/101-MVP-ADVOGADO.md §3.2 (T0.1). Um núcleo, vários pacotes: o que muda por
-- profissão (menu, botão central, vocabulário extra, módulos próprios) passa a ser
-- propriedade da LINHA do catálogo, não do tenant. `base` é exatamente o comportamento
-- de hoje, e é o padrão da coluna: nenhuma das 18 profissões existentes muda nada.
--
-- Por que uma coluna com `check` e não uma tabela: hoje são dois valores, e o que decide
-- o que cada pacote faz mora em código (`src/core/pacotes/`), com tipo, rota e componente.
-- A guarda `pacote-tem-registro` lê este `check` e exige que o registro em código tenha
-- exatamente estes slugs. Pacote novo = valor novo aqui + entrada lá, no mesmo commit.
--
-- Por que o pacote é da profissão e não de `tenants`: quem troca de profissão troca de
-- pacote; e `profession_id` já é a ponte que o onboarding grava (`executarOnboarding`).
-- Reverter: coluna em `tenants` que sobrepõe, se um dia um negócio precisar.
--
-- A linha `advocacia`: grupo `profissional` (`0022:25`); eixos pelo docs/09 §4 (advogado
-- não deixa desconhecido marcar direto: `inicio = 'solicitacao'`; honorário é orçamento;
-- ritmo sob demanda; híbrido). `ciclo_padrao_dias = 365`: revisão anual é o único ciclo
-- que faz sentido antes de o Motor aprender outro. O `vocab` guarda só palavras com plural
-- conhecido (`vocabulario-da-profissao` confere) e sem gênero ("profissional", nunca
-- "advogado"). Os sinônimos são termos de BUSCA do onboarding, por isso trazem as duas
-- formas: quem digita "advogada" precisa achar a linha.
--
-- Nenhuma conta consegue usar este pacote em produção enquanto a chave `ADVOCACIA_ABERTA`
-- (T0.6) estiver desligada: a linha existe para o cadastro local e para a demonstração.
-- =====================================================================

alter table public.professions
  add column pacote text not null default 'base'
  check (pacote in ('base', 'advocacia'));

insert into public.professions
  (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo,
   vocab, duracao_padrao_min, ciclo_padrao_dias, ativa, posicao, pacote)
values
  ('advocacia', 'Advocacia', 'profissional',
   '{"advogado","advogada","escritório de advocacia","direito","jurídico"}',
   'hibrido', 'orcamento', 'solicitacao', 'sob_demanda',
   '{"cliente":"cliente","atendimento":"reunião","profissional":"profissional","servico":"serviço","local":"escritório","agenda":"agenda"}',
   60, 365, true, 18, 'advocacia')
on conflict (slug) do nothing;
