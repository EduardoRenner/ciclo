-- Continuação de 0038 (S13, 2026-08-24): mesma causa raiz, agora do lado de FUNÇÃO.
--
-- 0038 corrigiu tabela e deliberadamente ficou fora de função, porque função ganha `EXECUTE` de
-- `PUBLIC` por padrão e um `grant` amplo ali reabriria os `revoke` de segurança deste projeto.
-- O que 0038 não previu: o INVERSO também é um buraco. `apply_vertical_pack`, `claim_jobs`,
-- `finish_job`, `apply_profession_pack`, `tenant_rls_report` e outras foram revogadas de
-- `public, anon, authenticated` (nove migrations, de 0004 a 0031) e **nenhuma delas foi
-- re-concedida a `service_role` explicitamente** — porque nunca precisou: em produção,
-- `service_role` já tinha `EXECUTE` nelas de fábrica, do mesmo jeito que já tinha `SELECT` nas
-- tabelas antes de 0038. Um `supabase start` do zero não herda nem uma coisa nem a outra.
--
-- Sintoma medido na 2ª execução do CI que sobreviveu ao 0038: `executarOnboarding` passou da
-- linha 68 (`profiles`, resolvido por 0038) para a linha 145 — o `catch` genérico em volta da
-- chamada a `apply_vertical_pack`/`apply_profession_pack`. Confirmado em produção antes de mexer:
-- `service_role` TEM `EXECUTE` nelas hoje, sem nenhuma migration ter concedido isso — exatamente
-- o padrão de 0038, desta vez em função.
--
-- ## Por que aqui pode ser um `grant` amplo, e em 0038 não podia
--
-- Nenhuma migration deste projeto jamais revogou nada de `service_role` (conferido: zero
-- ocorrências de `revoke ... from service_role` em toda a história). Todo `revoke` mirava
-- `public`/`anon`/`authenticated` — nunca a chave que o próprio servidor usa. Então, ao contrário
-- de "conceder EXECUTE a anon/authenticated" (que reabriria dez revokes de propósito),
-- "conceder EXECUTE a service_role" não desfaz nada: é dar à chave de serviço exatamente o que
-- ela sempre teve na prática, só que agora declarado.
grant execute on all functions in schema public to service_role;

-- Para toda função que uma migration futura vier a criar.
alter default privileges in schema public grant execute on functions to service_role;
