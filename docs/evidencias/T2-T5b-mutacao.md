# T2.6/T2.7/T5b.1 · mutações das defesas novas (2026-10-08)

Commits 72f8f4da, 0dcd4aa4 e fd9b5cfc antes de mutar; cada mutação conferida por `git diff --stat`
(1 linha trocada) e desfeita com `git checkout --`; o gatilho foi religado e conferido em `pg_trigger`
(`tgenabled = O`).

| Defesa | Mutação | Resultado |
|---|---|---|
| `rotulos-batem-com-o-banco` | `'outro'` removido de `AREAS_DO_CASO` | reprovou (1) |
| `fila-de-pendencias` "nenhum botão que o servidor recusaria" | `acoesDaTela` sem o filtro de `transicionar` | reprovou (2) |
| `resumo-do-caso` "no mesmo dia, o prazo vem antes" | desempate invertido (`b.peso - a.peso`) | reprovou (1) |
| gatilho da 0110 (estágio não aprova rascunho) | `disable trigger legal_checklist_items_rascunho` no banco local | `legal-casos` reprovou (1) |
| `demo-escritorio-sanidade` | regra que encerra pendência sem resposta há mais de 75 dias trocada por `if (false)` | reprovou "a fila de pendências parece a de um escritório de verdade" |

## Acréscimo · Cliente 360 (commit e07270f7)

| Defesa | Mutação | Resultado |
|---|---|---|
| `demo-escritorio-sanidade` "caso encerrado não tem prazo aberto" | prazo contratual volta a nascer em caso concluído | reprovou (1 de 10) |
| `legal-casos` recorte por cliente | (positivo) o teste tem piso: o recorte do outro cliente precisa ter exatamente as 3 pendências do divórcio | verde com o piso conferido |
