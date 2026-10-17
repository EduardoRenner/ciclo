# C-001 · Plano

| ID | Origem | Proposta | Arquivos | Aceite (MEDIDO) | Teste (guarda vista reprovando) | Migration | Dep. | Esforço |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MOT-001 | C-001 pesquisa | `backtest.ts` puro: origem móvel por histórico, previsor plugável, métricas erro mediano (dias), erro médio absoluto, viés, % ±7 (`TOLERANCIA_DIAS`), por faixa de histórico (1, 2, 3+ visitas) | `src/core/cycle/backtest.ts` | casos à mão: histórico de 3 visitas regulares → 1 previsão por prefixo, erro conhecido | unitário; reprova se a origem vazar o futuro (previsor que lê a próxima visita tem que dar erro 0 e o teste de vazamento acusa) | não | — | P |
| MOT-002 | C-001 | 5 cenários com semente fixa (regular, deriva, pulo, errático, padrão errado) + 4 bases (padrão do serviço, último intervalo, média, mediana de tudo) | `tests/unit/core/cycle/backtest-cenarios.test.ts` | tabela impressa; o Motor ganha do padrão do serviço em "regular" e "deriva" | o próprio teste | não | MOT-001 | P |
| MOT-003 | H2 | se "padrão errado" mostrar erro grande: o descarte de intervalos anômalos passa a ser relativo ao PRÓPRIO cliente (mediana dele) quando há 3+ intervalos, e o teto sobe | `compute.ts` (+ `VERSAO_DO_MOTOR = 2`) | erro mediano em "padrão errado" cai; nenhum dos outros 4 piora | guarda "nenhum cenário piora" vista reprovando com a versão antiga | não | MOT-002 | P |
| MOT-004 | — | rodar no seed local (quando o Docker subir) e registrar, com o aviso de que o seed é sintético | `docs/105-ciclo/C-001/03-medida.md` | números no doc | — | não | MOT-002 | P |

**Revisão adversarial do plano:**
- Overfitting no gerador: a correção MOT-003 tem de ter mecanismo explicável (filtro relativo ao
  padrão do serviço quebra quando o padrão está errado) — não um ajuste de constante para ganhar.
- `VERSAO_DO_MOTOR` sobe → `cycle_predictions` passa a gravar 2; a calibração compara eras. Já é o
  desenho previsto no comentário da constante. Ok.
- `previa-do-dinheiro` e `quem-ja-atendo` chamam com 1 visita: MOT-003 não pode mudar o caso de 0–2
  intervalos sem prova. Restringir a correção a 3+ intervalos.
- Teto de 2,5× o padrão: subir pode fazer um cliente sumido virar "ritmo longo". Só subir com
  regularidade comprovada (3+ intervalos coerentes entre si).
