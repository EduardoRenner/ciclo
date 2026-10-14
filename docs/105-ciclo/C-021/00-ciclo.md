# C-021 · AUT-101 parte aditiva: o sujeito do ciclo no banco

**F1 · Objetivo:** quem volta nem sempre é o cliente (pet: o animal; oficina: o carro). Criar o sujeito no
banco sem mudar nada para a beleza. Número: isolamento entre tenants, e nenhum dado pessoal do sujeito
sobrevivendo à eliminação LGPD.

**F2:** desenho e revisão adversarial do EXP-001 (C-003/02-plano.md); padrão de RLS da 0128; guardas do
projeto (`isolation`, `lgpd-cobertura`, `nunca-delete-o-que-e-historico`, `schema-esperado`).

**F3 · Plano:** 0132 = tabela `subjects` (animal | veiculo, nome, placa/microchip normalizada,
atributos, ativo) com RLS forçada, sem DELETE para o dono, placa única entre os ATIVOS, alvo composto
`(tenant_id, id)`. 0133 = `appointments.subject_id` e `ticket_items.subject_id` nuláveis, FK composta
com o tenant e `on delete set null (subject_id)`. A troca da chave de `client_cycles` fica para migration
própria (equivalente), com o código que a usa.

**F4 · O que as guardas pegaram (e o que mudou por causa delas):**
- `lgpd-cobertura`: as 4 colunas novas sem tratamento declarado. Pior: a eliminação ANONIMIZA a ficha
  (não apaga), então o `cascade` de `subjects.client_id` nunca dispararia, e o nome do animal e a placa
  sobreviveriam ao pedido de eliminação. Conserto: `TRATAMENTO_NA_ELIMINACAO.subjects` + escrita em
  `eliminarComServico` (nome e placa genéricos, atributos vazios, inativo; a linha fica para o histórico).
- `nunca-delete-o-que-e-historico`: o cascade do sujeito dividia arquivo com `appointments` (a guarda
  conta por arquivo, falso positivo assumido). Conserto: migration separada em 0132 (tabela) e 0133
  (colunas, sem cascade nenhum).
- `schema-esperado-bate-com-o-disco`: 0132 e 0133 registradas em `core/schema/versao.ts`.

**F5 · Medida (banco local):**
- `tests/rls/sujeito.test.ts` (5): RLS entre salões; FK composta recusa até o admin ligar agendamento do
  salão A ao carro do salão B (23503); dono não apaga; placa repetida entre ativos recusada (23505) e
  liberada ao inativar; remoção física do cliente mantém o agendamento com `subject_id` nulo.
- `tests/rls/isolation.test.ts`: `subjects` na lista; 220 verdes.
- `tests/integration/lgpd.test.ts`: eliminação deixa 2 sujeitos com "Eliminado", sem placa, sem
  atributos, inativos; `rowsRedacted.subjects = 2`.
- Tipos regenerados do banco local: só acréscimos.

**Ordem de deploy:** 0132 e 0133 são aditivas (antes do deploy). Nada no código lê `subjects` ainda.

**Nota:** cliente 5 · segredo 8 · engenharia 9. **Próximo (C-022):** a chave de `client_cycles` com o
sujeito (migration equivalente) + o Motor por sujeito no job (`agruparPorSujeito` do C-003), placar do
C-003 com banco; e a prova do cartão da fila no navegador a 390 px.
