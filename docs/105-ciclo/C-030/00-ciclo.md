# C-030 · Motor: a prestação de contas também por animal e por carro

**F1 · Objetivo:** desde o C-023 o ciclo do sujeito existe, mas a trilha de previsões (docs/46, de onde
saem o acerto do Motor e a calibração) só recebia o ciclo SEM sujeito. O Motor não media o próprio
acerto justamente na expansão. Número: previsões registradas e fechadas por sujeito.

**F2:** `cycle_predictions` tem chave única (tenant, cliente, serviço, última visita): dois animais
banhados no mesmo dia colidiriam. O casamento (`resolverPrevisoes`) e o job montavam a chave da combinação
cada um do seu jeito (2 e 3 partes) — duas cópias da mesma fórmula.

**F3/F4:**
- 0138 (aditiva, antes): `cycle_predictions.subject_id`, FK composta, chave única nova com o sujeito
  (`nulls not distinct`), índice pelo prefixo.
- 0139 (RESTRITIVA, depois do código no ar): cai a constraint antiga. (A 1ª versão usava `drop index` e
  falhou no banco local: era constraint; corrigida antes de commitar.)
- `chaveDaCombinacao` em `previsao.ts`, usada pelo job, pelo casamento e pelos testes: uma fórmula só.
- O job registra e fecha previsões de todo ciclo, com ou sem sujeito.

**F5 · Medida (banco local):** Mel e Thor banhados nos mesmos 3 dias: 2 previsões abertas (antes: 0, o
sujeito ficava fora da trilha); a Mel volta, só a previsão dela fecha. Unidade: a visita do Thor não fecha
a previsão da Mel. Unidade 4.281; integração ciclo + recuperar + LGPD 48 de 48. A asserção da chave de
conflito no teste de unidade foi atualizada mantendo a intenção (ignorar duplicata na chave da visita).

**Ordem de deploy:** 0138 antes; o código; 0139 depois.

**Nota:** cliente 4 · segredo 8 · engenharia 9. **Próximo (C-031):** AUT-104, o pacote oficina no catálogo.
