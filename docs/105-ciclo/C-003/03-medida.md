# C-003 · Medida

## O número
Placar sintético (`tests/unit/core/cycle/sujeito-placar.test.ts`, semente 3003/3004, 200 tutores):

| | Série única (hoje) | Por sujeito |
| --- | --- | --- |
| erro mediano da próxima visita (3+) | 3 d · 85% na semana | 1 d · 100% |
| **perda de um dos animais vista 45 dias depois** | **0%** | **100%** |

**H1 derrubada em parte:** a previsão da próxima visita "de alguém da casa" quase não sofre (o outro
animal vem uma semana depois). **O dano é outro e maior:** quem sai fica invisível. Isso é o coração
do produto (Recuperar, "dinheiro parado em quem sumiu", prestação de contas).
**H2 confirmada por leitura:** agenda, comanda, orçamento por link, Caixa, Mês, mensagens e Motor
servem à oficina e ao pet; o que falta é o sujeito, a leitura de uso, a regra de dois relógios, o
vocabulário/campos e a profissão "oficina" no catálogo.

## O que mudou
- `core/cycle/sujeito.ts` (agrupamento puro). Nenhum banco, nenhuma tela.

## [NÃO MEDIDO]
- Quantos tutores reais têm mais de um animal (sem acesso à produção).
- Seed e integração (Docker local parado).

## Decisões para o Eduardo (o laço segue sem elas, pelo padrão de trabalho)
- Entrar de verdade na oficina e no pet é decisão de produto e de marca (o StarkOS já existe como
  produto separado). Padrão de trabalho: a plataforma ganha o sujeito (serve aos dois e não quebra a
  beleza); a demo da oficina é preparada; vender é dele.

## Nota do ciclo
- Cliente 7/10 — achou um ponto cego real num segmento que já está no catálogo.
- Segredo 9/10 — "um relógio por sujeito" é o que transforma o CICLO em plataforma de retorno, não em
  agenda de salão.
- Engenharia 8/10 — medido, mutação reprova; o banco fica para ciclo com revisão própria.
