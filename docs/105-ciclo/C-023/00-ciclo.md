# C-023 · O ciclo por sujeito, passos 2 e 3: o job calcula um ciclo por animal ou carro

**F1 · Objetivo:** o tutor com 2 animais no mesmo serviço deixa de ser uma série só com intervalos pela
metade. Número: ciclos por tutor e o ciclo pessoal de cada animal (antes 1 ciclo de 7 dias; esperado 2
de 14).

**F2:** mapa das leituras de `client_cycles`: 2 leituras com `maybeSingle` por (cliente, serviço) na
rotina de envio da recuperação dariam erro de "várias linhas" com 2 sujeitos; listas (CRM, clube,
notas, lista de espera) toleram várias linhas. A trilha de previsões e o casamento delas usam chave de 2
partes (cliente, serviço).

**F3/F4:**
- `ciclo.ts`: a combinação é (cliente, serviço, sujeito); concluídos, futuros e visitas informadas
  trazem o sujeito; a linha grava `subject_id`. O pacote segue por (cliente, serviço), como é vendido.
  A trilha de previsões recebe só o ciclo SEM sujeito por enquanto (o sujeito na trilha é passo próprio).
- Recálculo de um atendimento: o agendamento concluído carrega `subject_id`; histórico e futuros
  filtrados pelo mesmo sujeito.
- Envio da recuperação: as 2 leituras pegam o ciclo mais atrasado (uma mensagem por tutor).
- 0135 (RESTRITIVA, depois do deploy do código): coluna gerada `subject_key` (sujeito ou uuid fixo) e
  a chave primária passa a (tenant, cliente, serviço, `subject_key`). A tabela nunca fica sem PK.

**F5 · Medida (banco local):** tutor com Mel e Thor em semanas alternadas: 2 ciclos de 14 dias
(amostra 3 cada), nenhum ciclo sem sujeito, rodar de novo não duplica, a fila mostra o tutor 1 vez.
Integração relacionada (agendamentos, ciclo, CRM, LGPD, notas, já atendo, recuperar): 107 de 107.
Unidade 4.267.

**Ordem de deploy:** 0134 antes; o código deste ciclo; 0135 DEPOIS dele no ar.

**Nota:** cliente 8 · segredo 9 · engenharia 9. **Próximo (C-024):** passo 4 (a fila e a ficha mostram o
sujeito: "Mel, da Ana, sumiu") + prova no navegador a 390 px; e a suíte de integração que nunca passa
de uma vez (ciclo próprio de dano vivo).
