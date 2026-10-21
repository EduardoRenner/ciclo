# C-002 · Medida

## O número
Erro mediano em dias entre o lembrete e o vencimento real da manutenção ("10 mil km ou 12 meses, o
que ocorrer primeiro"), 5 perfis SINTÉTICOS × 300 carros × 6 manutenções, semente 2002:

| Perfil | Só meses (StarkOS hoje) | O que vencer primeiro, ritmo médio BR (36 km/dia) | **O que vencer primeiro, ritmo do carro** |
| --- | --- | --- | --- |
| pouco uso (6 mil/ano) | 0 d | 84 d (cedo) | **0 d** |
| médio (13 mil/ano) | 78 d · 92% tarde | 30 d | **30 d** · 41% tarde |
| muito uso (25 mil/ano) | 216 d · 100% tarde | 132 d | **16 d** · 35% tarde |
| aplicativo (50 mil/ano) | 290 d · 100% tarde | 206 d | **8 d** · 23% tarde |
| irregular (8–30 mil/ano) | 165 d | 84 d | **17 d** |

"% tarde" = lembra mais de 7 dias depois do vencimento. Fonte: `tests/unit/core/cycle/relogios-placar.test.ts`.

**Leitura:** H1 e H2 confirmadas (no sintético): o lembrete só por meses chega 2,5 meses tarde para
o motorista médio e 9,5 meses tarde para o de aplicativo — justamente o cliente que mais vale para a
oficina. Com o ritmo de cada carro, o erro mediano cai para 8–30 dias e o viés fica perto de zero.
O perfil médio continua com 30 d: a variação de uso entre um intervalo e outro (±20% no gerador) é
ruído que nenhum previsor por média tira — é o piso do problema, não defeito do previsor.

## O que mudou
- O Motor tem relógio múltiplo no core, com a beleza intacta (invariante testado). Nenhuma tela,
  nenhum banco.

## [NÃO MEDIDO]
- Dados reais de oficina: não temos. O StarkOS local tem o schema, não histórico.
- O impacto no StarkOS (MOT-006) e no CICLO (MOT-007) — ciclos próprios.

## Apostas novas
- **A-11 · Leitura de km alta demais** (digitação 10×) distorce o ritmo com só 2 leituras. Conferir a
  leitura no balcão contra o ritmo esperado ("esse carro rodou 108 mil km em 3 meses?") antes de gravar.
- **A-12 · Mensagem que diz o relógio:** "pela quilometragem, seu carro deve estar perto da troca de
  óleo" é verdade verificável; "já faz tempo" não é. Vale para o serviço como software (trilha 5).

## Nota do ciclo
- Cliente 8/10 — no sintético, a oficina passa a chamar na hora certa quem mais roda.
- Segredo 9/10 — o Motor deixou de ser "agenda de beleza": prevê qualquer relógio, com prova.
- Engenharia 8/10 — puro, invariante da beleza, duas mutações reprovam; falta dado real.
