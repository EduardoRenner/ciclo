-- CICLO · a trilha de previsões por sujeito, passo 2 (docs/105-ciclo/C-030; AUT-101)
--
-- RESTRITIVA: sobe DEPOIS do código que grava a previsão com o sujeito (C-030). A chave nova da 0138
-- (com o sujeito, nulo igual a nulo) passa a ser a única; a antiga impedia dois animais do mesmo tutor,
-- banhados no mesmo dia, de terem cada um a sua previsão.

alter table public.cycle_predictions drop constraint cycle_predictions_uma_por_visita;
