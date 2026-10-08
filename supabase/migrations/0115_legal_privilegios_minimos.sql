-- docs/101 T1.10: privilégio mínimo nas tabelas do pacote Advocacia (defesa em profundidade).
--
-- O padrão do Supabase dá a `anon` e `authenticated` TODOS os privilégios de tabela (inclusive DELETE e
-- TRUNCATE), e quem barra é a RLS. Até aqui, o que impedia apagar uma linha jurídica era só a AUSÊNCIA de
-- política de DELETE: uma política escrita por engano amanhã abriria a porta. E TRUNCATE não passa pela
-- RLS: a PostgREST não o expõe, mas o privilégio não tem por que existir.
--
-- Depois desta migration:
--  * `anon` não tem nada nas tabelas jurídicas (nenhuma tela pública lê dado de escritório);
--  * `authenticated` não apaga nem trunca nenhuma; nada no pacote se apaga (estado, nunca DELETE);
--  * as tabelas que só o servidor ou um gatilho grava (trilha, histórico do prazo, alertas, captura,
--    sugestão) ficam só de leitura para `authenticated`; quem grava é `service_role` ou função definer.
do $$
declare
  t text;
  tabelas text[] := array[
    'legal_access_log', 'legal_case_meetings', 'legal_case_members', 'legal_cases', 'legal_checklist_items',
    'legal_checklist_template_items', 'legal_checklist_templates', 'legal_corporate_changes', 'legal_deadline_alerts',
    'legal_deadline_changes', 'legal_deadlines', 'legal_document_links', 'legal_document_versions', 'legal_documents',
    'legal_entities', 'legal_holidays', 'legal_intimation_suggestions', 'legal_intimation_sync', 'legal_intimations',
    'legal_ownerships', 'legal_persons'];
  so_servidor text[] := array[
    'legal_access_log', 'legal_deadline_changes', 'legal_deadline_alerts', 'legal_intimation_sync',
    'legal_intimation_suggestions'];
begin
  foreach t in array tabelas loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete, truncate on public.%I from authenticated', t);
  end loop;
  foreach t in array so_servidor loop
    execute format('revoke insert, update on public.%I from authenticated', t);
  end loop;
end $$;
