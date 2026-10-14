# C-024 · Dano vivo: a suíte de integração que nunca passava de uma vez, e a reexecução escondida

**F1 · Objetivo:** nas 3 rodadas inteiras desta sessão a integração nunca passou de uma vez, sempre em
arquivos diferentes. Uma suíte que nunca fica verde não protege ninguém: regressão real se esconde no
meio das falhas de sempre. Começar pelo teste que mais apareceu: "1.000 jobs com vários workers".

**F2 · Hipótese 1 (medida e REFUTADA):** `health.test.ts` documenta que os workers de `job-queue.test.ts`
roubam o job de fixture dele (a fila é global e `claim_jobs` pega qualquer tipo). Conserto: 0136, filtro
opcional `p_kinds`; o worker de produção não muda (job sem tratador segue morrendo com o erro escrito,
decisão registrada em teste); os testes da fila passam os próprios tipos. Medida, par fila + saúde:
antes 1 falha em 5 rodadas, depois 2 em 5. Não era isso que derrubava o teste dos 1.000.

**Hipótese 2 (medida e confirmada):** sozinho, o teste dos 1.000 passou 6 de 6; com o de saúde em
paralelo, falhou com 999. O job faltante FOI tratado: o log mostrou `job_concluido_sem_registro`, e o erro
da baixa (`finish_job`) foi "An invalid response was received from the upstream server" (gateway local
sob carga).

**O dano de produção que isto mostrou:** o comentário do código dizia que deixar o job em `running` era o
desfecho seguro ("alguém humano confere"). A 0037 desmente: ela reivindica de novo todo `running` parado
há mais de 15 min e executa o tratador OUTRA VEZ. Uma falha passageira na baixa vira, 15 min depois,
mensagem ou cobrança duplicada.

**F3/F4:** a baixa de um job concluído tenta 3 vezes (esperas de 200 e 600 ms) antes de desistir; o
comentário passa a dizer a verdade. Teste de unidade novo: falhou 2 vezes, entrou na 3ª, conta como
processado, sem log de "sem registro". O teste antigo mantém a intenção (nunca pedir failed/dead para um
job que já rodou), agora com 3 chamadas, todas "done".

**F5 · Medida (par fila + saúde em paralelo, banco local):**

| | rodadas com falha | baixas perdidas |
| --- | --- | --- |
| antes | 2 de 5 | 1 por falha |
| depois da nova tentativa | 0 de 6 | 0 |

O filtro `p_kinds` fica: não piora nada, tira o roubo documentado entre as suítes e prova seu efeito num
teste determinístico (2 tipos na fila, 1 pedido, o outro intocado).

**Nota:** cliente 6 · segredo 4 · engenharia 9. **Próximo (C-025):** a suíte inteira de novo, para ver se
passa de uma vez; depois a fila e a ficha mostram o sujeito.
