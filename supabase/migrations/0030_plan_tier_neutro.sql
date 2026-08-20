-- P11 (docs/09-PLATAFORMA.md §13, item 3 / G9): "os nomes atuais (start/pro/studio/network)
-- têm cheiro de salão" — 'studio' e 'network' são vocabulário de salão de beleza, não fazem
-- sentido pra eletricista ou faxineira. Achado ao auditar antes de bloquear a fase inteira:
-- nenhuma linha de código lê `tenants.plan` hoje (grep confirmou zero uso — cobrança nunca foi
-- construída, é exatamente por isso que P11 está bloqueado no Asaas). Sem nenhum call site pra
-- atualizar, renomear os valores do enum é troca de rótulo pura, zero risco.
--
-- Não vira tabela-catálogo (a "mesma solução do G1") nesta rodada: os LIMITES/PREÇOS de cada
-- plano ainda não foram decididos (decisão de negócio do Eduardo, §13 abertura) — construir um
-- catálogo rico agora, sem saber o que cada tier realmente vai oferecer, seria estrutura
-- especulativa. Renomear resolve o problema de vocabulário sem fingir resolver o de cobrança.

alter type plan_tier rename value 'start' to 'gratis';
alter type plan_tier rename value 'studio' to 'profissional';
alter type plan_tier rename value 'network' to 'avancado';
-- 'pro' já era neutro — fica como está.
