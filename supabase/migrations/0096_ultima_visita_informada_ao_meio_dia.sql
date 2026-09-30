-- CICLO · a última visita informada não pode voltar um dia (29/09/2026)
--
-- ## O defeito
--
-- A importação por planilha e o "Quem você já atende" gravavam `clients.last_visit_at` (que é
-- `timestamptz`) com uma DATA pura: `'2026-08-15'`. O Postgres guarda isso como MEIA-NOITE UTC —
-- que em Brasília é 21h do dia 14. Quem lê a data no fuso do salão vê a visita UM DIA ANTES.
-- Medido pelo teste da exportação da base (docs/83 P3): o arquivo sairia com o dia errado e, ao
-- voltar pelo importador, a pessoa ficaria "atrasada" um dia a mais.
--
-- O código novo grava MEIO-DIA UTC (`instanteDoDiaInformado`), que cai no mesmo dia em qualquer
-- fuso de UTC−11 a UTC+11. Esta migration conserta o que já foi gravado.
--
-- ## Quem é mexido, e quem NÃO é
--
-- Só as linhas em meia-noite UTC EXATA que não vieram de um atendimento. `last_visit_at` também é
-- escrito a partir de `appointments.starts_at` (segmentos); um atendimento às 21h00 em Brasília é
-- 00:00:00 UTC exato e é VERDADE — mexer nele empurraria a visita para o dia seguinte. Por isso a
-- condição `not exists` com o mesmo instante em `appointments`.
--
-- Soma 12 horas: meia-noite UTC do dia D vira meio-dia UTC do mesmo dia D — a data informada fica
-- a mesma, só deixa de ser ambígua. Idempotente: rodar de novo não acha mais nenhuma linha.

update clients c
set last_visit_at = c.last_visit_at + interval '12 hours'
where c.last_visit_at is not null
  and (c.last_visit_at at time zone 'UTC')::time = time '00:00:00'
  and not exists (
    select 1 from appointments a
    where a.client_id = c.id and a.tenant_id = c.tenant_id and a.starts_at = c.last_visit_at
  );
