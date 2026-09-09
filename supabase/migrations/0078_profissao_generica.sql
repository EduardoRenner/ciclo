-- =====================================================================
-- CICLO · a saída para quem não se encontra na lista (migration 0078)
--
-- Item 17 da auditoria de 2026-09-08.
--
-- ## O beco
--
-- O catálogo tem 17 profissões. A busca do onboarding filtra por nome e
-- sinônimo, e quando não acha nada mostra **"Nenhuma profissão encontrada."** —
-- ponto final, sem saída. E `EsquemaOnboarding` exige `professionId: z.uuid()`,
-- então não dá para seguir sem escolher.
--
-- Ou seja: massoterapeuta, costureira, confeiteira, podóloga, manicure de
-- domicílio, professor de música — qualquer um fora das 17 — cria a conta,
-- chega na PRIMEIRA tela do produto, digita a própria profissão, lê que ela não
-- existe e não tem o que fazer. É o pior lugar possível para um beco sem saída,
-- e ele engole a pessoa depois de ela já ter dado o e-mail e a senha.
--
-- ## Por que uma linha no catálogo, e não "deixar seguir sem profissão"
--
-- Seguir sem profissão exigiria afrouxar o esquema da rota e deixaria o tenant
-- sem `vertical` (que é `not null` desde a 0001) e sem pacote de expediente. A
-- linha genérica resolve os três de uma vez, pelo caminho que já existe:
-- `vertical` vira `general`, `apply_profession_pack` roda e cria o expediente
-- padrão mesmo sem nenhum serviço no catálogo (a 0031 já previu esse caso).
--
-- ## Os quatro eixos aqui NÃO são a resposta de ninguém
--
-- `onde`, `cobranca`, `inicio` e `ritmo` são `not null` nesta tabela, então a
-- linha precisa de algum valor. Mas eles **não são copiados para o tenant**
-- quando a profissão é esta — quem decide isso é `executarOnboarding`, e o
-- motivo está lá.
--
-- Em resumo: `podeUsarModulo` trata eixo nulo como "ainda não respondido" e não
-- esconde NADA por causa dele ("onboarding incompleto não é motivo para sumir
-- com funcionalidade", `core/billing/planos.ts`). Escolher quatro valores para
-- quem não se descreveu esconderia módulo de alguém que precisa dele — e não há
-- tela para corrigir depois, porque os eixos são gravados uma única vez, aqui.
-- Nulo é o estado honesto e é o estado seguro; os valores abaixo existem só
-- para satisfazer o `not null` da tabela.
--
-- `sinonimos` fica vazio de propósito: sinônimo faria esta linha aparecer em
-- buscas legítimas e roubar o lugar da profissão certa. Ela é a última opção da
-- lista (`posicao` 99) e o que a tela oferece quando a busca não acha nada.
-- =====================================================================

insert into public.professions
  (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo,
   vocab, duracao_padrao_min, ciclo_padrao_dias, ativa, posicao)
values
  ('outra', 'Outra profissão', 'outros', '{}',
   'hibrido', 'fixo', 'direto', 'avulso',
   -- `vocab` vazio: cai no PADRÃO da casa ("cliente", "atendimento", "serviço"),
   -- que é exatamente a palavra neutra que serve para quem não foi nomeado.
   '{}'::jsonb, 60, 30, true, 99)
on conflict (slug) do nothing;
