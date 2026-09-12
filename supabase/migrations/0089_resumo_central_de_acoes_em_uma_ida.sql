-- CICLO · resumo_central_de_acoes: quatro contagens, uma ida de rede (migration 0089)
--
-- Medido em produção (docs/28, rodada 2026-09-12): `/admin/hoje` estava consistentemente em
-- 700-1000ms, e a medição por ramo (`console.log` temporário) isolou a causa — `centralDeAcoes`
-- (9 consultas em `Promise.all`) levava 2-4x mais que os outros três ramos da tela (que fazem
-- 2-3 consultas cada). Nenhuma consulta individual é lenta no banco (`explain analyze` — poucos
-- milissegundos cada); o custo é de REDE: cada chamada ao PostgREST paga uma sobrecarga fixa que
-- não aparece no plano de execução, e nesta infraestrutura ela não desaparece só por as chamadas
-- estarem em `Promise.all` — "paralelo no código" não é "grátis na rede".
--
-- Esta função substitui QUATRO das nove consultas de `centralDeAcoes` (clientes, agendamentos,
-- clientes a recuperar, aniversariantes — todas `count(*, head: true)`) por UMA só: a mesma
-- pergunta, uma ida de rede em vez de quatro. As outras cinco (`loyalty_entries`, orçamentos,
-- contexto de plano, settings do tenant, material do catálogo) continuam onde estão — não são
-- contagens simples e misturar tudo numa função só criaria uma segunda definição das regras que
-- já vivem em `core/` e `services/`.
--
-- `security invoker` (não `definer`): a função roda com o papel de quem chama, e a RLS das
-- tabelas por trás (`clients`, `appointments`) e das views (`v_clientes_a_recuperar`,
-- `v_client_segments`, ambas já `security_invoker` desde suas migrations) continua valendo
-- inteira — mesmo padrão de `has_tenant()` e das outras funções desta base.

create or replace function public.resumo_central_de_acoes(p_tenant uuid)
returns table (
  clientes bigint,
  agendamentos bigint,
  em_risco bigint,
  aniversariantes bigint
)
language sql
security invoker
stable
as $$
  select
    (select count(*) from clients where tenant_id = p_tenant and deleted_at is null),
    (select count(*) from appointments where tenant_id = p_tenant),
    (select count(*) from v_clientes_a_recuperar where tenant_id = p_tenant and ja_atrasado = true),
    (select count(*) from v_client_segments where tenant_id = p_tenant and is_aniversariante = true)
$$;

comment on function public.resumo_central_de_acoes is
  'Quatro contagens da Central de Ações (clientes, agendamentos, a recuperar, aniversariantes) numa ida de rede só. Ver docs/28 §12.';
