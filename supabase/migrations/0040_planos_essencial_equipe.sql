-- docs/18-MONETIZACAO-PLANO.md §D.4 (tensão §4.3 do prompt de monetização).
--
-- A 0030 renomeou 'start/studio/network' para 'gratis/profissional/avancado' e deixou 'pro' de
-- pé por já ser neutro. O efeito colateral só apareceu ao desenhar a tabela de preço: sobraram
-- 'pro' E 'profissional' como degraus DISTINTOS, e ninguém consegue explicar num site a diferença
-- entre "Pro" e "Profissional". Não é problema de vocabulário de nicho (o da 0030) — é problema
-- de dois rótulos sinônimos disputando o mesmo significado.
--
-- Nomes escolhidos (D.3): gratis · essencial · equipe · avancado. 'equipe' diz o que separa o
-- degrau do anterior (mais de um profissional), que é a fronteira real da métrica de valor
-- recomendada na Fase C — degrau por faixa de profissionais, preço fixo dentro da faixa. É o
-- padrão que Trinks, Avec e Simples Agenda usam, então o cliente já sabe ler.
--
-- Continua sendo troca de rótulo pura: nenhuma linha de código lê `tenants.plan` (só o
-- types.gen.ts, que é gerado), e os 8 tenants em produção estão TODOS em 'gratis'. Depois de
-- existir cliente pagante isso vira migração de dado de assinatura — por isso é agora.

alter type plan_tier rename value 'pro' to 'essencial';
alter type plan_tier rename value 'profissional' to 'equipe';
-- 'gratis' e 'avancado' ficam.
