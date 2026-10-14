# C-001 · Medida

## O número
Antes: **não medido** (não existia jeito de comparar versões do Motor antes do ar).
Depois: placar com origem móvel, 5 clientelas sintéticas × 200 clientes × 8 visitas, semente 105,
faixa "3+ visitas" (quem tem ritmo provado):

| Cenário | Motor v1 erro mediano · acerto ±7 | **Motor v2** | Melhor base |
| --- | --- | --- | --- |
| regular (21±2) | 1 d · 100% | 1 d · 100% | padrão do serviço / mediana pura 1 d |
| deriva (21 → 35) | 5 d · 85% | 5 d · 85% | último intervalo 2 d · 97% |
| pulo (21, às vezes 42) | 3 d · 73% | 3 d · 73% | padrão do serviço 2 d · 81% |
| errático (14–45) | 8 d · 47% | 8 d · 47% | todos ≈ 8 d |
| **padrão errado (70±5, padrão 21)** | **44 d · 0%** | **5 d · 66%** | média 4 d · 84% |

Fonte: `tests/unit/core/cycle/backtest-cenarios.test.ts` (imprime a tabela); a v1 virou piso na guarda.

## O que mudou no produto
- `VERSAO_DO_MOTOR` 1 → 2. Com 3+ intervalos, o descarte de "anômalo" e o limite do ciclo são
  relativos à mediana do próprio cliente, não ao padrão do serviço. 0–2 intervalos: igual.
- Efeito real esperado [HIPÓTESE]: o salão cujo padrão de catálogo não bate com a clientela (pack
  semeado com 21 para um serviço que a clientela faz a cada 45–70) deixa de ver "atrasada" quem está
  no ritmo dela — menos mensagem errada, menos "sumiu" falso na Recuperar.

## O que foi tirado
- O teto de 2,5× o padrão e o descarte por 3× o padrão para quem tem ritmo provado.

## [NÃO MEDIDO]
- **Seed local:** o Docker Desktop subiu mas a engine (distro `docker-desktop` do WSL) ficou parada
  nesta rodada; o placar no seed fica para quando o banco local voltar. Lembrete: o seed é sintético,
  mede o gerador, não a clientela.
- **Clientela real:** não temos acesso de leitura à produção nesta sessão. O primeiro número real virá
  da prestação de contas (`algo_version = 2` separa as eras).
- Integração dos serviços que chamam `computeCycle` (`ciclo.ts`, `quem-ja-atende`) — rodar quando o
  banco local voltar.

## Apostas novas
- **A-09 · Estado pela regularidade, não por faixa fixa** (Platzer & Reutterer 2016): regular e
  atrasado 8 dias = sinal forte; irregular e atrasado 8 dias = ruído. Medida: o backtest ganha uma
  métrica de "quem foi embora" (perda) e compara faixa fixa × faixa escalada pela dispersão.
- **A-10 · Deriva:** "último intervalo" ganha do Motor em quem está desacelerando (2 d × 5 d). Uma
  mediana ponderada pelo recente pode capturar a deriva sem perder a robustez ao "pulo" — testar com
  o mesmo placar e a mesma guarda (nenhum cenário piora).

## Nota do ciclo
- Cliente 7/10 — corrige um erro grande num caso real (padrão de catálogo errado), sem tela nova.
- Segredo 8/10 — o Motor agora tem régua e piso; concorrente com régua fixa não tem como saber que erra.
- Engenharia 8/10 — puro, determinístico, guarda vista reprovando (3 testes caem com a v2 desligada);
  falta o seed e a integração.
