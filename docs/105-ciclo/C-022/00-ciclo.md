# C-022 · O ciclo por sujeito, passo 1: a chave nova, sem mudar a beleza

**F1 · Objetivo:** AUT-101 parte 2 — o pet com 2 animais vira 2 ciclos. Neste ciclo, só o passo que
pode subir antes do código: a chave nova da tabela de ciclos, com tudo idêntico para a beleza.

**F2:** `client_cycles` tem PK (tenant, cliente, serviço) desde a 0001; 3 portas gravam com upsert
nessa chave; nenhuma função SQL grava na tabela. Postgres 17 (local e config); `nulls not distinct` já
usado na 0003.

**F3 · Plano em passos:** `01-plano.md` (1 aditiva agora; 2 job por sujeito; 3 a PK antiga cai DEPOIS do
deploy; 4 a fila mostra o sujeito).

**F4:** 0134 — `client_cycles.subject_id` nulável, FK composta com o tenant (cascade: ciclo é estado
derivado, não histórico), índice ÚNICO `nulls not distinct` em (tenant, cliente, serviço, sujeito) e
índice pelo prefixo da FK. As 3 portas gravam com `onConflict` de 4 colunas (sujeito nulo).

**F5 · Medida (banco local, 90.539 linhas de ciclo):** índice único criado sem conflito; unidade
4.267; integração das 3 portas (ciclo, recuperar, notas, já atendo, CRM) 63 de 63. Mutação: a chave nova SEM `nulls not distinct` (recriada no banco local) derruba 10 testes de ciclo, porque o sujeito nulo da beleza deixa de colidir; restaurada igual à migration.

**Nota:** cliente 3 · segredo 8 · engenharia 9. **Próximo (C-023):** passo 2 (job por sujeito) + 3 (0135).

**Suítes inteiras:** RLS 357 de 357. Integração 620 verdes e 3 falhas + 1 arquivo no preparo, em
arquivos DIFERENTES das rodadas do C-020 e do C-021 (clube, agendamento público, estoque, fila de jobs:
2 erros genéricos de gravação e "998 de 1.000 jobs" sob concorrência). Isolados: 45 de 45. Falha que muda
de arquivo a cada rodada é a assinatura da suíte de banco intermitente (memória); nenhum desses arquivos
toca `client_cycles`. Não chamo de verde: a suíte inteira ainda não passou de uma vez nesta sessão.
