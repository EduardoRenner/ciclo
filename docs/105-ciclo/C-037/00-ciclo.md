# C-037 · Pedido do Eduardo: Recuperar só com "Dá para recuperar" e o preço cheio

**F1 · O pedido (14/10, com print):** "tira isso de lucro e faturamento, só põe dá para recuperar e o valor
sem reduzir". A tela mostrava, no cartão do topo, "R$ 510,95 / R$ 367,14 de lucro" e, em cada pessoa,
"R$ 153,00 / R$ 91,80 de lucro".

**F2 · O que os números eram:** o valor de cada pessoa era o preço do serviço × a chance de voltar
(R$ 153,00 = platinado de R$ 180 × 0,85 "na hora de voltar"; R$ 63,00 = 180 × 0,35 "em risco"). "Sem
reduzir" = o preço cheio. Não havia "faturamento" escrito nessa tela; o que saiu foi o lucro.

**F3/F4:**
- `ItemRecuperar.fullValueCents` e `ListaRecuperar.totalFullValueCents`: o preço do serviço, 0 quando a
  próxima visita não gera venda avulsa (assinante, pacote; a mesma regra do valor de antes).
- Tela: o cartão mostra só "Dá para recuperar" com a soma do preço cheio; cada pessoa e o cartão da fila
  mostram o preço cheio; nenhuma linha "de lucro". A explicação virou "Não é promessa: como a conta é
  feita — a soma do preço de cada pessoa: o que entra se todas voltarem".
- A ORDEM da fila não mudou (continua por quem deixa mais depois da comissão); o aviso de material que
  falta continua (guarda `tela-que-desconta-produto-sabe-a-lacuna`).
- As outras telas (Hoje, Mês, assistente) não mudaram: usam `totalValueCents`, que segue sendo preço ×
  chance, definido assim na guarda `numero-de-hoje-nao-e-faturamento`.
- Guarda `agendamento-anuncia-mudanca` (o anúncio do leitor de tela usa o mesmo número do cartão): fixava
  o nome do campo; agora lê qual campo o cartão usa e cobra o mesmo no anúncio. Mutação: anúncio com o
  número antigo → reprova.

**F5 · Prova (build de produção, 390 px, conta de demonstração):** cartão "Dá para recuperar R$ 765,00"
sem lucro; lista "Queila Andrade · Platinado · R$ 180,00"; cartão da fila "R$ 180,00"; anúncio "11
clientes, R$ 765,00 para recuperar."; a página inteira sem "de lucro". Unidade 4.308.

**Nota:** cliente 9 · segredo 3 · engenharia 8. **Próximo (C-038):** algoritmo (o último foi o C-035) ou a
rota do check-in no servidor.
