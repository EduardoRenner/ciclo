# 104 · Diário do founder-engenheiro

Uma entrada por rodada: o que, por quê, número antes e depois, o que saiu, próxima aposta.

## 2026-10-13 · Rodada 0 · O modo de trabalho

- **O que:** escrevi `docs/104-PROMPT-FOUNDER-ENGENHEIRO.md` e a primeira lista de apostas além do plano.
- **Por quê:** os planos (98/08, 103) dizem o que fazer; faltava um critério escrito para escolher,
  medir e ir além deles sem virar opinião. As lentes de Jobs e de *Zero to One* viraram perguntas com
  número, não frases.
- **Antes → depois (o que já foi medido hoje, base para as próximas rodadas):**
  - Importar: tela nova provada a 390 px (5 fichas, R$ 35,35 na prévia, print escuro em 1,9 s).
  - Toque: aba 344 → 51 ms, dia 516 → 57 ms (mediana); pior de 5 ainda acima de 100 ms (A-05).
  - Menu: Recepção e Profissional deixaram de ver Caixa e Estoque.
  - Texto: menor texto 12 px em 7 telas; trilho deixou de cortar o chip da ponta.
- **O que saiu:** a importação antiga por CSV (rota, serviço, teste), o botão flutuante no celular.
- **Próxima:** APR-105 (um primário só no detalhe do horário). Na fila das apostas, A-04 (dia do salão
  no servidor) é a mais barata com dano evitado e entra logo depois.

## 2026-10-13 · Rodada 1 · APR-105, o detalhe do horário

- **O que e por quê:** primeiro ticket desbloqueado da Onda 1, e o de maior dano evitado: um toque
  errado no balcão (Cancelar colado em Chegou) apaga um horário com cliente na frente.
- **Antes → depois (390 px, build de produção):** primários no "confirmado" 2 → 1; Cancelar de botão
  vermelho cheio no meio → linha separada no fim, 48 px, com "Ele sai da agenda e o horário fica livre".
- **Além do ticket (Lente 1):** a captura mostrou que o detalhe NÃO dizia de quem era o horário nem o
  serviço, e a hora saía no fuso do aparelho. Agora "Marina Bastos · Platinado com Anderson Rocha" e a
  hora do negócio. Nenhum plano tinha isso: só apareceu porque a tela foi olhada como a recepção olha.
- **O que saiu:** o segundo primário; o vermelho cheio do cancelar.
- **Próxima:** APR-106 (cada bloco da Hoje avisa quando falha em vez de mostrar zero): dano evitado
  alto, porque zero falso na Hoje é número errado na tela mais vista.
