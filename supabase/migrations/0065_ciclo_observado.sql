-- CICLO · a régua medida fica AO LADO da configurada, nunca por cima dela
--
-- `calibrarCiclo` (`core/cycle/calibracao.ts`) mede a cadência real de cada serviço a partir das
-- previsões já resolvidas. Falta onde guardar o resultado — e a decisão de ONDE é a parte que
-- importa.
--
-- ## Por que uma coluna nova, e não sobrescrever `cycle_days`
--
-- Sobrescrever seria mais simples e está errado por dois motivos:
--
-- 1. **Não dá para desfazer.** Uma vez sobrescrito, o valor que o dono (ou o pack) tinha escolhido
--    não existe mais em lugar nenhum. Se a calibração errar — amostra enviesada, mudança de
--    perfil de clientela, um mês atípico — não há para onde voltar.
-- 2. **Some a diferença, que é o produto.** O valor da coisa não é "o ciclo agora é 30". É *"você
--    configurou 21, sua clientela volta a cada 30, e por isso 12 pessoas estavam na lista errada"*.
--    Com uma coluna só, a comparação deixa de existir no instante em que a correção acontece.
--
-- Com as duas lado a lado, o dono vê o que escolheu, o que foi medido, e decide. E a tela pode
-- dizer a verdade em vez de mostrar um número que mudou sozinho — o defeito que esta base persegue
-- desde o `docs/21`.
--
-- ## `amostra` e `medido_em` não são metadado decorativo
--
-- São o que separa "medi 30 com 8 voltas na semana passada" de "medi 30 com 400 voltas em um ano".
-- Sem eles, a tela mostraria os dois do mesmo jeito, e o dono não teria como calibrar a própria
-- confiança. Número sem procedência é número que ninguém deveria usar para decidir.

alter table services
  add column cycle_days_observado int check (cycle_days_observado between 1 and 365),
  add column cycle_days_observado_amostra int check (cycle_days_observado_amostra >= 0),
  add column cycle_days_observado_em timestamptz;

comment on column services.cycle_days is
  'A régua CONFIGURADA: padrão da coluna (21) ou o que o pack da profissão semeou. Nunca é sobrescrita pela calibração.';
comment on column services.cycle_days_observado is
  'A régua MEDIDA a partir das voltas que de fato aconteceram (core/cycle/calibracao.ts). Nula enquanto não houver amostra suficiente. Ver docs/46.';
comment on column services.cycle_days_observado_amostra is
  'Quantas voltas entraram na medição. É o que permite a tela distinguir uma medida de 8 voltas de uma de 400.';
