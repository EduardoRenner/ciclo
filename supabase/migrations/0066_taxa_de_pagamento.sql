-- CICLO · a taxa da maquininha passa a ter quem a escreva
--
-- ## O buraco, medido (docs/49)
--
-- `tickets.fee_cents` existe desde a `0001`. `calcularSobraDaComanda` a subtrai. O resumo do caixa
-- a soma. E **nada em `src/` a escreve** — nem a comanda, nem pagamento, nem job. A auditoria de
-- 2026-08-28 fez a coisa honesta e removeu o quadro "Taxa" da tela em vez de mostrar R$ 0,00 para
-- sempre, deixando a guarda `caixa-nao-promete-taxa` de mão dupla: no dia em que alguém escrever,
-- o quadro tem que voltar.
--
-- Esse dia é hoje. E ele importa mais do que parece: o `docs/48` §Fase 3 apoia a tese inteira do
-- produto na frase *"a taxa da maquininha é um único percentual que todo dono sabe de cor"* — ou
-- seja, o plano supõe que essa parte já estava descontada. Não estava. O "Sobrou" que o CICLO
-- mostra hoje é faturamento menos material e comissão: melhor que o do setor, e ainda assim o
-- mesmo tipo de número inflado que o `docs/47` P05 acusa.
--
-- ## Por que a forma de pagamento fica na comanda, e não em `payments`
--
-- `payments` existe na `0001` e **não tem uma única escrita no projeto** — ligar o fechamento nela
-- agora seria criar uma segunda fonte para o mesmo dinheiro, que é exatamente o defeito de
-- livro-caixa que esta base já pagou uma vez (duas fontes somando o mesmo valor). O caixa lê
-- `tickets`. Enquanto for assim, a forma de pagamento mora em `tickets`.
--
-- ## Por que `fee_bps` também é gravado, e não só o valor em centavos
--
-- Mesmo motivo de `ticket_items.commission_bps` (TICKET-042): o percentual congelado é o que
-- permite auditar o valor depois. Se o dono trocar a taxa do crédito em novembro, a comanda de
-- agosto continua explicável — `docs/48` §4.2, "isso é registro contábil, não view".
--
-- O percentual em si (por forma de pagamento) vive em `tenants.settings.payment_fees_bps`, no
-- mesmo padrão jsonb de `loyalty`, `mensageria` e das configurações de agenda.

alter table tickets
  add column payment_method payment_method,
  add column fee_bps int not null default 0 check (fee_bps between 0 and 10000);

comment on column tickets.payment_method is
  'Como a cliente pagou, escolhido no fechamento. Nulo em comanda aberta e em comanda fechada antes da 0066.';
comment on column tickets.fee_bps is
  'O percentual da maquininha CONGELADO no fechamento, em basis points. Trocar a taxa depois não pode mudar o lucro de uma comanda já fechada.';
comment on column tickets.fee_cents is
  'O que a maquininha levou, em centavos, calculado sobre o total_cents (o valor que a cliente passou no cartão, gorjeta inclusa). Até a 0066 nenhum código escrevia esta coluna.';
