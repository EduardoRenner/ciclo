-- CICLO · o ciclo por sujeito, passo 3 (docs/105-ciclo/C-022/01-plano.md; AUT-101)
--
-- RESTRITIVA: sobe DEPOIS do código do passo 2 (job por sujeito, C-023) estar no ar. Com o código
-- antigo, que grava por (tenant, cliente, serviço), nada quebra; mas é esta migration que deixa o mesmo
-- cliente ter 2 ciclos no mesmo serviço (2 animais, 2 carros), e só o código novo sabe gravar isso.
--
-- A chave primária não pode ter coluna nula, e `subject_id` é nulo para toda a beleza. Então a chave usa
-- uma coluna GERADA: o sujeito, ou um uuid fixo quando não há sujeito. Mesma regra do índice único da
-- 0134 (`nulls not distinct`), que segue sendo o alvo do upsert do código.
--
-- Custo: a coluna gerada armazenada reescreve a tabela (trava de escrita durante a migration). Ciclo é
-- estado derivado que o job recalcula; rodar fora do horário do job.

alter table client_cycles add column subject_key uuid
  generated always as (coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored;

alter table client_cycles
  drop constraint client_cycles_pkey,
  add primary key (tenant_id, client_id, service_id, subject_key);
