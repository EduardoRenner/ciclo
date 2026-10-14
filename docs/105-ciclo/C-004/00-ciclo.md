# C-004 · Fundação pura do CICLO automotivo (plano 106, Fases 2–3 sem banco)

## F1 · Prompt
**Objetivo:** existir, em `src/core/manutencao/`, o que transforma "um carro" em "o plano daquele
carro, item a item, com data": catálogo de itens, planos genéricos por perfil, herança de camadas e
vencimento por três relógios. **Número:** de 0 para 29 itens (21 carro + 8 moto) e 7 perfis, todos
com relógio; vencimento por item testado nos 3 relógios + uso severo + "perguntar".
**Por que agora:** o Docker local está parado; tudo que precisa de banco (AUT-101..105) espera. Isto
é core puro e é a dependência de tudo o que vem depois (Motor por item, tela do plano do carro).
**Proibido:** inventar intervalo por modelo sem fonte (a camada de modelo só entra com manual citado);
afirmar "vencido" para item nunca feito nesta oficina (AUT-305).

## F2 · Pesquisa
`docs/106-automotivo/01-pesquisa.md` §2 (faixas por item, regra "o que ocorrer primeiro", uso severo
= metade, moto 1.000/3.000 km). Nada novo nesta rodada: o plano mestre já foi pesquisado.

## F3 · Plano
AUT-202 (itens), AUT-203 (perfis), AUT-204/205 parte pura (herança + origem), AUT-301 (três
relógios), AUT-302 (desgaste), AUT-305 (perguntar). Fica para o próximo ciclo: AUT-303 (agrupar em
visitas) e o placar automotivo por item.

## F4 · Execução
Commit `0e654353`. Mutações vistas reprovando: "perguntar" desligado; fator severo desligado.

## F5 · Medida
- 29 itens, 7 perfis; teste garante que todo item tem relógio e que item de moto não cai em carro.
- Herança: a camada mais específica vence item a item, com origem e fonte; câmbio filtra (manual sem
  fluido de câmbio automático, automático sem embreagem).
- Vencimento: óleo vence pelo km antes dos 12 meses e diz o km; fluido de freio vence pelo TEMPO com o
  carro parado; pastilha medida 2× prevê a data pelo desgaste antes do intervalo de km; uso severo
  corta pela metade; item sem histórico vira pergunta.
- **[NÃO MEDIDO]:** placar por item com perfis de motorista (próximo ciclo); nada de banco nem tela.
- **Nota:** cliente 6/10 (ainda invisível) · segredo 8/10 (o plano do carro existe como regra) ·
  engenharia 8/10.
